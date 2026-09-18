import React from "react";
import {
  GripVertical,
  Save,
  RotateCcw,
  Sparkles,
  LogOut,
  Lock,
  Unlock,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import {
  DEFAULT_THEME,
  sanitizeProfileTheme,
} from "./profileTheme.js";
import { getActiveSeasonalEvent } from "../seasonal/seasonalEvents.js";
import {
  uploadProfileBackground,
  validateProfileBackgroundVideo,
} from "./profileMedia.js";
import { getSeasonalProfileTheme } from "../seasonal/seasonalProfileTheme.js";
import {
  getCurrentProfile,
  setPrivateAccount,
} from "../social/socialApi.js";
import FollowRequests from "../social/FollowRequests.jsx";

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value)));

function backgroundMediaStyle(media) {
  const positionX = Number.isFinite(Number(media?.positionX))
    ? clamp(media.positionX, 0, 100)
    : 50;
  const positionY = Number.isFinite(Number(media?.positionY))
    ? clamp(media.positionY, 0, 100)
    : 50;
  const scale = Number.isFinite(Number(media?.scale))
    ? clamp(media.scale, 1, 1.6)
    : 1;

  return {
    objectPosition: positionX + "% " + positionY + "%",
    transform: "scale(" + scale + ")",
  };
}

function sectionPreviewStyle(style) {
  const media = style?.backgroundMedia;
  return media?.url
    ? {
        backgroundImage: `linear-gradient(rgba(9,10,13,.36),rgba(9,10,13,.58)), url("${media.url}")`,
        backgroundSize: "cover",
        backgroundPosition: `${media.positionX ?? 50}% ${media.positionY ?? 50}%`,
      }
    : {};
}

