import React from "react";

import { supabase } from "../lib/supabase";

import Boards from "../features/profile/Boards.jsx";
import BoardStudio from "../features/profile/BoardStudio.jsx";

import {
  getBoards,
  getBoardItems,
  getOrCreateDefaultBoard,
  createBoard,
  saveBoardItem,
} from "../features/profile/boardApi.js";

import Auth from "../features/auth/Auth.jsx";
import AppShell from "./AppShell.jsx";

import Home, { Viewer } from "../features/home/Home.jsx";

import CreateChoose from "../features/capture/CreateChoose.jsx";
import {
  DumpBuilder,
  RollBuilder,
} from "../features/capture/CaptureBuilders.jsx";

import {
  createDump,
  getDumps,
} from "../features/capture/dumpApi.js";
import {
  removeDumpImages,
  uploadDumpImages,
} from "../features/capture/mediaUpload.js";

import Messages from "../features/messages/Messages.jsx";
import Profile from "../features/profile/Profile.jsx";
import ProfileStudio from "../features/profile/ProfileStudio.jsx";
import EditProfile from "../features/profile/EditProfile.jsx";
import Discovery from "../features/discovery/Discovery.jsx";
import SpaceSwitcher from "../features/spaces/SpaceSwitcher.jsx";

import {
  DEFAULT_THEME,
  sanitizeProfileTheme,
} from "../features/profile/profileTheme.js";

const seedSpaces = [
  { id: "main", handle: "you", label: "Main", followers: 128, following: 94 },
  { id: "gym", handle: "gym_log", label: "Gym", followers: 42, following: 12 },
  { id: "music", handle: "the.setlist", label: "Music", followers: 301, following: 58 },
];

const seedDumps = [
  {
    id: 1,
    channel: "main",
    author: "maren_",
    mood: "golden hour",
    mode: "24h",
    postedMinutesAgo: 45,
    likes: 12,
    liked: false,
    items: [{ note: "rooftop, 7pm" }, { note: "the light though" }, { note: "" }],
    comments: [{ id: "c1", from: "theo", text: "wait where is this" }],
    context: "rooftop, 7pm",
  },
  {
    id: 2,
    channel: "main",
    author: "theo.b",
    mood: "chaotic",
    mode: "24h",
    postedMinutesAgo: 610,
    likes: 34,
    liked: true,
    items: [{ note: "new espresso setup" }, { note: "" }],
    comments: [],
    context: "new espresso setup",
  },
  {
    id: 3,
    channel: "gym",
    author: "cole_lifts",
    mood: "gym log",
    mode: "once",
    postedMinutesAgo: 5,
    likes: 3,
    liked: false,
    viewed: false,
    items: Array.from({ length: 8 }, () => ({ note: "" })),
    comments: [],
    context: "8 frame roll",
  },
  {
    id: 4,
    channel: "music",
    author: "junebug",
    mood: "nostalgic",
    mode: "24h",
    postedMinutesAgo: 120,
    likes: 58,
    liked: false,
    items: [{ note: "front row" }, { note: "setlist" }, { note: "encore" }],
    comments: [{ id: "c2", from: "theo", text: "the encore was insane" }],
    context: "front row",
  },
];

const seedRequests = [
  { id: "r1", user: { handle: "alex", name: "Alex Rivera", bio: "found you through global" } },
];

