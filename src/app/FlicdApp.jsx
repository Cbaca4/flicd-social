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
  getFeedDumps,
  getDumpById,
  markDumpViewed,
  getPostingLimitStatus,
} from "../features/capture/dumpApi.js";
import {
  removeDumpImages,
  uploadDumpImages,
} from "../features/capture/mediaUpload.js";
import {
  hydrateDumpInteractions,
  likeDump,
  unlikeDump,
} from "../features/social/interactionsApi.js";
import { createCommentAction } from "../features/social/commentAction.js";

import Messages from "../features/messages/Messages.jsx";
import Profile from "../features/profile/Profile.jsx";
import ProfileStudio from "../features/profile/ProfileStudio.jsx";
import EditProfile from "../features/profile/EditProfile.jsx";
import Discovery from "../features/discovery/Discovery.jsx";
import PublicProfile from "../features/profile/PublicProfile.jsx";
import Archive from "../features/profile/Archive.jsx";
import { syncExpiredArchive } from "../features/profile/archiveApi.js";
import SpaceSwitcher from "../features/spaces/SpaceSwitcher.jsx";
import { getMusicTrack } from "../features/music/musicApi.js";
import {
  getActiveAudio,
  pauseAudio,
  playAudioUrl,
  resumeAudio,
  stopAudio,
} from "../features/music/audioController.js";
import { getMessageRequests } from "../features/messages/messageApi.js";
import Notifications from "../features/social/Notifications.jsx";
import { getUnreadNotificationCount } from "../features/social/notificationsApi.js";

import {
  DEFAULT_THEME,
  sanitizeProfileTheme,
} from "../features/profile/profileTheme.js";

const seedSpaces = [
  { id: "main", handle: "you", label: "Main", followers: 0, following: 0 },
  { id: "gym", handle: "gym_log", label: "Gym", followers: 42, following: 12 },
  { id: "music", handle: "the.setlist", label: "Music", followers: 301, following: 58 },
];

const PROFILE_SCREENS = new Set([
  "profile",
  "profile-settings",
  "boards",
  "edit-profile",
  "spaces",
  "notifications",
  "archive",
]);

function formatDumpRecord(dump) {
  return {
    id: dump.id,
    channel: dump.space_id,
    author: dump.user_id,
    mood: dump.mood,
    mode: dump.expiry,
    allowOthersToKeep: Boolean(dump.allow_others_to_keep),
    postedMinutesAgo: Math.floor((Date.now() - new Date(dump.created_at).getTime()) / 60000),
    expiresAt: dump.expiry === "24h" ? new Date(dump.created_at).getTime() + 24 * 60 * 60 * 1000 : null,
    likes: 0,
    liked: false,
    viewed: Boolean(dump.viewed),
    comments: [],
    items: (dump.dump_items || [])
      .sort((a, b) => a.position - b.position)
      .map((item) => ({ note: item.note || "", imagePath: item.image_path || null })),
    context: dump.context || "",
    musicTrack: dump.music_tracks || null,
    location: dump.location_name
      ? {
          name: dump.location_name,
          city: dump.location_city || "",
          latitude: dump.location_lat,
          longitude: dump.location_lng,
          placeId: dump.location_place_id || "",
        }
      : null,
    taggedUsers: (dump.dump_tags || [])
      .map((tag) => tag.tagged_user || null)
      .filter(Boolean),
  };
}

