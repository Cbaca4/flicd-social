/**
 * Localhost-only flic'd staging media gateway preview.
 * DO NOT deploy this script on a public server or forward its TCP port.
 * See docs/media-gateway-deployment-contract.md for required hosted controls.
 * Run with: node --env-file=.env.gateway scripts/run-local-staging-media-gateway.mjs
 */
import http from 'node:http';
import { createClient } from '@supabase/supabase-js';
import { createMediaGateway } from '../server/media/gateway.mjs';
import { createSupabaseMediaAdapters } from '../server/media/supabaseAdapter.mjs';

const STAGING_URL = 'https://ljcfoanzmowgkjtrdcgg.supabase.co';
const HOST = '127.0.0.1';
const PORT = 8787;
const MAX_BODY_BYTES = 8192;
const FRONTEND_ORIGINS = [
  'http://127.0.0.1:5173',
  'http://localhost:5173',
];

if (process.env.NODE_ENV === 'production') {
  throw new Error('This local-only staging harness must not run in production.');
}
if (process.env.FLICD_STAGING_SUPABASE_URL && process.env.FLICD_STAGING_SUPABASE_URL !== STAGING_URL) {
  throw new Error('Refusing to connect a local staging gateway to a different Supabase project.');
}
const serviceRoleKey = process.env.FLICD_STAGING_SERVICE_ROLE_KEY;
if (!serviceRoleKey || serviceRoleKey.startsWith('sb_publishable_')) {
  throw new Error('Set FLICD_STAGING_SERVICE_ROLE_KEY privately in .env.gateway (never VITE_*).');
}

const client = createClient(STAGING_URL, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const { authorize, repository, storage } = createSupabaseMediaAdapters({ client });
const gateway = createMediaGateway({ authorize, repository, storage, allowedOrigins: FRONTEND_ORIGINS });

const sendError = (res, status, reason) => {
  if (res.headersSent || res.destroyed) return;
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'private, no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify({ error: reason }));
};

let inflight = 0;
const server = http.createServer(async (req, res) => {
  if (req.socket.remoteAddress !== HOST && req.socket.remoteAddress !== '::ffff:' + HOST) {
    sendError(res, 403, 'local_only');
    return;
  }
  if (req.headers.host !== HOST + ':' + PORT) {
    sendError(res, 403, 'invalid_host');
    return;
  }
  if (!FRONTEND_ORIGINS.includes(req.headers.origin)) {
    sendError(res, 403, 'origin_denied');
    return;
  }
  if (req.method !== 'POST' && req.method !== 'OPTIONS') {
    sendError(res, 405, 'method_not_allowed');
    return;
  }
  if (typeof req.url !== 'string' || !req.url.startsWith('/media/') || req.url.includes('?') || req.url.includes('#')) {
    sendError(res, 404, 'not_found');
    return;
  }
  if (req.rawHeaders.length > 64 ||
      typeof req.headers.authorization === 'string' && req.headers.authorization.length > 8192 ||
      req.headers['content-encoding'] ||
      (req.headers['transfer-encoding'] && req.headers['content-length'])) {
    sendError(res, 400, 'invalid_request');
    return;
  }
  const declaredLength = Number(req.headers['content-length']);
  if (req.headers['content-length'] !== undefined && (!Number.isSafeInteger(declaredLength) || declaredLength < 0 || declaredLength > MAX_BODY_BYTES)) {
    sendError(res, 413, 'request_too_large');
    return;
  }
  if (req.method === 'POST' && !String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
    sendError(res, 415, 'unsupported_media_type');
    return;
  }
  if (inflight >= 4) {
    sendError(res, 503, 'local_gateway_busy');
    return;
  }
  inflight += 1;
  try {
    const chunks = [];
    let total = 0;
    for await (const chunk of req) {
      total += chunk.byteLength;
      if (total > MAX_BODY_BYTES) {
        sendError(res, 413, 'request_too_large');
        return;
      }
      chunks.push(chunk);
    }
    const wrapped = new Request('http://' + HOST + ':' + PORT + req.url, {
      method: req.method,
      headers: req.headers,
      ...(req.method === 'POST' ? { body: Buffer.concat(chunks) } : {}),
    });
    const result = await gateway(wrapped);
    if (res.destroyed || res.writableEnded) return;
    res.writeHead(result.status, Object.fromEntries(result.headers.entries()));
    res.end(Buffer.from(await result.arrayBuffer()));
  } catch {
    // Never include tokens, SQL, upstream response bodies or object paths in logs.
    sendError(res, 503, 'gateway_unavailable');
  } finally {
    inflight -= 1;
  }
});
server.maxHeadersCount = 32;
server.headersTimeout = 5000;
server.requestTimeout = 10000;
server.keepAliveTimeout = 2000;
server.listen(PORT, HOST, () => {
  console.log("Flic'd local staging media gateway at http://" + HOST + ':' + PORT);
  console.log('Loopback-only preview; do not expose the port or deploy this script.');
});
