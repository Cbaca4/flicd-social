export function buildExploreLayout(candidates) {
  const items = Array.isArray(candidates) ? candidates : [];
  if (!items.length) return [];

  const rankedScores = items
    .map((item) => Number(item.recommendationScore) || 0)
    .sort((a, b) => a - b);
  const percentileIndex = Math.max(0, Math.floor(rankedScores.length * 0.72) - 1);
  const anchorThreshold = rankedScores[percentileIndex] ?? 0;

  let anchorsInWindow = 0;

  return items.map((item, index) => {
    const rollAnchor = item.type === "roll";
    const highScoreAnchor = (Number(item.recommendationScore) || 0) >= anchorThreshold && index > 0;
    const cadenceAnchor = index > 0 && index % 8 === 0;
    const shouldAnchor = rollAnchor || highScoreAnchor || cadenceAnchor;

    let isTall = false;
    if (shouldAnchor && anchorsInWindow < 2) {
      isTall = true;
      anchorsInWindow += 1;
    }

    if ((index + 1) % 4 === 0) anchorsInWindow = Math.max(0, anchorsInWindow - 1);

    return {
      ...item,
      layout: isTall ? "tall" : "standard",
      spanRows: isTall ? 2 : 1,
    };
  });
}
