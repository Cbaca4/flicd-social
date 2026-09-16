import { supabase } from "../../lib/supabase";
import { getCurrentUserId } from "./socialApi.js";

const MAX_COMMENT_LENGTH = 500;

export async function likeDump(dumpId) {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("likes")
    .upsert({ dump_id: dumpId, user_id: userId }, { onConflict: "dump_id,user_id" })
    .select("dump_id,user_id")
    .single();
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

export async function addComment(dumpId, text) {
  const userId = await getCurrentUserId();
  const cleanText = String(text ?? "").trim();
  if (!cleanText) throw new Error("Comment cannot be empty");
  if (cleanText.length > MAX_COMMENT_LENGTH) throw new Error(`Comment must be ${MAX_COMMENT_LENGTH} characters or fewer`);

  const { data, error } = await supabase
    .from("comments")
    .insert({ dump_id: dumpId, user_id: userId, text: cleanText })
    .select("id,dump_id,user_id,text,created_at")
    .single();
  if (error) throw error;
  return data;
}

export async function hydrateDumpInteractions(dumps) {
  const ids = (dumps || []).map((dump) => dump.id).filter(Boolean);
  if (!ids.length) return [];

  const [likesResult, commentsResult] = await Promise.all([
    supabase.from("likes").select("dump_id,user_id").in("dump_id", ids),
    supabase.from("comments").select("id,dump_id,user_id,text,created_at").in("dump_id", ids).order("created_at", { ascending: true }),
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