export function ProfilePreview({ theme, profile }) {
  const hero = theme.sectionStyles?.hero || {};
  const boards = theme.sectionStyles?.boards || {};
  const onRepeat = theme.sectionStyles?.onRepeat || {};
  const bg =
    theme.backgroundStyle === "gradient"
      ? "linear-gradient(145deg," + theme.background + ",#0f1e22)"
      : theme.background;

  return (
    <div className="preview-shell profile-customize-preview">
      <div className="eyebrow">Live preview</div>

      {theme.backgroundMedia?.url && (
        <div className="profile-background-media" aria-hidden="true">
          {theme.backgroundMedia.type === "video" ? (
            <video
              src={theme.backgroundMedia.url}
              autoPlay
              loop
              muted
              playsInline
              style={backgroundMediaStyle(theme.backgroundMedia)}
            />
          ) : (
            <img
              src={theme.backgroundMedia.url}
              alt=""
              style={backgroundMediaStyle(theme.backgroundMedia)}
            />
          )}
        </div>
      )}

      <div
        className="preview-card"
        style={{
          background: bg,
          borderRadius: theme.radius,
          border:
            theme.borderStyle === "none"
              ? "none"
              : "1px solid " + (hero.border || theme.accent) + "55",
          fontFamily: theme.font,
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          className="row"
          style={{
            padding: 14,
            borderRadius: hero.radius || 20,
            background: hero.background || "rgba(255,255,255,.03)",
            ...sectionPreviewStyle(hero),
            border:
              "1px solid " +
              (hero.border || "rgba(255,255,255,.08)"),
          }}
        >
          <div
            className="avatar lg"
            style={{
              boxShadow:
                "0 0 0 3px " +
                (hero.accent || theme.accent) +
                "55",
            }}
          >
            {profile.handle[0].toUpperCase()}
          </div>

          <div style={{ minWidth: 0 }}>
            <h2 style={{ overflowWrap: "anywhere" }}>@{profile.handle}</h2>
            <p
              style={{
                marginTop: 4,
                color: hero.accent || theme.accent,
                overflowWrap: "anywhere",
              }}
            >
              {theme.statusEmoji} {theme.status}
            </p>
          </div>
        </div>

        <div
          className="mini-sect"
          style={{
            background: hero.background || "rgba(0,0,0,.14)",
            borderColor: hero.border || undefined,
          }}
        >
          <p
            style={{
              fontSize: 13,
              lineHeight: 1.55,
              overflowWrap: "anywhere",
              whiteSpace: "pre-wrap",
            }}
          >
            {theme.message}
          </p>
        </div>

        {theme.showMusic && (
          <div
            className="mini-sect"
            style={{
              background: onRepeat.background || undefined,
              ...sectionPreviewStyle(onRepeat),
              borderColor: onRepeat.border || undefined,
              borderRadius: onRepeat.radius || 16,
            }}
          >
            <span className="eyebrow">On repeat</span>
            <strong
              style={{
                display: "block",
                marginTop: 5,
                overflowWrap: "anywhere",
              }}
            >
              {theme.favoriteArtist || "Add your favorite artist"}
            </strong>
          </div>
        )}

        <div
          className="mini-sect"
          style={{
            background: boards.background || undefined,
            ...sectionPreviewStyle(boards),
            borderColor: boards.border || undefined,
            borderRadius: boards.radius || 16,
          }}
        >
          <span className="eyebrow">Featured</span>
          <div className="grid grid-3" style={{ marginTop: 8 }}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="board-cover"
                style={{ aspectRatio: "1/1" }}
              >
                <span
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "grid",
                    placeItems: "center",
                    fontSize: 11,
                  }}
                >
                  flic'd
                </span>
              </div>
            ))}
          </div>
        </div>

        {theme.showBoards && (
          <div className="mini-sect">
            <span className="eyebrow">Boards</span>
            <div className="wrap" style={{ marginTop: 8 }}>
              <span className="pill">memories</span>
              <span className="pill">gym</span>
              <span className="pill">late nights</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BackgroundCropPreview({ media, onChange }) {
  const dragRef = React.useRef(null);

  if (!media?.url) return null;

  const style = backgroundMediaStyle(media);

  const updatePosition = (nextX, nextY) => {
    onChange?.({
      positionX: clamp(nextX, 0, 100),
      positionY: clamp(nextY, 0, 100),
    });
  };

  const handlePointerDown = (event) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      positionX: Number(media.positionX ?? 50),
      positionY: Number(media.positionY ?? 50),
      width: event.currentTarget.clientWidth || 1,
      height: event.currentTarget.clientHeight || 1,
      scale: Number(media.scale ?? 1),
    };
  };

  const handlePointerMove = (event) => {
    const start = dragRef.current;
    if (!start) return;

    const nextX =
      start.positionX -
      ((event.clientX - start.clientX) * 100) /
        start.width /
        Math.max(1, start.scale);

    const nextY =
      start.positionY -
      ((event.clientY - start.clientY) * 100) /
        start.height /
        Math.max(1, start.scale);

    updatePosition(nextX, nextY);
  };

  const handlePointerUp = (event) => {
    dragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  return (
    <div
      className="profile-background-crop"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        dragRef.current = null;
      }}
      role="img"
      aria-label="Background positioning preview"
    >
      {media.type === "video" ? (
        <video
          src={media.url}
          autoPlay
          loop
          muted
          playsInline
          style={style}
          aria-hidden="true"
        />
      ) : (
        <img src={media.url} alt="" style={style} draggable="false" />
      )}
      <div className="profile-background-crop-hint">
        Drag to position
      </div>
    </div>
  );
}

