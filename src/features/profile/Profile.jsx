import React from "react";
import { Settings, Plus, ChevronRight, Pin, LayoutGrid, Pencil, Palette, Users, LogOut, ShieldCheck, Bell, SlidersHorizontal, Database, HelpCircle, Info, UserRoundCog } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { getPinnedBoards } from "./boardPinning.js";
import { getRelationshipCounts } from "../social/socialApi.js";
import CompanionSettings from "../companion/CompanionSettings.jsx";
import { normalizeCompanionSettings } from "../companion/companionSettingsConfig.js";
import { loadCompanionSettings, saveCompanionSettings } from "../companion/companionStorage.js";
import OnRepeat from "../music/OnRepeat.jsx";
import MusicCredits from "../music/MusicCredits.jsx";

function SettingsList({ onBack, onEditProfile, onCustomize, onBoards, onSpaces }) {
  const [companionUserId, setCompanionUserId] = React.useState("");
  const [companionSettings, setCompanionSettings] = React.useState(() => loadCompanionSettings(""));
  const [musicCreditsOpen, setMusicCreditsOpen] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      const userId = data?.user?.id || "local";
      setCompanionUserId(userId);
      setCompanionSettings(loadCompanionSettings(userId));
    });
    return () => { active = false; };
  }, []);

  const updateCompanionSettings = (nextSettings) => {
    const normalized = normalizeCompanionSettings(nextSettings);
    setCompanionSettings(normalized);
    saveCompanionSettings(companionUserId || "local", normalized);
  };

  if (musicCreditsOpen) {
    return <MusicCredits onBack={() => setMusicCreditsOpen(false)} />;
  }

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error("Failed to sign out:", error);
  };

  const row = (Icon, title, description, onClick) => (
    <button type="button" className="card" onClick={onClick} style={{ width: "100%", textAlign: "left" }}>
      <div className="row">
        <Icon size={18} />
        <div style={{ flex: 1 }}>
          <strong>{title}</strong>
          <p className="subtitle" style={{ marginTop: 3 }}>{description}</p>
        </div>
        <ChevronRight size={18} className="muted" />
      </div>
    </button>
  );

  const placeholderRow = (Icon, title, description) => (
    <div className="card" aria-disabled="true" style={{ width: "100%", opacity: 0.82 }}>
      <div className="row">
        <Icon size={18} />
        <div style={{ flex: 1 }}>
          <strong>{title}</strong>
          <p className="subtitle" style={{ marginTop: 3 }}>{description}</p>
        </div>
        <span className="tag">Coming soon</span>
      </div>
    </div>
  );

  return (
    <div className="screen">
      <div className="topbar">
        <div>
          <div className="eyebrow">Settings</div>
          <h1 className="title">Settings</h1>
          <p className="subtitle">Manage your profile and Flic'd account.</p>
        </div>
        <button type="button" className="btn" onClick={onBack}>Done</button>
      </div>

      <div className="stack" style={{ maxWidth: 760 }}>
        <div className="eyebrow" style={{ marginTop: 4 }}>Profile</div>
        {row(Pencil, "Edit Profile", "Change your username, name, bio, and profile details.", onEditProfile)}
        {row(Palette, "Profile Studio", "Customize your profile's look, sections, and theme.", onCustomize)}
        {row(LayoutGrid, "Boards", "Manage your saved Boards and pinned profile Boards.", onBoards)}
        {row(Users, "Spaces", "Switch between your Flic'd spaces and identities.", onSpaces)}

        <div className="settings-section-label" style={{ marginTop: 12 }}>
          <div className="eyebrow">Coming Soon · Features</div>
          <p className="subtitle" style={{ marginTop: 4 }}>Little extras that make Flic'd feel like yours.</p>
        </div>

        <CompanionSettings value={companionSettings} onChange={updateCompanionSettings} />

        <div className="eyebrow" style={{ marginTop: 12 }}>Account</div>
        {placeholderRow(UserRoundCog, "Account & Security", "Email, password, active sessions, and account management.")}
        {placeholderRow(ShieldCheck, "Privacy & Safety", "Visibility, blocking, interaction controls, and safety settings.")}
        {placeholderRow(Bell, "Notifications", "Choose which likes, comments, messages, follows, and requests you receive.")}
        {placeholderRow(SlidersHorizontal, "Content Preferences", "Manage muted words, feed preferences, and content controls.")}
        {placeholderRow(Settings, "Appearance", "App-wide theme, accessibility, and display settings.")}
        {placeholderRow(Database, "Data & Storage", "Downloads, cached media, storage usage, and data controls.")}

        <div className="eyebrow" style={{ marginTop: 12 }}>Support & About</div>
        {placeholderRow(HelpCircle, "Help & Support", "FAQ, report a problem, and ways to get help with Flic'd.")}
        {row(Info, "Music Credits & Licenses", "See the artists, source pages, and licenses used by the beta music catalog.", () => setMusicCreditsOpen(true))}
        {placeholderRow(Info, "About Flic'd", "App version, Terms, Privacy Policy, and third-party licenses.")}

        <div className="card" style={{ marginTop: 4 }}>
          <div className="eyebrow">Account</div>
          <p className="subtitle" style={{ marginTop: 4 }}>Sign out of this Flic'd account on this device.</p>
          <button type="button" className="btn" style={{ marginTop: 10 }} onClick={handleSignOut} aria-label="Sign out">
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

function BoardPreview({ board, onOpenBoard }) {
  const style = board?.style_config || {};
  const cover = board?.cover_url || "";
  const accent = style.accent || "#ff72b6";
  const background = style.background || "#111111";
  const count = Number.isFinite(board?.count) ? board.count : 0;

  return (
    <button type="button" className="card" onClick={() => onOpenBoard?.(board)} style={{ textAlign: "left", padding: 10, cursor: "pointer", minWidth: 0 }} aria-label={`Open Board ${board.name}`}>
      <div className="board-cover" style={{ overflow: "hidden", borderRadius: style.radius !== undefined ? `${Math.max(8, Number(style.radius) - 6)}px` : undefined, background, position: "relative" }}>
        {cover ? <img src={cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: `linear-gradient(135deg, ${background}, ${accent}33)`, color: accent }}><Pin size={24} /></div>}
        <span className="tag" style={{ position: "absolute", left: 9, bottom: 9 }}>{count} {count === 1 ? "item" : "items"}</span>
        <span className="tag" style={{ position: "absolute", right: 9, top: 9, color: accent }} aria-hidden="true"><Pin size={12} /></span>
      </div>
      <strong style={{ display: "block", marginTop: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{board.name}</strong>
      <p className="subtitle" style={{ marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{board.description || "Your saved moments"}</p>
    </button>
  );
}

export default function Profile({ profile, activeSpace, onSwitchSpaces, theme, onSettings, onCustomize, onEditProfile, boards = [], onOpenBoards, onCustomizeBoards, onOpenBoard, musicTrack = null, onMusicTrackChange }) {
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [relationshipCounts, setRelationshipCounts] = React.useState(() => ({
    followers: profile?.followers ?? 0,
    following: profile?.following ?? 0,
  }));
  const pinnedBoards = getPinnedBoards(boards);

  React.useEffect(() => {
    setRelationshipCounts({
      followers: profile?.followers ?? 0,
      following: profile?.following ?? 0,
    });
    if (!profile?.id) return undefined;
    let active = true;
    getRelationshipCounts(profile.id)
      .then((counts) => {
        if (active) setRelationshipCounts(counts);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [profile?.id, profile?.followers, profile?.following]);

  if (settingsOpen) {
    return (
      <SettingsList
        onBack={() => setSettingsOpen(false)}
        onEditProfile={() => { setSettingsOpen(false); onEditProfile?.(); }}
        onCustomize={() => { setSettingsOpen(false); onCustomize?.(); }}
        onBoards={() => { setSettingsOpen(false); onOpenBoards?.(); }}
        onSpaces={() => { setSettingsOpen(false); onSwitchSpaces?.(); }}
      />
    );
  }

  const openSettings = () => {
    if (onSettings) onSettings();
    else setSettingsOpen(true);
  };

  return (
    <div className="screen" style={{ background: theme.background }}>
      <div className="profile-hero">
        <div className="profile-heading">
          <div className="avatar lg">
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={`@${profile.handle} profile`}
                style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit", display: "block" }}
              />
            ) : (
              profile.handle[0].toUpperCase()
            )}
          </div>
          <div className="profile-identity">
            <div className="profile-title-row">
              <div>
                <div className="eyebrow">{activeSpace.label} space</div>
                <h1 className="title" style={{ fontSize: 28, marginTop: 2 }}>@{profile.handle}</h1>
              </div>
              <div className="profile-actions">
                <button type="button" className="btn" onClick={onEditProfile} aria-label="Edit Profile"><Pencil size={15} />Edit Profile</button>
                <button type="button" className="btn icon-btn" onClick={openSettings} aria-label="Settings"><Settings size={18} /></button>
              </div>
            </div>
            {profile.bio ? <p className="profile-bio">{profile.bio}</p> : null}
            <p className="subtitle profile-message">{theme.message}</p>
            <p className="profile-status" style={{ color: theme.accent }}>{theme.statusEmoji} {theme.status}</p>
          </div>
        </div>

        <div className="row" style={{ gap: 28, marginTop: 22 }}>
          <div><strong>{relationshipCounts.followers}</strong><div className="subtitle">followers</div></div>
          <div><strong>{relationshipCounts.following}</strong><div className="subtitle">following</div></div>
          <div><strong>{boards.length}</strong><div className="subtitle">boards</div></div>
        </div>
      </div>

      <div className="profile-layout" style={{ marginTop: 14 }}>
        <div className="stack">
          {theme.showBoards && <div className="card">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <div><div className="eyebrow">Pinned Boards</div><h2 style={{ marginTop: 3 }}>Your corners of the internet</h2><p className="subtitle" style={{ marginTop: 4 }}>{pinnedBoards.length} of 3 pinned to your profile.</p></div>
              <button type="button" className="btn" onClick={onCustomizeBoards}><LayoutGrid size={15} />Manage</button>
            </div>
            {pinnedBoards.length > 0 ? <div className="grid" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))", marginTop: 14 }}>{pinnedBoards.map((board) => <BoardPreview key={board.id} board={board} onOpenBoard={onOpenBoard} />)}</div> : <button type="button" className="card" onClick={onCustomizeBoards || onOpenBoards} style={{ width: "100%", marginTop: 14, minHeight: 150, display: "grid", placeItems: "center", textAlign: "center", borderStyle: "dashed", cursor: "pointer" }}><div><Plus size={22} /><strong style={{ display: "block", marginTop: 8 }}>Pin a Board to your profile</strong><span className="subtitle" style={{ display: "block", marginTop: 4 }}>Choose up to three Boards to feature here.</span></div></button>}
            <div className="row" style={{ justifyContent: "flex-end", marginTop: 12 }}><button type="button" className="btn" onClick={onOpenBoards}>View all Boards<ChevronRight size={15} /></button></div>
          </div>}
          {theme.showMusic && <OnRepeat track={musicTrack} onTrackChange={onMusicTrackChange} />}
        </div>

        <div className="stack">
          <button type="button" className="card" style={{ textAlign: "left" }} onClick={onSwitchSpaces}>
            <div className="eyebrow">Active space</div>
            <div className="row" style={{ marginTop: 7 }}><div style={{ flex: 1 }}><strong>@{activeSpace.handle}</strong><p className="subtitle">Switch between your identities.</p></div><ChevronRight size={18} className="muted" /></div>
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
