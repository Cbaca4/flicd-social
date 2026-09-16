import React from "react";
import { Palette, Pin, Save, X } from "lucide-react";
import { updateBoard } from "./boardApi";

const DEFAULT_STYLE = {
  background: "#111111",
  accent: "#ff72b6",
  border: "#ffffff",
  borderWidth: 1,
  radius: 24,
  cardStyle: "soft",
  columns: 3,
  showItemCount: true,
  showDescription: true,
};

const PRESETS = [
  {
    name: "Flic'd",
    style: {
      background: "#111111",
      accent: "#ff72b6",
      border: "#ffffff",
      borderWidth: 1,
      radius: 24,
      cardStyle: "soft",
      columns: 3,
      showItemCount: true,
      showDescription: true,
    },
  },
  {
    name: "Midnight",
    style: {
      background: "#09090b",
      accent: "#a78bfa",
      border: "#3f3f46",
      borderWidth: 1,
      radius: 18,
      cardStyle: "minimal",
      columns: 3,
      showItemCount: true,
      showDescription: true,
    },
  },
  {
    name: "Pastel",
    style: {
      background: "#201725",
      accent: "#f9a8d4",
      border: "#fbcfe8",
      borderWidth: 2,
      radius: 28,
      cardStyle: "soft",
      columns: 2,
      showItemCount: true,
      showDescription: true,
    },
  },
  {
    name: "Glass",
    style: {
      background: "#0f172a",
      accent: "#67e8f9",
      border: "#67e8f9",
      borderWidth: 1,
      radius: 30,
      cardStyle: "glass",
      columns: 3,
      showItemCount: false,
      showDescription: true,
    },
  },
];

function normalizeStyle(style) {
  return {
    ...DEFAULT_STYLE,
    ...(style || {}),
  };
}

function ColorField({
  label,
  value,
  onChange,
}) {
  return (
    <label
      style={{
        display: "grid",
        gap: 7,
      }}
    >
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        {label}
      </span>

      <div
        className="row"
        style={{ gap: 8 }}
      >
        <input
          type="color"
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          style={{
            width: 42,
            height: 36,
            padding: 2,
            border: "none",
            background: "transparent",
            cursor: "pointer",
          }}
        />

        <input
          className="input"
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          style={{ flex: 1 }}
        />
      </div>
    </label>
  );
}

