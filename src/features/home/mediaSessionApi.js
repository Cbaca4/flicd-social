import { supabase } from "../../lib/supabase";
import { captureAuthScope } from "../../app/authScope.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const activePages = new Set();
const freshSecret = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("");

// Capabilities live only in closures. Never persist them in storage, URLs or cookies.
export function createMediaApi({ origin, getSession, fetchImpl = fetch, objectUrls = URL }) {
  const endpoint = (route) => {
    if (!origin) throw new Error("Media gateway is not configured.");
    const base = new URL(origin);
    if (base.username || base.password || base.search || base.hash || base.pathname !== "/" ||
      (base.protocol !== "https:" && !(base.protocol === "http:" && ["127.0.0.1", "localhost"].includes(base.hostname)))) {
      throw new Error("Invalid media gateway origin.");
    }
    return base.origin + "/media/" + route;
  };
  const request = async (route, body, { binary = false, keepalive = false, authScope, isCurrent } = {}) => {
    const target = endpoint(route);
    const scope = captureAuthScope(authScope, isCurrent);
    const session = await getSession();
    scope.assertCurrent();
    scope.assertSession(session);
    const token = session?.access_token;
    if (!token) throw new Error("You must be logged in.");
    const payload = JSON.stringify(body);
    scope.assertCurrent();
    const response = await fetchImpl(target, {
      method: "POST", credentials: "omit", redirect: "error", cache: "no-store", referrerPolicy: "no-referrer", keepalive,
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: payload,
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw Object.assign(new Error(result.error || "Media request failed."), { status: response.status });
    }
    return { data: binary ? await response.blob() : await response.json(), token };
  };
  const json = async (route, body, options) => (await request(route, body, options)).data;
  return {
    json,
    blob: async (route, body, options) => (await request(route, body, { ...options, binary: true })).data,
    // Owners use a separate server-authorized route, not a View Once claim.
    // Every page owns short-lived blob URLs; none survive navigation or sign-out.
    createOwnerSession(items, { authScope } = {}) {
      const scope = captureAuthScope(authScope);
      const ids = Array.isArray(items) ? items.map(item => item?.id) : [];
      if (!ids.length || ids.some(id => !UUID.test(id)) || new Set(ids).size !== ids.length) {
        throw new Error("Valid original photo identities are required.");
      }
      let closed = false, frameUrls = null, pending = null;
      const urls = new Set();
      const revoke = () => { for (const url of urls) objectUrls.revokeObjectURL(url); urls.clear(); frameUrls = null; };
      const pagehide = () => { void page.close(); };
      const page = {
        get closed() { return closed; },
        async loadFrames() {
          if (closed || !scope.isCurrent()) throw new Error("This viewing session has ended.");
          if (frameUrls) return frameUrls;
          if (pending) return pending;
          pending = (async () => {
            const created = [];
            const results = await Promise.allSettled(ids.map(async (itemId) => {
              const result = await request("owner/frame", { itemId }, { binary: true, authScope: scope, isCurrent: () => !closed });
              if (closed || !scope.isCurrent()) throw new Error("This viewing session has ended.");
              const url = objectUrls.createObjectURL(result.data);
              urls.add(url); created.push(url);
              return url;
            }));
            const failure = results.find(result => result.status === "rejected");
            if (failure || closed || !scope.isCurrent()) {
              for (const url of created) { objectUrls.revokeObjectURL(url); urls.delete(url); }
              throw failure?.reason || new Error("This viewing session has ended.");
            }
            frameUrls = results.map(result => result.value);
            return frameUrls;
          })().finally(() => { pending = null; });
          return pending;
        },
        async close() {
          if (closed) return;
          closed = true;
          revoke();
          activePages.delete(page);
          if (typeof window !== "undefined") window.removeEventListener("pagehide", pagehide);
        },
      };
      activePages.add(page);
      if (typeof window !== "undefined") window.addEventListener("pagehide", pagehide);
      return page;
    },
    createOnceSession(dumpId, { onEnded = () => {}, authScope } = {}) {
      const scope = captureAuthScope(authScope);
      const pageSecret = freshSecret(), attemptId = crypto.randomUUID();
      let receipt = null, closed = false, claimPending = null, framesPending = null, frameUrls = null, timer = null, lastToken = null;
      const urls = new Set();
      const revoke = () => { for (const url of urls) objectUrls.revokeObjectURL(url); urls.clear(); frameUrls = null; };
      const body = () => ({ claimId: receipt.claim_id, pageSecret });
      const options = () => ({ authScope: scope, isCurrent: () => !closed });
      const sendClose = async () => {
        // Retirement is the only operation allowed after close/invalidation.
        // It uses ONLY the verified original dispatch credential, never a new
        // getSession() result. Closing never refunds permanent consumption.
        if (receipt && lastToken) await fetchImpl(endpoint("once/close"), {
          method: "POST", credentials: "omit", redirect: "error", cache: "no-store", referrerPolicy: "no-referrer", keepalive: true,
          headers: { Authorization: "Bearer " + lastToken, "Content-Type": "application/json" }, body: JSON.stringify(body()),
        }).catch(() => {});
      };
      const finish = async (notify = true) => {
        if (closed) return;
        closed = true;
        clearInterval(timer); revoke(); activePages.delete(page);
        if (typeof window !== "undefined") window.removeEventListener("pagehide", pagehide);
        onEnded();
        if (notify) await sendClose();
      };
      const pagehide = () => { void finish(); };
      const page = {
        get committed() { return Boolean(receipt); },
        get closed() { return closed; },
        async claim() {
          if (closed) throw new Error("This viewing session has ended.");
          if (claimPending) return claimPending;
          activePages.add(page);
          if (typeof window !== "undefined") window.addEventListener("pagehide", pagehide);
          claimPending = (async () => {
            try {
              const result = await request("once/claim", { dumpId, attemptId, pageSecret }, options());
              const grant = result.data;
              if (!["claimed", "recovered"].includes(grant?.status) || grant.dump_id !== dumpId || !UUID.test(grant.claim_id) || !Array.isArray(grant.items) || !grant.items.length ||
                grant.items.some(item => !UUID.test(item?.id) || !Number.isInteger(item.position) || item.position < 0) ||
                new Set(grant.items.map(item => item.id)).size !== grant.items.length || new Set(grant.items.map(item => item.position)).size !== grant.items.length) {
                throw new Error("View acknowledgement was not confirmed.");
              }
              receipt = grant; lastToken = result.token;
              if (closed || !scope.isCurrent()) { await sendClose(); throw new Error("This viewing session has ended."); }
              if (!timer) timer = setInterval(() => {
                request("once/heartbeat", body(), options()).then((value) => { lastToken = value.token; }).catch(() => { void finish(false); });
              }, 30000);
              return receipt;
            } catch (error) {
              if (!scope.isCurrent() || [401, 403, 409].includes(error.status)) await finish(false);
              throw error;
            } finally { claimPending = null; }
          })();
          return claimPending;
        },
        async loadFrames() {
          if (!receipt || closed) throw new Error("An active confirmed claim is required.");
          if (frameUrls) return frameUrls;
          if (framesPending) return framesPending;
          framesPending = (async () => {
            const created = [];
            const results = await Promise.allSettled(receipt.items.map(async (item) => {
              const result = await request("once/frame", { ...body(), itemId: item.id }, { ...options(), binary: true });
              lastToken = result.token;
              if (closed || !scope.isCurrent()) throw new Error("This viewing session has ended.");
              const url = objectUrls.createObjectURL(result.data); urls.add(url); created.push(url); return url;
            }));
            const failure = results.find((result) => result.status === "rejected");
            if (failure || closed) {
              for (const url of created) { objectUrls.revokeObjectURL(url); urls.delete(url); }
              if ([401, 403, 409].includes(failure?.reason?.status)) await finish(false);
              throw failure?.reason || new Error("This viewing session has ended.");
            }
            frameUrls = results.map((result) => result.value);
            return frameUrls;
          })().finally(() => { framesPending = null; });
          return framesPending;
        },
        close: () => finish(),
      };
      return page;
    },
  };
}

export const isMediaGatewayConfigured = () => Boolean(import.meta.env.VITE_MEDIA_GATEWAY_URL);
export const mediaApi = createMediaApi({
  origin: import.meta.env.VITE_MEDIA_GATEWAY_URL || "",
  getSession: async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data?.session || null;
  },
});
export const createOwnerMediaSession = (items, options) => mediaApi.createOwnerSession(items, options);
export const createOnceMediaSession = (dumpId, options) => mediaApi.createOnceSession(dumpId, options);
export const closeAllMediaSessions = () => Promise.allSettled(Array.from(activePages, (page) => page.close()));
