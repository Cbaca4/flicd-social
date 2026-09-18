import React from "react";
import { Compass, Flame, Image as ImageIcon, RefreshCw, Search, Sparkles, Video } from "lucide-react";
import { getDumpItemMediaUrl } from "../home/mediaUrl.js";
import { getExploreCandidates } from "./discoverApi.js";
import { buildExploreLayout } from "./discoverLayout.js";
import { rankExploreCandidates } from "./discoverRanking.js";

const DEFAULT_TRAILS = [
  "film photography",
  "alt fashion",
  "grunge",
  "gym",
  "music",
  "street",
  "night",
  "travel",
];

function buildSearchTerms(post) {
  return [
    post.context,
    post.mood,
    post.type,
    post.author,
    post.authorName,
    ...(post.interests || []),
    post.musicTrack?.genre,
    post.musicTrack?.mood,
    post.musicTrack?.artist,
    post.musicTrack?.title,
  ].map((value) => String(value || "").trim().toLowerCase()).filter(Boolean);
}

function matchesSearch(post, query, trail) {
  const targets = [query, trail].map((value) => String(value || "").trim().toLowerCase()).filter(Boolean);
  if (!targets.length) return true;
  const terms = buildSearchTerms(post);
  return targets.every((target) => terms.some((term) => term.includes(target) || target.includes(term)));
}

function formatViewerPost(post) {
  const created = new Date(post.createdAt || 0).getTime();
  const postedMinutesAgo = Number.isFinite(created)
    ? Math.max(0, Math.floor((Date.now() - created) / 60000))
    : 0;

  return {
    ...post,
    postedMinutesAgo,
    expiresAt: post.mode === "24h" && Number.isFinite(created)
      ? created + 24 * 60 * 60 * 1000
      : null,
  };
}

function TileMedia({ post, index }) {
  const [failed, setFailed] = React.useState(false);
  const firstItem = (post.items || []).find((item) => item?.imagePath || item?.imageUrl);
  const imageUrl = firstItem?.imageUrl || getDumpItemMediaUrl(firstItem?.imagePath);
  const gradients = [
    "linear-gradient(145deg,#263d43,#10161a)",
    "linear-gradient(145deg,#493322,#18110b)",
    "linear-gradient(145deg,#302942,#15111f)",
    "linear-gradient(145deg,#243b31,#101713)",
    "linear-gradient(145deg,#44303a,#171116)",
  ];

  return (
    <div className="discover-tile-media" style={{ background: gradients[index % gradients.length] }}>
      {imageUrl && !failed ? (
        <img src={imageUrl} alt="" className="discover-tile-image" onError={() => setFailed(true)} />
      ) : (
        <div className="discover-tile-placeholder" aria-hidden="true">
          <ImageIcon size={28} />
          <span>{post.mood || "Flic’d"}</span>
        </div>
      )}

      <div className="discover-tile-scrim" aria-hidden="true" />

      <div className="discover-tile-top">
        <span className="discover-type-badge">
          {post.type === "roll" ? <Video size={11} /> : <Compass size={11} />}
          {post.type === "roll" ? "Roll" : "Dump"}
        </span>
        {post.recommendationScore >= 0.7 && (
          <span className="discover-hot-badge">
            <Flame size={11} />
            For you
          </span>
        )}
      </div>

      <div className="discover-tile-bottom">
        <div className="discover-tile-author">
          <span className="discover-tile-avatar">{post.author?.[0]?.toUpperCase() || "?"}</span>
          <span>@{post.author || "unknown"}</span>
        </div>
        <div className="discover-tile-meta">
          <span>♥ {post.likes || 0}</span>
          <span>·</span>
          <span>💬 {post.comments?.length || 0}</span>
          {post.musicTrack?.title && <span className="discover-music-tag">♪</span>}
        </div>
      </div>
    </div>
  );
}

function DiscoverTile({ post, index, onOpenPost }) {
  return (
    <button
      type="button"
      className={`discover-tile${post.layout === "tall" ? " is-tall" : ""}`}
      onClick={() => onOpenPost?.(formatViewerPost(post))}
      aria-label={`Open @${post.author || "unknown"} ${post.type === "roll" ? "roll" : "dump"}`}
    >
      <TileMedia post={post} index={index} />
    </button>
  );
}

