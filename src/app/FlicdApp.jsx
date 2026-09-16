import React from "react";

import { supabase } from "../lib/supabase";

import Boards from "../features/profile/Boards.jsx";
import BoardStudio from "../features/profile/BoardStudio.jsx";

import {
  getBoards,
  getBoardItems,
  getOrCreateDefaultBoard,
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
  {
    id: "main",
    handle: "you",
    label: "Main",
    followers: 128,
    following: 94,
  },
  {
    id: "gym",
    handle: "gym_log",
    label: "Gym",
    followers: 42,
    following: 12,
  },
  {
    id: "music",
    handle: "the.setlist",
    label: "Music",
    followers: 301,
    following: 58,
  },
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
    items: [
      { note: "rooftop, 7pm" },
      { note: "the light though" },
      { note: "" },
    ],
    comments: [
      {
        id: "c1",
        from: "theo",
        text: "wait where is this",
      },
    ],
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
    items: [
      { note: "new espresso setup" },
      { note: "" },
    ],
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
    items: Array.from(
      { length: 8 },
      () => ({ note: "" })
    ),
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
    items: [
      { note: "front row" },
      { note: "setlist" },
      { note: "encore" },
    ],
    comments: [
      {
        id: "c2",
        from: "theo",
        text: "the encore was insane",
      },
    ],
    context: "front row",
  },
];

const seedRequests = [
  {
    id: "r1",
    user: {
      handle: "alex",
      name: "Alex Rivera",
      bio: "found you through global",
    },
  },
];

