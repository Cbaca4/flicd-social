import React from "react";
import { Settings, Plus, ChevronRight, Pin, LayoutGrid, Pencil, Palette, Users, LogOut, ShieldCheck, Bell, SlidersHorizontal, Database, HelpCircle, Info, UserRoundCog, Archive as ArchiveIcon } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { getPinnedBoards } from "./boardPinning.js";
import { getRelationshipCounts } from "../social/socialApi.js";
import CompanionSettings from "../companion/CompanionSettings.jsx";
import { normalizeCompanionSettings } from "../companion/companionSettingsConfig.js";
import { loadCompanionSettings, saveCompanionSettings } from "../companion/companionStorage.js";
import OnRepeat from "../music/OnRepeat.jsx";
import MusicCredits from "../music/MusicCredits.jsx";
import RelationshipList from "../social/RelationshipList.jsx";

function SettingsList({ onBack, onEditProfile, onCustomize, onBoards, onSpaces, onArchive }) {
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
        {row(ArchiveIcon, "Archive", "Only you can access Flic&apos;d posts after they expire.", onArchive)}
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

export default function Profile({ profile, activeSpace, onSwitchSpaces, theme, onSettings, onCustomize, onEditProfile, boards = [], onOpenBoards, onCustomizeBoards, onOpenBoard, musicTrack = null, onMusicTrackChange, musicPlaying = false, onToggleMusic, onNotifications, notificationsUnread = 0, onUserSelect, onArchive }) {
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [relationshipList, setRelationshipList] = React.useState(null);
  const [relationshipCounts, setRelationshipCounts] = React.useState({ followers: profile?.followers ?? 0, following: profile?.following ?? 0 });
  const pinnedBoards = getPinnedBoards(boards);

  React.useEffect(() => {
    setRelationshipCounts({ followers: profile?.followers ?? 0, following: profile?.following ?? 0 });
    if (!profile?.id) return undefined;
    let active = true;
    getRelationshipCounts(profile.id).then((counts) => { if (active) setRelationshipCounts(counts); }).catch(() => {});
    return () => { active = false; };
  }, [profile?.id, profile?.followers, profile?.following]);

  if (settingsOpen) {
    return <SettingsList
      onBack={() => setSettingsOpen(false)}
      onEditProfile={() => { setSettingsOpen(false); onEditProfile?.(); }}
      onCustomize={() => { setSettingsOpen(false); onCustomize?.(); }}
      onBoards={() => { setSettingsOpen(false); onOpenBoards?.(); }}
      onSpaces={() => { setSettingsOpen(false); onSwitchSpaces?.(); }}
      onArchive={() => { setSettingsOpen(false); onArchive?.(); }}
    />;
  }

  const openSettings = () => {
    if (onSettings) onSettings();
    else setSettingsOpen(true);
  };

  const sectionStyle = (name) => {
    const style = theme?.sectionStyles?.[name] || {};
    const radius = Math.max(12, Number(theme?.radius) || Number(style.radius) || 20);
    return { background: style.background, borderColor: style.border, borderRadius: radius + "px", overflow: "hidden", minWidth: 0 };
  };
  const buttonStyle = theme?.buttonStyle || {};

  return (
    <div className="screen profile-screen">
      {theme.backgroundMedia?.url && (
        <div className="profile-background-media" aria-hidden="true">
          {theme.backgroundMedia.type === "video" ? (
            <video src={theme.backgroundMedia.url} autoPlay loop muted playsInline style={{ objectPosition: (theme.backgroundMedia.positionX ?? 50) + "% " + (theme.backgroundMedia.positionY ?? 50) + "%", transform: "scale(" + (theme.backgroundMedia.scale ?? 1) + ")" }} />
          ) : (
            <img src={theme.backgroundMedia.url} alt="" style={{ objectPosition: (theme.backgroundMedia.positionX ?? 50) + "% " + (theme.backgroundMedia.positionY ?? 50) + "%", transform: "scale(" + (theme.backgroundMedia.scale ?? 1) + ")" }} />
          )}
        </div>
      )}
      <div className="profile-content-layer">
        <section className="profile-hero profile-section-card" style={sectionStyle("hero")}>
          <button type="button" className="profile-settings-corner" onClick={openSettings} aria-label="Settings"><Settings size={18} /></button>
          <div className="profile-username-heading">@{profile.handle}</div>
          <div className="profile-main-row">
            <div className="avatar lg">
              {profile.avatarUrl ? <img src={profile.avatarUrl} alt={"@" + profile.handle + " profile"} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit", display: "block" }} /> : profile.handle[0].toUpperCase()}
            </div>
            <div className="profile-main-identity">
              {profile.displayName ? <div className="profile-display-name">{profile.displayName}</div> : null}
              <div className="profile-mini-stats">
                <button type="button" className="profile-stat profile-stat--inline" onClick={() => setRelationshipList("followers")}><strong>{relationshipCounts.followers}</strong><span className="subtitle">followers</span></button>
                <button type="button" className="profile-stat profile-stat--inline" onClick={() => setRelationshipList("following")}><strong>{relationshipCounts.following}</strong><span className="subtitle">following</span></button>
                <button type="button" className="profile-stat profile-stat--inline" onClick={onOpenBoards}><strong>{boards.length}</strong><span className="subtitle">boards</span></button>
              </div>
            </div>
          </div>
          {profile.bio ? <p className="profile-bio">{profile.bio}</p> : null}
          {profile.links?.length > 0 && <div className="profile-links" aria-label="Profile links">{profile.links.map((link, index) => <a key={link.url + "-" + index} href={link.url} target="_blank" rel="noreferrer noopener">{link.label || link.url.replace(/^https?:///i, "").replace(/\/$/, "")}</a>)}</div>}
          <div className="profile-hero-actions">
            <button type="button" className="btn btn-primary" onClick={onEditProfile} aria-label="Edit Profile"><Pencil size={15} />Edit Profile</button>
            {onNotifications && <button type="button" className="btn icon-btn profile-notifications-btn" onClick={onNotifications} aria-label="Notifications" style={{ position: "relative" }}><Bell size={18} />{notificationsUnread > 0 && <span className="nav-unread-badge">{notificationsUnread > 9 ? "9+" : notificationsUnread}</span>}</button>}
          </div>
        </section>

        <div className="profile-lower-grid">
          <section className="card profile-section-card profile-pinned-card" style={sectionStyle("boards")}>
            <div className="row" style={{ justifyContent: "space-between", gap: 8 }}><div><div className="eyebrow">Pinned Boards</div><h2 style={{ marginTop: 2 }}>Boards</h2></div><button type="button" className="btn icon-btn" onClick={onCustomizeBoards} aria-label="Manage pinned boards"><LayoutGrid size={16} /></button></div>
            {pinnedBoards.length > 0 ? <div className="profile-pinned-grid">{pinnedBoards.map((board) => <BoardPreview key={board.id} board={board} onOpenBoard={onOpenBoard} />)}</div> : <button type="button" className="profile-empty-board" onClick={onCustomizeBoards || onOpenBoards}><Plus size={18} /><span>Pin a Board</span></button>}
          </section>

          <div className="profile-right-stack">
            <button type="button" className="card profile-section-card profile-compact-section" style={{ ...sectionStyle("activeSpace"), textAlign: "left" }} onClick={onSwitchSpaces}><div className="eyebrow">Active space</div><div className="row profile-compact-row"><div style={{ minWidth: 0 }}><strong>@{activeSpace.handle}</strong><p className="subtitle">Switch spaces</p></div><ChevronRight size={17} className="muted" /></div></button>
            {theme.showMusic && <OnRepeat track={musicTrack} onTrackChange={onMusicTrackChange} playing={musicPlaying} onTogglePlay={onToggleMusic} className="profile-section-card" style={sectionStyle("onRepeat")} />}
            <div className="card profile-section-card profile-compact-section" style={sectionStyle("customize")}><div className="row" style={{ justifyContent: "space-between", gap: 8 }}><div><div className="eyebrow">Profile Studio</div><strong style={{ display: "block", marginTop: 3 }}>Customize your page</strong></div><Palette size={17} /></div><button type="button" className="btn btn-primary" style={{ marginTop: 8, width: "100%" }} onClick={onCustomize}>Open Studio</button></div>
          </div>
        </div>
      </div>
      {relationshipList && <RelationshipList profileId={profile.id} type={relationshipList} onClose={() => setRelationshipList(null)} onUserSelect={onUserSelect} />}
    </div>
  );
}
