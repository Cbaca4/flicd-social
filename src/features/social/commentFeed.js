export function appendSavedComment(post, savedComment, fallbackHandle = "you") {
  if (!post || !savedComment) return post;

  return {
    ...post,
    comments: [
      ...(post.comments || []),
      {
        id: savedComment.id,
        user_id: savedComment.user_id || null,
        from: savedComment.username || savedComment.from || fallbackHandle,
        text: savedComment.text ?? null,
        media_type: savedComment.media_type ?? "text",
        media_url: savedComment.media_url ?? null,
        media_path: savedComment.media_path ?? null,
        media_metadata: savedComment.media_metadata ?? null,
        created_at: savedComment.created_at,
      },
    ],
  };
}
