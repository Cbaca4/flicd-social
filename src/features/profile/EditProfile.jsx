import React from "react";
import { ArrowLeft, ImagePlus, Save } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { removeProfilePhoto, uploadProfilePhoto } from "./profileMedia.js";

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
  const [avatarUrl, setAvatarUrl] = React.useState(profile.avatarUrl || "");
  const [photoSaving, setPhotoSaving] = React.useState(false);

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [photoError, setPhotoError] = React.useState("");

  async function handlePhotoChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || photoSaving) return;

    setPhotoError("");
    setPhotoSaving(true);
    let uploadedUrl = "";

    try {
      uploadedUrl = await uploadProfilePhoto(file);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be logged in to change your profile photo.");

      const { data, error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: uploadedUrl })
        .eq("id", user.id)
        .select()
        .single();

      if (updateError) throw updateError;

      setAvatarUrl(uploadedUrl);
      onSaved?.(data);
      onToast?.("Profile photo updated");
    } catch (photoUploadError) {
      if (uploadedUrl) await removeProfilePhoto(uploadedUrl);
      setPhotoError(photoUploadError.message || "Could not update your profile photo.");
    } finally {
      setPhotoSaving(false);
    }
  }

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
        avatar_url: avatarUrl || null,
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
          type="button"
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
        <div>
          <label className="eyebrow" htmlFor="profile-photo">
            Profile photo
          </label>

          <div className="row" style={{ marginTop: 10, alignItems: "center" }}>
            <div className="avatar lg" aria-hidden="true">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }}
                />
              ) : (
                (username || "?")[0].toUpperCase()
              )}
            </div>
            <div style={{ flex: 1 }}>
              <input
                id="profile-photo"
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                disabled={photoSaving || saving}
                aria-label="Profile photo"
              />
              <p className="subtitle" style={{ marginTop: 6 }}>
                Choose a photo from your gallery. JPEG, PNG, or WebP, up to 5 MB.
              </p>
            </div>
            <ImagePlus size={20} className="muted" aria-hidden="true" />
          </div>

          {photoSaving ? <p className="subtitle" style={{ marginTop: 7 }}>Uploading photo...</p> : null}
          {photoError ? <p className="subtitle" style={{ marginTop: 7, color: "var(--danger, #ff6b6b)" }}>{photoError}</p> : null}
        </div>

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

        <button
          className="btn btn-primary"
          type="submit"
          disabled={saving || photoSaving}
        >
          <Save size={15} />

          {saving ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