export default function BoardStudio({
  boards = [],
  initialBoardId = null,
  onClose,
  onBoardSaved,
  onToast,
}) {
  const firstBoardId =
    initialBoardId || boards[0]?.id || null;

  const [selectedBoardId, setSelectedBoardId] =
    React.useState(firstBoardId);
  const [draft, setDraft] = React.useState(
    normalizeStyle(
      boards.find(
        (board) =>
          board.id === firstBoardId
      )?.style_config
    )
  );
  const [name, setName] = React.useState(
    boards.find(
      (board) =>
        board.id === firstBoardId
    )?.name || ""
  );
  const [description, setDescription] =
    React.useState(
      boards.find(
        (board) =>
          board.id === firstBoardId
      )?.description || ""
    );
  const [coverUrl, setCoverUrl] =
    React.useState(
      boards.find(
        (board) =>
          board.id === firstBoardId
      )?.cover_url || ""
    );
  const [saving, setSaving] =
    React.useState(false);

  const selectedBoard = boards.find(
    (board) =>
      board.id === selectedBoardId
  );

  React.useEffect(() => {
    if (!selectedBoard) return;

    setDraft(
      normalizeStyle(
        selectedBoard.style_config
      )
    );
    setName(selectedBoard.name || "");
    setDescription(
      selectedBoard.description || ""
    );
    setCoverUrl(
      selectedBoard.cover_url || ""
    );
  }, [selectedBoard]);

  function selectBoard(id) {
    setSelectedBoardId(id);
  }

  function applyPreset(style) {
    setDraft(normalizeStyle(style));
  }

  function setStyle(key, value) {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleSave(event) {
    event.preventDefault();

    if (!selectedBoard) {
      onToast?.(
        "Create a Board before customizing it."
      );
      return;
    }

    setSaving(true);

    try {
      const updated = await updateBoard(
        selectedBoard.id,
        {
          name,
          description,
          coverUrl,
          styleConfig: draft,
        }
      );

      onBoardSaved?.(updated);
      onToast?.("Board customized");
      onClose?.();
    } catch (error) {
      console.error(
        "Failed to customize Board:",
        error
      );
      onToast?.(
        error.message ||
          "Could not customize Board."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div
        className="modal"
        style={{
          maxWidth: 720,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div
          className="row"
          style={{
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <div className="eyebrow">
              Board Studio
            </div>
            <h2 style={{ marginTop: 4 }}>
              Make your Boards yours
            </h2>
            <p
              className="subtitle"
              style={{ marginTop: 4 }}
            >
              Colors, borders, covers, cards, and layout.
            </p>
          </div>

          <button
            type="button"
            className="btn icon-btn"
            onClick={onClose}
            aria-label="Close Board Studio"
          >
            <X size={18} />
          </button>
        </div>

        {boards.length === 0 ? (
          <div
            className="card"
            style={{
              marginTop: 18,
              padding: 28,
              textAlign: "center",
            }}
          >
            <strong>
              Create a Board first
            </strong>
            <p
              className="subtitle"
              style={{ marginTop: 5 }}
            >
              Board Studio customizes individual Boards.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSave}
            style={{ marginTop: 18 }}
          >
            <label
              style={{
                display: "grid",
                gap: 7,
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                Board
              </span>

              <select
                className="input"
                value={selectedBoardId || ""}
                onChange={(event) =>
                  selectBoard(event.target.value)
                }
              >
                {boards.map((board) => (
                  <option
                    key={board.id}
                    value={board.id}
                  >
                    {board.name}
                  </option>
                ))}
              </select>
            </label>

            <div
              className="grid grid-2"
              style={{ marginTop: 14 }}
            >
              <label
                style={{
                  display: "grid",
                  gap: 7,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  Name
                </span>
                <input
                  className="input"
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  maxLength={60}
                />
              </label>

              <label
                style={{
                  display: "grid",
                  gap: 7,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  Description
                </span>
                <input
                  className="input"
                  value={description}
                  onChange={(event) =>
                    setDescription(event.target.value)
                  }
                  maxLength={180}
                />
              </label>
            </div>

            <label
              style={{
                display: "grid",
                gap: 7,
                marginTop: 14,
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                Cover image URL
              </span>
              <input
                className="input"
                value={coverUrl}
                onChange={(event) =>
                  setCoverUrl(event.target.value)
                }
                placeholder="https://..."
              />
            </label>

            {coverUrl && (
              <div
                className="board-cover"
                style={{
                  marginTop: 10,
                  overflow: "hidden",
                }}
              >
                <img
                  src={coverUrl}
                  alt="Board cover preview"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                  onError={(event) => {
                    event.currentTarget.style.display =
                      "none";
                  }}
                />
              </div>
            )}

            <div
              style={{
                marginTop: 18,
              }}
            >
              <div className="eyebrow">
                Presets
              </div>

              <div
                className="row"
                style={{
                  gap: 8,
                  flexWrap: "wrap",
                  marginTop: 8,
                }}
              >
                {PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    className="btn"
                    onClick={() =>
                      applyPreset(preset.style)
                    }
                  >
                    <Palette size={14} />
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            <div
              className="card"
              style={{
                marginTop: 16,
              }}
            >
              <div className="eyebrow">
                Colors
              </div>

              <div
                className="grid grid-2"
                style={{ marginTop: 12 }}
              >
                <ColorField
                  label="Board background"
                  value={draft.background}
                  onChange={(value) =>
                    setStyle("background", value)
                  }
                />

                <ColorField
                  label="Accent"
                  value={draft.accent}
                  onChange={(value) =>
                    setStyle("accent", value)
                  }
                />

                <ColorField
                  label="Border color"
                  value={draft.border}
                  onChange={(value) =>
                    setStyle("border", value)
                  }
                />
              </div>
            </div>

            <div
              className="card"
              style={{ marginTop: 12 }}
            >
              <div className="eyebrow">
                Borders & cards
              </div>

              <div
                className="grid grid-2"
                style={{ marginTop: 12 }}
              >
                <label>
                  <span
                    style={{
                      display: "block",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    Border width
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="1"
                    value={draft.borderWidth}
                    onChange={(event) =>
                      setStyle(
                        "borderWidth",
                        Number(event.target.value)
                      )
                    }
                    style={{
                      width: "100%",
                      marginTop: 10,
                    }}
                  />
                  <small className="subtitle">
                    {draft.borderWidth}px
                  </small>
                </label>

                <label>
                  <span
                    style={{
                      display: "block",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    Corner radius
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="36"
                    step="2"
                    value={draft.radius}
                    onChange={(event) =>
                      setStyle(
                        "radius",
                        Number(event.target.value)
                      )
                    }
                    style={{
                      width: "100%",
                      marginTop: 10,
                    }}
                  />
                  <small className="subtitle">
                    {draft.radius}px
                  </small>
                </label>
              </div>

              <div
                className="row"
                style={{
                  gap: 8,
                  marginTop: 14,
                  flexWrap: "wrap",
                }}
              >
                {[
                  ["minimal", "Minimal"],
                  ["soft", "Soft"],
                  ["glass", "Glass"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className="btn"
                    onClick={() =>
                      setStyle("cardStyle", value)
                    }
                    style={{
                      borderColor:
                        draft.cardStyle === value
                          ? draft.accent
                          : undefined,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div
              className="card"
              style={{ marginTop: 12 }}
            >
              <div className="eyebrow">
                Layout
              </div>

              <div
                className="grid grid-2"
                style={{ marginTop: 12 }}
              >
                <label>
                  <span
                    style={{
                      display: "block",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    Columns
                  </span>
                  <select
                    className="input"
                    style={{
                      width: "100%",
                      marginTop: 7,
                    }}
                    value={draft.columns}
                    onChange={(event) =>
                      setStyle(
                        "columns",
                        Number(event.target.value)
                      )
                    }
                  >
                    <option value="2">
                      2 columns
                    </option>
                    <option value="3">
                      3 columns
                    </option>
                    <option value="4">
                      4 columns
                    </option>
                  </select>
                </label>

                <div>
                  <span
                    style={{
                      display: "block",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    Show details
                  </span>

                  <label
                    className="row"
                    style={{
                      gap: 8,
                      marginTop: 10,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(
                        draft.showItemCount
                      )}
                      onChange={(event) =>
                        setStyle(
                          "showItemCount",
                          event.target.checked
                        )
                      }
                    />
                    Item counts
                  </label>

                  <label
                    className="row"
                    style={{
                      gap: 8,
                      marginTop: 8,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(
                        draft.showDescription
                      )}
                      onChange={(event) =>
                        setStyle(
                          "showDescription",
                          event.target.checked
                        )
                      }
                    />
                    Descriptions
                  </label>
                </div>
              </div>
            </div>

            <div
              className="row"
              style={{
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 18,
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
                type="submit"
                className="btn btn-primary"
                disabled={saving}
              >
                <Save size={15} />
                {saving
                  ? "Saving..."
                  : "Save changes"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
