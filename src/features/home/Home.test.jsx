// @vitest-environment jsdom

import React from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import Home, { Viewer } from "./Home.jsx";

vi.mock("../seasonal/SeasonalOverlay.jsx", () => ({
  default: () => null,
}));
vi.mock("./UserSearch.jsx", () => ({
  default: () => null,
}));
vi.mock("../profile/PublicProfile.jsx", () => ({
  default: () => null,
}));
vi.mock("../../lib/supabase", () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: vi.fn(async () => ({
          data: { signedUrl: "https://media.example.test/comment-audio.webm" },
          error: null,
        })),
      })),
    },
  },
}));

let recorderState = "idle";
let recorderListener = null;
const voiceBlob = new Blob(["voice"], { type: "audio/webm" });
const startRecording = vi.fn(async () => {
  recorderState = "recording";
  recorderListener?.(recorderState);
});
const stopRecording = vi.fn(() => {
  recorderState = "review";
  recorderListener?.(recorderState);
});

vi.mock("../social/voiceCommentRecorder.js", () => ({
  createVoiceCommentRecorder: () => ({
    start: startRecording,
    stop: stopRecording,
    cancel: vi.fn(),
    getState: () => recorderState,
    getBlob: () => voiceBlob,
    subscribe: (listener) => {
      recorderListener = listener;
      return () => {
        if (recorderListener === listener) recorderListener = null;
      };
    },
  }),
}));

afterEach(() => {
  cleanup();
  recorderState = "idle";
  recorderListener = null;
  vi.clearAllMocks();
});

