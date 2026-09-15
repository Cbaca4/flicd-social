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
    throw new Error("You must be logged in to post.");
  }

  return user.id;
}

export async function createDump({
  type = "dump",
  spaceId,
  mood,
  expiry,
  context = null,
  frameCount = null,
  items = [],
}) {
  const userId = await getCurrentUserId();

  const { data: dump, error: dumpError } = await supabase
    .from("dumps")
    .insert({
      user_id: userId,
      space_id: spaceId,
      type,
      mood,
      expiry,
      context,
      frame_count: frameCount,
    })
    .select()
    .single();

  if (dumpError) {
    throw dumpError;
  }

  if (items.length > 0) {
    const dumpItems = items.map((item, index) => ({
      dump_id: dump.id,
      position: index,
      note: item.note || "",
      image_path: item.imagePath || null,
    }));

    const { error: itemsError } = await supabase
      .from("dump_items")
      .insert(dumpItems);

    if (itemsError) {
      // Clean up the parent dump if its items failed to save.
      await supabase.from("dumps").delete().eq("id", dump.id);
      throw itemsError;
    }
  }

  return dump;
}
export async function getDumps() {
  const { data, error } = await supabase
    .from("dumps")
    .select(`
      *,
      dump_items (
        id,
        position,
        note,
        image_path
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}