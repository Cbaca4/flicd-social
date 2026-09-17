import React from "react";
import {
  validateCommentMediaFile,
  validateCommentVideoDuration,
  MAX_COMMENT_VIDEO_DURATION,
} from "./commentMediaUpload.js";

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

export default function VideoCommentPicker({
  onSelect,
  onClose,
  getVideoDuration: getDuration = getVideoDuration,
  createObjectUrl = (file) => URL.createObjectURL(file),
  revokeObjectUrl = (url) => URL.revokeObjectURL(url),
}) {
  const [error, setError] = React.useState("");
  const [pendingVideo, setPendingVideo] = React.useState(null);
  const [previewUrl, setPreviewUrl] = React.useState("");
  const cameraInputRef = React.useRef(null);
  const deviceInputRef = React.useRef(null);

  React.useEffect(() => {
    return () => {
      if (previewUrl) revokeObjectUrl(previewUrl);
    };
  }, [previewUrl, revokeObjectUrl]);

  const clearPreview = React.useCallback(() => {
    setPendingVideo(null);
    setPreviewUrl((currentUrl) => {
      if (currentUrl) revokeObjectUrl(currentUrl);
      return "";
    });
  }, [revokeObjectUrl]);

  const handleChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");
    clearPreview();

    try {
      if (!ALLOWED_VIDEO_TYPES.has(file.type)) {
        throw new Error("Please choose an MP4 or WebM video.");
      }

      validateCommentMediaFile(file, "video");
      const duration = await getDuration(file);
      validateCommentVideoDuration(duration);

      setPendingVideo({
        mediaBlob: file,
        mediaMetadata: {
          duration_seconds: duration,
        },
      });
      setPreviewUrl(createObjectUrl(file));
    } catch (selectionError) {
      setError(selectionError?.message || "Could not use that video.");
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      if (deviceInputRef.current) deviceInputRef.current.value = "";
    }
  };

  const handleUseVideo = () => {
    if (!pendingVideo) return;

    onSelect?.({
      mediaType: "video",
      ...pendingVideo,
    });
    clearPreview();
  };

  return (
    <div className="comment-media-sheet" role="dialog" aria-modal="true" aria-label="Choose a video">
      <div className="comment-media-sheet__header">
        <strong>{pendingVideo ? "Preview video" : "Choose a video"}</strong>
        <button type="button" className="btn icon-btn" aria-label="Close video picker" onClick={onClose}>×</button>
      </div>

      {!pendingVideo ? (
        <div className="video-picker-actions">
          <label className="btn btn-primary" htmlFor="comment-video-camera-input">
            Record video
          </label>
          <input
            ref={cameraInputRef}
            id="comment-video-camera-input"
            type="file"
            accept="video/mp4,video/webm"
            capture="user"
            aria-label="Record a video"
            onChange={handleChange}
            style={{ display: "none" }}
          />

          <label className="btn" htmlFor="comment-video-device-input">
            Choose from device
          </label>
          <input
            ref={deviceInputRef}
            id="comment-video-device-input"
            type="file"
            accept="video/mp4,video/webm"
            aria-label="Choose a video from device"
            onChange={handleChange}
            style={{ display: "none" }}
          />
        </div>
      ) : (
        <>
          <div className="video-comment-preview">
            <video src={previewUrl} aria-label="Video preview" controls playsInline />
            <div className="video-comment-preview__meta">
              <span>{pendingVideo.mediaMetadata.duration_seconds.toFixed(1)}s</span>
              <span>15s max</span>
            </div>
          </div>
          <div className="video-picker-actions">
            <button type="button" className="btn btn-primary" onClick={handleUseVideo}>
              Use video
            </button>
            <button type="button" className="btn" onClick={clearPreview}>
              Choose another
            </button>
          </div>
        </>
      )}

      <div className="subtitle">Videos must be {MAX_COMMENT_VIDEO_DURATION} seconds or shorter.</div>
      {error && <div className="subtitle" role="alert">{error}</div>}
    </div>
  );
}