export default function ProfileStudio({
  theme,
  setTheme,
  onClose,
  onSave,
  profile = { handle: "you" },
  onChangeTheme,
  onSaved,
}) {
  const [draft, setDraft] = React.useState(() =>
    sanitizeProfileTheme(theme),
  );
  const [isPrivate, setIsPrivate] = React.useState(false);
  const [privacyLoading, setPrivacyLoading] = React.useState(true);
  const [privacySaving, setPrivacySaving] = React.useState(false);
  const [backgroundSaving, setBackgroundSaving] = React.useState(false);
  const [backgroundError, setBackgroundError] = React.useState("");
  const [sectionBackgroundSaving, setSectionBackgroundSaving] = React.useState("");
  const event = getActiveSeasonalEvent();

  React.useEffect(() => {
    let cancelled = false;

    getCurrentProfile()
      .then((profileValue) => {
        if (!cancelled) {
          setIsPrivate(Boolean(profileValue?.is_private));
        }
      })
      .catch((error) => {
        console.error("Failed to load privacy:", error);
      })
      .finally(() => {
        if (!cancelled) setPrivacyLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const update = (key, value) => {
    setDraft((current) =>
      sanitizeProfileTheme({
        ...current,
        [key]: value,
      }),
    );
  };

  const updateBackgroundMedia = (updates) => {
    setDraft((current) =>
      sanitizeProfileTheme({
        ...current,
        backgroundMedia: {
          ...current.backgroundMedia,
          ...updates,
        },
      }),
    );
  };

  const move = (section, direction) => {
    setDraft((current) => {
      const order = [...current.sectionOrder];
      const index = order.indexOf(section);
      const nextIndex = index + direction;

      if (
        index < 0 ||
        nextIndex < 0 ||
        nextIndex >= order.length
      ) {
        return current;
      }

      [order[index], order[nextIndex]] = [
        order[nextIndex],
        order[index],
      ];

      return sanitizeProfileTheme({
        ...current,
        sectionOrder: order,
      });
    });
  };

  const setSectionStyle = (section, key, value) => {
    setDraft((current) =>
      sanitizeProfileTheme({
        ...current,
        sectionStyles: {
          ...current.sectionStyles,
          [section]: {
            ...current.sectionStyles?.[section],
            [key]: value,
          },
        },
      }),
    );
  };


  const handleSectionBackgroundChange = async (section, eventValue) => {
    const file = eventValue.target.files?.[0];
    eventValue.target.value = "";
    if (!file || sectionBackgroundSaving) return;
    setSectionBackgroundSaving(section);
    try {
      const uploaded = await uploadProfileBackground(file);
      setDraft((current) =>
        sanitizeProfileTheme({
          ...current,
          sectionStyles: {
            ...current.sectionStyles,
            [section]: {
              ...current.sectionStyles?.[section],
              backgroundMedia: {
                url: uploaded.url,
                type: "image",
                mimeType: uploaded.mimeType,
                positionX: 50,
                positionY: 50,
                scale: 1,
              },
            },
          },
        }),
      );
    } catch (error) {
      setBackgroundError(error?.message || "Could not upload that component photo.");
    } finally {
      setSectionBackgroundSaving("");
    }
  };

  const removeSectionBackground = (section) => {
    setDraft((current) =>
      sanitizeProfileTheme({
        ...current,
        sectionStyles: {
          ...current.sectionStyles,
          [section]: {
            ...current.sectionStyles?.[section],
            backgroundMedia: null,
          },
        },
      }),
    );
  };

  const setButtonStyle = (key, value) => {
    setDraft((current) =>
      sanitizeProfileTheme({
        ...current,
        buttonStyle: {
          ...current.buttonStyle,
          [key]: value,
        },
      }),
    );
  };

  const applySeasonal = () => {
    setDraft((current) =>
      sanitizeProfileTheme(getSeasonalProfileTheme(current)),
    );
  };

  const handleBackgroundChange = async (eventValue) => {
    const file = eventValue.target.files?.[0];
    eventValue.target.value = "";

    if (!file || backgroundSaving) return;

    setBackgroundError("");

    try {
      if (file.type.startsWith("video/")) {
        await validateProfileBackgroundVideo(file);
      }

      setBackgroundSaving(true);
      const uploaded = await uploadProfileBackground(file);

      setDraft((current) =>
        sanitizeProfileTheme({
          ...current,
          backgroundMedia: {
            url: uploaded.url,
            type: uploaded.type,
            mimeType: uploaded.mimeType,
            positionX: 50,
            positionY: 50,
            scale: 1,
          },
        }),
      );
    } catch (error) {
      setBackgroundError(
        error?.message || "Could not upload that background.",
      );
    } finally {
      setBackgroundSaving(false);
    }
  };

  const saveTheme = (nextTheme) => {
    const normalized = sanitizeProfileTheme(nextTheme);
    setDraft(normalized);
    (onChangeTheme || setTheme)?.(normalized);
    (onSaved || onSave)?.(normalized);
  };

  const togglePrivacy = async () => {
    if (privacyLoading || privacySaving) return;

    try {
      setPrivacySaving(true);
      setIsPrivate(await setPrivateAccount(!isPrivate));
    } catch (error) {
      console.error("Failed to update privacy:", error);
    } finally {
      setPrivacySaving(false);
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error("Failed to sign out:", error);
  };

  const media = draft.backgroundMedia;

  return (
    <div
      className="screen profile-studio-screen"
      data-testid="profile-studio-screen"
      data-scroll-container="screen"
    >
      <div className="topbar">
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow">Profile Studio</div>
          <h1 className="title">Make it yours</h1>
          <p className="subtitle">
            Customize presentation, privacy, and identity controls.
          </p>
        </div>

        <button className="btn" type="button" onClick={onClose}>
          Exit
        </button>
      </div>

      <div className="studio">
        <div className="card stack profile-studio-form">
          <section className="profile-studio-section">
            <div className="profile-studio-section-heading">
              <div>
                <label className="eyebrow">Background</label>
                <p className="subtitle profile-studio-help">
                  Use a photo or short video. We resize photos to a 1920px
                  long edge and keep optimized photos around 3 MB or less.
                </p>
              </div>
            </div>

            <div
              className="row"
              style={{
                marginTop: 10,
                flexWrap: "wrap",
              }}
            >
              <input
                type="color"
                aria-label="Background color"
                value={draft.background}
                onChange={(eventValue) =>
                  update("background", eventValue.target.value)
                }
                style={{
                  width: 52,
                  height: 42,
                  border: 0,
                  background: "none",
                }}
              />

              <button
                type="button"
                className="pill"
                onClick={() =>
                  update(
                    "backgroundStyle",
                    draft.backgroundStyle === "solid"
                      ? "gradient"
                      : "solid",
                  )
                }
              >
                {draft.backgroundStyle}
              </button>
            </div>

            <div
              className="row"
              style={{
                marginTop: 10,
                flexWrap: "wrap",
              }}
            >
              <label
                className="btn"
                style={{
                  cursor: backgroundSaving ? "wait" : "pointer",
                  opacity: backgroundSaving ? 0.6 : 1,
                }}
              >
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
                  onChange={handleBackgroundChange}
                  disabled={backgroundSaving}
                  style={{ display: "none" }}
                  aria-label="Choose profile background"
                />
                {backgroundSaving
                  ? "Preparing…"
                  : "Choose background"}
              </label>

              {media?.url && (
                <button
                  type="button"
                  className="btn"
                  onClick={() =>
                    setDraft((current) =>
                      sanitizeProfileTheme({
                        ...current,
                        backgroundMedia: null,
                      }),
                    )
                  }
                >
                  Remove media
                </button>
              )}
            </div>

            {backgroundError && (
              <p
                className="subtitle"
                role="alert"
                style={{
                  marginTop: 7,
                  color: "var(--danger)",
                }}
              >
                {backgroundError}
              </p>
            )}

            {media?.url && (
              <div className="profile-background-adjustments">
                <div>
                  <div className="eyebrow">Adjust background</div>
                  <p className="subtitle profile-studio-help">
                    Drag the preview to center the important part of your
                    image, or use the controls below. The extend control
                    works like zooming a photo to fill a lock screen.
                  </p>
                </div>

                <BackgroundCropPreview
                  media={media}
                  onChange={updateBackgroundMedia}
                />

                <label className="profile-range-field">
                  <span>
                    Horizontal <strong>{Math.round(media.positionX ?? 50)}%</strong>
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={media.positionX ?? 50}
                    onChange={(eventValue) =>
                      updateBackgroundMedia({
                        positionX: Number(eventValue.target.value),
                      })
                    }
                    aria-label="Background horizontal position"
                  />
                </label>

                <label className="profile-range-field">
                  <span>
                    Vertical <strong>{Math.round(media.positionY ?? 50)}%</strong>
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={media.positionY ?? 50}
                    onChange={(eventValue) =>
                      updateBackgroundMedia({
                        positionY: Number(eventValue.target.value),
                      })
                    }
                    aria-label="Background vertical position"
                  />
                </label>

                <label className="profile-range-field">
                  <span>
                    Extend / zoom <strong>{Number(media.scale ?? 1).toFixed(2)}×</strong>
                  </span>
                  <input
                    type="range"
                    min="1"
                    max="1.6"
                    step="0.01"
                    value={media.scale ?? 1}
                    onChange={(eventValue) =>
                      updateBackgroundMedia({
                        scale: Number(eventValue.target.value),
                      })
                    }
                    aria-label="Background extend zoom"
                  />
                </label>

                <button
                  type="button"
                  className="pill"
                  onClick={() =>
                    updateBackgroundMedia({
                      positionX: 50,
                      positionY: 50,
                      scale: 1,
                    })
                  }
                >
                  Center & reset zoom
                </button>
              </div>
            )}
          </section>

          <section className="profile-studio-section">
            <div className="eyebrow">Text & identity</div>
            <div className="profile-studio-field">
              <label htmlFor="profile-font" className="eyebrow">
                Profile font
              </label>
              <select
                id="profile-font"
                className="input profile-studio-text-control"
                value={draft.font}
                onChange={(eventValue) =>
                  update("font", eventValue.target.value)
                }
              >
                <option value="Space Grotesk">Space Grotesk</option>
                <option value="IBM Plex Mono">IBM Plex Mono</option>
              </select>
            </div>

            <div className="profile-studio-field">
              <label htmlFor="profile-status" className="eyebrow">
                Status
              </label>
              <input
                id="profile-status"
                className="input profile-studio-text-control"
                value={draft.status}
                onChange={(eventValue) =>
                  update("status", eventValue.target.value)
                }
                placeholder="What are you up to?"
                maxLength={60}
              />
              <div className="profile-studio-count">
                {draft.status.length}/60
              </div>
            </div>

            <div className="profile-studio-field">
              <label htmlFor="profile-message" className="eyebrow">
                Profile message
              </label>
              <textarea
                id="profile-message"
                className="input profile-studio-text-control"
                value={draft.message}
                onChange={(eventValue) =>
                  update("message", eventValue.target.value)
                }
                placeholder="Write a little note for people visiting your profile…"
                maxLength={180}
                rows={5}
              />
              <div className="profile-studio-count">
                {draft.message.length}/180
              </div>
            </div>

            <div className="profile-studio-field">
              <label htmlFor="profile-artist" className="eyebrow">
                Favorite artist
              </label>
              <input
                id="profile-artist"
                aria-label="Favorite artist"
                className="input profile-studio-text-control"
                value={draft.favoriteArtist}
                onChange={(eventValue) =>
                  update("favoriteArtist", eventValue.target.value)
                }
                placeholder="Artist, band, or composer"
                maxLength={80}
              />
              <div className="profile-studio-count">
                {draft.favoriteArtist.length}/80
              </div>
            </div>
          </section>

          {event && (
            <div className="seasonal-profile-card">
              <div className="row">
                <Sparkles size={16} />
                <div style={{ minWidth: 0 }}>
                  <strong>{event.label} profile theme</strong>
                  <p className="subtitle">
                    Apply the seasonal accent and decoration to your profile.
                  </p>
                </div>
              </div>
              <button
                className="btn"
                type="button"
                style={{ marginTop: 10 }}
                onClick={applySeasonal}
              >
                Apply seasonal theme
              </button>
            </div>
          )}

          <div className="card" style={{ margin: 0 }}>
            <div className="row">
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  display: "grid",
                  placeItems: "center",
                  background: "rgba(255,255,255,.06)",
                }}
              >
                {isPrivate ? <Lock size={19} /> : <Unlock size={19} />}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <strong>Private account</strong>
                <p className="subtitle" style={{ marginTop: 3 }}>
                  {isPrivate
                    ? "Only followers can see your Flic content."
                    : "Anyone can see your public Flic content."}
                </p>
              </div>

              <button
                className={"btn " + (isPrivate ? "btn-primary" : "")}
                type="button"
                onClick={togglePrivacy}
                disabled={privacyLoading || privacySaving}
              >
                {privacySaving
                  ? "Saving…"
                  : isPrivate
                    ? "Private"
                    : "Public"}
              </button>
            </div>
          </div>

          {isPrivate && <FollowRequests />}

          <div className="profile-studio-field">
            <label className="eyebrow">Corners</label>
            <div className="wrap" style={{ marginTop: 8 }}>
              {[14, 18, 22, 28, 34].map((value) => (
                <button
                  type="button"
                  key={value}
                  className={
                    "pill " +
                    (draft.radius === value ? "active" : "")
                  }
                  onClick={() => update("radius", value)}
                >
                  {value}px
                </button>
              ))}
            </div>
          </div>

          <section className="card" style={{ margin: 0 }}>
            <div className="eyebrow">Sections</div>
            <p className="subtitle" style={{ marginTop: 4 }}>
              Put the parts of your profile in the order that feels natural
              on a phone.
            </p>

            <div className="stack" style={{ marginTop: 10 }}>
              {draft.sectionOrder.map((section, index) => (
                <div className="row" key={section}>
                  <GripVertical size={15} className="muted" />
                  <strong
                    style={{
                      flex: 1,
                      minWidth: 0,
                      textTransform: "capitalize",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {section}
                  </strong>
                  <button
                    type="button"
                    className="btn icon-btn"
                    disabled={index === 0}
                    onClick={() => move(section, -1)}
                    aria-label={"Move " + section + " up"}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn icon-btn"
                    disabled={
                      index === draft.sectionOrder.length - 1
                    }
                    onClick={() => move(section, 1)}
                    aria-label={"Move " + section + " down"}
                  >
                    ↓
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="card" style={{ margin: 0 }}>
            <div className="eyebrow">Components</div>
            <p className="subtitle" style={{ marginTop: 4 }}>
              Tune individual profile boxes without making the page feel
              over-designed.
            </p>

            <div className="stack" style={{ marginTop: 12 }}>
              {[
                ["hero", "Profile header"],
                ["boards", "Boards"],
                ["onRepeat", "On Repeat"],
                ["activeSpace", "Active space"],
                ["customize", "Profile Studio"],
              ].map(([key, label]) => {
                const style = draft.sectionStyles?.[key] || {};

                return (
                  <div className="card" key={key} style={{ margin: 0 }}>
                    <div
                      className="row"
                      style={{
                        justifyContent: "space-between",
                      }}
                    >
                      <strong>{label}</strong>
                      <span className="eyebrow">Box</span>
                    </div>

                    <div
                      className="grid grid-3"
                      style={{ marginTop: 10 }}
                    >
                      {[
                        ["Fill", "background"],
                        ["Border", "border"],
                        ["Accent", "accent"],
                      ].map(([labelText, styleKey]) => (
                        <label className="subtitle" key={styleKey}>
                          {labelText}
                          <input
                            type="color"
                            value={style[styleKey]}
                            onChange={(eventValue) =>
                              setSectionStyle(
                                key,
                                styleKey,
                                eventValue.target.value,
                              )
                            }
                            style={{
                              display: "block",
                              marginTop: 5,
                              width: 44,
                              height: 34,
                              border: 0,
                              background: "none",
                            }}
                            aria-label={label + " " + labelText}
                          />
                        </label>
                      ))}
                    </div>

                    <div className="profile-component-background-controls">
                      <label className="btn" style={{ cursor: sectionBackgroundSaving === key ? "wait" : "pointer", opacity: sectionBackgroundSaving === key ? 0.6 : 1 }}>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(eventValue) => handleSectionBackgroundChange(key, eventValue)}
                          disabled={Boolean(sectionBackgroundSaving)}
                          style={{ display: "none" }}
                          aria-label={label + " background photo"}
                        />
                        {sectionBackgroundSaving === key ? "Uploading…" : style.backgroundMedia?.url ? "Change background photo" : "Add background photo"}
                      </label>
                      {style.backgroundMedia?.url && (
                        <button type="button" className="btn" onClick={() => removeSectionBackground(key)}>
                          Remove photo
                        </button>
                      )}
                    </div>

                    <label
                      className="subtitle"
                      style={{
                        display: "block",
                        marginTop: 8,
                      }}
                    >
                      Roundness
                      <input
                        type="range"
                        min="12"
                        max="36"
                        value={style.radius || 20}
                        onChange={(eventValue) =>
                          setSectionStyle(
                            key,
                            "radius",
                            Number(eventValue.target.value),
                          )
                        }
                        style={{
                          width: "100%",
                          marginTop: 6,
                        }}
                        aria-label={label + " roundness"}
                      />
                    </label>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="card" style={{ margin: 0 }}>
            <div
              className="row"
              style={{
                justifyContent: "space-between",
              }}
            >
              <strong>Buttons</strong>
              <span className="eyebrow">Every button</span>
            </div>

            <div className="grid grid-3" style={{ marginTop: 10 }}>
              {[
                ["Button fill", "background"],
                ["Button border", "border"],
                ["Button accent", "accent"],
              ].map(([labelText, styleKey]) => (
                <label className="subtitle" key={styleKey}>
                  {labelText}
                  <input
                    type="color"
                    value={draft.buttonStyle[styleKey]}
                    onChange={(eventValue) =>
                      setButtonStyle(
                        styleKey,
                        eventValue.target.value,
                      )
                    }
                    style={{
                      display: "block",
                      marginTop: 5,
                      width: 44,
                      height: 34,
                      border: 0,
                      background: "none",
                    }}
                    aria-label={labelText}
                  />
                </label>
              ))}
            </div>

            <label
              className="subtitle"
              style={{
                display: "block",
                marginTop: 8,
              }}
            >
              Button roundness
              <input
                type="range"
                min="8"
                max="24"
                value={draft.buttonStyle.radius}
                onChange={(eventValue) =>
                  setButtonStyle(
                    "radius",
                    Number(eventValue.target.value),
                  )
                }
                style={{
                  width: "100%",
                  marginTop: 6,
                }}
                aria-label="Button roundness"
              />
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
                checked={draft.buttonStyle.filled}
                onChange={(eventValue) =>
                  setButtonStyle(
                    "filled",
                    eventValue.target.checked,
                  )
                }
              />
              Use filled buttons
            </label>
          </section>

          <div className="wrap">
            <button
              type="button"
              className="btn"
              onClick={() =>
                setDraft(
                  sanitizeProfileTheme({
                    ...DEFAULT_THEME,
                    backgroundMedia: null,
                  }),
                )
              }
            >
              <RotateCcw size={15} />
              Reset
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => saveTheme(draft)}
            >
              <Save size={15} />
              Save Profile
            </button>
          </div>

          <div
            style={{
              marginTop: 8,
              paddingTop: 16,
              borderTop: "1px solid var(--line)",
            }}
          >
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

        <ProfilePreview theme={draft} profile={profile} />
      </div>
    </div>
  );
}