export default function FlicdApp() {
  const [session, setSession] = React.useState(null);
  const [screen, setScreen] = React.useState("home");
  const [spaces] = React.useState(seedSpaces);
  const [activeSpaceId, setActiveSpaceId] = React.useState("main");
  const [dumps, setDumps] = React.useState([]);
  const [feedState, setFeedState] = React.useState({ status: "idle", error: "" });
  const [activePostId, setActivePostId] = React.useState(null);
  const [kept, setKept] = React.useState([]);
  const [boards, setBoards] = React.useState([]);
  const [pendingKeep, setPendingKeep] = React.useState(null);
  const [creatingKeepBoard, setCreatingKeepBoard] = React.useState(false);
  const [keepBoardName, setKeepBoardName] = React.useState("");
  const [savingKeep, setSavingKeep] = React.useState(false);
  const [boardStudioOpen, setBoardStudioOpen] = React.useState(false);
  const [openBoardId, setOpenBoardId] = React.useState(null);
  const [messageUnread, setMessageUnread] = React.useState(0);
  const [theme, setTheme] = React.useState(() => sanitizeProfileTheme(DEFAULT_THEME));
  const [supabaseProfile, setSupabaseProfile] = React.useState(null);
  const [profileMusicTrack, setProfileMusicTrack] = React.useState(null);
  const [profileMusicPlaying, setProfileMusicPlaying] = React.useState(false);
  const [publicProfile, setPublicProfile] = React.useState(null);
  const [toast, setToast] = React.useState("");
  const [notificationsUnread, setNotificationsUnread] = React.useState(0);
  const [viewerCommentsOpen, setViewerCommentsOpen] = React.useState(false);

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

  const refreshNotificationCount = React.useCallback(async () => {
    if (!session) {
      setNotificationsUnread(0);
      return;
    }
    try {
      setNotificationsUnread(await getUnreadNotificationCount());
    } catch {
      // Notification badges should never block the app.
    }
  }, [session]);

  React.useEffect(() => {
    refreshNotificationCount();
    if (!session) return undefined;
    const timer = setInterval(refreshNotificationCount, 30000);
    return () => clearInterval(timer);
  }, [refreshNotificationCount, session]);

  const refreshMessageCount = React.useCallback(async () => {
    if (!session) {
      setMessageUnread(0);
      return;
    }
    try {
      const requests = await getMessageRequests();
      setMessageUnread(requests.length);
    } catch {
      setMessageUnread(0);
    }
  }, [session]);

  React.useEffect(() => {
    refreshMessageCount();
    if (!session) return undefined;
    const timer = setInterval(refreshMessageCount, 30000);
    return () => clearInterval(timer);
  }, [refreshMessageCount, session]);

  React.useEffect(() => {
    const shouldPlay = Boolean(session && !publicProfile && PROFILE_SCREENS.has(screen) && profileMusicTrack?.audio_url);
    if (!shouldPlay) {
      stopAudio();
      setProfileMusicPlaying(false);
      return undefined;
    }

    const existing = getActiveAudio();
    if (existing?.src !== profileMusicTrack.audio_url) {
      const audio = playAudioUrl(profileMusicTrack.audio_url, {
        loop: true,
        muted: false,
        onFallbackToMuted: () => {},
      });
      if (!audio) return undefined;
    }

    const audio = getActiveAudio();
    const syncState = () => setProfileMusicPlaying(Boolean(audio && !audio.paused));
    audio?.addEventListener?.("play", syncState);
    audio?.addEventListener?.("pause", syncState);
    syncState();

    return () => {
      audio?.removeEventListener?.("play", syncState);
      audio?.removeEventListener?.("pause", syncState);
    };
  }, [profileMusicTrack?.audio_url, publicProfile, screen, session]);

  const toggleProfileMusic = React.useCallback(async () => {
    const audioUrl = profileMusicTrack?.audio_url;
    if (!audioUrl) return;

    const audio = getActiveAudio();
    if (!audio || audio.src !== audioUrl) {
      const next = playAudioUrl(audioUrl, { loop: true, muted: false });
      if (next) setProfileMusicPlaying(!next.paused);
      return;
    }

    if (audio.muted) {
      audio.muted = false;
      try {
        await audio.play();
        setProfileMusicPlaying(true);
      } catch {
        setProfileMusicPlaying(false);
      }
      return;
    }

    if (audio.paused) {
      const resumed = await resumeAudio();
      setProfileMusicPlaying(Boolean(resumed && !resumed.paused));
    } else {
      pauseAudio();
      setProfileMusicPlaying(false);
    }
  }, [profileMusicTrack?.audio_url]);

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
        setProfileMusicTrack(data.profile_music_track_id ? await getMusicTrack(data.profile_music_track_id) : null);
      }
    }
    loadProfile();
  }, [session]);

  const loadDumps = React.useCallback(async () => {
    if (!session) return;
    setFeedState({ status: "loading", error: "" });
    try {
      try {
        await syncExpiredArchive();
      } catch (archiveError) {
        console.error("Failed to sync archive:", archiveError);
      }

      const savedDumps = await getFeedDumps();
      const formattedDumps = savedDumps.map(formatDumpRecord);
      setDumps(await hydrateDumpInteractions(formattedDumps));
      setFeedState({ status: "ready", error: "" });
    } catch (error) {
      console.error("Failed to load social feed:", error);
      setDumps([]);
      setFeedState({ status: "error", error: error.message || "Failed to load social feed." });
    }
  }, [session]);

  React.useEffect(() => {
    loadDumps();
    if (!session) return undefined;

    const timer = setInterval(loadDumps, 60000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") loadDumps();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [loadDumps, session]);

  React.useEffect(() => {
    async function loadBoardItems() {
      if (!session) return;
      try {
        const savedItems = await getBoardItems();
        setKept(savedItems.map((item) => ({
          id: item.id,
          boardId: item.board_id,
          dumpId: item.dump_id,
          author: item.saved_author_username || "",
          note: item.note || "",
          mood: item.mood || "",
          imagePath: item.saved_image_path || "",
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
        console.error("Failed to load Boards:", error);
      }
    }
    loadBoards();
  }, [session]);

  React.useEffect(() => {
    const nextExpiry = dumps
      .map((dump) => Number(dump.expiresAt))
      .filter((value) => Number.isFinite(value) && value > Date.now())
      .sort((a, b) => a - b)[0];

    if (!nextExpiry) return undefined;

    const timer = setTimeout(() => {
      loadDumps();
    }, Math.max(100, nextExpiry - Date.now() + 100));

    return () => clearTimeout(timer);
  }, [dumps, loadDumps]);

  const activeSpace = spaces.find((space) => space.id === activeSpaceId) || spaces[0];
  const activePost = dumps.find((dump) => dump.id === activePostId);

  const primePostAudio = React.useCallback((post) => {
    const audioUrl = post?.musicTrack?.audio_url;
    if (!audioUrl) return;

    const existing = getActiveAudio();
    if (existing?.src === audioUrl) {
      existing.play().catch(() => {});
      return;
    }

    playAudioUrl(audioUrl, { loop: true, muted: false });
  }, []);

  const closeViewer = React.useCallback(() => {
    setViewerCommentsOpen(false);
    setActivePostId(null);
    setScreen("home");
  }, []);
  const onToast = (message) => setToast(message);
  const profileBoards = boards.map((board) => ({ ...board, count: kept.filter((item) => item.boardId === board.id).length }));
  const openPublicProfile = React.useCallback((user) => {
    if (!user?.id) return;
    setViewerCommentsOpen(false);
    if (screen === "viewer") setActivePostId(null);
    stopAudio();
    setProfileMusicPlaying(false);
    setPublicProfile(user);
  }, [screen, activePost?.id, activePost?.mode, activePost?.viewed]);

  const openDumpById = React.useCallback(async (dumpId) => {
    const existing = dumps.find((dump) => dump.id === dumpId);
    if (existing) {
      setViewerCommentsOpen(false);
      setActivePostId(dumpId);
      setScreen("viewer");
      return;
    }

    try {
      const savedDump = await getDumpById(dumpId);
      if (!savedDump) {
        onToast("That post is no longer available.");
        return;
      }

      const [formattedDump] = await hydrateDumpInteractions([formatDumpRecord(savedDump)]);
      setDumps((current) => current.some((dump) => dump.id === formattedDump.id) ? current : [formattedDump, ...current]);
      setActivePostId(dumpId);
      setScreen("viewer");
    } catch (error) {
      console.error("Failed to open post:", error);
      onToast(error.message || "Could not open that post.");
    }
  }, [dumps]);

  const [pendingLikeIds, setPendingLikeIds] = React.useState(() => new Set());

  const toggleLike = async (id) => {
    if (pendingLikeIds.has(id)) return;
    const post = dumps.find((dump) => dump.id === id);
    if (!post) return;
    const nextLiked = !post.liked;

    setPendingLikeIds((current) => new Set(current).add(id));
    setDumps((currentDumps) => currentDumps.map((item) => item.id === id ? { ...item, liked: nextLiked, likes: Math.max(0, item.likes + (nextLiked ? 1 : -1)) } : item));
    try {
      if (nextLiked) await likeDump(id);
      else await unlikeDump(id);
    } catch (error) {
      setDumps((currentDumps) => currentDumps.map((item) => item.id === id ? { ...item, liked: post.liked, likes: post.likes } : item));
      console.error("Failed to update like:", error);
      onToast(error.message || "Could not update like");
    } finally {
      setPendingLikeIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  };

  const comment = React.useCallback(async (id, input) => {
    if (typeof input === "string" && !input.trim()) return;
    return createCommentAction({
      setDumps,
      username: supabaseProfile?.username || "you",
      onToast,
    })(id, input);
  }, [supabaseProfile?.username]);

  const keep = async (post, index) => {
    const isOwnPost = post.authorId === session?.user?.id || post.author === supabaseProfile?.username;
    if (!isOwnPost && (!post.allowOthersToKeep || post.mode !== "24h")) {
      onToast("This Flic'd cannot be kept.");
      return;
    }
    if (!isOwnPost && post.mode !== "24h") {
      onToast("View once Flic'ds cannot be kept.");
      return;
    }
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
      setKept((current) => current.some((item) => item.id === saved.id) ? current : [...current, { id: saved.id, boardId: saved.board_id, dumpId: saved.dump_id, author: saved.saved_author_username || post.author, note: saved.note || "", mood: saved.mood || "", imagePath: saved.saved_image_path || post.items[index]?.imagePath || "", seed: saved.item_position }]);
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

  const postDump = async ({ mood, expiry, channel, items, musicTrack = null, location = null, taggedUsers = [], allowOthersToKeep = true }) => {
    let uploadedPaths = [];
    const quota = await getPostingLimitStatus();
    if (!quota.remaining) {
      throw new Error("You have reached the 3-post limit for the last 24 hours. Try again after your oldest post rolls out.");
    }
    try {
      const imageFiles = items.map((item) => item.imageFile).filter(Boolean);
      uploadedPaths = await uploadDumpImages(imageFiles);
      let uploadIndex = 0;
      const itemsWithPaths = items.map((item) => ({
        note: item.note || "",
        imagePath: item.imageFile ? uploadedPaths[uploadIndex++] : null,
      }));

      const savedDump = await createDump({
        type: "dump",
        spaceId: channel,
        mood,
        expiry,
        context: itemsWithPaths[0]?.note || "new dump",
        frameCount: itemsWithPaths.length,
        items: itemsWithPaths,
        musicTrackId: musicTrack?.id || null,
        location,
        taggedUserIds: taggedUsers.map((user) => user.id),
        allowOthersToKeep,
      });
      const newDump = {
        id: savedDump.id,
        channel,
        author: supabaseProfile?.username || activeSpace.handle,
        authorId: session.user.id,
        mood,
        mode: expiry,
        postedMinutesAgo: 0,
        expiresAt: expiry === "24h" ? Date.now() + 24 * 60 * 60 * 1000 : null,
        likes: 0,
        liked: false,
        comments: [],
        items: itemsWithPaths.map((item) => ({ note: item.note, imagePath: item.imagePath })),
        context: itemsWithPaths[0]?.note || "new dump",
        musicTrack,
        location,
        taggedUsers,
        allowOthersToKeep: expiry === "24h" && Boolean(allowOthersToKeep),
      };
      setDumps((currentDumps) => [newDump, ...currentDumps]);
      setScreen("home");
      setFeedState({ status: "ready", error: "" });
      onToast("Dump posted");
    } catch (error) {
      if (uploadedPaths.length) await removeDumpImages(uploadedPaths);
      console.error("Failed to post dump:", error);
      throw error;
    }
  };

  const postRoll = async ({ mood, expiry, channel, frameCount, items, musicTrack = null, location = null, taggedUsers = [], allowOthersToKeep = true }) => {
    let uploadedPaths = [];
    const quota = await getPostingLimitStatus();
    if (!quota.remaining) {
      throw new Error("You have reached the 3-post limit for the last 24 hours. Try again after your oldest post rolls out.");
    }
    try {
      const imageFiles = (items || []).map((item) => item.imageFile).filter(Boolean);
      uploadedPaths = await uploadDumpImages(imageFiles);
      const itemsWithPaths = (items || []).map((item, index) => ({ note: item.note || "", imagePath: uploadedPaths[index] || null }));
      const savedDump = await createDump({
        type: "roll",
        spaceId: channel,
        mood,
        expiry,
        context: `${frameCount} frame roll`,
        frameCount,
        items: itemsWithPaths,
        musicTrackId: musicTrack?.id || null,
        location,
        taggedUserIds: taggedUsers.map((user) => user.id),
        allowOthersToKeep,
      });
      const newRoll = {
        id: savedDump.id,
        channel,
        author: supabaseProfile?.username || activeSpace.handle,
        authorId: session.user.id,
        mood,
        mode: expiry,
        postedMinutesAgo: 0,
        expiresAt: expiry === "24h" ? Date.now() + 24 * 60 * 60 * 1000 : null,
        likes: 0,
        liked: false,
        comments: [],
        items: itemsWithPaths,
        context: `${frameCount} frame roll`,
        musicTrack,
        location,
        taggedUsers,
        allowOthersToKeep: expiry === "24h" && Boolean(allowOthersToKeep),
      };
      setDumps((currentDumps) => [newRoll, ...currentDumps]);
      setScreen("home");
      setFeedState({ status: "ready", error: "" });
      onToast("Roll posted");
    } catch (error) {
      if (uploadedPaths.length) await removeDumpImages(uploadedPaths);
      console.error("Failed to post roll:", error);
      throw error;
    }
  };

  if (!session) return <Auth onLogin={() => {}} />;

  const profile = {
    id: supabaseProfile?.id || session.user.id,
    handle: supabaseProfile?.username || activeSpace.handle,
    displayName: supabaseProfile?.display_name || "",
    bio: supabaseProfile?.bio || "",
    avatarUrl: supabaseProfile?.avatar_url || "",
    followers: activeSpace.followers,
    following: activeSpace.following,
    musicTrack: profileMusicTrack,
    links: theme.profileLinks || [],
  };

  let content;

  if (publicProfile) {
    content = <PublicProfile profile={publicProfile} onBack={() => { stopAudio(); setPublicProfile(null); }} onUserSelect={openPublicProfile} />;
  } else if (screen === "notifications") {
    content = (
      <Notifications
        onBack={() => setScreen("profile")}
        onOpenDump={(dumpId) => {
          setPublicProfile(null);
          openDumpById(dumpId).finally(() => refreshNotificationCount());
        }}
        onChanged={refreshNotificationCount}
      />
    );
  } else if (screen === "home") {
    content = <Home
      dumps={dumps}
      activeSpace={activeSpace}
      loading={feedState.status === "loading"}
      error={feedState.status === "error" ? feedState.error : ""}
      onRetry={loadDumps}
      onOpen={(post) => {
        primePostAudio(post);
        setViewerCommentsOpen(false);
        setActivePostId(post.id);
        setScreen("viewer");
      }}
      onCommentOpen={(post) => {
        primePostAudio(post);
        setViewerCommentsOpen(true);
        setActivePostId(post.id);
        setScreen("viewer");
      }}
      onLike={toggleLike}
      onKeep={keep}
      pendingLikeIds={pendingLikeIds}
      onUserSelect={openPublicProfile}
      onNotifications={() => setScreen("notifications")}
      notificationsUnread={notificationsUnread}
    />;
  } else if (screen === "discover") {
    content = <Discovery
      onToast={onToast}
      onUserSelect={openPublicProfile}
      onOpenPost={(post) => {
        primePostAudio(post);
        setViewerCommentsOpen(false);
        setActivePostId(post.id);
        setScreen("viewer");
      }}
    />;
  } else if (screen === "messages") {
    content = <Messages onToast={onToast} onChanged={refreshMessageCount} />;
  } else if (screen === "archive") {
    content = <Archive onBack={() => setScreen("profile")} onKeep={keep} />;
  } else if (screen === "profile") {
    content = <Profile profile={profile} activeSpace={activeSpace} onSwitchSpaces={() => setScreen("spaces")} onArchive={() => setScreen("archive")} theme={theme} onCustomize={() => setScreen("profile-settings")} boards={profileBoards} onOpenBoards={() => setScreen("boards")} onCustomizeBoards={() => setBoardStudioOpen(true)} onOpenBoard={(board) => { setOpenBoardId(board.id); setScreen("boards"); }} onEditProfile={() => setScreen("edit-profile")} musicTrack={profileMusicTrack} onMusicTrackChange={setProfileMusicTrack} musicPlaying={profileMusicPlaying} onToggleMusic={toggleProfileMusic} notificationsUnread={notificationsUnread} onNotifications={() => setScreen("notifications")} onUserSelect={openPublicProfile} />;
  } else if (screen === "profile-settings") {
    content = <ProfileStudio
      profile={profile}
      theme={theme}
      onClose={() => setScreen("profile")}
      onChangeTheme={setTheme}
      onSaved={async (updatedTheme) => {
        if (!supabaseProfile?.id) throw new Error("Profile is still loading.");
        const normalized = sanitizeProfileTheme(updatedTheme);
        const { data, error } = await supabase
          .from("profiles")
          .update({
            profile_theme: normalized,
            updated_at: new Date().toISOString(),
          })
          .eq("id", supabaseProfile.id)
          .select()
          .single();

        if (error) throw error;
        setSupabaseProfile(data);
        setTheme(normalized);
        setScreen("profile");
        onToast("Profile saved");
      }}
    />;
  } else if (screen === "boards") {
    content = <Boards dumps={dumps} keptItems={kept} initialBoardId={openBoardId} onBack={() => { setOpenBoardId(null); setScreen("profile"); }} onToast={onToast} />;
  } else if (screen === "edit-profile") {
    content = <EditProfile
      profile={profile}
      profileTheme={theme}
      onBack={() => setScreen("profile")}
      onSaved={(updatedProfile) => {
        setSupabaseProfile(updatedProfile);
        if (updatedProfile?.profile_theme) setTheme(sanitizeProfileTheme(updatedProfile.profile_theme));
        setScreen("profile");
      }}
      onToast={onToast}
    />;
  } else if (screen === "spaces") {
    content = <SpaceSwitcher spaces={spaces} activeSpaceId={activeSpaceId} setActiveSpaceId={setActiveSpaceId} onClose={() => setScreen("profile")} />;
  } else if (screen === "create-choose") {
    content = <CreateChoose onPick={(type) => setScreen(type === "dump" ? "create-dump" : "create-roll")} onCancel={() => setScreen("home")} />;
  } else if (screen === "create-dump") {
    content = <DumpBuilder spaces={spaces} activeSpaceId={activeSpaceId} onCancel={() => setScreen("home")} onPost={postDump} />;
  } else if (screen === "create-roll") {
    content = <RollBuilder spaces={spaces} activeSpaceId={activeSpaceId} onCancel={() => setScreen("home")} onPost={postRoll} />;
  } else {
    content = activePost ? <Viewer post={activePost} initialCommentsOpen={viewerCommentsOpen} onClose={closeViewer} onLike={toggleLike} onComment={comment} onKeep={keep} onMarkViewed={(dumpId) => {
          setDumps((current) => current.map((item) => item.id === dumpId ? { ...item, viewed: true } : item));
          markDumpViewed(dumpId)
            .then(() => syncExpiredArchive())
            .catch((error) => console.error("Failed to finish view-once archive:", error));
        }} likePending={pendingLikeIds.has(activePost.id)} onUserSelect={openPublicProfile} /> : <Home dumps={dumps} activeSpace={activeSpace} onOpen={() => {}} loading={false} error="" onUserSelect={openPublicProfile} />;
  }

  const navigationScreen = screen === "viewer" ? "home" : ["create-dump", "create-roll", "create-choose", "profile-settings", "edit-profile", "boards", "spaces", "notifications", "archive"].includes(screen) ? (["profile-settings", "edit-profile", "boards", "spaces", "notifications", "archive"].includes(screen) ? "profile" : "home") : screen;

  return (
    <>
      <AppShell
        userId={session.user.id}
        screen={navigationScreen}
        onNavigate={(key) => {
          setPublicProfile(null);
          setViewerCommentsOpen(false);
          if (screen === "viewer") setActivePostId(null);
          if (!PROFILE_SCREENS.has(key)) {
            stopAudio();
            setProfileMusicPlaying(false);
          }
          setScreen(key);
        }}
        onCapture={() => {
          setPublicProfile(null);
          setViewerCommentsOpen(false);
          if (screen === "viewer") setActivePostId(null);
          stopAudio();
          setProfileMusicPlaying(false);
          setScreen("create-choose");
        }}
        unread={messageUnread}
        notificationsUnread={notificationsUnread}
      >
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