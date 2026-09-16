import React from "react";
import {
  Settings,
  Plus,
  ChevronRight,
  Pin,
  LayoutGrid,
  Pencil,
} from "lucide-react";
import { getPinnedBoards } from "./boardPinning.js";

function BoardPreview({ board, onOpenBoard }) {
  const style = board?.style_config || {};
  const cover = board?.cover_url || "";
  const accent = style.accent || "#ff72b6";
  const background = style.background || "#111111";
  const count = Number.isFinite(board?.count) ? board.count : 0;

  return (
    <button
      type="button"
      className="card"
      onClick={() => onOpenBoard?.(board)}
      style={{
        textAlign: "left",
        padding: 10,
        cursor: "pointer",
        minWidth: 0,
      }}
      aria-label={`Open Board ${board.name}`}
    >
      <div
        className="board-cover"
        style={{
          overflow: "hidden",
          borderRadius:
            style.radius !== undefined
              ? `${Math.max(8, Number(style.radius) - 6)}px`
              : undefined,
          background,
          position: "relative",
        }}
      >
        {cover ? (
          <img
            src={cover}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              background: `linear-gradient(135deg, ${background}, ${accent}33)`,
              color: accent,
            }}
          >
            <Pin size={24} />
          </div>
        )}

        <span
          className="tag"
          style={{
            position: "absolute",
            left: 9,
            bottom: 9,
          }}
        >
          {count} {count === 1 ? "item" : "items"}
        </span>

        <span
          className="tag"
          style={{
            position: "absolute",
            right: 9,
            top: 9,
            color: accent,
          }}
          aria-hidden="true"
        >
          <Pin size={12} />
        </span>
      </div>

      <strong
        style={{
          display: "block",
          marginTop: 8,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {board.name}
      </strong>

      <p
        className="subtitle"
        style={{
          marginTop: 3,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {board.description || "Your saved moments"}
      </p>
    </button>
  );
}

export default function Profile({
  profile,
  activeSpace,
  onSwitchSpaces,
  theme,
  onCustomize,
  onEditProfile,
  boards = [],
  onOpenBoards,
  onCustomizeBoards,
  onOpenBoard,
}) {
  const pinnedBoards = getPinnedBoards(boards);

  return (
    <div
      className="screen"
      style={{ background: theme.background }}
    >
      <div className="profile-hero">
        <div
          className="row"
          style={{ alignItems: "flex-start" }}
        >
          <div className="avatar lg">
            {profile.handle[0].toUpperCase()}
          </div>

          <div style={{ flex: 1 }}>
            <div
              className="row"
              style={{ justifyContent: "space-between" }}
            >
              <div>
                <div className="eyebrow">
                  {activeSpace.label} space
                </div>

                <h1
                  className="title"
                  style={{
                    fontSize: 28,
                    marginTop: 2,
                  }}
                >
                  @{profile.handle}
                </h1>
              </div>

              <div className="row">
                <button
                  type="button"
                  className="btn"
                  onClick={onEditProfile}
                  aria-label="Edit Profile"
                >
                  <Pencil size={15} />
                  Edit Profile
                </button>

                <button
                  type="button"
                  className="btn icon-btn"
                  onClick={onCustomize}
                  aria-label="Customize profile"
                >
                  <Settings size={18} />
                </button>
              </div>
            </div>

            <p
              className="subtitle"
              style={{ marginTop: 10 }}
            >
              {theme.message}
            </p>

            <p
              style={{
                marginTop: 8,
                color: theme.accent,
                fontSize: 12,
              }}
            >
              {theme.statusEmoji} {theme.status}
            </p>
          </div>
        </div>

        <div
          className="row"
          style={{
            gap: 28,
            marginTop: 22,
          }}
        >
          <div>
            <strong>{profile.followers}</strong>
            <div className="subtitle">followers</div>
          </div>

          <div>
            <strong>{profile.following}</strong>
            <div className="subtitle">following</div>
          </div>

          <div>
            <strong>{boards.length}</strong>
            <div className="subtitle">boards</div>
          </div>
        </div>
      </div>

      <div
        className="profile-layout"
        style={{ marginTop: 14 }}
      >
        <div className="stack">
          {theme.showBoards && (
            <div className="card">
              <div
                className="row"
                style={{
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <div>
                  <div className="eyebrow">
                    Pinned Boards
                  </div>
                  <h2 style={{ marginTop: 3 }}>
                    Your corners of the internet
                  </h2>
                  <p
                    className="subtitle"
                    style={{ marginTop: 4 }}
                  >
                    {pinnedBoards.length} of 3 pinned to your profile.
                  </p>
                </div>

                <button
                  type="button"
                  className="btn"
                  onClick={onCustomizeBoards}
                >
                  <LayoutGrid size={15} />
                  Manage
                </button>
              </div>

              {pinnedBoards.length > 0 ? (
                <div
                  className="grid"
                  style={{
                    gridTemplateColumns:
                      "repeat(3,minmax(0,1fr))",
                    marginTop: 14,
                  }}
                >
                  {pinnedBoards.map((board) => (
                    <BoardPreview
                      key={board.id}
                      board={board}
                      onOpenBoard={onOpenBoard}
                    />
                  ))}
                </div>
              ) : (
                <button
                  type="button"
                  className="card"
                  onClick={onCustomizeBoards || onOpenBoards}
                  style={{
                    width: "100%",
                    marginTop: 14,
                    minHeight: 150,
                    display: "grid",
                    placeItems: "center",
                    textAlign: "center",
                    borderStyle: "dashed",
                    cursor: "pointer",
                  }}
                >
                  <div>
                    <Plus size={22} />
                    <strong
                      style={{
                        display: "block",
                        marginTop: 8,
                      }}
                    >
                      Pin a Board to your profile
                    </strong>
                    <span
                      className="subtitle"
                      style={{
                        display: "block",
                        marginTop: 4,
                      }}
                    >
                      Choose up to three Boards to feature here.
                    </span>
                  </div>
                </button>
              )}

              <div
                className="row"
                style={{
                  justifyContent: "flex-end",
                  marginTop: 12,
                }}
              >
                <button
                  type="button"
                  className="btn"
                  onClick={onOpenBoards}
                >
                  View all Boards
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}

          {theme.showMusic && (
            <div className="card">
              <div className="eyebrow">On repeat</div>
              <h3 style={{ marginTop: 6 }}>
                {theme.favoriteArtist ||
                  "Your soundtrack goes here"}
              </h3>
              <p
                className="subtitle"
                style={{ marginTop: 4 }}
              >
                A small detail that makes your profile yours.
              </p>
            </div>
          )}
        </div>

        <div className="stack">
          <button
            type="button"
            className="card"
            style={{ textAlign: "left" }}
            onClick={onSwitchSpaces}
          >
            <div className="eyebrow">Active space</div>

            <div
              className="row"
              style={{ marginTop: 7 }}
            >
              <div style={{ flex: 1 }}>
                <strong>
                  @{activeSpace.handle}
                </strong>
                <p className="subtitle">
                  Switch between your identities.
                </p>
              </div>

              <ChevronRight
                size={18}
                className="muted"
              />
            </div>
          </button>

          <div className="card">
            <div className="eyebrow">Profile Studio</div>
            <h3 style={{ marginTop: 5 }}>
              Build your page your way
            </h3>
            <p
              className="subtitle"
              style={{ marginTop: 5 }}
            >
              Nostalgic customization, with modern controls and privacy intact.
            </p>

            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: 12 }}
              onClick={onCustomize}
            >
              <Settings size={15} />
              Customize profile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