export default function Explore({ onOpenPost }) {
  const [candidates, setCandidates] = React.useState([]);
  const [interests, setInterests] = React.useState([]);
  const [followingIds, setFollowingIds] = React.useState(() => new Set());
  const [query, setQuery] = React.useState("");
  const [activeTrail, setActiveTrail] = React.useState("");
  const [random, setRandom] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const loadCandidates = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getExploreCandidates({ limit: 90 });
      setCandidates(result.candidates || []);
      setInterests(result.interests || []);
      setFollowingIds(result.followingIds || new Set());
    } catch (loadError) {
      console.error("Failed to load Explore:", loadError);
      setCandidates([]);
      setError(loadError.message || "Explore is unavailable right now.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  const trails = React.useMemo(() => {
    const merged = [...interests, ...DEFAULT_TRAILS];
    return Array.from(new Set(
      merged
        .map((value) => String(value || "").trim().toLowerCase())
        .filter(Boolean),
    )).slice(0, 10);
  }, [interests]);

  const visiblePosts = React.useMemo(() => {
    const filtered = candidates.filter((candidate) => matchesSearch(candidate, query, activeTrail));
    const ranked = rankExploreCandidates(filtered, {
      interests,
      followingIds,
      query,
      trail: activeTrail,
      randomize: random,
    });
    return buildExploreLayout(ranked.slice(0, 48));
  }, [activeTrail, candidates, followingIds, interests, query, random]);

  return (
    <div className="explore-content">
      <section className="card explore-control-panel">
        <div className="explore-control-header">
          <div>
            <div className="eyebrow">Explore</div>
            <h2 className="explore-heading">Find something worth keeping.</h2>
            <p className="subtitle explore-subtitle">
              A living visual grid built from public Flic’ds, your interests, and what the community is responding to.
            </p>
          </div>
          <button
            type="button"
            className={`btn explore-random-button${random ? " is-active" : ""}`}
            onClick={() => setRandom((value) => !value)}
            aria-pressed={random}
          >
            <RefreshCw size={15} />
            {random ? "Explore outside" : "Randomize"}
          </button>
        </div>

        <div className="explore-search-wrap">
          <Search size={16} className="muted" aria-hidden="true" />
          <input
            className="input explore-search-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search a mood, creator, genre, or vibe…"
            aria-label="Search Explore"
          />
        </div>

        <div className="explore-trails" aria-label="Explore trails">
          <button
            type="button"
            className={`pill explore-trail-pill${!activeTrail ? " active" : ""}`}
            onClick={() => setActiveTrail("")}
            aria-pressed={!activeTrail}
          >
            All
          </button>
          {trails.map((trail) => (
            <button
              type="button"
              className={`pill explore-trail-pill${activeTrail === trail ? " active" : ""}`}
              key={trail}
              onClick={() => setActiveTrail((value) => value === trail ? "" : trail)}
              aria-pressed={activeTrail === trail}
            >
              {trail}
            </button>
          ))}
        </div>
      </section>

      {loading ? (
        <div className="card explore-state-card">
          <Sparkles size={18} />
          <strong>Building your Explore grid…</strong>
          <p className="subtitle">Finding public posts, scoring signals, and arranging the first batch.</p>
        </div>
      ) : error ? (
        <div className="card explore-state-card" role="alert">
          <strong>Explore couldn’t load.</strong>
          <p className="subtitle">{error}</p>
          <button type="button" className="btn" onClick={loadCandidates}>Try again</button>
        </div>
      ) : !visiblePosts.length ? (
        <div className="card explore-state-card">
          <strong>No posts match that trail yet.</strong>
          <p className="subtitle">Try another interest or clear the search.</p>
        </div>
      ) : (
        <section className="discover-grid" aria-label="Explore posts">
          {visiblePosts.map((post, index) => (
            <DiscoverTile key={post.id} post={post} index={index} onOpenPost={onOpenPost} />
          ))}
        </section>
      )}
    </div>
  );
}
