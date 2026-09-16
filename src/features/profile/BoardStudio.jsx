import React from "react";

import {
  Check,
  Image,
  Pin,
  RotateCcw,
  Save,
  X,
} from "lucide-react";

import { updateBoard } from "./boardApi";

const DEFAULT_STYLE = {
  background: "#18181b",
  accent: "#ffffff",
  border: "#ffffff",
  borderWidth: 1,
  radius: 24,
  cardStyle: "soft",
  columns: 2,
  showItemCount: true,
  showDescription: true,
  coverUrl: "",
};

const PRESETS = {
  midnight: {
    background: "#111114",
    accent: "#ffffff",
    border: "#ffffff",
    borderWidth: 1,
    radius: 24,
    cardStyle: "soft",
    columns: 2,
    showItemCount: true,
    showDescription: true,
  },

  bubblegum: {
    background: "#24141f",
    accent: "#ff8fc8",
    border: "#ff8fc8",
    borderWidth: 2,
    radius: 30,
    cardStyle: "soft",
    columns: 2,
    showItemCount: true,
    showDescription: true,
  },

  glass: {
    background: "#15181c",
    accent: "#9fcbff",
    border: "#ffffff",
    borderWidth: 1,
    radius: 28,
    cardStyle: "glass",
    columns: 3,
    showItemCount: true,
    showDescription: false,
  },

  polaroid: {
    background: "#f0ede7",
    accent: "#161616",
    border: "#161616",
    borderWidth: 2,
    radius: 10,
    cardStyle: "polaroid",
    columns: 2,
    showItemCount: false,
    showDescription: true,
  },
};

function normalizeStyleConfig(config) {
  return {
    ...DEFAULT_STYLE,
    ...(config || {}),
  };
}