export default function FlicdApp() {
  const [session, setSession] =
    React.useState(null);

  const [screen, setScreen] =
    React.useState("home");

  const [spaces] =
    React.useState(seedSpaces);

  const [activeSpaceId, setActiveSpaceId] =
    React.useState("main");

  const [dumps, setDumps] =
    React.useState(seedDumps);

  const [activePostId, setActivePostId] =
    React.useState(null);

  const [kept, setKept] =
    React.useState([]);

  const [boards, setBoards] =
    React.useState([]);

  const [boardStudioOpen, setBoardStudioOpen] =
    React.useState(false);

  const [requests, setRequests] =
    React.useState(seedRequests);

  const [chats, setChats] =
    React.useState([]);

  const [studio, setStudio] =
    React.useState(false);

  const [theme, setTheme] =
    React.useState(() =>
      sanitizeProfileTheme(
        DEFAULT_THEME
      )
    );

  const [supabaseProfile, setSupabaseProfile] =
    React.useState(null);

  const [toast, setToast] =
    React.useState("");

  /*
   * Get the current Supabase session.
   */
  React.useEffect(() => {
    async function getSession() {
      const {
        data: { session },
      } =
        await supabase.auth.getSession();

      setSession(session);
    }

    getSession();

    const {
      data: { subscription },
    } =
      supabase.auth.onAuthStateChange(
        (_event, session) => {
          setSession(session);
        }
      );

    return () =>
      subscription.unsubscribe();
  }, []);

  /*
   * Clear temporary toast messages.
   */
  React.useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = setTimeout(() => {
      setToast("");
    }, 1900);

    return () =>
      clearTimeout(timer);
  }, [toast]);

  /*
   * Load the user's profile from Supabase.
   */
  React.useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      if (!user) {
        console.log(
          "No user logged in"
        );
        return;
      }

      const { data, error } =
        await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

      if (error) {
        console.error(
          "Profile error:",
          error
        );
        return;
      }

      if (data) {
        console.log(
          "✅ Profile loaded:",
          data
        );

        setSupabaseProfile(data);

        if (data.profile_theme) {
          setTheme(
            sanitizeProfileTheme(
              data.profile_theme
            )
          );
        }
      } else {
        console.log(
          "No profile found yet."
        );
      }
    }

    loadProfile();
  }, [session]);

  /*
   * Load saved dumps and rolls from Supabase.
   */
  React.useEffect(() => {
    async function loadDumps() {
      if (!session) {
        return;
      }

      try {
        const savedDumps =
          await getDumps();

        if (!savedDumps.length) {
          return;
        }

        const formattedDumps =
          savedDumps.map(
            (dump) => ({
              id: dump.id,
              channel:
                dump.space_id,
              author:
                dump.user_id,
              mood: dump.mood,
              mode: dump.expiry,

              postedMinutesAgo:
                Math.floor(
                  (Date.now() -
                    new Date(
                      dump.created_at
                    ).getTime()) /
                    60000
                ),

              likes: 0,
              liked: false,
              viewed: false,
              comments: [],

              items:
                (dump.dump_items || [])
                  .sort(
                    (a, b) =>
                      a.position -
                      b.position
                  )
                  .map(
                    (item) => ({
                      note:
                        item.note ||
                        "",
                      imagePath:
                        item.image_path ||
                        null,
                    })
                  ),

              context:
                dump.context ||
                "",
            })
          );

        setDumps(
          formattedDumps
        );
      } catch (error) {
        console.error(
          "Failed to load dumps:",
          error
        );
      }
    }

    loadDumps();
  }, [session]);

  /*
   * Load saved Board items from Supabase.
   *
   * boardId is intentionally preserved so
   * Profile can calculate per-Board counts.
   */
  React.useEffect(() => {
    async function loadBoardItems() {
      if (!session) {
        return;
      }

      try {
        const savedItems =
          await getBoardItems();

        setKept(
          savedItems.map(
            (item) => ({
              id: item.id,
              boardId:
                item.board_id,
              dumpId:
                item.dump_id,
              author: "",
              note:
                item.note || "",
              mood:
                item.mood || "",
              seed:
                item.item_position ||
                0,
            })
          )
        );
      } catch (error) {
        console.error(
          "Failed to load board items:",
          error
        );
      }
    }

    loadBoardItems();
  }, [session]);

  /*
   * Load the user's Boards from Supabase.
   */
  React.useEffect(() => {
    async function loadBoards() {
      if (!session) {
        return;
      }

      try {
        const savedBoards =
          await getBoards();

        setBoards(savedBoards);
      } catch (error) {
        console.error(
          "Failed to load boards:",
          error
        );
      }
    }

    loadBoards();
  }, [session]);

  const activeSpace =
    spaces.find(
      (space) =>
        space.id ===
        activeSpaceId
    ) || spaces[0];

  const activePost =
    dumps.find(
      (dump) =>
        dump.id ===
        activePostId
    );

  const onToast = (message) => {
    setToast(message);
  };

  /*
   * Boards shown on Profile.
   *
   * Each Board gets its current saved-item count.
   */
  const profileBoards =
    boards.map((board) => ({
      ...board,
      count: kept.filter(
        (item) =>
          item.boardId ===
          board.id
      ).length,
    }));

  /*
   * Like / unlike a post.
   */
  const toggleLike = (id) => {
    setDumps(
      (currentDumps) =>
        currentDumps.map(
          (post) =>
            post.id === id
              ? {
                  ...post,
                  liked:
                    !post.liked,
                  likes:
                    post.likes +
                    (post.liked
                      ? -1
                      : 1),
                }
              : post
        )
    );
  };

  /*
   * Add a comment to a post.
   */
  const comment = (
    id,
    text
  ) => {
    setDumps(
      (currentDumps) =>
        currentDumps.map(
          (post) =>
            post.id === id
              ? {
                  ...post,
                  comments: [
                    ...post.comments,
                    {
                      id:
                        Date.now(),
                      from: "you",
                      text,
                    },
                  ],
                }
              : post
        )
    );
  };

  /*
   * Save a post item to the default Saved Board.
   *
   * Users can later move the saved item
   * into any other Board.
   */
  const keep = async (
    post,
    index
  ) => {
    try {
      const board =
        await getOrCreateDefaultBoard();

      const saved =
        await saveBoardItem({
          boardId:
            board.id,
          dumpId:
            post.id,
          itemPosition:
            index,
          note:
            post.items[index]
              ?.note || "",
          mood:
            post.mood || "",
        });

      setKept(
        (current) => {
          const alreadySaved =
            current.some(
              (item) =>
                item.id ===
                saved.id
            );

          if (alreadySaved) {
            return current;
          }

          return [
            ...current,
            {
              id:
                saved.id,
              boardId:
                saved.board_id,
              dumpId:
                saved.dump_id,
              author:
                post.author,
              note:
                saved.note ||
                "",
              mood:
                saved.mood ||
                "",
              seed:
                saved.item_position,
            },
          ];
        }
      );

      setBoards(
        await getBoards()
      );

      onToast(
        "Saved to Boards"
      );
    } catch (error) {
      console.error(
        "Failed to save board item:",
        error
      );

      onToast(
        error.message ||
          "Failed to save to Boards"
      );
    }
  };

  /*
   * Mark a once-only post as viewed.
   */
  const markViewed = (id) => {
    setDumps(
      (currentDumps) =>
        currentDumps.map(
          (post) =>
            post.id === id &&
            post.mode === "once"
              ? {
                  ...post,
                  viewed: true,
                }
              : post
        )
    );
  };

  /*
   * Create and save a Dump.
   */
  const postDump =
    async ({
      mood,
      expiry,
      channel,
      items,
    }) => {
      try {
        const savedDump =
          await createDump({
            type: "dump",
            spaceId:
              channel,
            mood,
            expiry,
            context:
              items[0]?.note ||
              "new dump",
            frameCount:
              items.length,
            items,
          });

        const newDump = {
          id: savedDump.id,
          channel,
          author:
            activeSpace.handle,
          mood,
          mode: expiry,
          postedMinutesAgo: 0,
          likes: 0,
          liked: false,
          comments: [],
          items,
          context:
            items[0]?.note ||
            "new dump",
        };

        setDumps(
          (currentDumps) => [
            newDump,
            ...currentDumps,
          ]
        );

        setScreen("home");
        onToast("Dump posted");
      } catch (error) {
        console.error(
          "Failed to post dump:",
          error
        );

        onToast(
          error.message ||
            "Failed to post dump"
        );
      }
    };

  /*
   * Create and save a Roll.
   */
  const postRoll =
    async ({
      mood,
      expiry,
      channel,
      frameCount,
    }) => {
      try {
        const items =
          Array.from(
            { length: frameCount },
            () => ({
              note: "",
            })
          );

        const savedDump =
          await createDump({
            type: "roll",
            spaceId:
              channel,
            mood,
            expiry,
            context: `${frameCount} frame roll`,
            frameCount,
            items,
          });

        const newRoll = {
          id: savedDump.id,
          channel,
          author:
            activeSpace.handle,
          mood,
          mode: expiry,
          postedMinutesAgo: 0,
          likes: 0,
          liked: false,
          comments: [],
          items,
          context: `${frameCount} frame roll`,
        };

        setDumps(
          (currentDumps) => [
            newRoll,
            ...currentDumps,
          ]
        );

        setScreen("home");
        onToast("Roll posted");
      } catch (error) {
        console.error(
          "Failed to post roll:",
          error
        );

        onToast(
          error.message ||
            "Failed to post roll"
        );
      }
    };

  /*
   * Build the profile object used by
   * Profile, EditProfile, and ProfileStudio.
   */
  const profile = {
    handle:
      supabaseProfile?.username ||
      activeSpace.handle,

    displayName:
      supabaseProfile?.display_name ||
      "",

    bio:
      supabaseProfile?.bio ||
      "",

    avatarUrl:
      supabaseProfile?.avatar_url ||
      "",

    followers:
      activeSpace.followers,

    following:
      activeSpace.following,
  };

  /*
   * Require authentication.
   */
  if (!session) {
    return (
      <Auth
        onLogin={() => {}}
      />
    );
  }

  let content;

  /*
   * HOME
   */
  if (screen === "home") {
    content = (
      <Home
        dumps={dumps}
        activeSpace={activeSpace}
        onOpen={(post) => {
          setActivePostId(
            post.id
          );
          setScreen("viewer");
        }}
      />
    );
  }

  /*
   * DISCOVER
   */
  else if (
    screen === "discover"
  ) {
    content = (
      <Discovery
        onToast={onToast}
      />
    );
  }

  /*
   * MESSAGES
   */
  else if (
    screen === "messages"
  ) {
    content = (
      <Messages
        requests={requests}
        setRequests={setRequests}
        chats={chats}
        setChats={setChats}
        onToast={onToast}
      />
    );
  }

  /*
   * PROFILE
   */
  else if (
    screen === "profile"
  ) {
    content = (
      <Profile
        profile={profile}
        activeSpace={activeSpace}
        onSwitchSpaces={() =>
          setScreen("spaces")
        }
        theme={theme}
        onCustomize={() =>
          setStudio(true)
        }
        boards={profileBoards}
        onOpenBoards={() =>
          setScreen("boards")
        }
        onCustomizeBoards={() =>
          setBoardStudioOpen(true)
        }
        onEditProfile={() =>
          setScreen(
            "edit-profile"
          )
        }
      />
    );
  }

  /*
   * BOARDS
   */
  else if (
    screen === "boards"
  ) {
    content = (
      <Boards
        dumps={dumps}
        keptItems={kept}
        onBack={() =>
          setScreen("profile")
        }
        onToast={onToast}
      />
    );
  }

  /*
   * EDIT PROFILE
   */
  else if (
    screen === "edit-profile"
  ) {
    content = (
      <EditProfile
        profile={profile}
        onBack={() =>
          setScreen("profile")
        }
        onSaved={(updatedProfile) => {
          setSupabaseProfile(
            updatedProfile
          );

          if (
            updatedProfile?.profile_theme
          ) {
            setTheme(
              sanitizeProfileTheme(
                updatedProfile.profile_theme
              )
            );
          }

          setScreen("profile");
        }}
        onToast={onToast}
      />
    );
  }

  /*
   * SPACE SWITCHER
   */
  else if (
    screen === "spaces"
  ) {
    content = (
      <SpaceSwitcher
        spaces={spaces}
        activeSpaceId={
          activeSpaceId
        }
        setActiveSpaceId={
          setActiveSpaceId
        }
        onClose={() =>
          setScreen("profile")
        }
      />
    );
  }

  /*
   * CREATE CHOOSE
   */
  else if (
    screen === "create-choose"
  ) {
    content = (
      <CreateChoose
        onPick={(type) =>
          setScreen(
            type === "dump"
              ? "create-dump"
              : "create-roll"
          )
        }
        onCancel={() =>
          setScreen("home")
        }
      />
    );
  }

  /*
   * CREATE DUMP
   */
  else if (
    screen === "create-dump"
  ) {
    content = (
      <DumpBuilder
        spaces={spaces}
        activeSpaceId={
          activeSpaceId
        }
        onCancel={() =>
          setScreen("home")
        }
        onPost={postDump}
      />
    );
  }

  /*
   * CREATE ROLL
   */
  else if (
    screen === "create-roll"
  ) {
    content = (
      <RollBuilder
        spaces={spaces}
        activeSpaceId={
          activeSpaceId
        }
        onCancel={() =>
          setScreen("home")
        }
        onPost={postRoll}
      />
    );
  }

  /*
   * VIEWER
   */
  else {
    content = activePost ? (
      <Viewer
        post={activePost}
        onClose={() =>
          setScreen("home")
        }
        onLike={toggleLike}
        onComment={comment}
        onKeep={keep}
        onMarkViewed={
          markViewed
        }
      />
    ) : (
      <Home
        dumps={dumps}
        activeSpace={activeSpace}
        onOpen={() => {}}
      />
    );
  }

  /*
   * Keep the main navigation on Home
   * while viewing/creating content.
   */
  const navigationScreen =
    screen === "viewer"
      ? "home"
      : [
          "create-dump",
          "create-roll",
          "create-choose",
        ].includes(screen)
      ? "home"
      : screen;

  return (
    <>
      <AppShell
        screen={navigationScreen}
        onNavigate={(key) =>
          setScreen(key)
        }
        onCapture={() =>
          setScreen(
            "create-choose"
          )
        }
        unread={
          requests.length
        }
      >
        <div
          style={{
            height: "100%",
          }}
        >
          {content}
        </div>
      </AppShell>

      {/* PROFILE STUDIO */}
      {studio && (
        <div className="modal-backdrop">
          <div className="modal">
            <ProfileStudio
              theme={theme}
              setTheme={setTheme}
              profile={profile}
              onClose={() =>
                setStudio(false)
              }
              onSave={() => {
                setStudio(false);

                onToast(
                  "Profile saved"
                );
              }}
            />
          </div>
        </div>
      )}

      {/* BOARD STUDIO */}
      {boardStudioOpen && (
        <BoardStudio
          boards={boards}
          onClose={() =>
            setBoardStudioOpen(
              false
            )
          }
          onBoardSaved={(updated) => {
            setBoards(
              (current) =>
                current.map(
                  (board) =>
                    board.id ===
                    updated.id
                      ? updated
                      : board
                )
            );

            setBoardStudioOpen(
              false
            );
          }}
          onToast={onToast}
        />
      )}

      {/* TOAST */}
      {toast && (
        <div className="toast">
          {toast}
        </div>
      )}
    </>
  );
}