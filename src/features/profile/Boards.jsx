import React from "react";
import { useAccountScope } from "../../app/AuthScopeContext.js";
import { captureAuthScope } from "../../app/authScope.js";
import KeepPhoto from "./KeepPhoto.jsx";
import KeepLibrary from "./KeepLibrary.jsx";
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
  linkBoardItem,
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
  onRefresh,
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
        <button type="button" className="btn" onClick={onRefresh}>Refresh Saves</button>

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
            const frame = dump?.items?.find(entry => entry.position === item.item_position);
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
                  <KeepPhoto item={item} />
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
                        {note}
                      </strong>
                    )}
                  </div>

                  <button
                    type="button"
                    className="btn icon-btn"
                    disabled={Boolean(item.legacy_status)}
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
        item.id
    )
  );

  const available = keptItems.filter(
    (item) =>
      !existingKeys.has(
        item.id
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
              const key = item.id;
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
                        {item.source_username || "Saved item"}
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
  onBack,
  onToast,
  initialBoardId = null,
  authScope,
}) {
  const account = useAccountScope(authScope);
  const [boards, setBoards] = React.useState([]);
  const [library, setLibrary] = React.useState([]);
  const [libraryMode, setLibraryMode] = React.useState("Custom Boards");
  const [loadError, setLoadError] = React.useState("");
  const [libraryVersion, setLibraryVersion] = React.useState(0);
  const requestVersion = React.useRef(0);
  const activeBoardIdRef = React.useRef(null);
  const initialOpened = React.useRef(null);
  const [counts, setCounts] = React.useState({});
  const [activeBoard, setActiveBoard] =
    React.useState(null);
  const [activeItems, setActiveItems] =
    React.useState([]);
  const [showCreate, setShowCreate] =
    React.useState(false);
  const createGeneration = React.useRef(0);
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
      const generation = ++requestVersion.current;
      setLoading(true);
      let scope;
      try {
        scope = account.capture();
        const [boardRows, itemRows] =
          await Promise.all([
            getBoards(),
            getBoardItems(null, scope),
          ]);

        if (!scope.isCurrent() || generation !== requestVersion.current) return;
        setBoards(boardRows); setLibrary(itemRows); setLoadError("");
        setLibraryVersion(value => value + 1);
        if (activeBoardIdRef.current) setActiveItems(itemRows.filter(item => item.board_ids.includes(activeBoardIdRef.current)));

        const nextCounts = itemRows.reduce(
          (result, item) => {
            for (const id of item.board_ids) result[id] = (result[id] || 0) + 1;
            return result;
          },
          {}
        );

        setCounts(nextCounts);
      } catch (error) {
        if (!scope?.isCurrent() || generation !== requestVersion.current) return;
        setLibrary([]); setActiveItems([]); setLoadError(error.message || "Could not load Saves.");
        console.error(
          "Failed to load Boards:",
          error
        );
        onToast?.(
          error.message ||
            "Could not load Boards."
        );
      } finally {
        if (scope?.isCurrent() && generation === requestVersion.current) setLoading(false);
      }
    },
    [onToast, account]
  );

  React.useEffect(() => {
    refresh();
    return () => { requestVersion.current += 1; };
  }, [refresh]);

  React.useEffect(() => {
    if (!initialBoardId || initialOpened.current === initialBoardId || activeBoard || !boards.length) {
      return;
    }

    const target = boards.find(
      (board) => board.id === initialBoardId
    );

    if (target) {
      initialOpened.current = initialBoardId;
      openBoard(target);
    }
  }, [boards, initialBoardId, activeBoard]);

  async function openBoard(board) {
    if (!account.isCurrent()) return;
    const generation = ++requestVersion.current;
    activeBoardIdRef.current = board.id;
    setActiveBoard(board); setActiveItems([]);
    try {
      const scope = account.capture();
      const items =
        await getBoardItems(board.id, scope);
      if (!scope.isCurrent() || generation !== requestVersion.current) return;
      setActiveItems(items);
    } catch (error) {
      if (!account.isCurrent() || generation !== requestVersion.current) return;
      console.error(error);
      onToast?.(
        error.message ||
          "Could not open Board."
      );
    }
  }

  function openCreate() {
    createGeneration.current += 1;
    setName("");
    setDescription("");
    setShowCreate(true);
  }

  function cancelCreate() {
    // Invalidate before React commits the hidden/replacement form. The same
    // predicate reaches identity lookup, SDK credentials and final dispatch.
    createGeneration.current += 1;
    setShowCreate(false);
  }

  async function handleCreate(event) {
    event.preventDefault();
    if (!showCreate) return;
    const generation = ++createGeneration.current;
    let scope;
    try {
      scope = captureAuthScope(account.capture(), () => createGeneration.current === generation);
      const created = await createBoard({
        name,
        description,
        pinned: false,
      }, scope);
      if (!scope.isCurrent()) return;
      createGeneration.current += 1;

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
      if (!scope?.isCurrent()) return;
      console.error(error);
      onToast?.(
        error.message ||
          "Could not create Board."
      );
    }
  }

  async function togglePin(board) {
    let scope;
    if (!board.pinned && !canPinBoard(boards, board.id)) {
      onToast?.(`You can pin up to ${MAX_PINNED_BOARDS} Boards to your profile.`);
      return;
    }

    try {
      scope = account.capture();
      const updated = await updateBoard(
        board.id,
        {
          pinned: !board.pinned,
        }, scope
      );
      if (!scope.isCurrent()) return;

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
      if (!scope?.isCurrent()) return;
      console.error(error);
      onToast?.(
        error.message ||
          "Could not update Board."
      );
    }
  }

  async function removeBoard(board) {
    let scope;
    if (board.name === "Saved") {
      onToast?.(
        "The Saved Board cannot be deleted."
      );
      return;
    }

    if (
      !window.confirm(
        `Delete "${board.name}"? Only its memberships are removed; your Keeps remain in the library.`
      )
    ) {
      return;
    }

    try {
      scope = account.capture();
      await deleteBoard(board.id, scope);
      if (!scope.isCurrent()) return;

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
      if (!scope?.isCurrent()) return;
      console.error(error);
      onToast?.(
        error.message ||
          "Could not delete Board."
      );
    }
  }

  async function removeItem(itemId) {
    const boardId = activeBoard.id;
    let scope;
    try {
      scope = account.capture();
      await deleteBoardItem(itemId, boardId, scope);
      if (!scope.isCurrent()) return;
      setLibrary(current => current.map(item => item.id === itemId ? { ...item, board_ids: item.board_ids.filter(id => id !== boardId) } : item));

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
      if (!scope?.isCurrent()) return;
      console.error(error);
      onToast?.(
        error.message ||
          "Could not remove item."
      );
    }
  }

  async function addExistingItems(keys) {
    if (!activeBoard) return;
    let scope;
    try {
      scope = account.capture();
      const selectedItems = library.filter(
        (item) =>
          keys.includes(
            item.id
          )
      );

      for (const item of selectedItems) {
        scope.assertCurrent();
        await linkBoardItem(item.id, activeBoard.id, scope);
      }
      scope.assertCurrent();
      await refresh();
      scope.assertCurrent();

      const updatedItems =
        await getBoardItems(
          activeBoard.id, scope
        );
      if (!scope.isCurrent()) return;
      setActiveItems(updatedItems);
      setCounts((current) => ({
        ...current,
        [activeBoard.id]:
          updatedItems.length,
      }));
      setAddingItems(false);
      onToast?.("Added to Board");
    } catch (error) {
      if (!scope?.isCurrent()) return;
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
    if (!account.isCurrent()) return;
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
            activeBoardIdRef.current = null;
            requestVersion.current += 1;
            setActiveBoard(null);
            setActiveItems([]);
          }}
          onDeleteItem={removeItem}
          onRefresh={refresh}
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
            keptItems={library.filter(item => !item.legacy_status)}
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
            onClick={openCreate}
          >
            <Plus size={17} />
            New board
          </button>
        </div>

        <nav className="row" style={{ flexWrap: "wrap", gap: 8 }} aria-label="Saved photo collections">
          {["Custom Boards", "My Photos", "Kept from Others", "Legacy Saves"].map(mode => <button className="btn" key={mode} type="button" aria-pressed={libraryMode === mode} onClick={() => setLibraryMode(mode)}>{mode}</button>)}
          <button className="btn" type="button" onClick={refresh} disabled={loading}>Refresh Saves</button>
        </nav>
        {loadError && <p role="alert">{loadError}</p>}
        {!loading && !loadError && libraryMode !== "Custom Boards" && <KeepLibrary items={library} mode={libraryMode} boards={boards} onRefresh={refresh} version={libraryVersion} />}

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
                onClick={cancelCreate}
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
        ) : libraryMode !== "Custom Boards" || loadError ? null : boards.length === 0 ? (
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
          authScope={account.origin}
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
