import { supabase, createAccountClient } from "../../lib/supabase";
import { captureAuthScope } from "../../app/authScope.js";
import { mediaApi } from "../home/mediaSessionApi.js";

async function getCurrentUserId() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw error;
  if (!user) throw new Error("You must be logged in.");
  return user.id;
}

export async function getBoards() {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("boards")
    .select(
      "id,user_id,name,description,cover_url,pinned,style_config,created_at,updated_at"
    )
    .eq("user_id", userId)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getBoard(boardId) {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("boards")
    .select("*")
    .eq("id", boardId)
    .eq("user_id", userId)
    .single();

  if (error) throw error;
  return data;
}

export async function createBoard({
  name,
  description = "",
  coverUrl = "",
  pinned = false,
  styleConfig = {},
}, authScope) {
  const scope = captureAuthScope(authScope), client = createAccountClient(scope);
  const userId = await getCurrentUserId();
  scope.assertUser(userId);
  const cleanName = String(name || "").trim();

  if (!cleanName) {
    throw new Error("Board name is required.");
  }

  const payload = {
      user_id: scope.user,
      name: cleanName,
      description:
        String(description || "").trim() || null,
      cover_url:
        String(coverUrl || "").trim() || null,
      pinned: Boolean(pinned),
      style_config: styleConfig || {},
  };
  scope.assertCurrent();
  const { data, error } = await client
    .from("boards")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateBoard(
  boardId,
  updates = {},
  authScope
) {
  const scope = captureAuthScope(authScope), client = createAccountClient(scope);
  const userId = await getCurrentUserId();
  scope.assertUser(userId);
  const payload = {
    updated_at: new Date().toISOString(),
  };

  if (updates.name !== undefined) {
    const name = String(updates.name || "").trim();
    if (!name) {
      throw new Error("Board name is required.");
    }
    payload.name = name;
  }

  if (updates.description !== undefined) {
    payload.description =
      String(updates.description || "").trim() || null;
  }

  if (updates.coverUrl !== undefined) {
    payload.cover_url =
      String(updates.coverUrl || "").trim() || null;
  }

  if (updates.pinned !== undefined) {
    payload.pinned = Boolean(updates.pinned);
  }

  if (updates.styleConfig !== undefined) {
    payload.style_config = updates.styleConfig || {};
  }

  scope.assertCurrent();
  const { data, error } = await client
    .from("boards")
    .update(payload)
    .eq("id", boardId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteBoard(boardId, authScope) {
  const scope = captureAuthScope(authScope), client = createAccountClient(scope);
  const userId = await getCurrentUserId();
  scope.assertUser(userId);

  const { error } = await client
    .from("boards")
    .delete()
    .eq("id", boardId)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function getOrCreateDefaultBoard(authScope) {
  const scope = captureAuthScope(authScope), client = createAccountClient(scope);
  const userId = await getCurrentUserId();
  scope.assertUser(userId);

  const { data: existing, error } = await client
    .from("boards")
    .select("*")
    .eq("user_id", userId)
    .eq("name", "Saved")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  scope.assertCurrent();
  if (existing) return existing;

  return createBoard({
    name: "Saved",
    description: "Your saved Flic'd items",
    pinned: true,
  }, scope);
}

// Board metadata remains owner-RLS managed. Media entitlements/memberships never
// use browser Storage copies, signed URLs or direct legacy board_items writes.
function normalizeKeep(item) {
  return { ...item, dump_id: item.source_dump_id, note: item.saved_note || "",
    saved_author_username: item.source_username || "", board_ids: item.board_ids || [] };
}

export async function saveBoardItem({ dumpId, itemPosition, itemId, boardId }, authScope) {
  const scope = captureAuthScope(authScope);
  if (!Number.isInteger(itemPosition) || itemPosition < 0) throw new Error("Original photo position is required.");
  if (!dumpId) throw new Error("A Flic'd post is required.");
  const targetId = boardId || (await getOrCreateDefaultBoard(scope)).id;
  scope.assertCurrent();
  return normalizeKeep(await mediaApi.json("keeps/save", { dumpId, itemPosition, ...(itemId !== undefined ? { itemId } : {}), boardId: targetId }, { authScope: scope }));
}

export async function getBoardItems(boardId = null, authScope) {
  const scope = captureAuthScope(authScope);
  const items = (await mediaApi.json("keeps/list", {}, { authScope: scope })).map(normalizeKeep);
  scope.assertCurrent();
  return boardId ? items.filter((item) => item.board_ids.includes(boardId)) : items;
}

export const linkBoardItem = async (keepId, boardId, authScope) => mediaApi.json("keeps/link", { keepId, boardId }, { authScope: captureAuthScope(authScope) });
export const deleteBoardItem = async (keepId, boardId, authScope) => mediaApi.json("keeps/unlink", { keepId, boardId }, { authScope: captureAuthScope(authScope) });
export const removeKeep = async (keepId, authScope) => mediaApi.json("keeps/remove", { keepId }, { authScope: captureAuthScope(authScope) });
