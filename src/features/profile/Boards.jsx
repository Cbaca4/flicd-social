import React from "react";
import {
  ArrowLeft,
  Pin,
  Plus,
  Settings,
  Trash2,
  Copy,
} from "lucide-react";
import {
  createBoard,
  deleteBoard,
  deleteBoardItem,
  getBoardItems,
  getBoards,
  saveBoardItem,
  updateBoard,
} from "./boardApi";
import BoardStudio from "./BoardStudio";
import {
  canPinBoard,
  countPinnedBoards,
  MAX_PINNED_BOARDS,
} from "./boardPinning";

function boardStyle(board) {
  const style = board?.style_config || {};
  return {
    "--board-bg": style.background || "#111111",
    "--board-accent": style.accent || "#ff72b6",
    "--board-border": style.border || "#ffffff",
    "--board-border-width": `${Number(style.borderWidth ?? 1)}px`,
    "--board-radius": `${Number(style.radius ?? 24)}px`,
  };
}

function BoardCard({
  board,
  itemCount,
  onOpen,
  onTogglePin,
  onCustomize,
  onDelete,
}) {
  const style = board?.style_config || {};

  return (
    <div
      className="card"
      style={{
        ...boardStyle(board),
        borderColor: style.border || undefined,
        borderWidth:
          style.borderWidth !== undefined
            ? `${style.borderWidth}px`
            : undefined,
        borderRadius:
          style.radius !== undefined
            ? `${style.radius}px`
            : undefined,
        background:
          style.background || undefined,
      }}
    >
      <button
        type="button"
        onClick={() => onOpen(board)}
        style={{
          width: "100%",
          textAlign: "left",
          background: "transparent",
          border: 0,
          padding: 0,
          color: "inherit",
          cursor: "pointer",
        }}
      >
        <div
          className="board-cover"
          style={{
            overflow: "hidden",
            borderRadius:
              style.radius !== undefined
                ? `${Math.max(8, Number(style.radius) - 6)}px`
                : undefined,
            border:
              style.borderWidth > 0
                ? `${style.borderWidth}px solid ${style.border}`
                : undefined,
          }}
        >
          {board.cover_url ? (
            <img
              src={board.cover_url}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : null}

          {board.pinned && (
            <span
              className="tag"
              style={{
                position: "absolute",
                right: 9,
                top: 9,
                color:
                  style.accent || undefined,
              }}
            >
              <Pin size={12} />
            </span>
          )}

          {style.showItemCount !== false && (
            <span
              className="tag"
              style={{
                position: "absolute",
                left: 9,
                bottom: 9,
              }}
            >
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </span>
          )}
        </div>

        <div style={{ marginTop: 10 }}>
          <strong>{board.name}</strong>

          {style.showDescription !== false && (
            <p
              className="subtitle"
              style={{ marginTop: 3 }}
            >
              {board.description ||
                "Your saved moments"}
            </p>
          )}
        </div>
      </button>

      <div
        className="row"
        style={{
          gap: 6,
          marginTop: 12,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          className="btn"
          onClick={() => onOpen(board)}
        >
          Open
        </button>

        <button
          type="button"
          className="btn"
          onClick={() => onTogglePin(board)}
        >
          <Pin size={14} />
          {board.pinned ? "Unpin" : "Pin"}
        </button>

        <button
          type="button"
          className="btn"
          onClick={() => onCustomize(board)}
        >
          <Settings size={14} />
          Customize
        </button>

        <button
          type="button"
          className="btn icon-btn"
          onClick={() => onDelete(board)}
          title="Delete Board"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

function BoardDetail({
  board,
  boards,
  items,
  dumps,
  onBack,
  onDeleteItem,
  onAddExistingItem,
}) {
  const style = board?.style_config || {};
  const columns = Math.min(
    4,
    Math.max(2, Number(style.columns || 3))
  );

  const resolvedItems = items.map((item) => ({
    ...item,
    dump: dumps.find((dump) => dump.id === item.dump_id) || null,
  }));

  const gridColumns =
    columns === 4
      ? "repeat(4,minmax(0,1fr))"
      : columns === 2
      ? "repeat(2,minmax(0,1fr))"
      : "repeat(3,minmax(0,1fr))";

  return (
    <div className="stack">
      <div
        className="row"
        style={{
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div className="row">
          <button
            type="button"
            className="btn icon-btn"
            onClick={onBack}
            aria-label="Back to Boards"
          >
            <ArrowLeft size={18} />
          </button>

          <div style={{ marginLeft: 10 }}>
            <div className="eyebrow">
              Board
            </div>
            <h1
              className="title"
              style={{ marginTop: 3 }}
            >
              {board.name}
            </h1>
          </div>
        </div>

        <span className="tag">
          <Pin size={12} /> {board.pinned ? "Pinned" : "Board"}
        </span>
      </div>

      {board.description && (
        <p className="subtitle">
          {board.description}
        </p>
      )}

      <div
        className="row"
        style={{
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          className="btn btn-primary"
          onClick={onAddExistingItem}
        >
          <Copy size={15} />
          Add saved items
        </button>

        <span className="subtitle">
          {resolvedItems.length} saved {resolvedItems.length === 1 ? "item" : "items"}
        </span>
      </div>

      {resolvedItems.length === 0 ? (
        <div
          className="card"
          style={{
            padding: 40,
            textAlign: "center",
            background:
              style.background || undefined,
            borderColor:
              style.border || undefined,
            borderWidth:
              style.borderWidth !== undefined
                ? `${style.borderWidth}px`
                : undefined,
            borderRadius:
              style.radius !== undefined
                ? `${style.radius}px`
                : undefined,
          }}
        >
          <strong>
            Nothing saved here yet.
          </strong>
          <p
            className="subtitle"
            style={{ marginTop: 5 }}
          >
            Add an existing Keep or use Keep on a post and place it here.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: gridColumns,
            gap: 12,
          }}
        >
          {resolvedItems.map((item) => {
            const dump = item.dump;
            const frame = dump?.items?.[item.item_position];
            const imagePath = frame?.imagePath || item.saved_image_path || null;
            const mood = item.mood || dump?.mood || "Saved";
            const note = item.note || frame?.note || "";
            
            return (
              <div
                key={item.id}
                className="card"
                style={{
                  padding: 10,
                  background:
                    style.background || undefined,
                  borderColor:
                    style.border || undefined,
                  borderWidth:
                    style.borderWidth !== undefined
                      ? `${style.borderWidth}px`
                      : undefined,
                  borderRadius:
                    style.radius !== undefined
                      ? `${style.radius}px`
                      : undefined,
                  boxShadow:
                    style.cardStyle === "glass"
                      ? "0 18px 45px rgba(0,0,0,.16), inset 0 1px 0 rgba(255,255,255,.08)"
                      : style.cardStyle === "minimal"
                      ? "none"
                      : "0 12px 30px rgba(0,0,0,.12)",
                }}
              >
                <div
                  className="board-cover"
                  style={{
                    overflow: "hidden",
                    borderRadius:
                      style.radius !== undefined
                        ? `${Math.max(8, Number(style.radius) - 6)}px`
                        : undefined,
                  }}
                >
                  {imagePath ? (
                    <img
                      src={imagePath}
                      alt=""
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "grid",
                        placeItems: "center",
                        opacity: 0.35,
                        fontSize: 12,
                      }}
                    >
                      Saved Flic'd
                    </div>
                  )}
                </div>

                <div
                  className="row"
                  style={{
                    justifyContent:
                      "space-between",
                    gap: 8,
                    marginTop: 8,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <p className="subtitle">
                      {mood}
                    </p>

                    {note && (
                      <strong
                        style={{
                          display: "block",
                          marginTop: 3,
                        }}
                      >
                        {item.note}
                      </strong>
                    )}
                  </div>

                  <button
                    type="button"
                    className="btn icon-btn"
                    onClick={() =>
                      onDeleteItem(item.id)
                    }
                    title="Remove item"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AddItemsModal({
  board,
  keptItems,
  onClose,
  onAdd,
}) {
  const [selected, setSelected] = React.useState(
    new Set()
  );

  const existingKeys = new Set(
    board.currentItems.map(
      (item) =>
        `${item.dump_id}:${item.item_position}`
    )
  );

  const available = keptItems.filter(
    (item) =>
      !existingKeys.has(
        `${item.dumpId}:${item.seed}`
      )
  );

  function toggle(key) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="modal-backdrop">
      <div
        className="modal"
        style={{
          maxWidth: 620,
          width: "100%",
          maxHeight: "85vh",
          overflowY: "auto",
        }}
      >
        <div
          className="row"
          style={{
            justifyContent: "space-between",
          }}
        >
          <div>
            <div className="eyebrow">
              Add to {board.name}
            </div>
            <h2 style={{ marginTop: 4 }}>
              Choose saved items
            </h2>
          </div>

          <button
            type="button"
            className="btn icon-btn"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {available.length === 0 ? (
          <div
            className="card"
            style={{
              marginTop: 16,
              padding: 28,
              textAlign: "center",
            }}
          >
            <strong>
              No available saved items.
            </strong>
            <p
              className="subtitle"
              style={{ marginTop: 5 }}
            >
              Save some posts first, or this Board already contains your Keeps.
            </p>
          </div>
        ) : (
          <div
            className="stack"
            style={{ marginTop: 16 }}
          >
            {available.map((item) => {
              const key = `${item.dumpId}:${item.seed}`;
              const checked = selected.has(key);

              return (
                <button
                  key={key}
                  type="button"
                  className="card"
                  style={{
                    textAlign: "left",
                    borderColor:
                      checked
                        ? "var(--accent, #ff72b6)"
                        : undefined,
                  }}
                  onClick={() => toggle(key)}
                >
                  <div className="row">
                    <input
                      type="checkbox"
                      checked={checked}
                      readOnly
                    />

                    <div style={{ flex: 1 }}>
                      <strong>
                        {item.note ||
                          item.mood ||
                          "Saved Flic'd"}
                      </strong>
                      <p className="subtitle">
                        {item.author || "Saved item"}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div
          className="row"
          style={{
            justifyContent: "flex-end",
            gap: 8,
            marginTop: 16,
          }}
        >
          <button
            type="button"
            className="btn"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!selected.size}
            onClick={() =>
              onAdd(Array.from(selected))
            }
          >
            Add {selected.size || ""} item{selected.size === 1 ? "" : "s"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Boards({
  dumps = [],
  keptItems = [],
  onBack,
  onToast,
  initialBoardId = null,
}) {
  const [boards, setBoards] = React.useState([]);
  const [counts, setCounts] = React.useState({});
  const [activeBoard, setActiveBoard] =
    React.useState(null);
  const [activeItems, setActiveItems] =
    React.useState([]);
  const [showCreate, setShowCreate] =
    React.useState(false);
  const [editingBoard, setEditingBoard] =
    React.useState(null);
  const [addingItems, setAddingItems] =
    React.useState(false);
  const [name, setName] =
    React.useState("");
  const [description, setDescription] =
    React.useState("");
  const [loading, setLoading] =
    React.useState(true);

  const refresh = React.useCallback(
    async () => {
      setLoading(true);

      try {
        const [boardRows, itemRows] =
          await Promise.all([
            getBoards(),
            getBoardItems(),
          ]);

        setBoards(boardRows);

        const nextCounts = itemRows.reduce(
          (result, item) => {
            result[item.board_id] =
              (result[item.board_id] || 0) + 1;
            return result;
          },
          {}
        );

        setCounts(nextCounts);

        if (activeBoard) {
          setActiveItems(
            itemRows.filter(
              (item) =>
                item.board_id === activeBoard.id
            )
          );
        }
      } catch (error) {
        console.error(
          "Failed to load Boards:",
          error
        );
        onToast?.(
          error.message ||
            "Could not load Boards."
        );
      } finally {
        setLoading(false);
      }
    },
    [activeBoard, onToast]
  );

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  React.useEffect(() => {
    if (!initialBoardId || activeBoard || !boards.length) {
      return;
    }

    const target = boards.find(
      (board) => board.id === initialBoardId
    );

    if (target) {
      openBoard(target);
    }
  }, [boards, initialBoardId, activeBoard]);

  async function openBoard(board) {
    try {
      const items =
        await getBoardItems(board.id);
      setActiveBoard(board);
      setActiveItems(items);
    } catch (error) {
      console.error(error);
      onToast?.(
        error.message ||
          "Could not open Board."
      );
    }
  }

  async function handleCreate(event) {
    event.preventDefault();

    try {
      const created = await createBoard({
        name,
        description,
        pinned: false,
      });

      setBoards((current) => [
        ...current,
        created,
      ]);

      setCounts((current) => ({
        ...current,
        [created.id]: 0,
      }));

      setName("");
      setDescription("");
      setShowCreate(false);
      onToast?.("Board created");
    } catch (error) {
      console.error(error);
      onToast?.(
        error.message ||
          "Could not create Board."
      );
    }
  }

  async function togglePin(board) {
    if (!board.pinned && !canPinBoard(boards, board.id)) {
      onToast?.(`You can pin up to ${MAX_PINNED_BOARDS} Boards to your profile.`);
      return;
    }

    try {
      const updated = await updateBoard(
        board.id,
        {
          pinned: !board.pinned,
        }
      );

      setBoards((current) =>
        current
          .map((entry) =>
            entry.id === updated.id
              ? updated
              : entry
          )
          .sort(
            (a, b) =>
              Number(b.pinned) -
              Number(a.pinned)
          )
      );

      setEditingBoard((current) =>
        current?.id === updated.id
          ? updated
          : current
      );

      if (
        activeBoard?.id === updated.id
      ) {
        setActiveBoard(updated);
      }

      onToast?.(
        updated.pinned
          ? "Pinned to profile"
          : "Unpinned"
      );
    } catch (error) {
      console.error(error);
      onToast?.(
        error.message ||
          "Could not update Board."
      );
    }
  }

  async function removeBoard(board) {
    if (board.name === "Saved") {
      onToast?.(
        "The Saved Board cannot be deleted."
      );
      return;
    }

    if (
      !window.confirm(
        `Delete "${board.name}"? Its saved items will also be removed.`
      )
    ) {
      return;
    }

    try {
      await deleteBoard(board.id);

      setBoards((current) =>
        current.filter(
          (entry) =>
            entry.id !== board.id
        )
      );

      setCounts((current) => {
        const next = { ...current };
        delete next[board.id];
        return next;
      });

      if (
        activeBoard?.id === board.id
      ) {
        setActiveBoard(null);
        setActiveItems([]);
      }

      onToast?.("Board deleted");
    } catch (error) {
      console.error(error);
      onToast?.(
        error.message ||
          "Could not delete Board."
      );
    }
  }

  async function removeItem(itemId) {
    try {
      await deleteBoardItem(itemId);

      setActiveItems((current) =>
        current.filter(
          (item) =>
            item.id !== itemId
        )
      );

      if (activeBoard) {
        setCounts((current) => ({
          ...current,
          [activeBoard.id]: Math.max(
            0,
            (current[activeBoard.id] || 1) - 1
          ),
        }));
      }

      onToast?.("Removed from Board");
    } catch (error) {
      console.error(error);
      onToast?.(
        error.message ||
          "Could not remove item."
      );
    }
  }

  async function addExistingItems(keys) {
    if (!activeBoard) return;

    try {
      const selectedItems = keptItems.filter(
        (item) =>
          keys.includes(
            `${item.dumpId}:${item.seed}`
          )
      );

      for (const item of selectedItems) {
        await saveBoardItem({
          boardId: activeBoard.id,
          dumpId: item.dumpId,
          itemPosition: item.seed,
          note: item.note || "",
          mood: item.mood || "",
        });
      }

      const updatedItems =
        await getBoardItems(
          activeBoard.id
        );

      setActiveItems(updatedItems);
      setCounts((current) => ({
        ...current,
        [activeBoard.id]:
          updatedItems.length,
      }));
      setAddingItems(false);
      onToast?.("Added to Board");
    } catch (error) {
      console.error(
        "Failed to add items:",
        error
      );
      onToast?.(
        error.message ||
          "Could not add saved items."
      );
    }
  }

  function handleBoardSaved(updated) {
    setBoards((current) =>
      current
        .map((entry) =>
          entry.id === updated.id
            ? updated
            : entry
        )
        .sort(
          (a, b) =>
            Number(b.pinned) -
            Number(a.pinned)
        )
    );

    if (
      activeBoard?.id === updated.id
    ) {
      setActiveBoard(updated);
    }
  }

  if (activeBoard) {
    return (
      <>
        <BoardDetail
          board={activeBoard}
          boards={boards}
          items={activeItems}
          dumps={dumps}
          onBack={() => {
            setActiveBoard(null);
            setActiveItems([]);
          }}
          onDeleteItem={removeItem}
          onAddExistingItem={() =>
            setAddingItems(true)
          }
        />

        {addingItems && (
          <AddItemsModal
            board={{
              ...activeBoard,
              currentItems: activeItems,
            }}
            keptItems={keptItems}
            onClose={() =>
              setAddingItems(false)
            }
            onAdd={addExistingItems}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="stack">
        <div
          className="row"
          style={{
            justifyContent:
              "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <button
              type="button"
              className="btn"
              onClick={onBack}
            >
              <ArrowLeft size={16} />
              Profile
            </button>

            <h1
              className="title"
              style={{ marginTop: 12 }}
            >
              Boards
            </h1>
            <p
              className="subtitle"
              style={{ marginTop: 4 }}
            >
              Keep moments organized your way.
            </p>
            <div
              className="tag"
              style={{ marginTop: 8, display: "inline-flex" }}
              aria-label={`${countPinnedBoards(boards)} of ${MAX_PINNED_BOARDS} Boards pinned`}
            >
              {countPinnedBoards(boards)} / {MAX_PINNED_BOARDS} pinned
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() =>
              setShowCreate(true)
            }
          >
            <Plus size={17} />
            New board
          </button>
        </div>

        {showCreate && (
          <form
            className="card"
            onSubmit={handleCreate}
          >
            <div className="eyebrow">
              New board
            </div>

            <input
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
              className="input"
              style={{
                width: "100%",
                marginTop: 10,
              }}
              placeholder="Board name"
              maxLength={60}
              autoFocus
            />

            <textarea
              value={description}
              onChange={(event) =>
                setDescription(
                  event.target.value
                )
              }
              className="input"
              style={{
                width: "100%",
                marginTop: 8,
                minHeight: 80,
                resize: "vertical",
              }}
              placeholder="Description (optional)"
              maxLength={180}
            />

            <div
              className="row"
              style={{
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 12,
              }}
            >
              <button
                type="button"
                className="btn"
                onClick={() =>
                  setShowCreate(false)
                }
              >
                Cancel
              </button>

              <button
                type="submit"
                className="btn btn-primary"
              >
                Create
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="card">
            Loading Boards…
          </div>
        ) : boards.length === 0 ? (
          <div
            className="card"
            style={{
              padding: 40,
              textAlign: "center",
            }}
          >
            <strong>
              Your Boards are empty.
            </strong>
            <p
              className="subtitle"
              style={{ marginTop: 5 }}
            >
              Create a Board and start saving your favorite moments.
            </p>
          </div>
        ) : (
          <div className="grid grid-2">
            {boards.map((board) => (
              <BoardCard
                key={board.id}
                board={board}
                itemCount={
                  counts[board.id] || 0
                }
                onOpen={openBoard}
                onTogglePin={togglePin}
                onCustomize={setEditingBoard}
                onDelete={removeBoard}
              />
            ))}
          </div>
        )}
      </div>

      {editingBoard && (
        <BoardStudio
          boards={boards}
          initialBoardId={editingBoard.id}
          onClose={() =>
            setEditingBoard(null)
          }
          onBoardSaved={handleBoardSaved}
          onToast={onToast}
        />
      )}
    </>
  );
}
