import React from "react";
import { ArrowLeft, ImagePlus, Save } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { removeProfilePhoto, uploadProfilePhoto, validateProfilePhoto } from "./profileMedia.js";
import { sanitizeProfileLinks, sanitizeProfileTheme } from "./profileTheme.js";

const CROP_SIZE = 720;

function ProfilePhotoCropper({ file, onCancel, onConfirm, saving }) {
  const [url] = React.useState(() => URL.createObjectURL(file));
  const [zoom, setZoom] = React.useState(1);
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });
  const [imageSize, setImageSize] = React.useState({ width: 0, height: 0 });
  const dragRef = React.useRef(null);

  React.useEffect(() => () => URL.revokeObjectURL(url), [url]);

  const scale = imageSize.width && imageSize.height
    ? Math.max(CROP_SIZE / imageSize.width, CROP_SIZE / imageSize.height) * zoom
    : 1;
  const displayWidth = imageSize.width * scale;
  const displayHeight = imageSize.height * scale;

  const onPointerDown = (event) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      ox: offset.x,
      oy: offset.y,
    };
  };

  const onPointerMove = (event) => {
    if (!dragRef.current) return;
    setOffset({
      x: dragRef.current.ox + event.clientX - dragRef.current.x,
      y: dragRef.current.oy + event.clientY - dragRef.current.y,
    });
  };

  const onPointerUp = (event) => {
    dragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const confirm = async () => {
    try {
      const image = new Image();
      image.src = url;
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
      });

      const canvas = document.createElement("canvas");
      canvas.width = CROP_SIZE;
      canvas.height = CROP_SIZE;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Your browser could not prepare the crop.");

      const sourceSize = CROP_SIZE / scale;
      const maxX = Math.max(0, image.naturalWidth - sourceSize);
      const maxY = Math.max(0, image.naturalHeight - sourceSize);
      const sx = Math.min(
        maxX,
        Math.max(0, (image.naturalWidth - sourceSize) / 2 - offset.x / scale),
      );
      const sy = Math.min(
        maxY,
        Math.max(0, (image.naturalHeight - sourceSize) / 2 - offset.y / scale),
      );

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(image, sx, sy, sourceSize, sourceSize, 0, 0, CROP_SIZE, CROP_SIZE);

      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/webp", 0.9),
      );
      if (!blob) throw new Error("Could not create the cropped profile photo.");

      await onConfirm(
        new File([blob], "profile-photo.webp", {
          type: "image/webp",
          lastModified: Date.now(),
        }),
      );
    } catch (error) {
      onCancel(error?.message || "Could not prepare that profile photo.");
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Crop profile photo">
      <div className="modal profile-photo-crop-modal">
        <div className="topbar">
          <div>
            <div className="eyebrow">Profile photo</div>
            <h2 className="title">Crop your photo</h2>
            <p className="subtitle">
              Drag the photo and zoom until the circle looks exactly how you want.
            </p>
          </div>
          <button type="button" className="btn" onClick={() => onCancel()} disabled={saving}>
            Cancel
          </button>
        </div>

        <div
          className="profile-photo-crop-stage"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => { dragRef.current = null; }}
        >
          <div className="profile-photo-crop-circle">
            <img
              src={url}
              alt="Profile photo crop preview"
              onLoad={(event) =>
                setImageSize({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                })
              }
              style={{
                width: displayWidth,
                height: displayHeight,
                left: "calc(50% + " + offset.x + "px)",
                top: "calc(50% + " + offset.y + "px)",
              }}
            />
          </div>
        </div>

        <label className="profile-range-field" style={{ marginTop: 14 }}>
          <span>Zoom <strong>{zoom.toFixed(2)}×</strong></span>
          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            aria-label="Profile photo zoom"
          />
        </label>

        <div className="row" style={{ justifyContent: "flex-end", marginTop: 14 }}>
          <button type="button" className="btn" onClick={() => onCancel()} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={confirm} disabled={saving}>
            {saving ? "Saving…" : "Use this crop"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EditProfile({
  profile,
  onBack,
  onSaved,
  onToast,
  profileTheme = {},
}) {
  const [username, setUsername] = React.useState(profile.handle || "");
  const [displayName, setDisplayName] = React.useState(
    profile.displayName || ""
  );
  const [bio, setBio] = React.useState(profile.bio || "");
  const [avatarUrl, setAvatarUrl] = React.useState(profile.avatarUrl || "");
  const [links, setLinks] = React.useState(() =>
    sanitizeProfileLinks(profile.links || profileTheme.profileLinks || [])
  );
  const [photoSaving, setPhotoSaving] = React.useState(false);
  const [cropFile, setCropFile] = React.useState(null);

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [photoError, setPhotoError] = React.useState("");

  async function handlePhotoChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || photoSaving) return;

    try {
      validateProfilePhoto(file);
      setPhotoError("");
      setCropFile(file);
    } catch (error) {
      setPhotoError(error.message || "Could not use that profile photo.");
    }
  }

  async function handleCropConfirm(croppedFile) {
    setPhotoError("");
    setPhotoSaving(true);
    let uploadedUrl = "";

    try {
      uploadedUrl = await uploadProfilePhoto(croppedFile);

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
      setCropFile(null);
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
    const cleanLinks = sanitizeProfileLinks(links);
    const nextTheme = sanitizeProfileTheme({
      ...profileTheme,
      profileLinks: cleanLinks,
    });

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
        profile_theme: nextTheme,
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
                  className="profile-avatar-image"
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
                Profile photo: 320×320 recommended (1:1). JPEG, PNG, or WebP, up to 10 MB.
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

        <div>
          <div className="eyebrow">Profile links</div>
          <p className="subtitle" style={{ marginTop: 6 }}>
            Add up to 3 links people can open directly from your profile.
          </p>

          <div className="stack" style={{ marginTop: 10 }}>
            {links.map((link, index) => (
              <div className="card profile-link-editor" key={index} style={{ margin: 0 }}>
                <div className="row" style={{ justifyContent: "space-between", gap: 8 }}>
                  <strong>Link {index + 1}</strong>
                  <button
                    type="button"
                    className="btn icon-btn"
                    onClick={() =>
                      setLinks((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index)
                      )
                    }
                    aria-label={"Remove link " + (index + 1)}
                  >
                    ×
                  </button>
                </div>

                <input
                  className="input"
                  style={{ marginTop: 9 }}
                  value={link.label}
                  onChange={(event) =>
                    setLinks((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, label: event.target.value }
                          : item
                      )
                    )
                  }
                  placeholder="Label (optional)"
                  maxLength={40}
                  aria-label={"Link " + (index + 1) + " label"}
                />

                <input
                  className="input"
                  style={{ marginTop: 8 }}
                  value={link.url}
                  onChange={(event) =>
                    setLinks((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, url: event.target.value }
                          : item
                      )
                    )
                  }
                  placeholder="https://example.com"
                  maxLength={500}
                  inputMode="url"
                  autoComplete="url"
                  aria-label={"Link " + (index + 1) + " URL"}
                />
              </div>
            ))}
          </div>

          {links.length < 3 && (
            <button
              type="button"
              className="btn"
              style={{ marginTop: 10 }}
              onClick={() =>
                setLinks((current) => [
                  ...current,
                  { label: "", url: "" },
                ])
              }
            >
              + Add link
            </button>
          )}
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
      {cropFile && (
        <ProfilePhotoCropper
          file={cropFile}
          onCancel={(message) => {
            if (message) setPhotoError(message);
            if (!photoSaving) setCropFile(null);
          }}
          onConfirm={handleCropConfirm}
          saving={photoSaving}
        />
      )}
    </div>
  );
}
