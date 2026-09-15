import React from "react";
import { ArrowLeft, Save } from "lucide-react";
import { supabase } from "../../lib/supabase";

export default function EditProfile({
  profile,
  onBack,
  onSaved,
  onToast,
}) {
  const [username, setUsername] = React.useState(profile.handle || "");
  const [displayName, setDisplayName] = React.useState(
    profile.displayName || ""
  );
  const [bio, setBio] = React.useState(profile.bio || "");

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  async function handleSave(event) {
    event.preventDefault();

    const cleanUsername = username.trim().toLowerCase();
    const cleanDisplayName = displayName.trim();
    const cleanBio = bio.trim();

    if (!cleanUsername) {
      setError("Username is required.");
      return;
    }

    setError("");
    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("You must be logged in to edit your profile.");
      setSaving(false);
      return;
    }

    const { data, error: updateError } = await supabase
      .from("profiles")
      .update({
        username: cleanUsername,
        display_name: cleanDisplayName || null,
        bio: cleanBio || null,
      })
      .eq("id", user.id)
      .select()
      .single();

    if (updateError) {
      if (updateError.code === "23505") {
        setError("That username is already taken.");
      } else {
        setError(updateError.message);
      }

      setSaving(false);
      return;
    }

    onSaved?.(data);
    onToast?.("Profile updated");
    setSaving(false);
  }

  return (
    <div className="screen">
      <div className="topbar">
        <button
          className="btn icon-btn"
          onClick={onBack}
          aria-label="Back to profile"
        >
          <ArrowLeft size={18} />
        </button>

        <div style={{ flex: 1 }}>
          <div className="eyebrow">Profile</div>
          <h1 className="title">Edit Profile</h1>
        </div>
      </div>

      <form
        className="card stack"
        onSubmit={handleSave}
        style={{ marginTop: 18 }}
      >
        {/* Username */}
        <div>
          <label
            className="eyebrow"
            htmlFor="profile-username"
          >
            Username
          </label>

          <input
            id="profile-username"
            className="input"
            style={{ marginTop: 8 }}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="yourusername"
            autoComplete="username"
            maxLength={30}
          />

          <p className="subtitle" style={{ marginTop: 6 }}>
            Your unique @username on Flic&apos;d.
          </p>
        </div>

        {/* Display Name */}
        <div>
          <label
            className="eyebrow"
            htmlFor="profile-display-name"
          >
            Display name
          </label>

          <input
            id="profile-display-name"
            className="input"
            style={{ marginTop: 8 }}
            value={displayName}
            onChange={(event) =>
              setDisplayName(event.target.value)
            }
            placeholder="Your name"
            maxLength={50}
          />

          <p className="subtitle" style={{ marginTop: 6 }}>
            The name people see on your profile.
          </p>
        </div>

        {/* Bio */}
        <div>
          <label
            className="eyebrow"
            htmlFor="profile-bio"
          >
            Bio
          </label>

          <textarea
            id="profile-bio"
            className="input"
            style={{
              marginTop: 8,
              minHeight: 110,
              resize: "vertical",
            }}
            value={bio}
            onChange={(event) =>
              setBio(event.target.value)
            }
            placeholder="Tell people a little about yourself..."
            maxLength={160}
          />

          <p className="subtitle" style={{ marginTop: 6 }}>
            {bio.length}/160
          </p>
        </div>

        {/* Error */}
        {error && (
          <div
            className="card"
            style={{
              borderColor: "rgba(255,80,80,.4)",
            }}
          >
            <p>{error}</p>
          </div>
        )}

        {/* Save */}
        <button
          className="btn btn-primary"
          type="submit"
          disabled={saving}
        >
          <Save size={15} />

          {saving ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
