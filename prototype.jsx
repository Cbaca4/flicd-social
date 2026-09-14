import React, { useState } from "react";
import {
  Lock, Eye, MessageCircle, Mic, Heart, X, Camera, User, Home as HomeIcon,
  Send, ShieldAlert, ChevronLeft, ChevronRight, Compass, Bookmark, Check,
  Plus, Shuffle, Film,
} from "lucide-react";

const palette = {
  bg: "#121216",
  surface: "#1C1C22",
  card: "#232330",
  border: "#33333d",
  text: "#ECE9E2",
  textDim: "#9C9AA5",
  amber: "#FFB020",
  cyan: "#3ED6C4",
  danger: "#FF5A5A",
};

const fontImport = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap');
.flicd-root { font-family: 'Space Grotesk', sans-serif; }
.flicd-mono { font-family: 'IBM Plex Mono', monospace; }
`;

const tileGradients = [
  "linear-gradient(160deg, #2b2b38, #1a1a20)",
  "linear-gradient(160deg, #3a2a1e, #1c140d)",
  "linear-gradient(160deg, #1e2f2c, #101917)",
  "linear-gradient(160deg, #2f1e2a, #170f15)",
  "linear-gradient(160deg, #1e2433, #10131b)",
];
const tileBg = (seed) => tileGradients[seed % tileGradients.length];

const moods = ["golden hour", "late night", "chaotic", "nostalgic", "summer"];

const seedSpaces = [
  { id: "main", handle: "you", label: "Main", followers: 128, following: 94 },
  { id: "gym", handle: "gym_log", label: "Gym", followers: 42, following: 12 },
  { id: "music", handle: "the.setlist", label: "Music", followers: 301, following: 58 },
];

const seedDumps = [
  {
    id: 1, channel: "main", author: "maren_", type: "dump", mood: "golden hour",
    mode: "24h", postedMinutesAgo: 45, likes: 12, liked: false, kept: false,
    items: [{ note: "rooftop, 7pm" }, { note: "the light though" }, { note: "" }],
    comments: [{ id: "c1", from: "theo", text: "wait where is this" }],
  },
  {
    id: 2, channel: "main", author: "theo.b", type: "dump", mood: "chaotic",
    mode: "24h", postedMinutesAgo: 610, likes: 34, liked: true, kept: false,
    items: [{ note: "new espresso setup" }, { note: "" }], comments: [],
  },
  {
    id: 3, channel: "gym", author: "cole_lifts", type: "roll", mood: "gym log",
    mode: "once", postedMinutesAgo: 5, likes: 3, liked: false, kept: false, viewed: false,
    items: Array.from({ length: 8 }, () => ({ note: "" })), comments: [],
  },
  {
    id: 4, channel: "music", author: "junebug", type: "dump", mood: "nostalgic",
    mode: "24h", postedMinutesAgo: 120, likes: 58, liked: false, kept: false,
    items: [{ note: "front row" }, { note: "setlist" }, { note: "encore" }],
    comments: [{ id: "c2", from: "theo", text: "the encore was insane" }],
  },
];

function timeLeftLabel(post) {
  if (post.mode === "once") return post.viewed ? "expired" : "view once";
  const remainingMin = 24 * 60 - post.postedMinutesAgo;
  if (remainingMin <= 0) return "expired";
  const h = Math.floor(remainingMin / 60);
  const m = remainingMin % 60;
  return `${h}h ${m}m left`;
}

function CornerBrackets({ urgent }) {
  const c = urgent ? palette.danger : palette.cyan;
  const stroke = { stroke: c, strokeWidth: 2, fill: "none" };
  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
      <path d="M6,20 L6,6 L20,6" style={stroke} />
      <path d="M80,6 L94,6 L94,20" style={stroke} />
      <path d="M94,80 L94,94 L80,94" style={stroke} />
      <path d="M20,94 L6,94 L6,80" style={stroke} />
    </svg>
  );
}

function Pill({ children, active, onClick, tone = "surface" }) {
  const bg = tone === "amber" ? (active ? palette.amber : palette.surface) : (active ? palette.cyan : palette.surface);
  const color = active ? "#161616" : palette.textDim;
  return (
    <button onClick={onClick} className="px-3 py-1.5 rounded-full text-xs" style={{ background: bg, color, border: `1px solid ${palette.border}` }}>
      {children}
    </button>
  );
}

function ShutterButton({ onClick }) {
  return (
    <button onClick={onClick} className="rounded-full flex items-center justify-center" style={{ width: 52, height: 52, background: palette.text, border: `4px solid ${palette.border}` }} aria-label="Create">
      <div className="rounded-full" style={{ width: 36, height: 36, background: palette.amber }} />
    </button>
  );
}

function BottomNav({ screen, setScreen }) {
  const item = (key, Icon, label) => (
    <button key={key} onClick={() => setScreen(key)} className="flex flex-col items-center gap-1" style={{ color: screen === key ? palette.amber : palette.textDim }}>
      <Icon size={20} />
      <span style={{ fontSize: 10 }}>{label}</span>
    </button>
  );
  return (
    <div className="flex items-center justify-around px-4 py-3" style={{ background: palette.surface, borderTop: `1px solid ${palette.border}` }}>
      {item("home", HomeIcon, "Home")}
      {item("discover", Compass, "Discover")}
      <ShutterButton onClick={() => setScreen("create-choose")} />
      {item("boards", Bookmark, "Boards")}
      {item("profile", User, "Profile")}
    </div>
  );
}

function SignUp({ onDone }) {
  const [step, setStep] = useState("username");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const strength = password.length >= 10 ? "strong" : password.length >= 6 ? "ok" : "weak";
  const strengthColor = strength === "strong" ? palette.cyan : strength === "ok" ? palette.amber : palette.danger;

  return (
    <div className="flex flex-col justify-center h-full px-8" style={{ background: palette.bg }}>
      <div className="mb-8 flex flex-col items-center">
        <div className="rounded-full flex items-center justify-center mb-3" style={{ width: 64, height: 64, background: palette.surface, border: `1px solid ${palette.border}` }}>
          <Camera size={28} color={palette.amber} />
        </div>
        <h1 style={{ color: palette.text, fontSize: 22, fontWeight: 500 }}>flic'd</h1>
        <p style={{ color: palette.textDim, fontSize: 13 }}>moments that don't stick around</p>
      </div>

      {step === "username" ? (
        <div className="flex flex-col gap-3">
          <label style={{ color: palette.textDim, fontSize: 12 }}>choose a username</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. river_ok"
            className="px-4 py-3 rounded-lg outline-none" style={{ background: palette.surface, color: palette.text, border: `1px solid ${palette.border}` }} />
          <button disabled={username.trim().length < 3} onClick={() => setStep("password")} className="mt-2 py-3 rounded-lg font-medium"
            style={{ background: username.trim().length >= 3 ? palette.amber : palette.surface, color: username.trim().length >= 3 ? "#2A1B00" : palette.textDim }}>
            Continue
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 mb-1">
            <button onClick={() => setStep("username")} style={{ color: palette.textDim }}><ChevronLeft size={18} /></button>
            <span style={{ color: palette.textDim, fontSize: 12 }}>set a password for @{username}</span>
          </div>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 10 characters"
            className="px-4 py-3 rounded-lg outline-none" style={{ background: palette.surface, color: palette.text, border: `1px solid ${palette.border}` }} />
          {password.length > 0 && <p style={{ color: strengthColor, fontSize: 12 }}>Strength: {strength}</p>}
          <div className="flex items-start gap-2 mt-2 p-3 rounded-lg" style={{ background: palette.surface }}>
            <Lock size={16} color={palette.cyan} style={{ marginTop: 2, flexShrink: 0 }} />
            <p style={{ color: palette.textDim, fontSize: 12, lineHeight: 1.5 }}>
              Your password is hashed with Argon2id before it ever touches a database — nobody at Flic'd can see it, including us.
            </p>
          </div>
          <button disabled={password.length < 6} onClick={onDone} className="mt-2 py-3 rounded-lg font-medium"
            style={{ background: password.length >= 6 ? palette.amber : palette.surface, color: password.length >= 6 ? "#2A1B00" : palette.textDim }}>
            Create account
          </button>
        </div>
      )}
    </div>
  );
}

function SpaceSwitcher({ spaces, activeSpaceId, setActiveSpaceId, onClose }) {
  return (
    <div className="h-full flex flex-col" style={{ background: palette.bg }}>
      <div className="flex items-center gap-2 px-4 pt-5 pb-3">
        <button onClick={onClose} style={{ color: palette.textDim }}><ChevronLeft size={20} /></button>
        <h2 style={{ color: palette.text, fontSize: 16, fontWeight: 500 }}>Switch space</h2>
      </div>
      <div className="px-4 flex flex-col gap-2">
        {spaces.map((s) => (
          <button key={s.id} onClick={() => { setActiveSpaceId(s.id); onClose(); }} className="flex items-center justify-between p-3 rounded-lg text-left"
            style={{ background: s.id === activeSpaceId ? palette.card : palette.surface, border: `1px solid ${s.id === activeSpaceId ? palette.amber : palette.border}` }}>
            <div className="flex items-center gap-3">
              <div className="rounded-full" style={{ width: 36, height: 36, background: tileBg(s.id.length) }} />
              <div>
                <p style={{ color: palette.text, fontSize: 14, fontWeight: 500 }}>@{s.handle}</p>
                <p style={{ color: palette.textDim, fontSize: 11 }}>{s.label} space</p>
              </div>
            </div>
            {s.id === activeSpaceId && <Check size={18} color={palette.amber} />}
          </button>
        ))}
        <button className="flex items-center gap-2 p-3 rounded-lg" style={{ color: palette.textDim, border: `1px dashed ${palette.border}` }}>
          <Plus size={16} /> New space
        </button>
        <p style={{ color: palette.textDim, fontSize: 11, marginTop: 8, lineHeight: 1.5 }}>
          Spaces aren't linkable to each other. Someone who follows @gym_log has no way to find out it's connected to @you.
        </p>
      </div>
    </div>
  );
}

function DumpCard({ post, onOpen }) {
  const expired = timeLeftLabel(post) === "expired";
  return (
    <button onClick={() => !expired && onOpen(post)} className="w-full text-left rounded-xl overflow-hidden mb-3" style={{ background: palette.card, border: `1px solid ${palette.border}`, opacity: expired ? 0.4 : 1 }}>
      <div className="relative" style={{ aspectRatio: "4 / 3", background: tileBg(post.id) }}>
        <CornerBrackets />
        <div className="absolute top-2 left-2 px-2 py-1 rounded-full" style={{ background: "rgba(0,0,0,0.55)", fontSize: 11, color: palette.text }}>
          {post.mood}
        </div>
        <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full flicd-mono" style={{ background: "rgba(0,0,0,0.55)", fontSize: 11, color: expired ? palette.danger : palette.amber }}>
          {post.mode === "once" ? <Eye size={12} /> : null}
          {timeLeftLabel(post)}
        </div>
        <div className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full" style={{ background: "rgba(0,0,0,0.55)", fontSize: 11, color: palette.textDim }}>
          {post.type === "roll" ? <><Film size={12} /> {post.items.length} frames</> : <>{post.items.length} photos</>}
        </div>
      </div>
      <div className="px-3 py-2 flex items-center justify-between">
        <p style={{ color: palette.text, fontSize: 14, fontWeight: 500 }}>@{post.author}</p>
        <div className="flex items-center gap-3" style={{ color: palette.textDim }}>
          <span className="flex items-center gap-1 text-xs"><Heart size={14} fill={post.liked ? palette.amber : "none"} color={post.liked ? palette.amber : palette.textDim} />{post.likes}</span>
          <span className="flex items-center gap-1 text-xs"><MessageCircle size={14} />{post.comments.length}</span>
        </div>
      </div>
    </button>
  );
}

function Home({ dumps, activeSpace, onOpen }) {
  const visible = dumps.filter((d) => d.channel === activeSpace.id);
  return (
    <div className="h-full overflow-y-auto px-4 pt-4" style={{ background: palette.bg }}>
      <div className="flex items-center justify-between mb-1">
        <h1 style={{ color: palette.text, fontSize: 18, fontWeight: 500 }}>flic'd</h1>
        <span className="flicd-mono" style={{ color: palette.textDim, fontSize: 11 }}>as @{activeSpace.handle}</span>
      </div>
      <p style={{ color: palette.textDim, fontSize: 11, marginBottom: 12 }}>following, from your {activeSpace.label.toLowerCase()} space</p>
      {visible.length === 0 ? (
        <p style={{ color: palette.textDim, fontSize: 13, textAlign: "center", padding: "40px 0" }}>Nothing here yet from this space's follows.</p>
      ) : (
        visible.map((p) => <DumpCard key={p.id} post={p} onOpen={onOpen} />)
      )}
    </div>
  );
}

function Discover() {
  const [randomized, setRandomized] = useState(false);
  const trails = ["film photography", "alt fashion", "grunge", "gym"];
  const cards = randomized
    ? [{ title: "Underground pottery", blurb: "Outside your usual interests" }, { title: "Street chess", blurb: "Outside your usual interests" }]
    : [{ title: "Late-night film dump", blurb: "Grainy street photos and concert memories" }, { title: "Alt style archive", blurb: "Niche fashion collections you might enjoy" }];
  return (
    <div className="h-full overflow-y-auto px-4 pt-4" style={{ background: palette.bg }}>
      <h1 style={{ color: palette.text, fontSize: 18, fontWeight: 500, marginBottom: 10 }}>Discover</h1>
      <p style={{ color: palette.textDim, fontSize: 11, marginBottom: 8 }}>your interest trails</p>
      <div className="flex gap-2 flex-wrap mb-4">
        {trails.map((t) => <Pill key={t} active tone="cyan">{t}</Pill>)}
      </div>
      <div className="flex gap-2 mb-4">
        <button className="flex-1 py-2 rounded-lg text-xs flex items-center justify-center gap-1" style={{ background: palette.surface, color: palette.textDim, border: `1px solid ${palette.border}` }}>
          30-min deep dive
        </button>
        <button onClick={() => setRandomized((r) => !r)} className="flex-1 py-2 rounded-lg text-xs flex items-center justify-center gap-1" style={{ background: randomized ? palette.amber : palette.surface, color: randomized ? "#2A1B00" : palette.textDim, border: `1px solid ${palette.border}` }}>
          <Shuffle size={13} /> Randomize
        </button>
      </div>
      {cards.map((c, i) => (
        <div key={i} className="rounded-xl p-3 mb-3" style={{ background: palette.card, border: `1px solid ${palette.border}` }}>
          <div className="rounded-lg mb-2" style={{ height: 100, background: tileBg(i + 2) }} />
          <p style={{ color: palette.text, fontSize: 13, fontWeight: 500 }}>{c.title}</p>
          <p style={{ color: palette.textDim, fontSize: 11 }}>{c.blurb}</p>
        </div>
      ))}
    </div>
  );
}

function Boards({ kept }) {
  return (
    <div className="h-full overflow-y-auto px-4 pt-4" style={{ background: palette.bg }}>
      <h1 style={{ color: palette.text, fontSize: 18, fontWeight: 500, marginBottom: 4 }}>Boards</h1>
      <p style={{ color: palette.textDim, fontSize: 11, marginBottom: 14 }}>everything else on flic'd disappears — these don't, because you chose to keep them.</p>
      <p style={{ color: palette.text, fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Kept ({kept.length})</p>
      {kept.length === 0 ? (
        <p style={{ color: palette.textDim, fontSize: 12 }}>Tap "keep" on anything you're viewing to save it here before it expires.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {kept.map((k) => (
            <div key={k.id} className="rounded-lg overflow-hidden" style={{ background: palette.card, border: `1px solid ${palette.border}` }}>
              <div style={{ height: 90, background: tileBg(k.seed) }} />
              <div className="p-2">
                <p style={{ color: palette.text, fontSize: 11 }}>@{k.author}</p>
                <p style={{ color: palette.textDim, fontSize: 10 }}>{k.note || k.mood}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Viewer({ post, onClose, onLike, onComment, onMarkViewed, onKeep }) {
  const [text, setText] = useState("");
  const [flash, setFlash] = useState(false);
  const [kept, setKept] = useState(false);
  const [recording, setRecording] = useState(false);
  const [index, setIndex] = useState(0);
  const [showNote, setShowNote] = useState(false);

  React.useEffect(() => { onMarkViewed(post.id); }, []);

  const triggerFakeScreenshotAlert = () => { setFlash(true); setTimeout(() => setFlash(false), 1800); };
  const isRoll = post.type === "roll";
  const currentItem = post.items[index];

  const keep = () => {
    onKeep(post, index);
    setKept(true);
    setTimeout(() => setKept(false), 1800);
  };

  return (
    <div className="h-full flex flex-col relative" style={{ background: "#000" }}>
      <div className="relative flex-1" style={{ background: isRoll ? palette.bg : tileBg(post.id * 3 + index) }}>
        {!isRoll && <CornerBrackets urgent={post.mode === "once"} />}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
          <button onClick={onClose} style={{ color: palette.text }}><X size={20} /></button>
          <span className="flicd-mono px-2 py-1 rounded-full" style={{ background: "rgba(0,0,0,0.55)", color: post.mode === "once" ? palette.danger : palette.amber, fontSize: 12 }}>
            {timeLeftLabel(post)}
          </span>
        </div>

        {isRoll ? (
          <div className="grid grid-cols-4 gap-1 p-6 pt-14 h-full content-start">
            {post.items.map((_, i) => (
              <div key={i} className="rounded relative" style={{ aspectRatio: "1 / 1", background: tileBg(post.id * 5 + i) }}>
                <CornerBrackets />
              </div>
            ))}
          </div>
        ) : (
          <>
            <button onClick={() => setShowNote((s) => !s)} className="absolute inset-0" aria-label="Toggle context card" />
            {showNote && currentItem.note && (
              <div className="absolute inset-x-6 bottom-16 p-3 rounded-lg" style={{ background: "rgba(0,0,0,0.7)" }}>
                <p style={{ color: palette.text, fontSize: 13 }}>{currentItem.note}</p>
              </div>
            )}
            {post.items.length > 1 && (
              <>
                {index > 0 && <button onClick={() => setIndex((i) => i - 1)} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: palette.text }}><ChevronLeft size={22} /></button>}
                {index < post.items.length - 1 && <button onClick={() => setIndex((i) => i + 1)} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: palette.text }}><ChevronRight size={22} /></button>}
                <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1">
                  {post.items.map((_, i) => (
                    <div key={i} style={{ width: 5, height: 5, borderRadius: 3, background: i === index ? palette.amber : "rgba(255,255,255,0.3)" }} />
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {flash && (
          <div className="absolute inset-0 flex items-center justify-center flex-col gap-2 z-20" style={{ background: "rgba(255,90,90,0.15)" }}>
            <ShieldAlert size={28} color={palette.danger} />
            <p className="flicd-mono" style={{ color: palette.danger, fontSize: 12, textAlign: "center", padding: "0 24px" }}>
              @{post.author} would be notified: a capture was detected on this post
            </p>
          </div>
        )}
        {kept && (
          <div className="absolute inset-0 flex items-center justify-center flex-col gap-2 z-20" style={{ background: "rgba(62,214,196,0.15)" }}>
            <Bookmark size={26} color={palette.cyan} />
            <p className="flicd-mono" style={{ color: palette.cyan, fontSize: 12, textAlign: "center", padding: "0 24px" }}>
              Saved to Kept — this one won't disappear
            </p>
          </div>
        )}
        <button onClick={triggerFakeScreenshotAlert} className="absolute bottom-3 left-3 px-2 py-1 rounded flicd-mono z-10" style={{ background: "rgba(0,0,0,0.5)", color: palette.textDim, fontSize: 10 }}>
          simulate capture attempt
        </button>
      </div>

      <div className="px-4 py-3" style={{ background: palette.surface, borderTop: `1px solid ${palette.border}` }}>
        <div className="flex items-center justify-between mb-2">
          <p style={{ color: palette.text, fontSize: 13, fontWeight: 500 }}>@{post.author} · {post.mood}</p>
          <div className="flex items-center gap-3">
            <button onClick={keep} style={{ color: palette.textDim }} aria-label="Keep to board"><Bookmark size={16} /></button>
            <button onClick={() => onLike(post.id)} className="flex items-center gap-1" style={{ color: post.liked ? palette.amber : palette.textDim }}>
              <Heart size={16} fill={post.liked ? palette.amber : "none"} /> {post.likes}
            </button>
          </div>
        </div>
        <div className="max-h-16 overflow-y-auto mb-2 flex flex-col gap-1">
          {post.comments.length === 0 ? (
            <p style={{ color: palette.textDim, fontSize: 12 }}>No comments yet — they vanish with the post.</p>
          ) : (
            post.comments.map((c) => (
              <p key={c.id} style={{ color: palette.textDim, fontSize: 12 }}>
                <span style={{ color: palette.text }}>@{c.from}</span> {c.text}
              </p>
            ))
          )}
        </div>
        <div className="flex items-center gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment"
            className="flex-1 px-3 py-2 rounded-full outline-none" style={{ background: palette.card, color: palette.text, border: `1px solid ${palette.border}`, fontSize: 13 }} />
          <button onMouseDown={() => setRecording(true)} onMouseUp={() => setRecording(false)} onMouseLeave={() => setRecording(false)}
            className="rounded-full p-2" style={{ background: recording ? palette.danger : palette.card, color: recording ? "#fff" : palette.textDim }} aria-label="Hold to record a voice note">
            <Mic size={16} />
          </button>
          <button onClick={() => { if (!text.trim()) return; onComment(post.id, text.trim()); setText(""); }}
            className="rounded-full p-2" style={{ background: palette.amber, color: "#2A1B00" }} aria-label="Send comment">
            <Send size={16} />
          </button>
        </div>
        {recording && <p className="flicd-mono" style={{ color: palette.danger, fontSize: 11, marginTop: 4 }}>recording voice note… release to send</p>}
      </div>
    </div>
  );
}

function DumpBuilder({ spaces, activeSpaceId, onCancel, onPost }) {
  const [items, setItems] = useState([{ note: "" }]);
  const [mood, setMood] = useState(moods[0]);
  const [expiry, setExpiry] = useState("24h");
  const [postAs, setPostAs] = useState(activeSpaceId);

  const addItem = () => items.length < 20 && setItems([...items, { note: "" }]);
  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i));

  return (
    <div className="h-full flex flex-col" style={{ background: palette.bg }}>
      <div className="flex items-center gap-2 px-4 pt-5 pb-3">
        <button onClick={onCancel} style={{ color: palette.textDim }}><ChevronLeft size={20} /></button>
        <h2 style={{ color: palette.text, fontSize: 16, fontWeight: 500 }}>New dump</h2>
      </div>
      <div className="flex-1 overflow-y-auto px-4 flex flex-col gap-4">
        <div>
          <p style={{ color: palette.textDim, fontSize: 11, marginBottom: 6 }}>{items.length}/20 items</p>
          <div className="flex gap-2 flex-wrap">
            {items.map((_, i) => (
              <div key={i} className="relative rounded-lg" style={{ width: 56, height: 56, background: tileBg(i) }}>
                <button onClick={() => removeItem(i)} className="absolute -top-1 -right-1 rounded-full" style={{ background: palette.danger, width: 16, height: 16, color: "#fff", fontSize: 10, lineHeight: "16px" }}>×</button>
              </div>
            ))}
            <button onClick={addItem} className="rounded-lg flex items-center justify-center" style={{ width: 56, height: 56, border: `1px dashed ${palette.border}`, color: palette.textDim }}>
              <Plus size={18} />
            </button>
          </div>
        </div>

        <div>
          <p style={{ color: palette.textDim, fontSize: 11, marginBottom: 6 }}>mood</p>
          <div className="flex gap-2 flex-wrap">
            {moods.map((m) => <Pill key={m} active={mood === m} onClick={() => setMood(m)} tone="amber">{m}</Pill>)}
          </div>
        </div>

        <div>
          <p style={{ color: palette.textDim, fontSize: 11, marginBottom: 6 }}>context card for the cover photo</p>
          <input value={items[0]?.note || ""} onChange={(e) => setItems((prev) => prev.map((it, i) => i === 0 ? { ...it, note: e.target.value } : it))}
            placeholder="A memory, a song, a location…" className="w-full px-3 py-2 rounded-lg outline-none" style={{ background: palette.surface, color: palette.text, border: `1px solid ${palette.border}`, fontSize: 13 }} />
        </div>

        <div>
          <p style={{ color: palette.textDim, fontSize: 11, marginBottom: 6 }}>expires</p>
          <div className="flex gap-2">
            <Pill active={expiry === "24h"} onClick={() => setExpiry("24h")}>24 hours</Pill>
            <Pill active={expiry === "once"} onClick={() => setExpiry("once")}>view once</Pill>
          </div>
        </div>

        <div>
          <p style={{ color: palette.textDim, fontSize: 11, marginBottom: 6 }}>posting as</p>
          <div className="flex gap-2 flex-wrap">
            {spaces.map((s) => <Pill key={s.id} active={postAs === s.id} onClick={() => setPostAs(s.id)}>@{s.handle}</Pill>)}
          </div>
        </div>
      </div>
      <div className="p-4">
        <button disabled={items.length === 0} onClick={() => onPost({ mood, expiry, channel: postAs, items })}
          className="w-full py-3 rounded-lg font-medium" style={{ background: palette.amber, color: "#2A1B00" }}>
          Post dump
        </button>
      </div>
    </div>
  );
}

function RollBuilder({ spaces, activeSpaceId, onCancel, onPost }) {
  const [step, setStep] = useState("count");
  const [frameCount, setFrameCount] = useState(null);
  const [framesShot, setFramesShot] = useState(0);
  const [expiry, setExpiry] = useState("once");
  const [postAs, setPostAs] = useState(activeSpaceId);

  return (
    <div className="h-full flex flex-col" style={{ background: palette.bg }}>
      <div className="flex items-center gap-2 px-4 pt-5 pb-3">
        <button onClick={onCancel} style={{ color: palette.textDim }}><ChevronLeft size={20} /></button>
        <h2 style={{ color: palette.text, fontSize: 16, fontWeight: 500 }}>New roll</h2>
      </div>

      {step === "count" && (
        <div className="px-4 flex flex-col gap-4">
          <p style={{ color: palette.textDim, fontSize: 12 }}>Pick a frame count. Once you start, there's no deleting or reordering — just like a disposable camera.</p>
          <div className="flex gap-2">
            {[8, 12, 24].map((n) => <Pill key={n} active={frameCount === n} onClick={() => setFrameCount(n)}>{n} frames</Pill>)}
          </div>
          <button disabled={!frameCount} onClick={() => setStep("shoot")} className="py-3 rounded-lg font-medium"
            style={{ background: frameCount ? palette.amber : palette.surface, color: frameCount ? "#2A1B00" : palette.textDim }}>
            Start roll
          </button>
        </div>
      )}

      {step === "shoot" && (
        <div className="px-4 flex flex-col gap-4">
          <p className="flicd-mono" style={{ color: palette.textDim, fontSize: 12 }}>{framesShot}/{frameCount} frames</p>
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: frameCount }).map((_, i) => (
              <div key={i} className="rounded" style={{ aspectRatio: "1/1", background: i < framesShot ? tileBg(i) : "transparent", border: i < framesShot ? "none" : `1px dashed ${palette.border}` }} />
            ))}
          </div>
          {framesShot < frameCount ? (
            <button onClick={() => setFramesShot((f) => f + 1)} className="py-3 rounded-lg font-medium flex items-center justify-center gap-2" style={{ background: palette.amber, color: "#2A1B00" }}>
              <Camera size={16} /> Capture frame
            </button>
          ) : (
            <button onClick={() => setStep("reveal")} className="py-3 rounded-lg font-medium" style={{ background: palette.cyan, color: "#0d1f1c" }}>
              Develop roll
            </button>
          )}
        </div>
      )}

      {step === "reveal" && (
        <div className="flex-1 flex flex-col px-4 overflow-y-auto">
          <p style={{ color: palette.textDim, fontSize: 12, marginBottom: 8 }}>Your roll, developed:</p>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {Array.from({ length: frameCount }).map((_, i) => <div key={i} className="rounded" style={{ aspectRatio: "1/1", background: tileBg(i) }} />)}
          </div>
          <p style={{ color: palette.textDim, fontSize: 11, marginBottom: 6 }}>expires</p>
          <div className="flex gap-2 mb-4">
            <Pill active={expiry === "24h"} onClick={() => setExpiry("24h")}>24 hours</Pill>
            <Pill active={expiry === "once"} onClick={() => setExpiry("once")}>view once</Pill>
          </div>
          <p style={{ color: palette.textDim, fontSize: 11, marginBottom: 6 }}>posting as</p>
          <div className="flex gap-2 flex-wrap mb-4">
            {spaces.map((s) => <Pill key={s.id} active={postAs === s.id} onClick={() => setPostAs(s.id)}>@{s.handle}</Pill>)}
          </div>
          <button onClick={() => onPost({ mood: "roll", expiry, channel: postAs, frameCount })} className="py-3 rounded-lg font-medium mb-4" style={{ background: palette.amber, color: "#2A1B00" }}>
            Post roll
          </button>
        </div>
      )}
    </div>
  );
}

function CreateChoose({ onPick, onCancel }) {
  return (
    <div className="h-full flex flex-col justify-center px-6" style={{ background: palette.bg }}>
      <button onClick={onCancel} className="absolute top-5 left-4" style={{ color: palette.textDim }}><X size={20} /></button>
      <button onClick={() => onPick("dump")} className="p-5 rounded-xl mb-3 text-left" style={{ background: palette.card, border: `1px solid ${palette.border}` }}>
        <p style={{ color: palette.text, fontSize: 15, fontWeight: 500, marginBottom: 4 }}>Start a dump</p>
        <p style={{ color: palette.textDim, fontSize: 12 }}>3–20 photos or videos, in any order, with a mood and a cover.</p>
      </button>
      <button onClick={() => onPick("roll")} className="p-5 rounded-xl text-left" style={{ background: palette.card, border: `1px solid ${palette.border}` }}>
        <p style={{ color: palette.text, fontSize: 15, fontWeight: 500, marginBottom: 4 }}>Start a roll</p>
        <p style={{ color: palette.textDim, fontSize: 12 }}>A fixed number of frames, shot in-app, revealed all at once.</p>
      </button>
    </div>
  );
}

function Profile({ activeSpace, onSwitchSpaces, feedBias, setFeedBias }) {
  return (
    <div className="h-full overflow-y-auto px-5 pt-6" style={{ background: palette.bg }}>
      <div className="flex flex-col items-center mb-5">
        <div className="rounded-full mb-2" style={{ width: 72, height: 72, background: tileBg(activeSpace.id.length), border: `2px solid ${palette.amber}` }} />
        <p style={{ color: palette.text, fontSize: 16, fontWeight: 500 }}>@{activeSpace.handle}</p>
        <p style={{ color: palette.textDim, fontSize: 12 }}>{activeSpace.label} space</p>
      </div>

      <button onClick={onSwitchSpaces} className="w-full flex items-center justify-between p-3 rounded-lg mb-5" style={{ background: palette.surface, border: `1px solid ${palette.border}` }}>
        <span style={{ color: palette.text, fontSize: 13 }}>Switch space</span>
        <ChevronRight size={16} color={palette.textDim} />
      </button>

      <div className="flex justify-center gap-8 mb-5">
        <div className="text-center">
          <p className="flicd-mono" style={{ color: palette.text, fontSize: 18 }}>{activeSpace.followers}</p>
          <p style={{ color: palette.textDim, fontSize: 11 }}>followers</p>
        </div>
        <div className="text-center">
          <p className="flicd-mono" style={{ color: palette.text, fontSize: 18 }}>{activeSpace.following}</p>
          <p style={{ color: palette.textDim, fontSize: 11 }}>following</p>
        </div>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-lg mb-4" style={{ background: palette.surface, border: `1px solid ${palette.border}` }}>
        <Lock size={16} color={palette.cyan} style={{ marginTop: 2, flexShrink: 0 }} />
        <p style={{ color: palette.textDim, fontSize: 12, lineHeight: 1.5 }}>
          Only you can see who's on this space's lists — and only you can see that this space is even linked to your other ones.
        </p>
      </div>

      <p style={{ color: palette.textDim, fontSize: 12, marginBottom: 8 }}>Tune this space's feed</p>
      <div className="flex gap-2 mb-6">
        {["fewer", "balanced", "more"].map((v) => (
          <button key={v} onClick={() => setFeedBias(v)} className="flex-1 py-2 rounded-lg text-xs"
            style={{ background: feedBias === v ? palette.amber : palette.surface, color: feedBias === v ? "#2A1B00" : palette.textDim, border: `1px solid ${palette.border}` }}>
            {v === "fewer" ? "less like this" : v === "more" ? "more like this" : "balanced"}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function FlicdApp() {
  const [screen, setScreen] = useState("signedout");
  const [spaces] = useState(seedSpaces);
  const [activeSpaceId, setActiveSpaceId] = useState("main");
  const [dumps, setDumps] = useState(seedDumps);
  const [activePostId, setActivePostId] = useState(null);
  const [feedBias, setFeedBias] = useState("balanced");
  const [kept, setKept] = useState([]);

  const activeSpace = spaces.find((s) => s.id === activeSpaceId);
  const activePost = dumps.find((d) => d.id === activePostId);

  const openPost = (post) => { setActivePostId(post.id); setScreen("viewer"); };
  const markViewed = (id) => setDumps((prev) => prev.map((p) => (p.id === id && p.mode === "once" ? { ...p, viewed: true } : p)));
  const toggleLike = (id) => setDumps((prev) => prev.map((p) => (p.id === id ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 } : p)));
  const addComment = (id, text) => {
    const c = { id: `c${Date.now()}`, from: "you", text };
    setDumps((prev) => prev.map((p) => (p.id === id ? { ...p, comments: [...p.comments, c] } : p)));
  };
  const keepItem = (post, index) => {
    setKept((prev) => [...prev, { id: `k${Date.now()}`, author: post.author, mood: post.mood, note: post.items[index]?.note, seed: post.id * 5 + index }]);
  };
  const postDump = ({ mood, expiry, channel, items }) => {
    const newDump = { id: Date.now(), channel, author: activeSpace.handle, type: "dump", mood, mode: expiry, postedMinutesAgo: 0, likes: 0, liked: false, comments: [], items };
    setDumps((prev) => [newDump, ...prev]);
    setScreen("home");
  };
  const postRoll = ({ mood, expiry, channel, frameCount }) => {
    const newDump = { id: Date.now(), channel, author: activeSpace.handle, type: "roll", mood, mode: expiry, postedMinutesAgo: 0, likes: 0, liked: false, comments: [], items: Array.from({ length: frameCount }, () => ({ note: "" })) };
    setDumps((prev) => [newDump, ...prev]);
    setScreen("home");
  };

  return (
    <div className="flicd-root flex justify-center" style={{ padding: "24px 0" }}>
      <style>{fontImport}</style>
      <div className="flex flex-col overflow-hidden" style={{ width: 360, height: 700, background: palette.bg, borderRadius: 32, border: "8px solid #0a0a0d", boxShadow: "0 0 0 1px #2a2a32" }}>
        <div className="flex-1 overflow-hidden relative">
          {screen === "signedout" && <SignUp onDone={() => setScreen("home")} />}
          {screen === "home" && <Home dumps={dumps} activeSpace={activeSpace} onOpen={openPost} />}
          {screen === "discover" && <Discover />}
          {screen === "boards" && <Boards kept={kept} />}
          {screen === "profile" && <Profile activeSpace={activeSpace} onSwitchSpaces={() => setScreen("spaces")} feedBias={feedBias} setFeedBias={setFeedBias} />}
          {screen === "spaces" && <SpaceSwitcher spaces={spaces} activeSpaceId={activeSpaceId} setActiveSpaceId={setActiveSpaceId} onClose={() => setScreen("profile")} />}
          {screen === "viewer" && activePost && (
            <Viewer post={activePost} onClose={() => setScreen("home")} onLike={toggleLike} onComment={addComment} onMarkViewed={markViewed} onKeep={keepItem} />
          )}
          {screen === "create-choose" && <CreateChoose onPick={(t) => setScreen(t === "dump" ? "create-dump" : "create-roll")} onCancel={() => setScreen("home")} />}
          {screen === "create-dump" && <DumpBuilder spaces={spaces} activeSpaceId={activeSpaceId} onCancel={() => setScreen("home")} onPost={postDump} />}
          {screen === "create-roll" && <RollBuilder spaces={spaces} activeSpaceId={activeSpaceId} onCancel={() => setScreen("home")} onPost={postRoll} />}
        </div>
        {!["signedout", "spaces"].includes(screen) && <BottomNav screen={screen} setScreen={setScreen} />}
      </div>
    </div>
  );
}
