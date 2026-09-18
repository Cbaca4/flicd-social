export const DISCOVER_WEIGHTS = Object.freeze({
  interestMatch: 0.30,
  recentEngagement: 0.20,
  creatorAffinity: 0.15,
  mediaPreference: 0.15,
  freshness: 0.10,
  quality: 0.10,
});

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function stableNoise(value) {
  let hash = 0;
  for (const char of String(value || "")) {
    hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  }
  return (Math.abs(hash) % 1000) / 1000;
}

function textTerms(candidate) {
  return [
    candidate?.context,
    candidate?.mood,
    candidate?.type,
    ...(candidate?.interests || []),
    ...(candidate?.tags || []),
    candidate?.musicTrack?.genre,
    candidate?.musicTrack?.mood,
  ].map(normalize).filter(Boolean);
}

function interestScore(candidate, interests, query, trail) {
  const terms = textTerms(candidate);
  const targets = [...(interests || []), query, trail].map(normalize).filter(Boolean);
  if (!targets.length) return 0;

  let hits = 0;
  for (const target of targets) {
    if (terms.some((term) => term.includes(target) || target.includes(term))) hits += 1;
  }
  return Math.min(1, hits / targets.length);
}

function freshnessScore(createdAt) {
  const timestamp = new Date(createdAt || 0).getTime();
  if (!Number.isFinite(timestamp)) return 0.35;
  const ageHours = Math.max(0, (Date.now() - timestamp) / 3600000);
  return Math.exp(-ageHours / 72);
}

export function scoreExploreCandidate(candidate, {
  interests = [],
  followingIds = new Set(),
  query = "",
  trail = "",
  maxEngagement = 1,
  randomize = false,
} = {}) {
  const engagement = Math.min(
    1,
    (Math.log1p(Math.max(0, Number(candidate.likes) || 0)) +
      Math.log1p(Math.max(0, Number(candidate.comments?.length) || 0)) * 1.4) /
      Math.max(1, maxEngagement),
  );
  const creatorAffinity = followingIds.has(candidate.authorId) ? 1 : 0;
  const mediaPreference = candidate.type === "roll"
    ? 1
    : candidate.items?.length > 1
      ? 0.75
      : 0.55;
  const quality = candidate.imagePath || candidate.imageUrl
    ? 1
    : candidate.items?.some((item) => item?.imagePath || item?.imageUrl)
      ? 0.8
      : 0.45;
  const interestMatch = interestScore(candidate, interests, query, trail);
  const freshness = freshnessScore(candidate.createdAt);
  const explorationBoost = randomize ? stableNoise(candidate.id) * 0.35 : 0;

  const score =
    DISCOVER_WEIGHTS.interestMatch * interestMatch +
    DISCOVER_WEIGHTS.recentEngagement * engagement +
    DISCOVER_WEIGHTS.creatorAffinity * creatorAffinity +
    DISCOVER_WEIGHTS.mediaPreference * mediaPreference +
    DISCOVER_WEIGHTS.freshness * freshness +
    DISCOVER_WEIGHTS.quality * quality +
    explorationBoost;

  return {
    ...candidate,
    recommendationScore: Number(score.toFixed(6)),
    signals: {
      interestMatch,
      recentEngagement: engagement,
      creatorAffinity,
      mediaPreference,
      freshness,
      quality,
    },
  };
}

export function rankExploreCandidates(candidates, options = {}) {
  const input = Array.isArray(candidates) ? candidates : [];
  const maxEngagement = Math.max(
    1,
    ...input.map((candidate) =>
      Math.log1p(Math.max(0, Number(candidate.likes) || 0)) +
      Math.log1p(Math.max(0, Number(candidate.comments?.length) || 0)) * 1.4
    ),
  );

  const scored = input
    .filter((candidate) => candidate?.id)
    .map((candidate) => scoreExploreCandidate(candidate, { ...options, maxEngagement }));

  const sorted = [...scored].sort((a, b) =>
    b.recommendationScore - a.recommendationScore ||
    new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime() ||
    String(a.id).localeCompare(String(b.id)),
  );

  const result = [];
  const remaining = [...sorted];
  let lastAuthor = null;
  let lastType = null;

  while (remaining.length) {
    let pickIndex = remaining.findIndex((candidate) =>
      candidate.authorId !== lastAuthor && candidate.type !== lastType
    );
    if (pickIndex < 0) {
      pickIndex = remaining.findIndex((candidate) => candidate.authorId !== lastAuthor);
    }
    if (pickIndex < 0) pickIndex = 0;

    const [next] = remaining.splice(pickIndex, 1);
    result.push(next);
    lastAuthor = next.authorId;
    lastType = next.type;
  }

  return result;
}
