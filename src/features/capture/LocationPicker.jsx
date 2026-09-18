import React from "react";
import { MapPin, Search, X } from "lucide-react";
import { getCurrentLocation, searchLocations } from "./locationApi.js";

export default function LocationPicker({ value = null, onChange, disabled = false }) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [locating, setLocating] = React.useState(false);
  const [error, setError] = React.useState("");

  const search = async (event) => {
    event?.preventDefault();
    const clean = query.trim();
    if (!clean) return;
    setLoading(true);
    setError("");
    try {
      setResults(await searchLocations(clean));
    } catch (searchError) {
      setResults([]);
      setError(searchError.message || "Could not search locations.");
    } finally {
      setLoading(false);
    }
  };

  const useCurrentLocation = async () => {
    setLocating(true);
    setError("");
    try {
      const location = await getCurrentLocation();
      if (!location) throw new Error("Could not identify that location.");
      onChange?.(location);
      setOpen(false);
      setResults([]);
    } catch (locationError) {
      setError(locationError.message || "Could not use your current location.");
    } finally {
      setLocating(false);
    }
  };

  const select = (location) => {
    onChange?.(location);
    setOpen(false);
    setResults([]);
    setQuery("");
  };

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div className="eyebrow">Location</div>
          <h3 style={{ marginTop: 5 }}>{value?.name || "Add a location"}</h3>
          <p className="subtitle" style={{ marginTop: 4 }}>
            {value?.city || "Tag a place on your post."}
          </p>
        </div>
        {value && (
          <button
            type="button"
            className="btn icon-btn"
            onClick={() => onChange?.(null)}
            disabled={disabled}
            aria-label="Remove location"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <button
        type="button"
        className="btn"
        style={{ marginTop: 12 }}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <MapPin size={15} />
        {open ? "Close location" : value ? "Change location" : "Add location"}
      </button>

      {open && (
        <div className="stack" style={{ marginTop: 12 }}>
          <button type="button" className="btn btn-cyan" onClick={useCurrentLocation} disabled={disabled || locating}>
            <MapPin size={15} />
            {locating ? "Finding you…" : "Use current location"}
          </button>

          <form className="row" onSubmit={search}>
            <input
              className="input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search a place"
              aria-label="Search a place"
              disabled={disabled || loading}
            />
            <button type="submit" className="btn icon-btn" disabled={disabled || loading || !query.trim()} aria-label="Search locations">
              <Search size={16} />
            </button>
          </form>

          {loading && <p className="subtitle">Searching locations…</p>}
          {error && <p className="subtitle" role="alert">{error}</p>}
          {!loading && !error && query.trim() && !results.length && (
            <p className="subtitle">No places found.</p>
          )}

          {results.map((location) => (
            <button
              key={location.placeId || `${location.latitude}-${location.longitude}`}
              type="button"
              className="card"
              onClick={() => select(location)}
              style={{ width: "100%", textAlign: "left", padding: 12 }}
            >
              <div className="row" style={{ alignItems: "flex-start" }}>
                <MapPin size={16} style={{ marginTop: 2 }} />
                <div style={{ minWidth: 0 }}>
                  <strong>{location.name}</strong>
                  <p className="subtitle" style={{ marginTop: 3 }}>{location.displayName}</p>
                </div>
              </div>
            </button>
          ))}

          <p className="subtitle" style={{ fontSize: 11 }}>
            Location data © OpenStreetMap contributors.
          </p>
        </div>
      )}
    </div>
  );
}