describe("Home feed states", () => {
  const activeSpace = {
    id: "main",
    handle: "baco",
    label: "Main",
    followers: 12,
  };

  it("renders loading skeletons while the feed is loading", () => {
    render(
      <Home
        dumps={[]}
        activeSpace={activeSpace}
        loading
        onOpen={() => {}}
      />,
    );

    expect(screen.getAllByTestId("feed-skeleton")).toHaveLength(3);
    expect(screen.queryByText("Nothing here yet")).not.toBeInTheDocument();
  });

  it("renders a retryable error instead of the empty state", () => {
    const onRetry = vi.fn();

    render(
      <Home
        dumps={[]}
        activeSpace={activeSpace}
        error="Failed to load social feed."
        onRetry={onRetry}
        onOpen={() => {}}
      />,
    );

    expect(screen.getByText("Could not load your feed")).toBeInTheDocument();
    expect(screen.getByText("Something went wrong while loading your moments.")).toBeInTheDocument();
    expect(screen.queryByText("Nothing here yet")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("preserves the existing empty state when the feed is ready with no posts", () => {
    render(
      <Home
        dumps={[]}
        activeSpace={activeSpace}
        loading={false}
        error=""
        onOpen={() => {}}
      />,
    );

    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
  });
});

describe("Post viewer", () => {
  const post = {
    id: "post-1",
    author: "baco",
    mood: "late night",
    mode: "dump",
    postedMinutesAgo: 20,
    liked: false,
    likes: 4,
    comments: [{ id: "comment-1", user_id: "friend-id", from: "mia", text: "love this" }],
    items: [{ id: "item-1", note: "one moment" }],
  };

  it("keeps actions and comments in separate viewer sections", () => {
    const onLike = vi.fn();
    const onComment = vi.fn();
    const onKeep = vi.fn();

    const { container } = render(
      <Viewer
        post={post}
        onClose={() => {}}
        onLike={onLike}
        onComment={onComment}
        onKeep={onKeep}
        onMarkViewed={() => {}}
      />,
    );

    const actions = container.querySelector(".post-actions");
    const conversation = container.querySelector(".post-conversation");
    const composer = container.querySelector(".comment-composer");

    expect(actions).toBeInTheDocument();
    expect(conversation).toBeInTheDocument();
    expect(conversation?.querySelector(".comment-composer")).toBe(composer);
    expect(screen.getByText("love this")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Add a comment")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Like" }));
    expect(onLike).toHaveBeenCalledWith("post-1");
  });

  it("disables only the like action while a like request is pending", () => {
    render(
      <Viewer
        post={post}
        onClose={() => {}}
        onLike={() => {}}
        onComment={() => {}}
        onKeep={() => {}}
        onMarkViewed={() => {}}
        likePending
      />,
    );

    expect(screen.getByRole("button", { name: "Like" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Keep" })).toBeEnabled();
    expect(screen.getByPlaceholderText("Add a comment")).toBeEnabled();
  });

  it("shows a voice comment control in the composer", () => {
    render(
      <Viewer
        post={post}
        onClose={() => {}}
        onLike={() => {}}
        onComment={() => {}}
        onKeep={() => {}}
        onMarkViewed={() => {}}
      />,
    );

    expect(screen.getByRole("button", { name: "Record voice comment" })).toBeInTheDocument();
  });

  it("starts voice recording when the voice control is pressed", () => {
    render(
      <Viewer
        post={post}
        onClose={() => {}}
        onLike={() => {}}
        onComment={() => {}}
        onKeep={() => {}}
        onMarkViewed={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Record voice comment" }));
    expect(startRecording).toHaveBeenCalledTimes(1);
  });

  it("shows a stop control after recording starts", async () => {
    render(
      <Viewer
        post={post}
        onClose={() => {}}
        onLike={() => {}}
        onComment={() => {}}
        onKeep={() => {}}
        onMarkViewed={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Record voice comment" }));

    expect(await screen.findByRole("button", { name: "Stop voice recording" })).toBeInTheDocument();
  });

  it("shows voice review controls after recording stops", async () => {
    render(
      <Viewer
        post={post}
        onClose={() => {}}
        onLike={() => {}}
        onComment={() => {}}
        onKeep={() => {}}
        onMarkViewed={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Record voice comment" }));
    fireEvent.click(await screen.findByRole("button", { name: "Stop voice recording" }));

    expect(await screen.findByLabelText("Voice comment preview")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel voice comment" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send voice comment" })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Add a comment")).not.toBeInTheDocument();
  });

  it("sends the recorded blob as an audio comment payload", async () => {
    const onComment = vi.fn();

    render(
      <Viewer
        post={post}
        onClose={() => {}}
        onLike={() => {}}
        onComment={onComment}
        onKeep={() => {}}
        onMarkViewed={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Record voice comment" }));
    fireEvent.click(await screen.findByRole("button", { name: "Stop voice recording" }));
    fireEvent.click(screen.getByRole("button", { name: "Send voice comment" }));

    expect(onComment).toHaveBeenCalledWith("post-1", {
      media_type: "audio",
      media_blob: voiceBlob,
    });
  });

  it("shows Delete only for the current user's comment", () => {
    render(
      <Viewer
        post={{
          ...post,
          comments: [
            { id: "own", user_id: "me", from: "baco", text: "my comment" },
            { id: "other", user_id: "friend-id", from: "mia", text: "their comment" },
          ],
        }}
        currentUserId="me"
        onDeleteComment={() => {}}
        onClose={() => {}}
        onLike={() => {}}
        onComment={() => {}}
        onKeep={() => {}}
        onMarkViewed={() => {}}
      />,
    );

    expect(screen.getByRole("button", { name: "Delete comment" })).toBeInTheDocument();
  });

  it("deletes the current user's comment from the viewer after success", async () => {
    const onDeleteComment = vi.fn().mockResolvedValue(true);

    render(
      <Viewer
        post={{
          ...post,
          comments: [{ id: "own", user_id: "me", from: "baco", text: "my comment" }],
        }}
        currentUserId="me"
        onDeleteComment={onDeleteComment}
        onClose={() => {}}
        onLike={() => {}}
        onComment={() => {}}
        onKeep={() => {}}
        onMarkViewed={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete comment" }));

    expect(onDeleteComment).toHaveBeenCalledWith("own");
    expect(await screen.findByText("No comments yet.")).toBeInTheDocument();
  });

  it("shows Report for another user's comment and sends the selected reason", async () => {
    const onReportComment = vi.fn().mockResolvedValue(true);

    render(
      <Viewer
        post={{
          ...post,
          comments: [{ id: "other", user_id: "friend-id", from: "mia", text: "their comment" }],
        }}
        currentUserId="me"
        onReportComment={onReportComment}
        onClose={() => {}}
        onLike={() => {}}
        onComment={() => {}}
        onKeep={() => {}}
        onMarkViewed={() => {}}
      />,
    );

    expect(screen.getByRole("button", { name: "Report comment" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Report comment" }));
    expect(screen.getByText("Report this comment")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Spam" }));

    expect(onReportComment).toHaveBeenCalledWith("other", "spam");
    expect(await screen.findByText("Comment reported.")).toBeInTheDocument();
  });

  it("renders a saved audio comment with a signed storage URL", async () => {
    render(
      <Viewer
        post={{
          ...post,
          comments: [{
            id: "comment-audio-1",
            from: "mia",
            text: null,
            media_type: "audio",
            media_url: null,
            media_path: "user-1/comments/voice-1.webm",
            media_metadata: { duration_seconds: 8 },
          }],
        }}
        onClose={() => {}}
        onLike={() => {}}
        onComment={() => {}}
        onKeep={() => {}}
        onMarkViewed={() => {}}
      />,
    );

    const audio = await screen.findByLabelText("Audio comment");
    expect(audio).toHaveAttribute("src", "https://media.example.test/comment-audio.webm");
  });

  it("renders a saved video comment with a signed storage URL and controls", async () => {
    render(
      <Viewer
        post={{
          ...post,
          comments: [{
            id: "comment-video-1",
            from: "mia",
            text: null,
            media_type: "video",
            media_url: null,
            media_path: "user-1/comments/clip-1.mp4",
            media_metadata: { duration_seconds: 12 },
          }],
        }}
        onClose={() => {}}
        onLike={() => {}}
        onComment={() => {}}
        onKeep={() => {}}
        onMarkViewed={() => {}}
      />,
    );

    const video = await screen.findByLabelText("Video comment");
    expect(video).toHaveAttribute("src", "https://media.example.test/comment-audio.webm");
    expect(video).toHaveAttribute("controls");
    expect(screen.getByText("12s")).toBeInTheDocument();
  });

  it("renders a saved GIF comment as an image tile", async () => {
    render(
      <Viewer
        post={{
          ...post,
          comments: [{
            id: "comment-gif-1",
            from: "mia",
            text: null,
            media_type: "gif",
            media_url: "https://media.example.test/funny.gif",
            media_path: null,
            media_metadata: { provider: "giphy", title: "Funny reaction" },
          }],
        }}
        onClose={() => {}}
        onLike={() => {}}
        onComment={() => {}}
        onKeep={() => {}}
        onMarkViewed={() => {}}
      />,
    );

    const gif = await screen.findByLabelText("GIF comment");
    expect(gif).toHaveAttribute("src", "https://media.example.test/funny.gif");
  });
});
