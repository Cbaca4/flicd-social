import React from "react";
import { ChevronRight, LogOut, Palette, Pencil, Settings, Users } from "lucide-react";
import { supabase } from "../../lib/supabase";
import CompanionSettings, { normalizeCompanionSettings } from "../companion/CompanionSettings.jsx";
import { loadCompanionSettings, saveCompanionSettings } from "../companion/companionStorage.js";

const SettingRow = ({ icon: Icon, title, description, onClick }) => (
  <button
    type="button"
    className="card"
    onClick={onClick}
    style={{ width: "100%", textAlign: "left" }}
  >
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

export default function ProfileSettings({ onBack, onEditProfile, onProfileStudio, onBoards, onSpaces, userId }) {
  const [companionSettings, setCompanionSettings] = React.useState(() => loadCompanionSettings(userId));

  const updateCompanionSettings = (nextSettings) => {
    const normalized = normalizeCompanionSettings(nextSettings);
    setCompanionSettings(normalized);
    saveCompanionSettings(userId, normalized);
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error("Failed to sign out:", error);
  };

  return (
    <div className="screen">
      <div className="topbar">
        <div>
          <div className="eyebrow">Settings</div>
          <h1 className="title">Your Flic'd settings</h1>
          <p className="subtitle">Manage your profile, account, and app options.</p>
        </div>
        <button type="button" className="btn" onClick={onBack}>Done</button>
      </div>

      <div className="stack" style={{ maxWidth: 760 }}>
        <SettingRow
          icon={Pencil}
          title="Edit Profile"
          description="Change your username, name, bio, and profile details."
          onClick={onEditProfile}
        />
        <SettingRow
          icon={Palette}
          title="Profile Studio"
          description="Customize your profile's look, sections, and theme."
          onClick={onProfileStudio}
        />
        <SettingRow
          icon={Settings}
          title="Boards"
          description="Manage your saved Boards and pinned profile Boards."
          onClick={onBoards}
        />
        <SettingRow
          icon={Users}
          title="Spaces"
          description="Switch between your Flic'd spaces and identities."
          onClick={onSpaces}
        />

        <div className="settings-section-label">
          <div className="eyebrow">Coming Soon · Features</div>
          <p className="subtitle" style={{ marginTop: 4 }}>Little extras that make Flic'd feel like yours.</p>
        </div>

        <CompanionSettings value={companionSettings} onChange={updateCompanionSettings} />

        <div className="card" style={{ marginTop: 4 }}>
          <div className="eyebrow">Account</div>
          <p className="subtitle" style={{ marginTop: 4 }}>
            Sign out of this Flic'd account on this device.
          </p>
          <button
            type="button"
            className="btn"
            style={{ marginTop: 10 }}
            onClick={handleSignOut}
            aria-label="Sign out"
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
