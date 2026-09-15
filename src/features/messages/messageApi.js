import { supabase } from "../../lib/supabase";

export async function getCurrentUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw error;
  if (!user) throw new Error("You must be logged in.");

  return user;
}

export async function getMessageRequests() {
  const user = await getCurrentUser();

  const { data, error } = await supabase
    .from("message_requests")
   .select(`
  id,
  sender_id,
  recipient_id,
  status,
  created_at,
  sender:profiles!message_requests_sender_profile_fkey (
    id,
    username,
    display_name,
    bio,
    avatar_url
  )
`)
    .eq("recipient_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data ?? [];
}

export async function acceptRequest(requestId) {
  const user = await getCurrentUser();

  const { data, error } = await supabase
    .from("message_requests")
    .update({
      status: "accepted",
      responded_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("recipient_id", user.id)
    .eq("status", "pending")
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function declineRequest(requestId) {
  const user = await getCurrentUser();

  const { data, error } = await supabase
    .from("message_requests")
    .update({
      status: "declined",
      responded_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("recipient_id", user.id)
    .eq("status", "pending")
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function getChats() {
  const user = await getCurrentUser();

  const { data, error } = await supabase
    .from("conversation_participants")
    .select(`
      conversation_id,
      conversation:conversations (
        id,
        created_at,
        participants:conversation_participants (
          user_id,
          profile:profiles (
            id,
            username,
            display_name,
            bio,
            avatar_url
          )
        ),
        messages (
          id,
          sender_id,
          body,
          created_at
        )
      )
    `)
    .eq("user_id", user.id);

  if (error) throw error;

  return (data ?? []).map((row) => {
    const conversation = row.conversation;

    const otherParticipant = conversation?.participants?.find(
      (participant) => participant.user_id !== user.id
    );

    const messages = [...(conversation?.messages ?? [])].sort(
      (a, b) =>
        new Date(a.created_at).getTime() -
        new Date(b.created_at).getTime()
    );

    const otherUser = otherParticipant?.profile;

    return {
      id: conversation.id,
      user: {
        id: otherUser?.id,
        handle: otherUser?.username ?? "unknown",
        name: otherUser?.display_name ?? "",
        bio: otherUser?.bio ?? "",
        avatarUrl: otherUser?.avatar_url ?? "",
      },
      messages: messages.map((message) => ({
        id: message.id,
        from: message.sender_id === user.id ? "you" : "them",
        text: message.body,
        createdAt: message.created_at,
      })),
      unread: 0,
    };
  });
}

export async function sendMessage(conversationId, text) {
  const user = await getCurrentUser();

  const body = text.trim();

  if (!body) {
    throw new Error("Message cannot be empty.");
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      body,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    from: "you",
    text: data.body,
    createdAt: data.created_at,
  };
}