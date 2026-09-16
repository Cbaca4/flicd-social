import { supabase } from "../../lib/supabase";

/*
 * Get the currently signed-in user's ID.
 */
async function getCurrentUserId() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!user) {
    throw new Error(
      "You must be logged in."
    );
  }

  return user.id;
}

/*
 * Get all Boards belonging to the
 * currently signed-in user.
 */
export async function getBoards() {
  const userId =
    await getCurrentUserId();

  const { data, error } =
    await supabase
      .from("boards")
      .select(
        `
        id,
        user_id,
        name,
        description,
        cover_url,
        pinned,
        style_config,
        created_at,
        updated_at
        `
      )
      .eq("user_id", userId)
      .order("pinned", {
        ascending: false,
      })
      .order("created_at", {
        ascending: true,
      });

  if (error) {
    throw error;
  }

  return data || [];
}

/*
 * Get one specific Board belonging
 * to the current user.
 */
export async function getBoard(
  boardId
) {
  const userId =
    await getCurrentUserId();

  const { data, error } =
    await supabase
      .from("boards")
      .select("*")
      .eq("id", boardId)
      .eq("user_id", userId)
      .single();

  if (error) {
    throw error;
  }

  return data;
}

/*
 * Create a new Board.
 */
export async function createBoard({
  name,
  description = "",
  coverUrl = "",
  pinned = false,
  styleConfig = {},
}) {
  const userId =
    await getCurrentUserId();

  const cleanName =
    String(name || "").trim();

  if (!cleanName) {
    throw new Error(
      "Board name is required."
    );
  }

  const { data, error } =
    await supabase
      .from("boards")
      .insert({
        user_id: userId,
        name: cleanName,
        description:
          String(
            description || ""
          ).trim() || null,
        cover_url:
          String(
            coverUrl || ""
          ).trim() || null,
        pinned: Boolean(pinned),
        style_config:
          styleConfig || {},
      })
      .select()
      .single();

  if (error) {
    throw error;
  }

  return data;
}

/*
 * Update an existing Board.
 *
 * Can update:
 * - name
 * - description
 * - cover
 * - pinned status
 * - visual customization
 */
export async function updateBoard(
  boardId,
  updates = {}
) {
  const userId =
    await getCurrentUserId();

  const payload = {
    updated_at:
      new Date().toISOString(),
  };

  /*
   * Board name
   */
  if (
    updates.name !== undefined
  ) {
    const name = String(
      updates.name || ""
    ).trim();

    if (!name) {
      throw new Error(
        "Board name is required."
      );
    }

    payload.name = name;
  }

  /*
   * Description
   */
  if (
    updates.description !==
    undefined
  ) {
    payload.description =
      String(
        updates.description || ""
      ).trim() || null;
  }

  /*
   * Cover image URL
   */
  if (
    updates.coverUrl !==
    undefined
  ) {
    payload.cover_url =
      String(
        updates.coverUrl || ""
      ).trim() || null;
  }

  /*
   * Pin / unpin
   */
  if (
    updates.pinned !==
    undefined
  ) {
    payload.pinned =
      Boolean(updates.pinned);
  }

  /*
   * Board visual customization.
   */
  if (
    updates.styleConfig !==
    undefined
  ) {
    payload.style_config =
      updates.styleConfig || {};
  }

  const { data, error } =
    await supabase
      .from("boards")
      .update(payload)
      .eq("id", boardId)
      .eq("user_id", userId)
      .select()
      .single();

  if (error) {
    throw error;
  }

  return data;
}

/*
 * Delete a Board.
 *
 * Board items connected to it are
 * removed automatically by the
 * database relationship.
 */
export async function deleteBoard(
  boardId
) {
  const userId =
    await getCurrentUserId();

  const { error } =
    await supabase
      .from("boards")
      .delete()
      .eq("id", boardId)
      .eq("user_id", userId);

  if (error) {
    throw error;
  }
}

/*
 * Get the user's default Saved Board.
 *
 * If one does not exist, create it.
 */
export async function getOrCreateDefaultBoard() {
  const userId =
    await getCurrentUserId();

  const {
    data: existing,
    error,
  } = await supabase
    .from("boards")
    .select("*")
    .eq("user_id", userId)
    .eq("name", "Saved")
    .order("created_at", {
      ascending: true,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (existing) {
    return existing;
  }

  return createBoard({
    name: "Saved",
    description:
      "Your saved Flic'd items",
    pinned: true,
  });
}

/*
 * Save an individual item to a Board.
 */
export async function saveBoardItem({
  dumpId,
  itemPosition,
  note = "",
  mood = "",
  boardId,
}) {
  const userId =
    await getCurrentUserId();

  /*
   * Use the selected Board when supplied.
   * Otherwise use the default Saved Board.
   */
  const targetBoard = boardId
    ? await getBoard(boardId)
    : await getOrCreateDefaultBoard();

  const { data, error } =
    await supabase
      .from("board_items")
      .upsert(
        {
          user_id: userId,
          board_id:
            targetBoard.id,
          dump_id: dumpId,
          item_position:
            itemPosition,
          note,
          mood,
        },
        {
          onConflict:
            "user_id,board_id,dump_id,item_position",
        }
      )
      .select()
      .single();

  if (error) {
    throw error;
  }

  return data;
}

/*
 * Get all saved items for the user.
 *
 * Supplying boardId limits the results
 * to one specific Board.
 */
export async function getBoardItems(
  boardId = null
) {
  const userId =
    await getCurrentUserId();

  let query = supabase
    .from("board_items")
    .select(
      `
      id,
      user_id,
      board_id,
      dump_id,
      item_position,
      note,
      mood,
      created_at
      `
    )
    .eq("user_id", userId)
    .order("created_at", {
      ascending: false,
    });

  if (boardId) {
    query = query.eq(
      "board_id",
      boardId
    );
  }

  const { data, error } =
    await query;

  if (error) {
    throw error;
  }

  return data || [];
}

/*
 * Move an existing saved item
 * from one Board to another.
 */
export async function moveBoardItem(
  boardItemId,
  boardId
) {
  const userId =
    await getCurrentUserId();

  /*
   * Make sure the destination
   * Board belongs to this user.
   */
  const targetBoard =
    await getBoard(boardId);

  const { data, error } =
    await supabase
      .from("board_items")
      .update({
        board_id:
          targetBoard.id,
      })
      .eq("id", boardItemId)
      .eq("user_id", userId)
      .select()
      .single();

  if (error) {
    throw error;
  }

  return data;
}

/*
 * Remove a saved item from a Board.
 */
export async function deleteBoardItem(
  boardItemId
) {
  const userId =
    await getCurrentUserId();

  const { error } =
    await supabase
      .from("board_items")
      .delete()
      .eq("id", boardItemId)
      .eq("user_id", userId);

  if (error) {
    throw error;
  }
}