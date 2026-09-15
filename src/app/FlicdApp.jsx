import React from "react";
import { supabase } from "../lib/supabase";
import Auth from "../features/auth/Auth.jsx";
import AppShell from './AppShell.jsx';
import Home,{Viewer} from '../features/home/Home.jsx';
import CreateChoose from '../features/capture/CreateChoose.jsx';
import {DumpBuilder,RollBuilder} from '../features/capture/CaptureBuilders.jsx';
import Messages from '../features/messages/Messages.jsx';
import Profile from '../features/profile/Profile.jsx';
import ProfileStudio from '../features/profile/ProfileStudio.jsx';
import EditProfile from '../features/profile/EditProfile.jsx';
import Discovery from '../features/discovery/Discovery.jsx';
import SpaceSwitcher from '../features/spaces/SpaceSwitcher.jsx';
import {DEFAULT_THEME,sanitizeProfileTheme} from '../features/profile/profileTheme.js';
const seedSpaces=[{id:'main',handle:'you',label:'Main',followers:128,following:94},{id:'gym',handle:'gym_log',label:'Gym',followers:42,following:12},{id:'music',handle:'the.setlist',label:'Music',followers:301,following:58}];
const seedDumps=[{id:1,channel:'main',author:'maren_',mood:'golden hour',mode:'24h',postedMinutesAgo:45,likes:12,liked:false,items:[{note:'rooftop, 7pm'},{note:'the light though'},{note:''}],comments:[{id:'c1',from:'theo',text:'wait where is this'}],context:'rooftop, 7pm'},{id:2,channel:'main',author:'theo.b',mood:'chaotic',mode:'24h',postedMinutesAgo:610,likes:34,liked:true,items:[{note:'new espresso setup'},{note:''}],comments:[],context:'new espresso setup'},{id:3,channel:'gym',author:'cole_lifts',mood:'gym log',mode:'once',postedMinutesAgo:5,likes:3,liked:false,viewed:false,items:Array.from({length:8},()=>({note:''})),comments:[],context:'8 frame roll'},{id:4,channel:'music',author:'junebug',mood:'nostalgic',mode:'24h',postedMinutesAgo:120,likes:58,liked:false,items:[{note:'front row'},{note:'setlist'},{note:'encore'}],comments:[{id:'c2',from:'theo',text:'the encore was insane'}],context:'front row'}];
const seedRequests=[{id:'r1',user:{handle:'alex',name:'Alex Rivera',bio:'found you through global'}}];
export default function FlicdApp() {
    const [session, setSession] = React.useState(null);
    React.useEffect(() => {
  async function getSession() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    setSession(session);
  }

  getSession();

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    setSession(session);
  });

  return () => subscription.unsubscribe();
}, []);

  const [screen, setScreen] = React.useState("home");
  const [spaces] = React.useState(seedSpaces);
  const [activeSpaceId, setActiveSpaceId] = React.useState("main");
  const [dumps, setDumps] = React.useState(seedDumps);
  const [activePostId, setActivePostId] = React.useState(null);
  const [kept, setKept] = React.useState([]);
  const [requests, setRequests] = React.useState(seedRequests);
  const [chats, setChats] = React.useState([]);
  const [studio, setStudio] = React.useState(false);
  const [theme, setTheme] = React.useState(() =>
    sanitizeProfileTheme(DEFAULT_THEME)
  );

  const [supabaseProfile, setSupabaseProfile] = React.useState(null);

  const [toast, setToast] = React.useState("");

  // Clear temporary toast messages.
  React.useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => {
      setToast("");
    }, 1900);

    return () => clearTimeout(timer);
  }, [toast]);

  // Test the Supabase connection when the app starts.
  React.useEffect(() => {
  async function loadProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.log("No user logged in");
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Profile error:", error);
      return;
    }

        if (data) {
      console.log("✅ Profile loaded:", data);
      setSupabaseProfile(data);
    } else {
      console.log("No profile found yet.");
    }
  }

  loadProfile();
}, []);

  const activeSpace =
    spaces.find((space) => space.id === activeSpaceId) || spaces[0];

  const activePost = dumps.find((dump) => dump.id === activePostId);

  const onToast = (message) => {
    setToast(message);
  };

  const toggleLike = (id) => {
    setDumps((currentDumps) =>
      currentDumps.map((post) =>
        post.id === id
          ? {
              ...post,
              liked: !post.liked,
              likes: post.likes + (post.liked ? -1 : 1),
            }
          : post
      )
    );
  };

  const comment = (id, text) => {
    setDumps((currentDumps) =>
      currentDumps.map((post) =>
        post.id === id
          ? {
              ...post,
              comments: [
                ...post.comments,
                {
                  id: Date.now(),
                  from: "you",
                  text,
                },
              ],
            }
          : post
      )
    );
  };

  const keep = (post, index) => {
    setKept((currentKept) => [
      ...currentKept,
      {
        id: Date.now(),
        author: post.author,
        note: post.items[index]?.note || "",
        mood: post.mood,
        seed: post.id * 9 + index,
      },
    ]);

    onToast("Saved to Boards");
  };

  const markViewed = (id) => {
    setDumps((currentDumps) =>
      currentDumps.map((post) =>
        post.id === id && post.mode === "once"
          ? {
              ...post,
              viewed: true,
            }
          : post
      )
    );
  };

  const postDump = ({ mood, expiry, channel, items }) => {
    const newDump = {
      id: Date.now(),
      channel,
      author: activeSpace.handle,
      mood,
      mode: expiry,
      postedMinutesAgo: 0,
      likes: 0,
      liked: false,
      comments: [],
      items,
      context: items[0]?.note || "new dump",
    };

    setDumps((currentDumps) => [newDump, ...currentDumps]);
    setScreen("home");
    onToast("Dump posted");
  };

  const postRoll = ({ mood, expiry, channel, frameCount }) => {
    const newRoll = {
      id: Date.now(),
      channel,
      author: activeSpace.handle,
      mood,
      mode: expiry,
      postedMinutesAgo: 0,
      likes: 0,
      liked: false,
      comments: [],
      items: Array.from({ length: frameCount }, () => ({
        note: "",
      })),
      context: `${frameCount} frame roll`,
    };

    setDumps((currentDumps) => [newRoll, ...currentDumps]);
    setScreen("home");
    onToast("Roll posted");
  };

  const profile = {
  handle: supabaseProfile?.username || activeSpace.handle,
  displayName: supabaseProfile?.display_name || "",
  bio: supabaseProfile?.bio || "",
  avatarUrl: supabaseProfile?.avatar_url || "",
  followers: activeSpace.followers,
  following: activeSpace.following,
};

  const boards = [
    {
      id: "b1",
      name: "Memories",
      count: kept.length || 6,
      description: "kept forever",
    },
    {
      id: "b2",
      name: "Late nights",
      count: 12,
      description: "after dark energy",
    },
  ];

  if (!session) {
  return <Auth onLogin={() => {}} />;
}

  let content;

  if (screen === "home") {
    content = (
      <Home
        dumps={dumps}
        activeSpace={activeSpace}
        onOpen={(post) => {
          setActivePostId(post.id);
          setScreen("viewer");
        }}
      />
    );
  } else if (screen === "discover") {
    content = <Discovery onToast={onToast} />;
  } else if (screen === "messages") {
    content = (
      <Messages
        requests={requests}
        setRequests={setRequests}
        chats={chats}
        setChats={setChats}
        onToast={onToast}
      />
    );
   } else if (screen === "profile") {

    content = (

      <Profile

        profile={profile}

        activeSpace={activeSpace}

        onSwitchSpaces={() => setScreen("spaces")}

        theme={theme}

        onCustomize={() => setStudio(true)}

        boards={boards}

        onOpenBoard={() => onToast("Board opened")}

        onEditProfile={() => setScreen("edit-profile")}

      />

    );

  } else if (screen === "edit-profile") {

    content = (

      <EditProfile

        profile={profile}

        onBack={() => setScreen("profile")}

        onSaved={(updatedProfile) => {

          setSupabaseProfile(updatedProfile);

          setScreen("profile");

        }}

        onToast={onToast}

      />

    );

  } else if (screen === "spaces") {
    content = (
      <SpaceSwitcher
        spaces={spaces}
        activeSpaceId={activeSpaceId}
        setActiveSpaceId={setActiveSpaceId}
        onClose={() => setScreen("profile")}
      />
    );
  } else if (screen === "create-choose") {
    content = (
      <CreateChoose
        onPick={(type) =>
          setScreen(type === "dump" ? "create-dump" : "create-roll")
        }
        onCancel={() => setScreen("home")}
      />
    );
  } else if (screen === "create-dump") {
    content = (
      <DumpBuilder
        spaces={spaces}
        activeSpaceId={activeSpaceId}
        onCancel={() => setScreen("home")}
        onPost={postDump}
      />
    );
  } else if (screen === "create-roll") {
    content = (
      <RollBuilder
        spaces={spaces}
        activeSpaceId={activeSpaceId}
        onCancel={() => setScreen("home")}
        onPost={postRoll}
      />
    );
  } else {
    content = activePost ? (
      <Viewer
        post={activePost}
        onClose={() => setScreen("home")}
        onLike={toggleLike}
        onComment={comment}
        onKeep={keep}
        onMarkViewed={markViewed}
      />
    ) : (
      <Home
        dumps={dumps}
        activeSpace={activeSpace}
        onOpen={() => {}}
      />
    );
  }

  const navigationScreen =
    screen === "viewer"
      ? "home"
      : ["create-dump", "create-roll", "create-choose"].includes(screen)
      ? "home"
      : screen;

  return (
    <>
      <AppShell
        screen={navigationScreen}
        onNavigate={(key) => setScreen(key)}
        onCapture={() => setScreen("create-choose")}
        unread={requests.length}
      >
        <div style={{ height: "100%" }}>
          {content}
        </div>
      </AppShell>

      {studio && (
        <div className="modal-backdrop">
          <div className="modal">
            <ProfileStudio
              theme={theme}
              setTheme={setTheme}
              profile={profile}
              onClose={() => setStudio(false)}
              onSave={() => {
                setStudio(false);
                onToast("Profile saved");
              }}
            />
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
