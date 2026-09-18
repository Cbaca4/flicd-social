import { supabase } from "../../lib/supabase";
import { MEDIA_BUCKET } from "../capture/mediaUpload.js";

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
}) {
  const userId = await getCurrentUserId();
  const cleanName = String(name || "").trim();

  if (!cleanName) {
    throw new Error("Board name is required.");
  }

  const { data, error } = await supabase
    .from("boards")
    .insert({
      user_id: userId,
      name: cleanName,
      description:
        String(description || "").trim() || null,
      cover_url:
        String(coverUrl || "").trim() || null,
      pinned: Boolean(pinned),
      style_config: styleConfig || {},
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateBoard(
  boardId,
  updates = {}
) {
  const userId = await getCurrentUserId();
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

  const { data, error } = await supabase
    .from("boards")
    .update(payload)
    .eq("id", boardId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteBoard(boardId) {
  const userId = await getCurrentUserId();

  const { error } = await supabase
    .from("boards")
    .delete()
    .eq("id", boardId)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function getOrCreateDefaultBoard() {
  const userId = await getCurrentUserId();

  const { data: existing, error } = await supabase
    .from("boards")
    .select("*")
    .eq("user_id", userId)
    .eq("name", "Saved")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (existing) return existing;

  return createBoard({
    name: "Saved",
    description: "Your saved Flic'd items",
    pinned: true,
  });
}

async function snapshotBoardImage(sourcePath, userId, boardId, dumpId, itemPosition) {
  if (!sourcePath) return null;

  const { data: file, error: downloadError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .download(sourcePath);

  if (downloadError) throw downloadError;
  if (!file) throw new Error("Could not read the source image.");

  const extension = String(sourcePath)
    .split("?")[0]
    .split(".")
    .pop()
    ?.replace(/[^a-z0-9]/gi, "")
    .toLowerCase() || "jpg";

  const snapshotPath =
    userId + "/boards/" + boardId + "/" + dumpId + "-" + itemPosition + "." + extension;

  const { data, error: uploadError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(snapshotPath, file, {
      cacheControl: "31536000",
      contentType: file.type || "image/jpeg",
      upsert: true,
    });

  if (uploadError) throw uploadError;
  return data?.path || snapshotPath;
}

export async function saveBoardItem({
  dumpId,
  itemPosition,
  note = "",
  mood = "",
  boardId,
}) {
  const userId = await getCurrentUserId();
  const targetBoard = boardId
    ? await getBoard(boardId)
    : await getOrCreateDefaultBoard();

  if (!dumpId) throw new Error("A Flic'd post is required.");

  const { data: sourceDump, error: sourceError } = await supabase
    .from("dumps")
    .select("id,user_id,expiry,created_at,allow_others_to_keep,dump_items(id,position,image_path,note,mood)")
    .eq("id", dumpId)
    .single();

  if (sourceError) throw sourceError;

  if (
    sourceDump.user_id !== userId &&
    !sourceDump.allow_others_to_keep
  ) {
    throw new Error("The owner does not allow this Flic'd to be kept.");
  }

  if (sourceDump.expiry !== "24h" && sourceDump.user_id !== userId) {
    throw new Error("View once Flic'ds cannot be kept.");
  }

  if (
    sourceDump.user_id !== userId &&
    new Date(sourceDump.created_at || 0).getTime() <= Date.now() - 24 * 60 * 60 * 1000
  ) {
    throw new Error("That Flic'd has expired.");
  }

  const sourceItem = (sourceDump.dump_items || []).find(
    (item) => Number(item.position) === Number(itemPosition),
  );

  if (!sourceItem) throw new Error("That saved moment is no longer available.");

  const { data: existingItem } = await supabase
    .from("board_items")
    .select("id,saved_image_path")
    .eq("user_id", userId)
    .eq("board_id", targetBoard.id)
    .eq("dump_id", dumpId)
    .eq("item_position", itemPosition)
    .maybeSingle();

  const savedImagePath =
    existingItem?.saved_image_path ||
    await snapshotBoardImage(
      sourceItem.image_path,
      userId,
      targetBoard.id,
      dumpId,
      itemPosition,
    );

  let sourceUsername = "";
  const { data: sourceProfile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", sourceDump.user_id)
    .maybeSingle();
  sourceUsername = sourceProfile?.username || "";

  const { data, error } = await supabase
    .from("board_items")
    .upsert(
      {
        user_id: userId,
        board_id: targetBoard.id,
        dump_id: dumpId,
        item_position: itemPosition,
        note: note || sourceItem.note || "",
        mood: mood || sourceItem.mood || "",
        saved_image_path: savedImagePath,
        saved_author_username: sourceUsername || null,
      },
      {
        onConflict: "user_id,board_id,dump_id,item_position",
      }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getBoardItems(boardId = null) {
  const userId = await getCurrentUserId();

  let query = supabase
    .from("board_items")
    .select(
      "id,user_id,board_id,dump_id,item_position,note,mood,saved_image_path,saved_author_username,created_at"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (boardId) {
    query = query.eq("board_id", boardId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

export async function moveBoardItem(
  boardItemId,
  boardId
) {
  const userId = await getCurrentUserId();
  const targetBoard = await getBoard(boardId);

  const { data, error } = await supabase
    .from("board_items")
    .update({ board_id: targetBoard.id })
    .eq("id", boardItemId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteBoardItem(boardItemId) {
  const userId = await getCurrentUserId();

  const { data: item, error: readError } = await supabase
    .from("board_items")
    .select("id,saved_image_path")
    .eq("id", boardItemId)
    .eq("user_id", userId)
    .maybeSingle();

  if (readError) throw readError;

  const { error } = await supabase
    .from("board_items")
    .delete()
    .eq("id", boardItemId)
    .eq("user_id", userId);

  if (error) throw error;

  if (item?.saved_image_path) {
    const { error: removeError } = await supabase.storage
      .from(MEDIA_BUCKET)
      .remove([item.saved_image_path]);
    if (removeError) console.error("Failed to remove Board snapshot:", removeError);
  }
}
