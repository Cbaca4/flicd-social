import { submitComment as defaultSubmitComment } from "./commentSubmit.js";
import { appendSavedComment } from "./commentFeed.js";

export function createCommentAction({
  submitComment = defaultSubmitComment,
  setDumps,
  username = "you",
  onToast = () => {},
} = {}) {
  return async (dumpId, input) => {
    try {
      const savedComment = await submitComment(dumpId, input);
      setDumps((currentDumps) => currentDumps.map((post) =>
        post.id === dumpId
          ? appendSavedComment(post, { ...savedComment, username }, username)
          : post,
      ));
      return savedComment;
    } catch (error) {
      console.error("Failed to add comment:", error);
      onToast(error.message || "Could not add comment");
      return null;
    }
  };
}
