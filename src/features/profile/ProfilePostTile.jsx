import React from "react";
import { Eye, Images } from "lucide-react";
import { resolveDumpItemMediaUrl } from "../home/mediaUrl.js";

/**
 * Profile gallery media follows the existing authorized feed URL resolver.
 * View-once frames are never requested as a thumbnail.
 */
export function formatTimeRemaining(expiresAt, now = Date.now()) {
  const remaining = Number(expiresAt) - now;
  if (!Number.isFinite(remaining) || remaining <= 0) return "Expired";
  const minutes = Math.ceil(remaining / 60000);
  if (minutes < 60) return `${minutes}m left`;
  return `${Math.ceil(minutes / 60)}h left`;
}

export default function ProfilePostTile({ post, onOpen, now = Date.now() }) {
  const isOnce = post.mode === "once";
  const firstItem = isOnce ? null : (post.items || []).find((item) => item?.imagePath || item?.imageUrl);
  const imagePath = firstItem?.imagePath || null;
  const mediaBucket = firstItem?.mediaBucket || null;
  const imageUrl = firstItem?.imageUrl || null;
  const [thumbnail, setThumbnail] = React.useState(null);
  const [loadFailed, setLoadFailed] = React.useState(false);

  React.useEffect(() => {
    if (isOnce || (!imagePath && !imageUrl)) return undefined;

    let active = true;
    const item = { imagePath, mediaBucket, imageUrl };
    const request = imageUrl
      ? Promise.resolve(imageUrl)
      : resolveDumpItemMediaUrl(item);
    Promise.resolve(request)
      .then((url) => {
        if (active) {
          setThumbnail(url || null);
          setLoadFailed(false);
        }
      })
      .catch(() => {
        if (active) {
          setThumbnail(null);
          setLoadFailed(true);
        }
      });
    return () => { active = false; };
  }, [isOnce, imagePath, mediaBucket, imageUrl]);

  const resolvedUrl = !isOnce && !loadFailed ? thumbnail : null;
  const label = post.type === "roll" ? "roll" : "dump";
  const frames = Number(post.frameCount) || post.items?.length || 1;

  return (
    <button type="button" className="profile-gallery-tile"
      onClick={() => onOpen?.(post)}
      aria-label={`Open ${label} post`}>
      <div className="profile-gallery-tile-art" aria-hidden="true">
        {resolvedUrl ? (
          <img src={resolvedUrl} alt="" loading="lazy" className="profile-gallery-thumbnail"
            onError={() => { setLoadFailed(true); }} />
        ) : isOnce ? <Eye size={26} /> : <Images size={27} />}
      </div>
      {Number.isFinite(post.expiresAt) && <span className="profile-gallery-time-left" aria-label={formatTimeRemaining(post.expiresAt, now)}>{formatTimeRemaining(post.expiresAt, now)}</span>}
      <span className="profile-gallery-tile-meta">
        <strong>{isOnce ? "View once" : label === "roll" ? "Roll" : "Dump"}</strong>
        <small>{frames} {frames === 1 ? "frame" : "frames"}</small>
      </span>
    </button>
  );
}
