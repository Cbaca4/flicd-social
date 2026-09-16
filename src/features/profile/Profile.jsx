import React from "react";
import { Settings, Plus, ChevronRight, Pencil, Pin } from "lucide-react";

export default function Profile({
  profile,
  activeSpace,
  onSwitchSpaces,
  theme,
  onCustomize,
  onEditProfile,
  boards = [],
  onOpenBoards,
  onOpenBoard,
  onCustomizeBoards,
}) {
  const openBoards = onOpenBoards || onOpenBoard || (() => {});
  const customizeBoards = onCustomizeBoards || openBoards;
  const pinnedBoards = boards.filter((board) => board.pinned).slice(0, 3);

  return (
    <div className="screen" style={{ background: theme.background }}>
      <div className="profile-hero">
        <div className="row" style={{ alignItems: "flex-start" }}>
          <div className="avatar lg">{profile?.handle?.[0]?.toUpperCase() || "?"}</div>
          <div style={{ flex: 1 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div className="eyebrow">{activeSpace.label} space</div>
                <h1 className="title" style={{ fontSize: 28, marginTop: 2 }}>@{profile.handle}</h1>
                {profile.displayName && <div style={{ marginTop: 4, fontSize: 15, fontWeight: 600 }}>{profile.displayName}</div>}
                {profile.bio && <p className="subtitle" style={{ marginTop: 6 }}>{profile.bio}</p>}
              </div>
              <div className="row" style={{ gap: 8 }}>
                <button type="button" className="btn" onClick={onEditProfile}><Pencil size={15} />Edit profile</button>
                <button type="button" className="btn icon-btn" onClick={onCustomize} aria-label="Customize profile"><Settings size={18} /></button>
              </div>
            </div>
            <p className="subtitle" style={{ marginTop: 10 }}>{theme.message}</p>
            <p style={{ marginTop: 8, color: theme.accent, fontSize: 12 }}>{theme.statusEmoji} {theme.status}</p>
          </div>
        </div>
        <div className="row" style={{ gap: 28, marginTop: 22 }}>
          <div><strong>{profile.followers}</strong><div className="subtitle">followers</div></div>
          <div><strong>{profile.following}</strong><div className="subtitle">following</div></div>
          <div><strong>{boards.length}</strong><div className="subtitle">boards</div></div>
        </div>
      </div>

      <div className="profile-layout" style={{ marginTop: 14 }}>
        <div className="stack">
          {theme.showBoards && (
            <div className="card">
              <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div className="eyebrow">Boards</div>
                  <h2 style={{ marginTop: 3 }}>Your corners of the internet</h2>
                  <p className="subtitle" style={{ marginTop: 4 }}>Tap a Board to open it, or view everything.</p>
                </div>
                <button type="button" className="btn" onClick={customizeBoards}>
                  <Settings size={15} />Customize Boards
                </button>
              </div>

              <div className="grid grid-2" style={{ marginTop: 14 }}>
                {pinnedBoards.map((board) => (
                  <button key={board.id} type="button" className="card" style={{ textAlign: "left", padding: 10, cursor: "pointer" }} onClick={() => openBoards(board)}>
                    <div className="board-cover" style={{ overflow: "hidden" }}>
                      {board.cover_url && <img src={board.cover_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                      <span className="tag" style={{ position: "absolute", left: 9, bottom: 9 }}>{board.count || 0} {(board.count || 0) === 1 ? "item" : "items"}</span>
                      {board.pinned && <span className="tag" style={{ position: "absolute", right: 9, top: 9 }}><Pin size={12} /></span>}
                    </div>
                    <strong style={{ display: "block", marginTop: 8 }}>{board.name}</strong>
                    <p className="subtitle" style={{ marginTop: 3 }}>{board.description || "Your saved moments"}</p>
                  </button>
                ))}

                {pinnedBoards.length === 0 && (
                  <button type="button" className="card" style={{ minHeight: 190, display: "grid", placeItems: "center", textAlign: "center", cursor: "pointer" }} onClick={openBoards}>
                    <div><strong>No pinned Boards yet</strong><p className="subtitle" style={{ marginTop: 4 }}>Open Boards to create or pin one.</p></div>
                  </button>
                )}

                <button type="button" className="card" style={{ display: "grid", placeItems: "center", minHeight: 190, borderStyle: "dashed", cursor: "pointer" }} onClick={openBoards}>
                  <Plus size={22} />
                  <span style={{ marginTop: 8 }}>New board</span>
                  <p className="subtitle" style={{ marginTop: 4 }}>Open Boards</p>
                </button>
              </div>

              <button type="button" className="btn" style={{ marginTop: 14, width: "100%", justifyContent: "center" }} onClick={openBoards}>
                View all Boards <ChevronRight size={16} />
              </button>
            </div>
          )}

          {theme.showMusic && (
            <div className="card">
              <div className="eyebrow">On repeat</div>
              <h3 style={{ marginTop: 6 }}>{theme.favoriteArtist || "Your soundtrack goes here"}</h3>
              <p className="subtitle" style={{ marginTop: 4 }}>A small detail that makes your profile yours.</p>
            </div>
          )}
        </div>

        <div className="stack">
          <button type="button" className="card" style={{ textAlign: "left" }} onClick={onSwitchSpaces}>
            <div className="eyebrow">Active space</div>
            <div className="row" style={{ marginTop: 7 }}>
              <div style={{ flex: 1 }}><strong>@{activeSpace.handle}</strong><p className="subtitle">Switch between your identities.</p></div>
              <ChevronRight size={18} className="muted" />
            </div>
          </button>

          <div className="card">
            <div className="eyebrow">Profile Studio</div>
            <h3 style={{ marginTop: 5 }}>Build your page your way</h3>
            <p className="subtitle" style={{ marginTop: 5 }}>Nostalgic customization, with modern controls and privacy intact.</p>
            <button type="button" className="btn btn-primary" style={{ marginTop: 12 }} onClick={onCustomize}><Settings size={15} />Customize profile</button>
          </div>
        </div>
      </div>
    </div>
  );
}
