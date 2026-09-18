
import React from "react";
import {
  Check,
  Clock,
  MessageCircle,
  Send,
  UserRoundX,
  X,
} from "lucide-react";

import { EmptyState } from "../../components/shared/States.jsx";
import {
  getMessageRequests,
  acceptRequest,
  declineRequest,
  getChats,
  sendMessage,
} from "./messageApi.js";

export default function Messages({ onToast }) {
  const [tab, setTab] = React.useState("pending");
  const [active, setActive] = React.useState(null);
  const [text, setText] = React.useState("");

  const [requests, setRequests] = React.useState([]);
  const [chats, setChats] = React.useState([]);

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const [actionLoading, setActionLoading] = React.useState(false);

  async function loadMessages() {
    setLoading(true);
    setError("");

    try {
      const [requestData, chatData] = await Promise.all([
        getMessageRequests(),
        getChats(),
      ]);

      setRequests(requestData);
      setChats(chatData);
    } catch (err) {
      console.error("Messages loading error:", err);
      setError(err.message || "Unable to load messages.");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    loadMessages();
  }, []);

  async function handleAccept(id) {
    setActionLoading(true);
    setError("");

    try {
      await acceptRequest(id);

      await loadMessages();

      onToast?.("Request accepted");
    } catch (err) {
      console.error("Accept request error:", err);
      setError(err.message || "Unable to accept request.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDecline(id) {
    setActionLoading(true);
    setError("");

    try {
      await declineRequest(id);

      await loadMessages();

      onToast?.("Request declined");
    } catch (err) {
      console.error("Decline request error:", err);
      setError(err.message || "Unable to decline request.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSendMessage() {
    const value = text.trim();

    if (!value || !active || actionLoading) {
      return;
    }

    setActionLoading(true);
    setError("");

    try {
      const newMessage = await sendMessage(active, value);

      setChats((currentChats) =>
        currentChats.map((chat) =>
          chat.id === active
            ? {
                ...chat,
                messages: [...chat.messages, newMessage],
                unread: 0,
              }
            : chat
        )
      );

      setText("");
    } catch (err) {
      console.error("Send message error:", err);
      setError(err.message || "Unable to send message.");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="screen">
        <div className="topbar">
          <div>
            <div className="eyebrow">Inbox</div>
            <h1 className="title">Messages</h1>
            <p className="subtitle">Loading your messages...</p>
          </div>
        </div>
      </div>
    );
  }

  if (active) {
    const chat = chats.find((conversation) => conversation.id === active);

    if (!chat) {
      setActive(null);
      return null;
    }

    return (
      <div className="screen">
        <div className="topbar">
          <div className="row">
  <button
    className="btn icon-btn"
    onClick={() => setActive(null)}
    aria-label="Back to messages"
  >
    <X size={18} />
  </button>

  <div
    className="avatar"
    style={{
      width: 40,
      height: 40,
      fontSize: 15,
      flexShrink: 0,
    }}
  >
    {(chat.user.handle || "?")[0].toUpperCase()}
  </div>

  <div>
    <strong>@{chat.user.handle}</strong>

    {chat.user.name && (
      <p className="subtitle">
        {chat.user.name}
      </p>
    )}
  </div>
</div>

          <button
            className="btn btn-danger"
            aria-label="Block user"
          >
            <UserRoundX size={15} />
            Block
          </button>
        </div>

        {error && (
          <div
            className="card"
            style={{
              marginTop: 14,
              borderColor: "rgba(255,80,80,.4)",
            }}
          >
            <p>{error}</p>
          </div>
        )}

        <div
          className="stack"
          style={{
            minHeight: "55vh",
            justifyContent: "flex-end",
            marginTop: 14,
          }}
        >
          {chat.messages.length ? (
            chat.messages.map((message) => (
             <div
  key={message.id}
  style={{
    alignSelf:
      message.from === "you"
        ? "flex-end"
        : "flex-start",
    maxWidth: "78%",
  }}
>
  <div
    style={{
      padding: "11px 13px",
      borderRadius: 16,
      background:
        message.from === "you"
          ? "var(--amber)"
          : "var(--card)",
      color:
        message.from === "you"
          ? "#ffffff"
          : "var(--text)",
    }}
  >
    {message.text}
  </div>

  <div
    className="subtitle"
    style={{
      fontSize: 11,
      marginTop: 4,
      textAlign:
        message.from === "you"
          ? "right"
          : "left",
      opacity: 0.7,
    }}
  >
    {new Date(message.createdAt).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })}
  </div>
</div>
            ))
          ) : (
            <EmptyState
              title="Start the conversation"
              text="Say something that feels like you."
            />
          )}
        </div>

        <div
  className="row"
  style={{
    marginTop: 14,
    alignItems: "stretch",
  }}
>
  <input
    className="input"
    value={text}
    onChange={(event) => setText(event.target.value)}
    onKeyDown={(event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleSendMessage();
      }
    }}
    placeholder="Write a message..."
    disabled={actionLoading}
    aria-label="Message"
  />

  <button
    className="btn btn-primary"
    disabled={!text.trim() || actionLoading}
    onClick={handleSendMessage}
    aria-label="Send message"
  >
    {actionLoading ? "Sending..." : <Send size={16} />}
  </button>
</div>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="topbar">
        <div>
          <div className="eyebrow">Inbox</div>
          <h1 className="title">Messages</h1>
          <p className="subtitle">
            Requests stay separate until you accept them.
          </p>
        </div>
      </div>

      {error && (
        <div
          className="card"
          style={{
            marginTop: 14, borderColor: "rgba(255,80,80,.4)", }} > <p>{error}</p> <button className="btn" style={{ marginTop: 10 }} onClick={loadMessages} > Try again </button> </div> )} <div className="segmented"> <button className={`seg ${tab === "pending" ? "active" : ""}`} onClick={() => setTab("pending")} > Pending{" "} {requests.length > 0 && `· ${requests.length}`} </button> <button className={`seg ${tab === "chats" ? "active" : ""}`} onClick={() => setTab("chats")} > Chats </button> </div> <div style={{ marginTop: 14 }}> {tab === "pending" ? ( requests.length ? ( <div className="stack"> {requests.map((request) => { const user = request.sender; return ( <div className="card row" key={request.id} > <div className="avatar"> {(user?.username || "?")[0].toUpperCase()} </div> <div style={{ flex: 1 }}> <strong> @{user?.username || "unknown"} </strong> <p className="subtitle"> {user?.bio || "Wants to send you a message."} </p> <div className="row" style={{ marginTop: 8 }} > <Clock size={13} className="muted" /> <span className="subtitle"> Message request </span> </div> </div> <button className="btn btn-primary icon-btn" onClick={() => handleAccept(request.id)} disabled={actionLoading} aria-label="Accept" > <Check size={16} /> </button> <button className="btn icon-btn" onClick={() => handleDecline(request.id)} disabled={actionLoading} aria-label="Decline" > <X size={16} /> </button> </div> ); })} </div> ) : ( <div
  className="card"
  style={{
    textAlign: "center",
    padding: 28,
  }}
>
  <div
    className="avatar"
    style={{
      margin: "0 auto 12px",
      width: 48,
      height: 48,
      fontSize: 20,
    }}
  >
    <Clock size={20} />
  </div>

  <strong>No pending requests</strong>

  <p
    className="subtitle"
    style={{
      marginTop: 6,
      maxWidth: 280,
      marginLeft: "auto",
      marginRight: "auto",
    }}
  >
    When someone wants to message you, their request will show up here.
  </p>
</div> ) ) : chats.length ? ( <div className="stack"> {chats.map((chat) => ( <button className="card row" style={{ textAlign: "left" }} key={chat.id} onClick={() => setActive(chat.id)} > <div className="avatar"> {(chat.user.handle || "?")[0].toUpperCase()} </div> <div style={{ flex: 1 }}> <div className="row" style={{ justifyContent: "space-between", }} > <strong>@{chat.user.handle}</strong> {chat.unread > 0 && ( <span className="pill active"> {chat.unread} </span> )} </div> <p className="subtitle" style={{ marginTop: 4 }} > {chat.messages.at(-1)?.text || "No messages yet"} </p> </div> <MessageCircle size={17} className="muted" /> </button> ))} </div> ) : ( <div
  className="card"
  style={{
    textAlign: "center",
    padding: 28,
  }}
>
  <div
    className="avatar"
    style={{
      margin: "0 auto 12px",
      width: 48,
      height: 48,
      fontSize: 20,
    }}
  >
    <MessageCircle size={20} />
  </div>

  <strong>No chats yet</strong>

  <p
    className="subtitle"
    style={{
      marginTop: 6,
      maxWidth: 280,
      marginLeft: "auto",
      marginRight: "auto",
    }}
  >
    Accept a message request and your conversation will appear here.
  </p>
</div> )} </div> </div> ); }
