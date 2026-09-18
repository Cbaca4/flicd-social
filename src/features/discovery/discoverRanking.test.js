import { describe, expect, it } from "vitest";
import { rankExploreCandidates, scoreExploreCandidate } from "./discoverRanking.js";

describe("Discover ranking", () => {
  it("raises interest-aligned and followed creators without losing freshness signals", () => {
    const score = scoreExploreCandidate(
      {
        id: "post-1",
        authorId: "user-2",
        interests: ["Gym"],
        context: "late night gym session",
        mood: "focused",
        type: "dump",
        items: [{ imagePath: "user-2/post.jpg" }],
        likes: 6,
        comments: [{ id: "comment-1" }],
        createdAt: new Date().toISOString(),
      },
      {
        interests: ["Gym"],
        followingIds: new Set(["user-2"]),
      },
    );

    expect(score.signals.interestMatch).toBe(1);
    expect(score.signals.creatorAffinity).toBe(1);
    expect(score.recommendationScore).toBeGreaterThan(0.5);
  });

  it("diversifies adjacent creators and media types", () => {
    const candidates = [
      { id: "a-1", authorId: "a", type: "dump", context: "gym", items: [{ imagePath: "a/1" }], createdAt: new Date().toISOString() },
      { id: "a-2", authorId: "a", type: "dump", context: "gym", items: [{ imagePath: "a/2" }], createdAt: new Date(Date.now() - 1000).toISOString() },
      { id: "b-1", authorId: "b", type: "roll", context: "music", items: [{ imagePath: "b/1" }], createdAt: new Date(Date.now() - 2000).toISOString() },
      { id: "c-1", authorId: "c", type: "dump", context: "street", items: [{ imagePath: "c/1" }], createdAt: new Date(Date.now() - 3000).toISOString() },
    ];

    const ranked = rankExploreCandidates(candidates, { interests: ["Gym"] });

    expect(ranked).toHaveLength(4);
    expect(ranked[0].authorId).not.toBe(ranked[1].authorId);
    expect(ranked[0].type).not.toBe(ranked[1].type);
  });
});