export default function FlicdApp() {
  const [session, setSession] = React.useState(null);
  const [screen, setScreen] = React.useState("home");
  const [spaces] = React.useState(seedSpaces);
  const [activeSpaceId, setActiveSpaceId] = React.useState("main");
  const [dumps, setDumps] = React.useState(seedDumps);
  const [activePostId, setActivePostId] = React.useState(null);
  const [kept, setKept] = React.useState([]);
  const [boards, setBoards] = React.useState([]);
  const [pendingKeep, setPendingKeep] = React.useState(null);
  const [creatingKeepBoard, setCreatingKeepBoard] = React.useState(false);
  const [keepBoardName, setKeepBoardName] = React.useState("");
  const [savingKeep, setSavingKeep] = React.useState(false);
  const [boardStudioOpen, setBoardStudioOpen] = React.useState(false);
  const [openBoardId, setOpenBoardId] = React.useState(null);
  const [requests, setRequests] = React.useState(seedRequests);
  const [chats, setChats] = React.useState([]);
  const [theme, setTheme] = React.useState(() => sanitizeProfileTheme(DEFAULT_THEME));
  const [supabaseProfile, setSupabaseProfile] = React.useState(null);
  const [toast, setToast] = React.useState("");

  React.useEffect(() => {
    async function getSession() {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
    }
    getSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  React.useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 1900);
    return () => clearTimeout(timer);
  }, [toast]);

  React.useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (error) {
        console.error("Profile error:", error);
        return;
      }
      if (data) {
        setSupabaseProfile(data);
        if (data.profile_theme) setTheme(sanitizeProfileTheme(data.profile_theme));
      }
    }
    loadProfile();
  }, [session]);

  React.useEffect(() => {
    async function loadDumps() {
      if (!session) return;
      try {
        const savedDumps = await getDumps();
        if (!savedDumps.length) return;
        const formattedDumps = savedDumps.map((dump) => ({
          id: dump.id,
          channel: dump.space_id,
          author: dump.user_id,
          mood: dump.mood,
          mode: dump.expiry,
          postedMinutesAgo: Math.floor((Date.now() - new Date(dump.created_at).getTime()) / 60000),
          likes: 0,
          liked: false,
          viewed: false,
          comments: [],
          items: (dump.dump_items || []).sort((a, b) => a.position - b.position).map((item) => ({ note: item.note || "", imagePath: item.image_path || null })),
          context: dump.context || "",
        }));
        setDumps(formattedDumps);
      } catch (error) {
        console.error("Failed to load dumps:", error);
      }
    }
    loadDumps();
  }, [session]);

  React.useEffect(() => {
    async function loadBoardItems() {
      if (!session) return;
      try {
        const savedItems = await getBoardItems();
        setKept(savedItems.map((item) => ({
          id: item.id,
          boardId: item.board_id,
          dumpId: item.dump_id,
          author: "",
          note: item.note || "",
          mood: item.mood || "",
          seed: item.item_position || 0,
        })));
      } catch (error) {
        console.error("Failed to load board items:", error);
      }
    }
    loadBoardItems();
  }, [session]);

  React.useEffect(() => {
    async function loadBoards() {
      if (!session) return;
      try {
        setBoards(await getBoards());
      } catch (error) {
        console.error("Failed to load boards:", error);
      }
    }
    loadBoards();
  }, [session]);

  const activeSpace = spaces.find((space) => space.id === activeSpaceId) || spaces[0];
  const activePost = dumps.find((dump) => dump.id === activePostId);
  const onToast = (message) => setToast(message);
  const profileBoards = boards.map((board) => ({ ...board, count: kept.filter((item) => item.boardId === board.id).length }));

  const toggleLike = (id) => {
    setDumps((currentDumps) => currentDumps.map((post) => post.id === id ? { ...post, liked: !post.liked, likes: post.likes + (post.liked ? -1 : 1) } : post));
  };

  const comment = (id, text) => {
    setDumps((currentDumps) => currentDumps.map((post) => post.id === id ? { ...post, comments: [...post.comments, { id: Date.now(), from: "you", text }] } : post));
  };

  const keep = async (post, index) => {
    try {
      const savedBoard = await getOrCreateDefaultBoard();
      setBoards((current) => current.some((board) => board.id === savedBoard.id) ? current : [savedBoard, ...current]);
      setPendingKeep({ post, index });
      setCreatingKeepBoard(false);
      setKeepBoardName("");
    } catch (error) {
      console.error("Failed to prepare Save to Board:", error);
      onToast(error.message || "Could not open Save to Board");
    }
  };

  const saveKeepToBoard = async (board) => {
    if (!pendingKeep || savingKeep) return;
    const { post, index } = pendingKeep;
    try {
      setSavingKeep(true);
      const saved = await saveBoardItem({ boardId: board.id, dumpId: post.id, itemPosition: index, note: post.items[index]?.note || "", mood: post.mood || "" });
      setKept((current) => current.some((item) => item.id === saved.id) ? current : [...current, { id: saved.id, boardId: saved.board_id, dumpId: saved.dump_id, author: post.author, note: saved.note || "", mood: saved.mood || "", seed: saved.item_position }]);
      setBoards(await getBoards());
      setPendingKeep(null);
      setCreatingKeepBoard(false);
      setKeepBoardName("");
      onToast(`Saved to ${board.name}`);
    } catch (error) {
      console.error("Failed to save board item:", error);
      onToast(error.message || "Failed to save to Board");
    } finally {
      setSavingKeep(false);
    }
  };

  const createKeepBoard = async (event) => {
    event.preventDefault();
    const cleanName = keepBoardName.trim();
    if (!cleanName || !pendingKeep || savingKeep) return;
    try {
      setSavingKeep(true);
      const board = await createBoard({ name: cleanName, description: "", pinned: false });
      setBoards((current) => [...current, board]);
      const { post, index } = pendingKeep;
      const saved = await saveBoardItem({ boardId: board.id, dumpId: post.id, itemPosition: index, note: post.items[index]?.note || "", mood: post.mood || "" });
      setKept((current) => [...current, { id: saved.id, boardId: saved.board_id, dumpId: saved.dump_id, author: post.author, note: saved.note || "", mood: saved.mood || "", seed: saved.item_position }]);
      setBoards(await getBoards());
      setPendingKeep(null);
      setCreatingKeepBoard(false);
      setKeepBoardName("");
      onToast(`Saved to ${board.name}`);
    } catch (error) {
      console.error("Failed to create Board from Keep:", error);
      onToast(error.message || "Failed to create Board");
    } finally {
      setSavingKeep(false);
    }
  };

  const postDump = async ({ mood, expiry, channel, items }) => {
    let uploadedPaths = [];
    try {
      const imageFiles = items.map((item) => item.imageFile).filter(Boolean);
      uploadedPaths = await uploadDumpImages(imageFiles);
      let uploadIndex = 0;
      const itemsWithPaths = items.map((item) => ({
        note: item.note || "",
        imagePath: item.imageFile ? uploadedPaths[uploadIndex++] : null,
      }));

      const savedDump = await createDump({ type: "dump", spaceId: channel, mood, expiry, context: itemsWithPaths[0]?.note || "new dump", frameCount: itemsWithPaths.length, items: itemsWithPaths });
      const newDump = { id: savedDump.id, channel, author: activeSpace.handle, mood, mode: expiry, postedMinutesAgo: 0, likes: 0, liked: false, comments: [], items: itemsWithPaths.map((item) => ({ note: item.note, imagePath: item.imagePath })), context: itemsWithPaths[0]?.note || "new dump" };
      setDumps((currentDumps) => [newDump, ...currentDumps]);
      setScreen("home");
      onToast("Dump posted");
    } catch (error) {
      if (uploadedPaths.length) await removeDumpImages(uploadedPaths);
      console.error("Failed to post dump:", error);
      throw error;
    }
  };

  const postRoll = async ({ mood, expiry, channel, frameCount, items }) => {
    let uploadedPaths = [];
    try {
      const imageFiles = (items || []).map((item) => item.imageFile).filter(Boolean);
      uploadedPaths = await uploadDumpImages(imageFiles);
      const itemsWithPaths = (items || []).map((item, index) => ({ note: item.note || "", imagePath: uploadedPaths[index] || null }));
      const savedDump = await createDump({ type: "roll", spaceId: channel, mood, expiry, context: `${frameCount} frame roll`, frameCount, items: itemsWithPaths });
      const newRoll = { id: savedDump.id, channel, author: activeSpace.handle, mood, mode: expiry, postedMinutesAgo: 0, likes: 0, liked: false, comments: [], items: itemsWithPaths, context: `${frameCount} frame roll` };
      setDumps((currentDumps) => [newRoll, ...currentDumps]);
      setScreen("home");
      onToast("Roll posted");
    } catch (error) {
      if (uploadedPaths.length) await removeDumpImages(uploadedPaths);
      console.error("Failed to post roll:", error);
      throw error;
    }
  };

  const profile = {
    handle: supabaseProfile?.username || activeSpace.handle,
    displayName: supabaseProfile?.display_name || "",
    bio: supabaseProfile?.bio || "",
    avatarUrl: supabaseProfile?.avatar_url || "",
    followers: activeSpace.followers,
    following: activeSpace.following,
  };

  if (!session) return <Auth onLogin={() => {}} />;

  let content;

  if (screen === "home") {
    content = <Home dumps={dumps} activeSpace={activeSpace} onOpen={(post) => { setActivePostId(post.id); setScreen("viewer"); }} />;
  } else if (screen === "discover") {
    content = <Discovery onToast={onToast} />;
  } else if (screen === "messages") {
    content = <Messages requests={requests} setRequests={setRequests} chats={chats} setChats={setChats} onToast={onToast} />;
  } else if (screen === "profile") {
    content = <Profile profile={profile} activeSpace={activeSpace} onSwitchSpaces={() => setScreen("spaces")} theme={theme} onCustomize={() => setScreen("profile-settings")} boards={profileBoards} onOpenBoards={() => setScreen("boards")} onCustomizeBoards={() => setBoardStudioOpen(true)} onOpenBoard={(board) => { setOpenBoardId(board.id); setScreen("boards"); }} onEditProfile={() => setScreen("edit-profile")} />;
  } else if (screen === "profile-settings") {
    content = <ProfileStudio profile={profile} theme={theme} onClose={() => setScreen("profile")} onChangeTheme={setTheme} onSaved={(updatedTheme) => { setTheme(updatedTheme); setScreen("profile"); onToast("Profile saved"); }} />;
  } else if (screen === "boards") {
    content = <Boards dumps={dumps} keptItems={kept} initialBoardId={openBoardId} onBack={() => { setOpenBoardId(null); setScreen("profile"); }} onToast={onToast} />;
  } else if (screen === "edit-profile") {
    content = <EditProfile profile={profile} onBack={() => setScreen("profile")} onSaved={(updatedProfile) => { setSupabaseProfile(updatedProfile); if (updatedProfile?.profile_theme) setTheme(sanitizeProfileTheme(updatedProfile.profile_theme)); setScreen("profile"); }} onToast={onToast} />;
  } else if (screen === "spaces") {
    content = <SpaceSwitcher spaces={spaces} activeSpaceId={activeSpaceId} setActiveSpaceId={setActiveSpaceId} onClose={() => setScreen("profile")} />;
  } else if (screen === "create-choose") {
    content = <CreateChoose onPick={(type) => setScreen(type === "dump" ? "create-dump" : "create-roll")} onCancel={() => setScreen("home")} />;
  } else if (screen === "create-dump") {
    content = <DumpBuilder spaces={spaces} activeSpaceId={activeSpaceId} onCancel={() => setScreen("home")} onPost={postDump} />;
  } else if (screen === "create-roll") {
    content = <RollBuilder spaces={spaces} activeSpaceId={activeSpaceId} onCancel={() => setScreen("home")} onPost={postRoll} />;
  } else {
    content = activePost ? <Viewer post={activePost} onClose={() => setScreen("home")} onLike={toggleLike} onComment={comment} onKeep={keep} /> : <Home dumps={dumps} activeSpace={activeSpace} onOpen={() => {}} />;
  }

  const navigationScreen = screen === "viewer" ? "home" : ["create-dump", "create-roll", "create-choose", "profile-settings", "edit-profile", "boards", "spaces"].includes(screen) ? (screen === "profile-settings" || screen === "edit-profile" || screen === "boards" || screen === "spaces" ? "profile" : "home") : screen;

  return (
    <>
      <AppShell screen={navigationScreen} onNavigate={(key) => setScreen(key)} onCapture={() => setScreen("create-choose")} unread={requests.length}>
        <div style={{ height: "100%" }}>{content}</div>
      </AppShell>

      {pendingKeep && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !savingKeep) { setPendingKeep(null); setCreatingKeepBoard(false); } }}>
          <div className="modal" style={{ width: "100%", maxWidth: 520, maxHeight: "85vh", overflowY: "auto" }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <div><div className="eyebrow">Save to Board</div><h2 style={{ marginTop: 4 }}>Where should this go?</h2><p className="subtitle" style={{ marginTop: 5 }}>Choose a Board for this saved moment.</p></div>
              <button type="button" className="btn icon-btn" onClick={() => { if (savingKeep) return; setPendingKeep(null); setCreatingKeepBoard(false); }} aria-label="Close">×</button>
            </div>
            {!creatingKeepBoard ? (
              <>
                <div className="stack" style={{ marginTop: 16 }}>
                  {boards.map((board) => {
                    const count = kept.filter((item) => item.boardId === board.id).length;
                    return <button key={board.id} type="button" className="card" disabled={savingKeep} onClick={() => saveKeepToBoard(board)} style={{ width: "100%", textAlign: "left", cursor: savingKeep ? "wait" : "pointer", opacity: savingKeep ? 0.65 : 1 }}><div className="row"><div style={{ width: 42, height: 42, borderRadius: 14, flexShrink: 0, background: board.style_config?.accent || "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.12)" }} /><div style={{ flex: 1, minWidth: 0 }}><strong>{board.name}</strong><p className="subtitle" style={{ marginTop: 3 }}>{count} {count === 1 ? "item" : "items"}{board.name === "Saved" ? " · default" : ""}</p></div></div></button>;
                  })}
                  <button type="button" className="card" disabled={savingKeep} onClick={() => setCreatingKeepBoard(true)} style={{ width: "100%", textAlign: "left", cursor: savingKeep ? "not-allowed" : "pointer", opacity: savingKeep ? 0.65 : 1 }}><strong>＋ New Board</strong><p className="subtitle" style={{ marginTop: 3 }}>Create a Board and save this moment there.</p></button>
                </div>
                <div className="row" style={{ justifyContent: "flex-end", marginTop: 16 }}><button type="button" className="btn" disabled={savingKeep} onClick={() => { setPendingKeep(null); setCreatingKeepBoard(false); }}>Cancel</button></div>
              </>
            ) : (
              <form onSubmit={createKeepBoard} className="stack" style={{ marginTop: 16 }}><label className="eyebrow">New Board name</label><input className="input" value={keepBoardName} onChange={(event) => setKeepBoardName(event.target.value)} placeholder="e.g. Gym, Memories, Trips" maxLength={60} autoFocus /><div className="row" style={{ justifyContent: "flex-end", gap: 8 }}><button type="button" className="btn" disabled={savingKeep} onClick={() => { setCreatingKeepBoard(false); setKeepBoardName(""); }}>Back</button><button type="submit" className="btn btn-primary" disabled={savingKeep || !keepBoardName.trim()}>{savingKeep ? "Saving…" : "Create & Save"}</button></div></form>
            )}
          </div>
        </div>
      )}

      {boardStudioOpen && <BoardStudio boards={boards} onClose={() => setBoardStudioOpen(false)} onBoardSaved={(updated) => { setBoards((current) => current.map((board) => board.id === updated.id ? updated : board)); setBoardStudioOpen(false); }} onToast={onToast} />}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
