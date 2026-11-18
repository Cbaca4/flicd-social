import React from "react";
import { getProfileImageAccent } from "./profilePalette.js";

const BRAND_ACCENT = "#db98cf";

export default function useProfileAccent(backgroundMedia, adaptiveTheme = true) {
  const [accent, setAccent] = React.useState(BRAND_ACCENT);
  const url = backgroundMedia?.url;
  const type = backgroundMedia?.type;

  React.useEffect(() => {
    let cancelled = false;
    setAccent(BRAND_ACCENT);

    // Background videos and cross-origin images with restricted canvas
    // access use the legible brand fallback instead of risking a crash.
    if (!adaptiveTheme || !url || type === "video" || typeof Image === "undefined") {
      return undefined;
    }

    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 24;
        canvas.height = 24;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(image, 0, 0, 24, 24);
        const nextAccent = getProfileImageAccent(ctx.getImageData(0, 0, 24, 24).data);
        if (!cancelled && nextAccent) setAccent(nextAccent);
      } catch {
        // Security errors from cross-origin images are expected; keep fallback.
      }
    };
    image.onerror = () => {};
    image.src = url;

    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
    };
  }, [url, type, adaptiveTheme]);

  return accent;
}
