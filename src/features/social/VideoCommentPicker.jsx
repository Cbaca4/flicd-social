import React from "react";
import { validateCommentMediaFile, validateCommentVideoDuration, MAX_COMMENT_VIDEO_DURATION } from "./commentMediaUpload.js";

const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);

async function getVideoDuration(file) {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        const duration = video.duration;
        video.removeAttribute("src");
        video.load();
        resolve(duration);
      };
      video.onerror = () => reject(new Error("Unable to determine video duration."));
      video.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function VideoCommentPicker({ onSelect, onClose, getVideoDuration: getDuration = getVideoDuration }) {
  const [error, setError] = React.useState("");
  const inputRef = React.useRef(null);

  const handleChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");

    try {
      if (!ALLOWED_VIDEO_TYPES.has(file.type)) {
        throw new Error("Please choose an MP4 or WebM video.");
      }

      validateCommentMediaFile(file, "video");
      const duration = await getDuration(file);
      validateCommentVideoDuration(duration);

      onSelect?.({
        mediaType: "video",
        mediaBlob: file,
        mediaMetadata: {
          duration_seconds: duration,
        },
      });
    } catch (selectionError) {
      setError(selectionError?.message || "Could not use that video.");
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="comment-media-sheet" role="dialog" aria-modal="true" aria-label="Choose a video">
      <div className="comment-media-sheet__header">
        <strong>Choose a video</strong>
        <button type="button" className="btn icon-btn" aria-label="Close video picker" onClick={onClose}>×</button>
      </div>

      <label className="btn btn-primary" htmlFor="comment-video-input">
        Select video
      </label>
      <input
        ref={inputRef}
        id="comment-video-input"
        type="file"
        accept="video/mp4,video/webm"
        aria-label="Choose a video"
        onChange={handleChange}
        style={{ display: "none" }}
      />

      <div className="subtitle">Videos must be {MAX_COMMENT_VIDEO_DURATION} seconds or shorter.</div>
      {error && <div className="subtitle" role="alert">{error}</div>}
    </div>
  );
}
