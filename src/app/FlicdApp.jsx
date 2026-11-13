import React from "react";
import { createAuthBoundary, captureAuthScope } from "./authScope.js";
import { AuthScopeContext } from "./AuthScopeContext.js";

import { supabase, createAccountClient } from "../lib/supabase";

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
import { closeAllMediaSessions } from "../features/home/mediaSessionApi.js";

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
  PRIVATE_DUMP_MEDIA_BUCKET,
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
    authorId: dump.user_id,
    type: dump.type,
    frameCount: dump.frame_count,
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
      .map((item) => ({ id: item.id, position: item.position, note: item.note || "", imagePath: item.image_path || null, mediaBucket: item.media_bucket || "flicd-media" })),
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
  const [boundary] = React.useState(createAuthBoundary);
  const [auth, setAuth] = React.useState(null);
  React.useEffect(() => {
    let active = true, receivedAuthEvent = false, previous = null;
    const accept = (event, session) => {
      if (!active) return;
      const scope = boundary.accept(session, event);
      if (previous && previous !== scope) {
        void Promise.resolve(closeAllMediaSessions()).catch(() => {});
        stopAudio();
      }
      previous = scope;
      setAuth({ session, scope });
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      receivedAuthEvent = true;
      accept(event, session);
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (!receivedAuthEvent) accept("INITIAL_SESSION", data?.session);
    }).catch(() => { if (!receivedAuthEvent) accept("SIGNED_OUT", null); });
    return () => {
      active = false; boundary.invalidate(); subscription.unsubscribe();
      stopAudio(); void Promise.resolve(closeAllMediaSessions()).catch(() => {});
    };
  }, [boundary]);
  if (!auth?.session) return <Auth onLogin={() => {}} />;
  // Every account-owned surface and draft has this lifetime, including AppShell.
  return <AuthScopeContext.Provider value={auth.scope}><AccountApp key={auth.scope.generation} session={auth.session} authScope={auth.scope} /></AuthScopeContext.Provider>;
}

