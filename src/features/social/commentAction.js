import { submitComment as defaultSubmitComment } from "./commentSubmit.js";
import { appendSavedComment } from "./commentFeed.js";
import { captureAuthScope } from "../../app/authScope.js";

export function createCommentAction({
  submitComment = defaultSubmitComment,
  setDumps,
  username = "you",
  onToast = () => {},
  context,
} = {}) {
  return async (dumpId, input) => {
    let scope;
    try {
      scope = captureAuthScope(context);
      const savedComment = await submitComment(dumpId, input, scope);
      if (!scope.isCurrent()) return null;
      setDumps((currentDumps) => currentDumps.map((post) =>
        post.id === dumpId
          ? appendSavedComment(post, { ...savedComment, username }, username)
          : post,
      ));
      return savedComment;
    } catch (error) {
      if (!scope?.isCurrent()) return null;
      console.error("Failed to add comment:", error);
      onToast(error.message || "Could not add comment");
      return null;
    }
  };
}
