import { supabase } from "../../lib/supabase";
import { getCurrentUserId } from "./socialApi.js";

const MAX_COMMENT_LENGTH = 500;
const COMMENT_MEDIA_TYPES = new Set(["text", "gif", "audio", "video"]);

export async function likeDump(dumpId) {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("likes")
    .upsert(
      { dump_id: dumpId, user_id: userId },
      { onConflict: "dump_id,user_id", ignoreDuplicates: true },
    )
    .select("dump_id,user_id")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function unlikeDump(dumpId) {
  const userId = await getCurrentUserId();
  const { error } = await supabase
    .from("likes")
    .delete()
    .eq("dump_id", dumpId)
    .eq("user_id", userId);
  if (error) throw error;
}

function normalizeCommentPayload(payload) {
  if (typeof payload === "string") {
    const text = payload.trim();
    if (!text) throw new Error("Comment cannot be empty");
    if (text.length > MAX_COMMENT_LENGTH) throw new Error(`Comment must be ${MAX_COMMENT_LENGTH} characters or fewer`);
    return {
      text,
      media_type: "text",
      media_url: null,
      media_path: null,
      media_metadata: null,
    };
  }

  const input = payload || {};
  const text = String(input.text ?? "").trim();
  const mediaType = input.media_type || (input.media_url ? "gif" : "text");

  if (!COMMENT_MEDIA_TYPES.has(mediaType)) {
    throw new Error("Unsupported comment media type");
  }
  if (text.length > MAX_COMMENT_LENGTH) {
    throw new Error(`Comment must be ${MAX_COMMENT_LENGTH} characters or fewer`);
  }
  if (mediaType === "text" && !text) {
    throw new Error("Comment cannot be empty");
  }
  if (mediaType !== "text" && !text && !input.media_url && !input.media_path) {
    throw new Error("Comment cannot be empty");
  }

  return {
    text: text || null,
    media_type: mediaType,
    media_url: input.media_url || null,
    media_path: input.media_path || null,
    media_metadata: input.media_metadata || null,
  };
}

export async function addComment(dumpId, payload) {
  const userId = await getCurrentUserId();
  const normalized = normalizeCommentPayload(payload);

  const { data, error } = await supabase
    .from("comments")
    .insert({ dump_id: dumpId, user_id: userId, ...normalized })
    .select("id,dump_id,user_id,text,media_type,media_url,media_path,media_metadata,created_at")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteComment(commentId) {
  const userId = await getCurrentUserId();
  const { error } = await supabase
    .from("comments")
    .delete()
    .eq("id", commentId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function hydrateDumpInteractions(dumps) {
  const ids = (dumps || []).map((dump) => dump.id).filter(Boolean);
  if (!ids.length) return [];

  const [likesResult, commentsResult] = await Promise.all([
    supabase.from("likes").select("dump_id,user_id").in("dump_id", ids),
    supabase
      .from("comments")
      .select("id,dump_id,user_id,text,media_type,media_url,media_path,media_metadata,created_at")
      .in("dump_id", ids)
      .order("created_at", { ascending: true }),
  ]);

  if (likesResult.error) throw likesResult.error;
  if (commentsResult.error) throw commentsResult.error;

  const commenterIds = Array.from(new Set((commentsResult.data || []).map((comment) => comment.user_id).filter(Boolean)));
  let profiles = [];
  if (commenterIds.length) {
    const { data, error } = await supabase.from("profiles").select("id,username,display_name").in("id", commenterIds);
    if (error) throw error;
    profiles = data || [];
  }

  const likesByDump = new Map();
  const likedByDump = new Set();
  const commentsByDump = new Map();
  const currentUserId = await getCurrentUserId();
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));

  for (const like of likesResult.data || []) {
    likesByDump.set(like.dump_id, (likesByDump.get(like.dump_id) || 0) + 1);
    if (like.user_id === currentUserId) likedByDump.add(like.dump_id);
  }

  for (const comment of commentsResult.data || []) {
    const list = commentsByDump.get(comment.dump_id) || [];
    const profile = profilesById.get(comment.user_id);
    list.push({
      id: comment.id,
      from: profile?.username || comment.user_id,
      displayName: profile?.display_name || "",
      text: comment.text,
      media_type: comment.media_type || (comment.text ? "text" : null),
      media_url: comment.media_url || null,
      media_path: comment.media_path || null,
      media_metadata: comment.media_metadata || null,
      created_at: comment.created_at,
    });
    commentsByDump.set(comment.dump_id, list);
  }

  return dumps.map((dump) => ({
    ...dump,
    likes: likesByDump.get(dump.id) || 0,
    liked: likedByDump.has(dump.id),
    comments: commentsByDump.get(dump.id) || [],
  }));
}