function AccountApp({ session, authScope }) {
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
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 1900);
    return () => clearTimeout(timer);
  }, [toast]);

  const refreshNotificationCount = React.useCallback(async () => {
    const current = authScope.begin("notifications");
    if (!current()) return;
    if (!session) {
      setNotificationsUnread(0);
      return;
    }
    try {
      const unread = await getUnreadNotificationCount();
      if (current()) setNotificationsUnread(unread);
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
    const current = authScope.begin("messages");
    if (!current()) return;
    if (!session) {
      setMessageUnread(0);
      return;
    }
    try {
      const requests = await getMessageRequests();
      if (current()) setMessageUnread(requests.length);
    } catch {
      if (current()) setMessageUnread(0);
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
    const current = authScope.isCurrent;
    if (!current()) return;
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
        if (current()) setProfileMusicPlaying(true);
      } catch {
        if (current()) setProfileMusicPlaying(false);
      }
      return;
    }

    if (audio.paused) {
      const resumed = await resumeAudio();
      if (current()) setProfileMusicPlaying(Boolean(resumed && !resumed.paused));
    } else {
      pauseAudio();
      setProfileMusicPlaying(false);
    }
  }, [profileMusicTrack?.audio_url]);

  React.useEffect(() => {
    async function loadProfile() {
      const current = authScope.begin("profile");
      if (!current()) return;
      if (!session) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== session.user.id || !current()) return;
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (!current()) return;
      if (error) {
        console.error("Profile error:", error);
        return;
      }
      if (data) {
        const track = data.profile_music_track_id ? await getMusicTrack(data.profile_music_track_id) : null;
        if (!current()) return;
        setSupabaseProfile(data);
        if (data.profile_theme) setTheme(sanitizeProfileTheme(data.profile_theme));
        setProfileMusicTrack(track);
      }
    }
    void loadProfile().catch(() => {});
  }, [session]);

  const loadDumps = React.useCallback(async () => {
    const current = authScope.begin("feed");
    if (!current()) return;
    if (!session) return;
    setFeedState({ status: "loading", error: "" });
    try {
      try {
        await syncExpiredArchive(captureAuthScope(authScope, current));
      } catch (archiveError) {
        if (!current()) return;
        console.error("Failed to sync archive:", archiveError);
      }

      if (!current()) return;
      const savedDumps = await getFeedDumps();
      const formattedDumps = savedDumps.map(formatDumpRecord);
      if (!current()) return;
      const hydrated = await hydrateDumpInteractions(formattedDumps);
      if (!current()) return;
      setDumps(hydrated);
      setFeedState({ status: "ready", error: "" });
    } catch (error) {
      if (!current()) return;
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
      const current = authScope.begin("library");
      if (!current()) return;
      if (!session) return;
      try {
        const savedItems = await getBoardItems(null, captureAuthScope(authScope, current));
        if (!current()) return;
        setKept(savedItems);
      } catch (error) {
        if (!current()) return;
        console.error("Failed to load board items:", error);
      }
    }
    loadBoardItems();
  }, [session]);

  React.useEffect(() => {
    async function loadBoards() {
      const current = authScope.begin("boards");
      if (!current()) return;
      if (!session) return;
      try {
        const rows = await getBoards();
        if (current()) setBoards(rows);
      } catch (error) {
        if (!current()) return;
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
    if (!authScope.isCurrent()) return;
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
    if (!authScope.isCurrent()) return;
    authScope.cancel("viewer");
    setViewerCommentsOpen(false);
    setActivePostId(null);
    setScreen("home");
  }, []);
  const onToast = authScope.guard((message) => setToast(message));
  const profileBoards = boards.map((board) => ({ ...board, count: kept.filter((item) => item.board_ids?.includes(board.id)).length }));
  const openPublicProfile = React.useCallback((user) => {
    if (!authScope.isCurrent()) return;
    authScope.cancel("viewer");
    if (!user?.id) return;
    setViewerCommentsOpen(false);
    if (screen === "viewer") setActivePostId(null);
    stopAudio();
    setProfileMusicPlaying(false);
    setPublicProfile(user);
  }, [screen, activePost?.id, activePost?.mode, activePost?.viewed]);

  const openDumpById = React.useCallback(async (dumpId) => {
    const current = authScope.begin("viewer");
    if (!current()) return;
    const existing = dumps.find((dump) => dump.id === dumpId);
    if (existing) {
      setViewerCommentsOpen(false);
      setActivePostId(dumpId);
      setScreen("viewer");
      return;
    }

    try {
      const savedDump = await getDumpById(dumpId);
      if (!current()) return;
      if (!savedDump) {
        onToast("That post is no longer available.");
        return;
      }

      const [formattedDump] = await hydrateDumpInteractions([formatDumpRecord(savedDump)]);
      if (!current()) return;
      setDumps((current) => current.some((dump) => dump.id === formattedDump.id) ? current : [formattedDump, ...current]);
      setActivePostId(dumpId);
      setScreen("viewer");
    } catch (error) {
      if (!current()) return;
      console.error("Failed to open post:", error);
      onToast(error.message || "Could not open that post.");
    }
  }, [dumps]);

  const [pendingLikeIds, setPendingLikeIds] = React.useState(() => new Set());

  const toggleLike = async (id) => {
    if (!authScope.isCurrent()) return;
    if (pendingLikeIds.has(id)) return;
    const post = dumps.find((dump) => dump.id === id);
    if (!post) return;
    const nextLiked = !post.liked;

    setPendingLikeIds((current) => new Set(current).add(id));
    setDumps((currentDumps) => currentDumps.map((item) => item.id === id ? { ...item, liked: nextLiked, likes: Math.max(0, item.likes + (nextLiked ? 1 : -1)) } : item));
    try {
      if (nextLiked) await likeDump(id, authScope);
      else await unlikeDump(id, authScope);
    } catch (error) {
      if (!authScope.isCurrent()) return;
      setDumps((currentDumps) => currentDumps.map((item) => item.id === id ? { ...item, liked: post.liked, likes: post.likes } : item));
      console.error("Failed to update like:", error);
      onToast(error.message || "Could not update like");
    } finally {
      if (authScope.isCurrent())
      setPendingLikeIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  };

  const comment = React.useCallback(async (id, input) => {
    if (!authScope.isCurrent()) return;
    if (typeof input === "string" && !input.trim()) return;
    return createCommentAction({
      context: authScope,
      setDumps: authScope.guard(setDumps),
      username: supabaseProfile?.username || "you",
      onToast,
    })(id, input);
  }, [supabaseProfile?.username]);

  const keep = async (post, index) => {
    const current = authScope.begin("keep");
    if (!current()) return;
    const isOwnPost = post.authorId === session?.user?.id || post.author === session?.user?.id;
    if (post.mode !== "24h" || (!isOwnPost && !post.allowOthersToKeep)) {
      onToast("This Flic'd cannot be kept.");
      return;
    }
    const itemPosition = post.items[index]?.position;
    if (!Number.isInteger(itemPosition) || itemPosition < 0) {
      onToast("Original photo position is unavailable. Refresh this post.");
      return;
    }
    try {
      const scope = captureAuthScope(authScope, current);
      const [savedBoard, photos, boardRows] = await Promise.all([getOrCreateDefaultBoard(scope), getBoardItems(null, scope), getBoards()]);
      if (!current()) return;
      setKept(photos);
      setBoards(boardRows.some(board => board.id === savedBoard.id) ? boardRows : [savedBoard, ...boardRows]);
      setPendingKeep({ post, itemPosition, itemId: post.items[index].id });
      setCreatingKeepBoard(false);
      setKeepBoardName("");
    } catch (error) {
      if (!current()) return;
      console.error("Failed to prepare Save to Board:", error);
      onToast(error.message || "Could not open Save to Board");
    }
  };

  const saveKeepToBoard = async (board) => {
    if (!authScope.isCurrent()) return;
    if (!pendingKeep || savingKeep) return;
    const { post, itemPosition, itemId } = pendingKeep;
    try {
      setSavingKeep(true);
      await saveBoardItem({ boardId: board.id, dumpId: post.id, itemPosition, itemId }, authScope);
      if (!authScope.isCurrent()) return;
      const [photos, boardRows] = await Promise.all([getBoardItems(null, authScope), getBoards()]);
      if (!authScope.isCurrent()) return;
      setKept(photos); setBoards(boardRows);
      setPendingKeep(null);
      setCreatingKeepBoard(false);
      setKeepBoardName("");
      onToast(`Saved to ${board.name}`);
    } catch (error) {
      if (!authScope.isCurrent()) return;
      console.error("Failed to save board item:", error);
      onToast(error.message || "Failed to save to Board");
    } finally {
      if (authScope.isCurrent()) setSavingKeep(false);
    }
  };

  const createKeepBoard = async (event) => {
    event.preventDefault();
    if (!authScope.isCurrent()) return;
    const cleanName = keepBoardName.trim();
    if (!cleanName || !pendingKeep || savingKeep) return;
    try {
      setSavingKeep(true);
      const board = await createBoard({ name: cleanName, description: "", pinned: false }, authScope);
      if (!authScope.isCurrent()) return;
      setBoards((current) => [...current, board]);
      const { post, itemPosition, itemId } = pendingKeep;
      await saveBoardItem({ boardId: board.id, dumpId: post.id, itemPosition, itemId }, authScope);
      if (!authScope.isCurrent()) return;
      const [photos, boardRows] = await Promise.all([getBoardItems(null, authScope), getBoards()]);
      if (!authScope.isCurrent()) return;
      setKept(photos); setBoards(boardRows);
      setPendingKeep(null);
      setCreatingKeepBoard(false);
      setKeepBoardName("");
      onToast(`Saved to ${board.name}`);
    } catch (error) {
      if (!authScope.isCurrent()) return;
      console.error("Failed to create Board from Keep:", error);
      onToast(error.message || "Failed to create Board");
    } finally {
      if (authScope.isCurrent()) setSavingKeep(false);
    }
  };

  const postDump = async ({ mood, expiry, channel, items, musicTrack = null, location = null, taggedUsers = [], allowOthersToKeep = true }) => {
    const current = authScope.isCurrent;
    if (!current()) return;
    let uploadedPaths = [];
    try {
      const quota = await getPostingLimitStatus();
      if (!current()) return;
      if (!quota.remaining) throw new Error("You have reached the 3-post limit for the last 24 hours. Try again after your oldest post rolls out.");
      const imageFiles = items.map((item) => item.imageFile).filter(Boolean);
      uploadedPaths = await uploadDumpImages(imageFiles, captureAuthScope(authScope, current));
      if (!current()) return;
      let uploadIndex = 0;
      const itemsWithPaths = items.map((item) => ({
        note: item.note || "",
        imagePath: item.imageFile ? uploadedPaths[uploadIndex++] : null,
        mediaBucket: PRIVATE_DUMP_MEDIA_BUCKET,
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
      }, captureAuthScope(authScope, current));
      if (!current()) return;
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
        items: formatDumpRecord(savedDump).items,
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
      if (!current()) return;
      if (uploadedPaths.length) await removeDumpImages(uploadedPaths, PRIVATE_DUMP_MEDIA_BUCKET, authScope);
      if (!current()) return;
      console.error("Failed to post dump:", error);
      throw error;
    }
  };

  const postRoll = async ({ mood, expiry, channel, frameCount, items, musicTrack = null, location = null, taggedUsers = [], allowOthersToKeep = true }) => {
    const current = authScope.isCurrent;
    if (!current()) return;
    let uploadedPaths = [];
    try {
      const quota = await getPostingLimitStatus();
      if (!current()) return;
      if (!quota.remaining) throw new Error("You have reached the 3-post limit for the last 24 hours. Try again after your oldest post rolls out.");
      const imageFiles = (items || []).map((item) => item.imageFile).filter(Boolean);
      uploadedPaths = await uploadDumpImages(imageFiles, captureAuthScope(authScope, current));
      if (!current()) return;
      const itemsWithPaths = (items || []).map((item, index) => ({ note: item.note || "", imagePath: uploadedPaths[index] || null, mediaBucket: PRIVATE_DUMP_MEDIA_BUCKET }));
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
      }, captureAuthScope(authScope, current));
      if (!current()) return;
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
        items: formatDumpRecord(savedDump).items,
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
      if (!current()) return;
      if (uploadedPaths.length) await removeDumpImages(uploadedPaths, PRIVATE_DUMP_MEDIA_BUCKET, authScope);
      if (!current()) return;
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
      currentUserId={session.user.id}
      loading={feedState.status === "loading"}
      error={feedState.status === "error" ? feedState.error : ""}
      onRetry={loadDumps}
      onOpen={(post) => {
        if (!authScope.isCurrent()) return;
        authScope.cancel("viewer");
        primePostAudio(post);
        setViewerCommentsOpen(false);
        setActivePostId(post.id);
        setScreen("viewer");
      }}
      onCommentOpen={(post) => {
        if (!authScope.isCurrent()) return;
        authScope.cancel("viewer");
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
        if (!authScope.isCurrent()) return;
        authScope.cancel("viewer");
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
      isCurrent={authScope.isCurrent}
      profile={profile}
      theme={theme}
      onClose={() => setScreen("profile")}
      onChangeTheme={setTheme}
      onSaved={async (updatedTheme) => {
        const current = authScope.begin("profile-save");
        if (!current()) return;
        if (!supabaseProfile?.id) throw new Error("Profile is still loading.");
        const normalized = sanitizeProfileTheme(updatedTheme);
        const { data, error } = await createAccountClient(captureAuthScope(authScope, current))
          .from("profiles")
          .update({
            profile_theme: normalized,
            updated_at: new Date().toISOString(),
          })
          .eq("id", supabaseProfile.id)
          .select()
          .single().catch((error) => { if (current()) throw error; return {}; });

        if (!current()) return;
        if (error) throw error;
        setSupabaseProfile(data);
        setTheme(normalized);
        setScreen("profile");
        onToast("Profile saved");
      }}
    />;
  } else if (screen === "boards") {
    content = <Boards authScope={authScope} dumps={dumps} keptItems={kept} initialBoardId={openBoardId} onBack={() => { setOpenBoardId(null); setScreen("profile"); }} onToast={onToast} />;
  } else if (screen === "edit-profile") {
    content = <EditProfile
      isCurrent={authScope.isCurrent}
      profile={profile}
      profileTheme={theme}
      onBack={() => setScreen("profile")}
      onSaved={(updatedProfile) => {
        if (!authScope.isCurrent()) return;
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
    content = activePost ? <Viewer post={activePost} currentUserId={session.user.id} initialCommentsOpen={viewerCommentsOpen} onClose={closeViewer} onLike={toggleLike} onComment={comment} onKeep={keep} onMarkViewed={async (dumpId, receipt) => {
          if (!authScope.isCurrent()) throw new Error("Authenticated context changed.");
          const confirmed = await markDumpViewed(dumpId, receipt);
          if (confirmed !== true) throw new Error("View acknowledgement was not confirmed.");
          if (!authScope.isCurrent()) throw new Error("Authenticated account changed.");
          setDumps((current) => current.map((item) => item.id === dumpId ? { ...item, viewed: true } : item));
          // A per-account claim never retires or archives the source for others.
          return true;
        }} likePending={pendingLikeIds.has(activePost.id)} onUserSelect={openPublicProfile} /> : <Home dumps={dumps} activeSpace={activeSpace} onOpen={() => {}} loading={false} error="" onUserSelect={openPublicProfile} />;
  }

  const navigationScreen = screen === "viewer" ? "home" : ["create-dump", "create-roll", "create-choose", "profile-settings", "edit-profile", "boards", "spaces", "notifications", "archive"].includes(screen) ? (["profile-settings", "edit-profile", "boards", "spaces", "notifications", "archive"].includes(screen) ? "profile" : "home") : screen;

  return (
    <>
      <AppShell
        userId={session.user.id}
        screen={navigationScreen}
        onNavigate={(key) => {
          if (!authScope.isCurrent()) return;
          authScope.cancel("viewer");
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
          if (!authScope.isCurrent()) return;
          authScope.cancel("viewer");
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
                    const count = kept.filter((item) => item.board_ids?.includes(board.id)).length;
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

      {boardStudioOpen && <BoardStudio isCurrent={authScope.isCurrent} boards={boards} onClose={() => setBoardStudioOpen(false)} onBoardSaved={authScope.guard((updated) => { setBoards((current) => current.map((board) => board.id === updated.id ? updated : board)); setBoardStudioOpen(false); })} onToast={onToast} />}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}