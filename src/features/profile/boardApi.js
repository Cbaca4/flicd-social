import { supabase } from "../../lib/supabase";

async function getCurrentUserId() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!user) {
    throw new Error("You must be logged in.");
  }

  return user.id;
}

export async function saveBoardItem({
  dumpId,
  itemPosition,
  note = "",
  mood = "",
}) {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("board_items")
    .upsert(
      {
        user_id: userId,
        dump_id: dumpId,
        item_position: itemPosition,
        note,
        mood,
      },
      {
        onConflict: "user_id,dump_id,item_position",
      }
    )
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getBoardItems() {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("board_items")
    .select(`
      id,
      dump_id,
      item_position,
      note,
      mood,
      created_at
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}

export async function deleteBoardItem(boardItemId) {
  const userId = await getCurrentUserId();

  const { error } = await supabase
    .from("board_items")
    .delete()
    .eq("id", boardItemId)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}