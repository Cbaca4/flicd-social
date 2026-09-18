import { supabase } from "../../lib/supabase";

export async function getNotifications({ limit = 50 } = {}) {
  const { data, error } = await supabase
    .from("notifications")
    .select(`
      id,
      type,
      body,
      dump_id,
      created_at,
      read_at,
      actor:actor_id (
        id,
        username,
        display_name,
        avatar_url
      )
    `)
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 100)));

  if (error) throw error;
  return data || [];
}

export async function getUnreadNotificationCount() {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);

  if (error) throw error;
  return count || 0;
}

export async function markNotificationRead(id) {
  if (!id) return;
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

export async function markAllNotificationsRead() {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);

  if (error) throw error;
}