export default function BoardStudio({
  boards = [],
  onClose,
  onBoardSaved,
  onToast,
}) {
  const [selectedBoardId, setSelectedBoardId] =
    React.useState(
      boards[0]?.id || ""
    );

  const [draft, setDraft] = React.useState(
    () =>
      normalizeStyleConfig(
        boards[0]?.style_config
      )
  );

  const [saving, setSaving] =
    React.useState(false);

  const selectedBoard =
    boards.find(
      (board) =>
        board.id === selectedBoardId
    ) || null;

  /*
   * Load the selected Board's saved style.
   */
  React.useEffect(() => {
    if (!selectedBoard) {
      setDraft(
        normalizeStyleConfig({})
      );
      return;
    }

    setDraft(
      normalizeStyleConfig(
        selectedBoard.style_config
      )
    );
  }, [selectedBoard]);

  function updateStyle(
    key,
    value
  ) {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function applyPreset(name) {
    const preset =
      PRESETS[name];

    if (!preset) {
      return;
    }

    setDraft((current) => ({
      ...current,
      ...preset,
    }));

    onToast?.(
      `${name[0].toUpperCase()}${name.slice(
        1
      )} style applied`
    );
  }

  function resetStyle() {
    setDraft(
      normalizeStyleConfig({})
    );

    onToast?.(
      "Board style reset"
    );
  }

  /*
   * Save the selected Board's
   * customization to Supabase.
   */
  async function handleSave() {
    if (!selectedBoard) {
      onToast?.(
        "Choose a Board first."
      );
      return;
    }

    setSaving(true);

    try {
      const updated =
        await updateBoard(
          selectedBoard.id,
          {
            coverUrl:
              draft.coverUrl ||
              "",

            styleConfig: {
              background:
                draft.background,

              accent:
                draft.accent,

              border:
                draft.border,

              borderWidth:
                draft.borderWidth,

              radius:
                draft.radius,

              cardStyle:
                draft.cardStyle,

              columns:
                draft.columns,

              showItemCount:
                draft.showItemCount,

              showDescription:
                draft.showDescription,
            },
          }
        );

      onBoardSaved?.(
        updated
      );

      onToast?.(
        "Board customization saved"
      );
    } catch (error) {
      console.error(
        "Failed to save Board customization:",
        error
      );

      onToast?.(
        error.message ||
          "Could not save Board customization."
      );
    } finally {
      setSaving(false);
    }
  }

  /*
   * No Boards yet.
   */
  if (!boards.length) {
    return (
      <div className="modal-backdrop">
        <div
          className="modal"
          style={{
            maxWidth: 560,
            width: "100%",
          }}
        >
          <div
            className="row"
            style={{
              justifyContent:
                "space-between",
            }}
          >
            <div>
              <div className="eyebrow">
                Board Studio
              </div>

              <h2
                style={{
                  marginTop: 5,
                }}
              >
                Customize your Boards
              </h2>
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

          <div
            className="card"
            style={{
              marginTop: 18,
              padding: 24,
              textAlign: "center",
            }}
          >
            <p className="subtitle">
              You don't have any Boards yet.
            </p>

            <p
              className="subtitle"
              style={{
                marginTop: 5,
              }}
            >
              Create a Board first, then come back
              here to customize it.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop">
      <div
        className="modal"
        style={{
          width: "100%",
          maxWidth: 820,
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        {/* HEADER */}
        <div
          className="row"
          style={{
            justifyContent:
              "space-between",
            alignItems:
              "flex-start",
          }}
        >
          <div>
            <div className="eyebrow">
              Board Studio
            </div>

            <h2
              style={{
                marginTop: 5,
              }}
            >
              Customize your Boards
            </h2>

            <p
              className="subtitle"
              style={{
                marginTop: 4,
              }}
            >
              Give each Board its own look.
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

        {/* BOARD SELECTOR */}
        <div
          className="card"
          style={{
            marginTop: 18,
          }}
        >
          <div className="eyebrow">
            Board
          </div>

          <select
            value={selectedBoardId}
            onChange={(event) =>
              setSelectedBoardId(
                event.target.value
              )
            }
            className="input"
            style={{
              width: "100%",
              marginTop: 8,
            }}
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
        </div>

        {selectedBoard && (
          <>
            {/* QUICK STYLES */}
            <div
              className="card"
              style={{
                marginTop: 12,
              }}
            >
              <div className="eyebrow">
                Quick styles
              </div>

              <div
                className="grid grid-2"
                style={{
                  marginTop: 10,
                }}
              >
                {Object.keys(
                  PRESETS
                ).map(
                  (presetName) => (
                    <button
                      key={presetName}
                      type="button"
                      className="card"
                      style={{
                        textAlign:
                          "left",
                        padding: 12,
                        cursor:
                          "pointer",
                      }}
                      onClick={() =>
                        applyPreset(
                          presetName
                        )
                      }
                    >
                      <div
                        style={{
                          height: 54,
                          borderRadius:
                            PRESETS[
                              presetName
                            ]
                              .radius,
                          background:
                            PRESETS[
                              presetName
                            ]
                              .background,
                          border: `${PRESETS[presetName].borderWidth}px solid ${PRESETS[presetName].border}`,
                        }}
                      />

                      <strong
                        style={{
                          display:
                            "block",
                          marginTop: 8,
                          textTransform:
                            "capitalize",
                        }}
                      >
                        {presetName}
                      </strong>
                    </button>
                  )
                )}
              </div>
            </div>

            {/* COLORS */}
            <div
              className="card"
              style={{
                marginTop: 12,
              }}
            >
              <div className="eyebrow">
                Colors
              </div>

              <div
                className="grid grid-2"
                style={{
                  marginTop: 10,
                }}
              >
                {/* BACKGROUND */}
                <label>
                  <span className="subtitle">
                    Background
                  </span>

                  <div
                    className="row"
                    style={{
                      marginTop: 6,
                      gap: 8,
                    }}
                  >
                    <input
                      type="color"
                      value={
                        draft.background
                      }
                      onChange={(
                        event
                      ) =>
                        updateStyle(
                          "background",
                          event
                            .target
                            .value
                        )
                      }
                      style={{
                        width: 48,
                        height: 38,
                        padding: 2,
                        border: 0,
                        background:
                          "transparent",
                        cursor:
                          "pointer",
                      }}
                    />

                    <input
                      className="input"
                      value={
                        draft.background
                      }
                      onChange={(
                        event
                      ) =>
                        updateStyle(
                          "background",
                          event
                            .target
                            .value
                        )
                      }
                    />
                  </div>
                </label>

                {/* ACCENT */}
                <label>
                  <span className="subtitle">
                    Accent
                  </span>

                  <div
                    className="row"
                    style={{
                      marginTop: 6,
                      gap: 8,
                    }}
                  >
                    <input
                      type="color"
                      value={
                        draft.accent
                      }
                      onChange={(
                        event
                      ) =>
                        updateStyle(
                          "accent",
                          event
                            .target
                            .value
                        )
                      }
                      style={{
                        width: 48,
                        height: 38,
                        padding: 2,
                        border: 0,
                        background:
                          "transparent",
                        cursor:
                          "pointer",
                      }}
                    />

                    <input
                      className="input"
                      value={
                        draft.accent
                      }
                      onChange={(
                        event
                      ) =>
                        updateStyle(
                          "accent",
                          event
                            .target
                            .value
                        )
                      }
                    />
                  </div>
                </label>

                {/* BORDER */}
                <label>
                  <span className="subtitle">
                    Border
                  </span>

                  <div
                    className="row"
                    style={{
                      marginTop: 6,
                      gap: 8,
                    }}
                  >
                    <input
                      type="color"
                      value={
                        draft.border
                      }
                      onChange={(
                        event
                      ) =>
                        updateStyle(
                          "border",
                          event
                            .target
                            .value
                        )
                      }
                      style={{
                        width: 48,
                        height: 38,
                        padding: 2,
                        border: 0,
                        background:
                          "transparent",
                        cursor:
                          "pointer",
                      }}
                    />

                    <input
                      className="input"
                      value={
                        draft.border
                      }
                      onChange={(
                        event
                      ) =>
                        updateStyle(
                          "border",
                          event
                            .target
                            .value
                        )
                      }
                    />
                  </div>
                </label>

                {/* BORDER WIDTH */}
                <label>
                  <span className="subtitle">
                    Border thickness
                  </span>

                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="1"
                    value={
                      draft.borderWidth
                    }
                    onChange={(
                      event
                    ) =>
                      updateStyle(
                        "borderWidth",
                        Number(
                          event.target.value
                        )
                      )
                    }
                    style={{
                      width: "100%",
                      marginTop: 14,
                    }}
                  />

                  <div className="subtitle">
                    {draft.borderWidth}px
                  </div>
                </label>
              </div>
            </div>

            {/* SHAPE */}
            <div
              className="card"
              style={{
                marginTop: 12,
              }}
            >
              <div className="eyebrow">
                Shape & style
              </div>

              <div
                style={{
                  marginTop: 12,
                }}
              >
                <div className="subtitle">
                  Corner radius
                </div>

                <input
                  type="range"
                  min="0"
                  max="40"
                  step="1"
                  value={
                    draft.radius
                  }
                  onChange={(
                    event
                  ) =>
                    updateStyle(
                      "radius",
                      Number(
                        event.target.value
                      )
                    )
                  }
                  style={{
                    width: "100%",
                    marginTop: 8,
                  }}
                />

                <div className="subtitle">
                  {draft.radius}px
                </div>
              </div>

              <div
                style={{
                  marginTop: 16,
                }}
              >
                <div className="subtitle">
                  Card style
                </div>

                <div
                  className="row"
                  style={{
                    gap: 8,
                    marginTop: 8,
                    flexWrap:
                      "wrap",
                  }}
                >
                  {[
                    "soft",
                    "glass",
                    "polaroid",
                    "minimal",
                  ].map(
                    (styleName) => (
                      <button
                        key={
                          styleName
                        }
                        type="button"
                        className={
                          draft.cardStyle ===
                          styleName
                            ? "btn btn-primary"
                            : "btn"
                        }
                        onClick={() =>
                          updateStyle(
                            "cardStyle",
                            styleName
                          )
                        }
                        style={{
                          textTransform:
                            "capitalize",
                        }}
                      >
                        {styleName}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* COVER */}
            <div
              className="card"
              style={{
                marginTop: 12,
              }}
            >
              <div className="eyebrow">
                Cover
              </div>

              <div
                className="row"
                style={{
                  gap: 10,
                  marginTop: 8,
                }}
              >
                <Image
                  size={18}
                  className="muted"
                />

                <input
                  className="input"
                  style={{
                    flex: 1,
                  }}
                  placeholder="Paste a cover image URL"
                  value={
                    draft.coverUrl
                  }
                  onChange={(
                    event
                  ) =>
                    updateStyle(
                      "coverUrl",
                      event.target
                        .value
                    )
                  }
                />
              </div>

              {draft.coverUrl && (
                <div
                  className="board-cover"
                  style={{
                    marginTop: 12,
                    overflow:
                      "hidden",
                  }}
                >
                  <img
                    src={
                      draft.coverUrl
                    }
                    alt=""
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit:
                        "cover",
                    }}
                    onError={(
                      event
                    ) => {
                      event.currentTarget.style.display =
                        "none";
                    }}
                  />
                </div>
              )}
            </div>

            {/* LAYOUT */}
            <div
              className="card"
              style={{
                marginTop: 12,
              }}
            >
              <div className="eyebrow">
                Layout
              </div>

              <div
                className="grid grid-2"
                style={{
                  marginTop: 12,
                  gap: 14,
                }}
              >
                <label>
                  <span className="subtitle">
                    Columns
                  </span>

                  <select
                    className="input"
                    style={{
                      width: "100%",
                      marginTop: 6,
                    }}
                    value={
                      draft.columns
                    }
                    onChange={(
                      event
                    ) =>
                      updateStyle(
                        "columns",
                        Number(
                          event.target
                            .value
                        )
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
                  <span className="subtitle">
                    Details
                  </span>

                  <button
                    type="button"
                    className="card"
                    style={{
                      width: "100%",
                      marginTop: 6,
                      textAlign:
                        "left",
                      cursor:
                        "pointer",
                    }}
                    onClick={() =>
                      updateStyle(
                        "showItemCount",
                        !draft.showItemCount
                      )
                    }
                  >
                    <div className="row">
                      <Check
                        size={16}
                        style={{
                          opacity:
                            draft.showItemCount
                              ? 1
                              : 0.2,
                        }}
                      />

                      <span>
                        Show item counts
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className="card"
                    style={{
                      width: "100%",
                      marginTop: 6,
                      textAlign:
                        "left",
                      cursor:
                        "pointer",
                    }}
                    onClick={() =>
                      updateStyle(
                        "showDescription",
                        !draft.showDescription
                      )
                    }
                  >
                    <div className="row">
                      <Check
                        size={16}
                        style={{
                          opacity:
                            draft.showDescription
                              ? 1
                              : 0.2,
                        }}
                      />

                      <span>
                        Show descriptions
                      </span>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* PIN */}
            <div
              className="card"
              style={{
                marginTop: 12,
              }}
            >
              <button
                type="button"
                style={{
                  width: "100%",
                  background:
                    "transparent",
                  border: 0,
                  color: "inherit",
                  textAlign:
                    "left",
                  padding: 0,
                  cursor:
                    "pointer",
                }}
                onClick={async () => {
                  try {
                    const updated =
                      await updateBoard(
                        selectedBoard.id,
                        {
                          pinned:
                            !selectedBoard.pinned,
                        }
                      );

                    onBoardSaved?.(
                      updated
                    );

                    onToast?.(
                      updated.pinned
                        ? "Board pinned"
                        : "Board unpinned"
                    );
                  } catch (error) {
                    console.error(
                      error
                    );

                    onToast?.(
                      error.message ||
                        "Could not update Board."
                    );
                  }
                }}
              >
                <div className="row">
                  <Pin
                    size={18}
                    style={{
                      opacity:
                        selectedBoard.pinned
                          ? 1
                          : 0.35,
                    }}
                  />

                  <div
                    style={{
                      flex: 1,
                      marginLeft: 8,
                    }}
                  >
                    <strong>
                      {selectedBoard.pinned
                        ? "Pinned to profile"
                        : "Not pinned"}
                    </strong>

                    <p className="subtitle">
                      {selectedBoard.pinned
                        ? "This Board can appear in your profile preview."
                        : "Pin this Board to show it on your profile."}
                    </p>
                  </div>
                </div>
              </button>
            </div>

            {/* PREVIEW */}
            <div
              className="card"
              style={{
                marginTop: 12,
                background:
                  draft.background,
                border: `${draft.borderWidth}px solid ${draft.border}`,
                borderRadius:
                  draft.radius,
              }}
            >
              <div className="eyebrow">
                Live preview
              </div>

              <div
                style={{
                  marginTop: 10,
                  padding: 16,
                  borderRadius:
                    Math.max(
                      0,
                      draft.radius - 8
                    ),
                  background:
                    draft.cardStyle ===
                    "polaroid"
                      ? "#ffffff"
                      : draft.cardStyle ===
                        "glass"
                      ? "rgba(255,255,255,0.08)"
                      : draft.cardStyle ===
                        "minimal"
                      ? "transparent"
                      : "rgba(255,255,255,0.04)",
                  border: `1px solid ${draft.border}`,
                }}
              >
                {draft.coverUrl && (
                  <div
                    style={{
                      height: 90,
                      marginBottom: 12,
                      borderRadius:
                        Math.max(
                          0,
                          draft.radius - 10
                        ),
                      overflow:
                        "hidden",
                    }}
                  >
                    <img
                      src={
                        draft.coverUrl
                      }
                      alt=""
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit:
                          "cover",
                      }}
                    />
                  </div>
                )}

                <div
                  className="row"
                  style={{
                    justifyContent:
                      "space-between",
                  }}
                >
                  <div>
                    <strong
                      style={{
                        color:
                          draft.accent,
                      }}
                    >
                      {
                        selectedBoard.name
                      }
                    </strong>

                    {draft.showDescription &&
                      selectedBoard.description && (
                        <p
                          className="subtitle"
                          style={{
                            marginTop: 4,
                          }}
                        >
                          {
                            selectedBoard.description
                          }
                        </p>
                      )}
                  </div>

                  {draft.showItemCount && (
                    <span className="tag">
                      0 items
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* ACTIONS */}
            <div
              className="row"
              style={{
                justifyContent:
                  "space-between",
                marginTop: 18,
                gap: 8,
              }}
            >
              <button
                type="button"
                className="btn"
                onClick={
                  resetStyle
                }
              >
                <RotateCcw
                  size={15}
                />
                Reset
              </button>

              <div
                className="row"
                style={{
                  gap: 8,
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
                  disabled={saving}
                  onClick={
                    handleSave
                  }
                >
                  <Save size={15} />

                  {saving
                    ? "Saving..."
                    : "Save changes"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}