import React from "react";
import { createPortal } from "react-dom";
import {
  GIPHY_ATTRIBUTION_TEXT,
  getTrendingGifs,
  searchGifs,
} from "./giphyApi.js";
import "./GifPicker.css";

export default function GifPicker({ onSelect, onClose }) {
  const [gifs, setGifs] = React.useState([]);
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const loadGifs = React.useCallback(async (loadQuery = "") => {
    setLoading(true);
    setError("");
    try {
      const results = loadQuery.trim()
        ? await searchGifs(loadQuery.trim(), {})
        : await getTrendingGifs({});
      setGifs(results);
    } catch (loadError) {
      setGifs([]);
      setError(loadError?.message || "Could not load GIFs.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadGifs();
  }, [loadGifs]);

  const handleSearch = (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    loadGifs(query);
  };

  const sheet = (return (
    <div className="comment-media-sheet" role="dialog" aria-modal="true" aria-label="Choose a GIF">
      <div className="comment-media-sheet__header">
        <strong>Choose a GIF</strong>
        <button type="button" className="btn icon-btn" aria-label="Close GIF picker" onClick={onClose}>×</button>
      </div>

      <input
        className="input"
        role="searchbox"
        aria-label="Search GIFs"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={handleSearch}
        placeholder="Search GIFs"
      />

      {loading ? (
        <div className="subtitle">Loading GIFs…</div>
      ) : error ? (
        <div className="subtitle">{error}</div>
      ) : gifs.length ? (
        <div className="gif-grid">
          {gifs.map((gif) => (
            <button
              key={gif.id}
              type="button"
              className="gif-tile"
              data-testid={`giphy-result-${gif.id}`}
              onClick={() => onSelect?.({
                ...gif,
                mediaType: "gif",
                mediaUrl: gif.fullUrl,
                mediaMetadata: { provider: "giphy", id: gif.id, title: gif.title },
              })}
            >
              <img src={gif.previewUrl || gif.fullUrl} alt={gif.title || "GIF"} />
            </button>
          ))}
        </div>
      ) : (
        <div className="subtitle">No GIFs found.</div>
      )}

      <div className="giphy-attribution">{GIPHY_ATTRIBUTION_TEXT}</div>
    </div>);

  return typeof document !== "undefined" ? createPortal(sheet, document.body) : sheet;
  );
}
