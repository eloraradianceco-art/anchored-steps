import React, { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import Onboarding from "./Onboarding.jsx";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://cvtukqamaqrhjtdvmslb.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2dHVrcWFtYXFyaGp0ZHZtc2xiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NDU1MjQsImV4cCI6MjA5MTQyMTUyNH0.gSksF5jV-UpuaUL7x7vhHHOB6Z7Qq0iehtbc2PoSAxw";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const SECTIONS = [
  {id:"scripture",label:"📖 Scripture"},
  {id:"verseMap",label:"🗺 Verse Map"},
  {id:"study",label:"📝 Study"},
  {id:"reflect",label:"🪞 Reflect"},
  {id:"apply",label:"⚡ Apply"},
  {id:"prayer",label:"🙏 Prayer"},
  {id:"tracker",label:"📊 Tracker"},
  {id:"weekEnd",label:"✨ Week End"},
  {id:"community",label:"🌿 Community"},
];

const G = {
  bg:"#0F1A24",bgCard:"rgba(255,255,255,0.035)",bgMid:"#1A2A38",
  gold:"#B08A4E",goldL:"#D6B97A",goldF:"rgba(176,138,78,0.12)",goldB:"rgba(176,138,78,0.28)",
  green:"#7C9284",greenF:"rgba(124,146,132,0.12)",greenB:"rgba(124,146,132,0.28)",
  purple:"#A89ACF",purpleF:"rgba(168,154,207,0.08)",purpleB:"rgba(168,154,207,0.22)",
  red:"#D97A7A",redF:"rgba(217,122,122,0.08)",redB:"rgba(217,122,122,0.24)",
  cream:"#F5F1E8",text:"#E6DED0",muted:"#A8B3BC",dim:"#6C7A86",border:"rgba(255,255,255,0.06)",
};

const INP_STYLE = {width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:8,color:G.cream,fontSize:16,padding:"12px 14px",outline:"none",fontFamily:"EB Garamond,Georgia,serif",marginBottom:12};
const LBL_STYLE = {fontSize:10,color:G.gold,letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:8,display:"block",fontFamily:"Cinzel,serif"};

function todayStr() { return new Date().toISOString().split("T")[0]; }

function highlightKeywords(text, keywords) {
  try {
    if (!text || !keywords || keywords.length === 0) return text;
    const validKws = keywords.filter(k => k && k.trim().length > 2);
    if (validKws.length === 0) return text;
    const sorted = [...validKws].sort((a,b) => b.length - a.length);
    const escaped = sorted.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) => {
      if (validKws.some(kw => kw.toLowerCase() === part.toLowerCase())) {
        return (
          <mark key={i} style={{background:"rgba(176,138,78,0.28)",color:"#F5F1E8",borderRadius:3,padding:"0 3px",fontStyle:"inherit",fontWeight:500}}>
            {part}
          </mark>
        );
      }
      return <span key={i}>{part}</span>;
    });
  } catch(e) {
    return text;
  }
}

function calcStreak(entries) {
  const days = [...new Set(entries.filter(e => e.field_key.startsWith("day_")).map(e => e.field_key.replace("day_","")))].sort().reverse();
  if (!days.length) return 0;
  let streak = 0;
  let cursor = new Date(); cursor.setHours(0,0,0,0);
  for (let i = 0; i < days.length; i++) {
    const d = new Date(days[i]); d.setHours(0,0,0,0);
    const diff = Math.round((cursor - d) / 86400000);
    if (diff === 0 || diff === 1) { streak++; cursor = d; } else break;
  }
  return streak;
}

function SaveBtn({onSave, flash}) {
  return (
    <button onClick={onSave} style={{marginTop:20,background:flash?"rgba(124,146,132,0.14)":"linear-gradient(135deg,rgba(176,138,78,0.24),rgba(176,138,78,0.10))",border:"1px solid "+(flash?"rgba(124,146,132,0.35)":"rgba(176,138,78,0.30)"),color:flash?G.green:G.gold,padding:"11px 22px",borderRadius:10,cursor:"pointer",fontSize:12,fontFamily:"Cinzel,serif",letterSpacing:"0.08em",transition:"all .25s ease"}}>
      {flash ? "✓ Saved" : "Save Entry"}
    </button>
  );
}

// ── AUTH SCREENS ──────────────────────────────────────────────────────────────

function AuthScreen({onAuth}) {
  const [screen, setScreen] = useState("login"); // login | signup | code
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [stayIn, setStayIn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const wrap = style => ({
    minHeight:"100vh",
    background:"linear-gradient(155deg,#0F1A24 0%,#1A2A38 55%,#0F1A24 100%)",
    display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
    padding:"24px",fontFamily:"EB Garamond,Georgia,serif",color:G.text,
    ...style
  });

  const card = {
    background:"rgba(255,255,255,0.04)",border:"1px solid "+G.goldB,
    borderRadius:16,padding:"32px",width:"100%",maxWidth:400,
  };

  const handleLogin = async () => {
    setLoading(true); setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); }
    else { onAuth(); }
  };

  const handleSignup = async () => {
    if (!code.trim()) { setError("Please enter your access code first."); return; }
    setLoading(true); setError("");

    // Validate code using security definer function (bypasses RLS)
    const { data: codeRows, error: codeErr } = await supabase
      .rpc("validate_access_code", { input_code: code.trim() });

    if (codeErr || !codeRows || codeRows.length === 0) {
      setError("Invalid or already used access code.");
      setLoading(false); return;
    }
    const codeData = codeRows[0];

    // Create account
    const { data: authData, error: authErr } = await supabase.auth.signUp({ email, password });
    if (authErr) { setError(authErr.message); setLoading(false); return; }

    // Handle email confirmation required
    if (!authData.user) {
      setMsg("Check your email to confirm your account, then sign in.");
      setLoading(false);
      return;
    }

    // Mark code as used
    await supabase.from("access_codes").update({
      used: true,
      used_by: authData.user?.id,
      used_at: new Date().toISOString(),
    }).eq("id", codeData.code_id);

    // Update profile with correct plan
    await supabase.from("profiles").update({ plan: codeData.plan_type })
      .eq("id", authData.user?.id);

    setMsg("Account created! Logging you in...");
    setTimeout(() => onAuth(), 1500);
  };

  const handleReset = async () => {
    if (!email) { setError("Enter your email first."); return; }
    setLoading(true);
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "https://anchored-steps.vercel.app/reset-password",
    });
    setMsg("Check your email for a reset link.");
    setLoading(false);
  };

  if (screen === "login") return (
    <div style={wrap()}>
      <div style={{fontSize:36,color:G.gold,marginBottom:12}}>⚓</div>
      <div style={{fontFamily:"Cinzel,serif",fontSize:22,fontWeight:600,color:G.cream,marginBottom:4}}>Anchored Steps</div>
      <div style={{fontSize:12,color:G.muted,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:28}}>52 Weeks of Faith in Action</div>
      <div style={card}>
        <div style={{fontFamily:"Cinzel,serif",fontSize:14,color:G.cream,marginBottom:20,textAlign:"center",letterSpacing:"0.06em"}}>Sign In</div>
        {error && <p style={{fontSize:12,color:G.red,marginBottom:12,textAlign:"center"}}>{error}</p>}
        {msg && <p style={{fontSize:12,color:G.green,marginBottom:12,textAlign:"center"}}>{msg}</p>}
        <label style={LBL_STYLE}>Email</label>
        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com" type="email" style={INP_STYLE} />
        <label style={LBL_STYLE}>Password</label>
        <input value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" type="password" style={INP_STYLE} onKeyDown={e=>e.key==="Enter"&&handleLogin()} />
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
          <input type="checkbox" id="stay" checked={stayIn} onChange={e=>setStayIn(e.target.checked)} />
          <label htmlFor="stay" style={{fontSize:13,color:G.muted,cursor:"pointer"}}>Stay signed in</label>
        </div>
        <button onClick={handleLogin} disabled={loading} style={{width:"100%",background:"linear-gradient(135deg,rgba(180,140,60,0.3),rgba(180,140,60,0.15))",border:"1px solid "+G.goldB,color:G.gold,padding:"12px",borderRadius:8,cursor:"pointer",fontSize:14,fontFamily:"Cinzel,serif",letterSpacing:"0.1em",marginBottom:12}}>
          {loading ? "Signing in..." : "Sign In"}
        </button>
        <div style={{textAlign:"center",fontSize:13,color:G.muted,marginBottom:12}}>
          <span onClick={handleReset} style={{color:G.gold,cursor:"pointer",textDecoration:"none"}}>Forgot password?</span>
        </div>
        <button onClick={()=>{setScreen("signup");setError("");}} style={{width:"100%",background:"transparent",border:"1px solid rgba(176,138,78,0.25)",color:G.text,padding:"11px",borderRadius:8,cursor:"pointer",fontSize:14,fontFamily:"EB Garamond,Georgia,serif",marginBottom:10,transition:"all .2s"}}>
          Create Account
        </button>
        <button onClick={()=>setScreen("plans")} style={{width:"100%",background:"transparent",border:"1px solid rgba(255,255,255,0.06)",color:G.muted,padding:"11px",borderRadius:8,cursor:"pointer",fontSize:13,fontFamily:"EB Garamond,Georgia,serif",transition:"all .2s"}}>
          View Plans &#8594;
        </button>
      </div>
    </div>
  );

  if (screen === "plans") return (
    <div style={wrap()}>
      <img src="/icon.png" alt="Anchored Steps" style={{width:56,height:56,marginBottom:12,borderRadius:12,boxShadow:"0 4px 16px rgba(0,0,0,0.2)"}}/>
      <div style={{fontFamily:"Cinzel,serif",fontSize:20,fontWeight:600,color:G.cream,marginBottom:4}}>Choose Your Plan</div>
      <div style={{fontSize:13,color:G.muted,fontStyle:"italic",marginBottom:28,textAlign:"center"}}>Subscribe to receive your access code instantly by email.</div>
      <div style={{width:"100%",maxWidth:400}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
          <a href="https://buy.stripe.com/28E4gyfDSfG69KLgQj57W04" target="_blank" rel="noreferrer" style={{textDecoration:"none",display:"block",background:"linear-gradient(145deg,rgba(176,138,78,0.1),rgba(176,138,78,0.04))",border:"1px solid rgba(176,138,78,0.28)",borderRadius:14,padding:"24px 16px",textAlign:"center"}}>
            <div style={{fontFamily:"Cinzel,serif",fontSize:12,color:G.gold,letterSpacing:"0.1em",marginBottom:10}}>Monthly</div>
            <div style={{fontSize:32,fontWeight:600,color:G.cream,fontFamily:"Cinzel,serif",marginBottom:4}}>$5.50</div>
            <div style={{fontSize:12,color:G.muted,marginBottom:16}}>per month</div>
            <div style={{background:"rgba(176,138,78,0.2)",border:"1px solid rgba(176,138,78,0.3)",borderRadius:8,padding:"10px",fontSize:13,color:G.gold,fontFamily:"EB Garamond,Georgia,serif"}}>Subscribe &#8594;</div>
          </a>
          <a href="https://buy.stripe.com/dRmbJ09fu51s9KLgQj57W01" target="_blank" rel="noreferrer" style={{textDecoration:"none",display:"block",background:"linear-gradient(145deg,rgba(176,138,78,0.16),rgba(176,138,78,0.07))",border:"1px solid rgba(176,138,78,0.4)",borderRadius:14,padding:"24px 16px",textAlign:"center",position:"relative"}}>
            <div style={{position:"absolute",top:-12,left:"50%",transform:"translateX(-50%)",background:G.gold,color:"#0F1A24",fontSize:9,fontFamily:"Cinzel,serif",padding:"3px 12px",borderRadius:20,whiteSpace:"nowrap",fontWeight:700,letterSpacing:"0.08em"}}>BEST VALUE</div>
            <div style={{fontFamily:"Cinzel,serif",fontSize:12,color:G.gold,letterSpacing:"0.1em",marginBottom:10}}>Full Year Access</div>
            <div style={{fontSize:32,fontWeight:600,color:G.cream,fontFamily:"Cinzel,serif",marginBottom:4}}>$39</div>
            <div style={{fontSize:12,color:G.muted,marginBottom:16}}>full year &#8212; $3.25/mo</div>
            <div style={{background:"rgba(176,138,78,0.3)",border:"1px solid rgba(176,138,78,0.45)",borderRadius:8,padding:"10px",fontSize:13,color:G.gold,fontFamily:"EB Garamond,Georgia,serif"}}>Subscribe &#8594;</div>
          </a>
        </div>
        <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:"16px",marginBottom:20,textAlign:"center"}}>
          <p style={{fontSize:13,color:G.muted,lineHeight:1.7,margin:0}}>After subscribing, check your email for your unique access code. Then return here and tap <strong style={{color:G.text}}>Create Account</strong> to get started.</p>
        </div>
        <button onClick={()=>setScreen("login")} style={{width:"100%",background:"transparent",border:"none",color:G.muted,padding:"8px",cursor:"pointer",fontSize:13,fontFamily:"EB Garamond,Georgia,serif"}}>
          &#8592; Back to Sign In
        </button>
      </div>
    </div>
  );

  return (
    <div style={wrap()}>
      <div style={{fontSize:36,color:G.gold,marginBottom:12}}>⚓</div>
      <div style={{fontFamily:"Cinzel,serif",fontSize:22,fontWeight:600,color:G.cream,marginBottom:4}}>Create Your Account</div>
      <div style={{fontSize:12,color:G.muted,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:28}}>Enter your access code to get started</div>
      <div style={card}>
        {error && <p style={{fontSize:12,color:G.red,marginBottom:12,textAlign:"center"}}>{error}</p>}
        {msg && <p style={{fontSize:12,color:G.green,marginBottom:12,textAlign:"center"}}>{msg}</p>}
        <label style={LBL_STYLE}>Access Code</label>
        <input value={code} onChange={e=>setCode(e.target.value)} placeholder="e.g. AS-7X4K2M" style={{...INP_STYLE,fontFamily:"Cinzel,serif",letterSpacing:"0.08em",textTransform:"uppercase"}} />
        <label style={LBL_STYLE}>Email</label>
        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com" type="email" style={INP_STYLE} />
        <label style={LBL_STYLE}>Create Password</label>
        <input value={password} onChange={e=>setPassword(e.target.value)} placeholder="min 6 characters" type="password" style={INP_STYLE} />
        <button onClick={handleSignup} disabled={loading} style={{width:"100%",background:"linear-gradient(135deg,rgba(180,140,60,0.3),rgba(180,140,60,0.15))",border:"1px solid "+G.goldB,color:G.gold,padding:"12px",borderRadius:8,cursor:"pointer",fontSize:14,fontFamily:"Cinzel,serif",letterSpacing:"0.1em",marginBottom:12}}>
          {loading ? "Creating account..." : "Create Account"}
        </button>
        <div style={{textAlign:"center",fontSize:13,color:G.muted,marginTop:4}}>
          Already have an account?{" "}
          <span onClick={()=>{setScreen("login");setError("");}} style={{color:G.gold,cursor:"pointer"}}>Sign in</span>
          {" · "}
          <span onClick={()=>window.open("https://eloraradiance.com/anchored-steps-app","_blank")} style={{color:G.muted,cursor:"pointer",textDecoration:"underline"}}>View Plans</span>
        </div>
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────

export default function AnchoredSteps() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem("onboarding_complete"));
  const [subExpired, setSubExpired] = useState(false);
  const [view, setView] = useState("journal");
  const [wk, setWk] = useState(1);
  const [sec, setSec] = useState("scripture");
  const [day, setDay] = useState(-1);
  const [flash, setFlash] = useState(false);
  const [animK, setAnimK] = useState(0);
  const [lexWord, setLexWord] = useState(null);
  const [speaking, setSpeaking] = useState(false);
  const [quizMode, setQuizMode] = useState(false);
  const [quizInput, setQuizInput] = useState("");
  const [quizResult, setQuizResult] = useState(null);
  const [quizVerse, setQuizVerse] = useState(null);
  const [openAuthor, setOpenAuthor] = useState(null);
  const [openCrossRef, setOpenCrossRef] = useState(null);
  const [communityInput, setCommunityInput] = useState("");
  const [communityDone, setCommunityDone] = useState(false);

  // Safety check for data loading
  if (!window.__APPDATA__) {
    return (
      <div style={{minHeight:"100vh",background:"#0b1825",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
        <img src="/icon.png" alt="Anchored Steps" style={{width:56,height:56,marginBottom:12,borderRadius:12,boxShadow:"0 4px 16px rgba(0,0,0,0.2)"}}/>
        <div style={{fontFamily:"Cinzel,serif",color:"#7e92a2",fontSize:12,letterSpacing:"0.1em"}}>Loading journal data...</div>
      </div>
    );
  }
  const ALL_WEEKS = window.__APPDATA__.ALL_WEEKS;
  const LEXICON = window.__APPDATA__.LEXICON;
  const CROSS_REFS = window.__APPDATA__.CROSS_REFS;
  const EXCERPTS = window.__APPDATA__.EXCERPTS;
  const AUTHOR_DATA = window.__APPDATA__.AUTHOR_DATA;

  // ── Push notification setup
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("Notification" in window)) return;

    // Register service worker
    navigator.serviceWorker.register("/sw.js").then(reg => {
      console.log("SW registered");

      // Ask for permission after user is logged in
      if (Notification.permission === "default") {
        setTimeout(() => {
          Notification.requestPermission().then(perm => {
            if (perm === "granted") {
              // Schedule daily reminder check
              scheduleDailyReminder(reg);
            }
          });
        }, 5000); // Ask after 5 seconds so it's not immediate
      } else if (Notification.permission === "granted") {
        scheduleDailyReminder(reg);
      }
    }).catch(err => console.log("SW error:", err));

    function scheduleDailyReminder(reg) {
      // Store last notification time
      const lastNotif = localStorage.getItem("last_notif");
      const now = new Date();
      const today = now.toISOString().split("T")[0];

      if (lastNotif === today) return; // Already notified today

      // Check if it's morning time (7-9am) or evening (7-9pm)
      const hour = now.getHours();
      const isGoodTime = (hour >= 7 && hour <= 9) || (hour >= 19 && hour <= 21);

      if (isGoodTime) {
        const messages = [
          "Your journal is waiting. A few minutes with God changes everything.",
          "Walk steadily today. Your anchor holds.",
          "Ready for your time with God? Week " + (parseInt(localStorage.getItem("anchored_week") || "1")) + " is waiting.",
          "Stay anchored. Open your journal today.",
          "Faith grows through intention. Your journal is ready.",
        ];
        const msg = messages[Math.floor(Math.random() * messages.length)];

        reg.showNotification("Anchored Steps ⚓", {
          body: msg,
          icon: "/icon.png",
          badge: "/icon.png",
          tag: "anchored-daily",
        });

        localStorage.setItem("last_notif", today);
      }
    }
  }, []);

  // ── Auth listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadUserData(session.user.id);
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session);
      if (session) loadUserData(session.user.id);
      else { setLoading(false); setProfile(null); setEntries([]); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadUserData = async (userId) => {
    setLoading(true);
    const [{ data: prof }, { data: ents }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase.from("journal_entries").select("*").eq("user_id", userId),
    ]);
    if (prof) {
      setProfile(prof);
      setWk(prof.current_week || 1);
      // Check subscription status
      if (prof.subscription_status === "canceled") {
        setSubExpired(true);
      }
    }
    if (ents) setEntries(ents);
    setLoading(false);
  };

  // ── Entry helpers
  const kk = (t) => "w" + wk + "_" + t;

  const get = (t) => {
    const entry = entries.find(e => e.week === wk && e.field_key === t);
    return entry ? entry.field_value || "" : "";
  };

  const set = useCallback(async (t, v) => {
    if (!session) return;
    const userId = session.user.id;
    const todayKey = "day_" + todayStr();

    // Optimistic update
    setEntries(prev => {
      const existing = prev.findIndex(e => e.week === wk && e.field_key === t);
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = { ...next[existing], field_value: v };
        return next;
      }
      return [...prev, { user_id: userId, week: wk, field_key: t, field_value: v }];
    });

    // Mark today active
    setEntries(prev => {
      if (!prev.find(e => e.field_key === todayKey)) {
        return [...prev, { user_id: userId, week: wk, field_key: todayKey, field_value: "1" }];
      }
      return prev;
    });

    // Persist to Supabase
    await supabase.from("journal_entries").upsert({
      user_id: userId, week: wk, field_key: t, field_value: v,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,week,field_key" });

    await supabase.from("journal_entries").upsert({
      user_id: userId, week: wk, field_key: todayKey, field_value: "1",
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,week,field_key" });
  }, [session, wk]);

  const save = () => { setFlash(true); setTimeout(() => setFlash(false), 1800); };

  const goWk = async (n) => {
    setWk(n); setSec("scripture"); setDay(-1);
    setAnimK(a => a+1); setLexWord(null);
    setQuizMode(false); setQuizResult(null); setQuizInput("");
    if (session) {
      await supabase.from("profiles").update({ current_week: n, updated_at: new Date().toISOString() })
        .eq("id", session.user.id);
      setProfile(prev => ({ ...prev, current_week: n }));
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const speak = entry => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(entry.transliteration);
    utt.rate = 0.72;
    utt.onstart = () => setSpeaking(true);
    utt.onend = () => setSpeaking(false);
    utt.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utt);
  };

  const startQuiz = s => { setQuizVerse(s); setQuizMode(true); setQuizInput(""); setQuizResult(null); };

  const checkQuiz = async () => {
    if (!quizVerse) return;
    const norm = s => s.toLowerCase().replace(/[^a-z0-9 ]/g,"").replace(/\s+/g," ").trim();
    const aw = norm(quizInput).split(" ");
    const cw = norm(quizVerse.text).split(" ");
    const result = aw.filter(w => cw.includes(w)).length / cw.length >= 0.75 ? "pass" : "fail";
    setQuizResult(result);
    if (result === "pass") {
      await set("mem_" + quizVerse.ref, "1");
    }
  };

  const daysComplete = n => entries.filter(e => e.week === n && e.field_key.startsWith("tr_") && (e.field_value||"").trim()).length;
  const weeksActive = ALL_WEEKS.filter(w => daysComplete(w.week) > 0).length;
  const streak = calcStreak(entries);

  const exportNotes = () => {
    let out = "ANCHORED STEPS\nGenerated " + new Date().toLocaleDateString() + "\n\n";
    ALL_WEEKS.forEach(w => {
      const wEntries = entries.filter(e => e.week === w.week);
      const has = wEntries.some(e => ["study","rfj","apply","prayer"].includes(e.field_key) && (e.field_value||"").trim());
      if (!has) return;
      out += "=".repeat(50) + "\nWEEK " + w.week + ": " + w.title + "\n\n";
      const studyE = wEntries.find(e => e.field_key === "study");
      if (studyE?.field_value) out += "STUDY:\n" + studyE.field_value + "\n\n";
      [0,1,2,3].forEach(i => {
        const rf = wEntries.find(e => e.field_key === "rf"+i);
        if (rf?.field_value) out += "REFLECTION "+(i+1)+":\n"+rf.field_value+"\n\n";
      });
      const rfjE = wEntries.find(e => e.field_key === "rfj");
      if (rfjE?.field_value) out += "JOURNAL:\n" + rfjE.field_value + "\n\n";
      const appE = wEntries.find(e => e.field_key === "apply");
      if (appE?.field_value) out += "APPLICATION:\n" + appE.field_value + "\n\n";
      const prayE = wEntries.find(e => e.field_key === "prayer");
      if (prayE?.field_value) out += "PRAYER:\n" + prayE.field_value + "\n\n";
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([out], {type:"text/plain"}));
    a.download = "anchored-steps.txt"; a.click();
  };

  const submitCommunity = async () => {
    if (!communityInput.trim()) return;
    const key = "community_w" + wk;
    const ex = JSON.parse(localStorage.getItem(key) || "[]");
    ex.unshift({text: communityInput.trim(), date: new Date().toLocaleDateString()});
    localStorage.setItem(key, JSON.stringify(ex.slice(0,50)));
    setCommunityInput(""); setCommunityDone(true);
    setTimeout(() => setCommunityDone(false), 2500);
  };
  const communityNotes = () => { try { return JSON.parse(localStorage.getItem("community_w"+wk)||"[]"); } catch { return []; } };

  // ── Onboarding
  if (showOnboarding) return (
    <Onboarding onComplete={() => setShowOnboarding(false)} />
  );

  // ── Subscription expired
  if (subExpired) return (
    <div style={{minHeight:"100vh",background:"linear-gradient(155deg,#0F1A24 0%,#1A2A38 55%,#0F1A24 100%)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px",fontFamily:"EB Garamond,Georgia,serif",textAlign:"center"}}>
      <img src="/icon.png" alt="" style={{width:64,height:64,borderRadius:14,marginBottom:16,opacity:.6}}/>
      <div style={{fontFamily:"Cinzel,serif",fontSize:20,color:"#F5F1E8",marginBottom:8}}>Subscription Ended</div>
      <p style={{fontSize:16,color:"#A8B3BC",lineHeight:1.7,marginBottom:28,maxWidth:340}}>Your subscription is no longer active. Resubscribe to continue your faith journey.</p>
      <a href="https://eloraradiance.com/anchored-steps-app" style={{display:"block",background:"linear-gradient(135deg,rgba(176,138,78,0.35),rgba(176,138,78,0.15))",border:"1px solid rgba(176,138,78,0.45)",color:"#B08A4E",padding:"14px 32px",borderRadius:12,textDecoration:"none",fontFamily:"Cinzel,serif",fontSize:14,letterSpacing:"0.1em",marginBottom:12}}>View Plans &#8594;</a>
      <button onClick={signOut} style={{background:"transparent",border:"none",color:"#6C7A86",cursor:"pointer",fontSize:13,fontFamily:"EB Garamond,Georgia,serif"}}>Sign out</button>
    </div>
  );

  // ── Loading
  if (loading) return (
    <div style={{minHeight:"100vh",background:G.bg,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
      <div style={{fontSize:32,color:G.gold}}>⚓</div>
      <div style={{fontFamily:"Cinzel,serif",color:G.muted,fontSize:12,letterSpacing:"0.1em"}}>Loading your journal...</div>
    </div>
  );

  // ── Not logged in
  if (!session) return <AuthScreen onAuth={() => window.location.reload()} />;

  const week = ALL_WEEKS.find(w => w.week === wk);
  const INP = {width:"100%",background:"rgba(255,255,255,0.035)",border:"1px solid rgba(176,138,78,0.18)",borderRadius:12,color:G.text,fontSize:17,lineHeight:1.9,padding:"16px 18px",fontFamily:"EB Garamond,Georgia,serif",outline:"none",boxShadow:"inset 0 1px 0 rgba(255,255,255,0.02)"};
  const LBL = {fontSize:10,color:G.gold,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:12,display:"block",fontFamily:"Cinzel,serif"};
  const kwList = week ? week.keywords.split(",").map(k => k.trim()) : [];
  const crossRefs = CROSS_REFS[wk] || [];

  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(155deg,#0F1A24 0%,#1A2A38 50%,#0F1A24 100%)"}}>

      <header style={{position:"sticky",top:0,zIndex:100,background:"rgba(15,26,36,0.88)",backdropFilter:"blur(14px)",borderBottom:"1px solid rgba(176,138,78,0.14)"}}>
        <div style={{borderBottom:"1px solid rgba(180,140,60,0.12)",padding:"10px 18px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:16,color:G.gold}}>⚓</span>
              <span style={{fontFamily:"Cinzel,serif",fontSize:14,fontWeight:600,color:G.cream}}>Anchored Steps</span>
              {streak > 0 && <span style={{background:"rgba(180,140,60,0.15)",border:"1px solid "+G.goldB,borderRadius:12,padding:"1px 8px",fontSize:10,color:G.gold,fontFamily:"Cinzel,serif"}}>🔥 {streak}</span>}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:11,color:G.muted}}>{profile?.email?.split("@")[0]}</span>
              <button onClick={signOut} style={{background:"transparent",border:"1px solid "+G.border,color:G.muted,padding:"3px 10px",borderRadius:6,cursor:"pointer",fontSize:10,fontFamily:"Cinzel,serif"}}>Sign Out</button>
            </div>
          </div>
        </div>
        <div style={{display:"flex",justifyContent:"center",gap:4,padding:"7px 18px"}}>
          {[["journal","Journal"],["contents","Contents"],["progress","Progress"],["export","Export"]].map(([v,l]) => (
            <button key={v} onClick={() => setView(v)} style={{background:view===v?G.goldF:"transparent",border:"1px solid "+(view===v?G.goldB:"transparent"),color:view===v?G.gold:G.muted,padding:"5px 14px",borderRadius:6,cursor:"pointer",fontSize:11,fontFamily:"Cinzel,serif",letterSpacing:"0.07em",transition:"all .2s"}}>{l}</button>
          ))}
        </div>
      </header>

      <main style={{maxWidth:860,margin:"0 auto",padding:"26px 18px 80px"}}>

        {view === "journal" && week && (
          <div className="fi">
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18}}>
              <button onClick={() => goWk(Math.max(1,wk-1))} disabled={wk===1} style={{background:G.goldF,border:"1px solid "+G.goldB,color:G.gold,width:34,height:34,borderRadius:8,cursor:"pointer",fontSize:15,flexShrink:0,opacity:wk===1?.3:1}}>&#8249;</button>
              <div style={{flex:1,textAlign:"center"}}>
                <div style={{fontSize:10,color:G.gold,letterSpacing:"0.16em",textTransform:"uppercase",fontFamily:"Cinzel,serif",marginBottom:1}}>Week {wk} of 52</div>
                <h1 style={{fontSize:23,fontWeight:600,color:G.cream,fontFamily:"Cinzel,serif"}}>{week.title}</h1>
                <p style={{fontSize:13,color:G.muted,fontStyle:"italic",marginTop:1}}>{week.subtitle}</p>
              </div>
              <button onClick={() => goWk(Math.min(52,wk+1))} disabled={wk===52} style={{background:G.goldF,border:"1px solid "+G.goldB,color:G.gold,width:34,height:34,borderRadius:8,cursor:"pointer",fontSize:15,flexShrink:0,opacity:wk===52?.3:1}}>&#8250;</button>
            </div>

            <div style={{background:"rgba(255,255,255,0.05)",borderRadius:3,height:3,marginBottom:20,overflow:"hidden"}}>
              <div style={{height:"100%",background:"linear-gradient(90deg,#B08A4E,#D6B97A)",width:((wk/52)*100)+"%",transition:"width .5s ease"}} />
            </div>

            <div style={{display:"flex",gap:3,marginBottom:20,flexWrap:"wrap"}}>
              {SECTIONS.map(s => (
                <button key={s.id} onClick={() => { setSec(s.id); setAnimK(a=>a+1); setLexWord(null); setQuizMode(false); }} style={{background:sec===s.id?"linear-gradient(135deg,rgba(176,138,78,0.15),rgba(176,138,78,0.06))":"transparent",border:"1px solid "+(sec===s.id?"rgba(176,138,78,0.35)":G.border),color:sec===s.id?G.gold:G.muted,padding:"6px 10px",borderRadius:8,cursor:"pointer",fontSize:11,transition:"all .18s"}}>{s.label}</button>
              ))}
            </div>

            <div key={wk+"-"+sec+"-"+animK} className="fu">

              {sec === "scripture" && (
                <div>
                  <label style={LBL}>Key Passages &#8212; Week {wk}</label>
                  {week.scriptures.map((s,i) => {
                    const ak = wk+"_"+i;
                    const ae = (AUTHOR_DATA[wk]||[])[i];
                    const isOpen = openAuthor === ak;
                    return (
                      <div key={i} style={{background:i===0?"linear-gradient(145deg,rgba(176,138,78,0.14),rgba(176,138,78,0.05))":"linear-gradient(145deg,rgba(176,138,78,0.07),rgba(176,138,78,0.02))",border:"1px solid rgba(176,138,78,0.3)",borderRadius:16,padding:"22px 24px",marginBottom:14,boxShadow:"0 8px 24px rgba(0,0,0,0.12)"}}>
                        <div style={{display:"flex",gap:10}}>
                          <span style={{color:G.gold,fontSize:32,lineHeight:1,opacity:.3,flexShrink:0,marginTop:0,fontFamily:"Georgia,serif"}}>&#8220;</span>
                          <div style={{flex:1}}>
                            <p style={{fontSize:19,lineHeight:1.95,color:G.cream,fontStyle:"italic",marginBottom:12,letterSpacing:"0.01em"}}>{s.text}</p>
                            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8,marginBottom:ae?8:0}}>
                              <span style={{fontSize:11,color:G.gold,fontFamily:"Cinzel,serif",fontWeight:500,letterSpacing:"0.08em",textTransform:"uppercase"}}>{s.ref}</span>
                              <div style={{display:"flex",gap:6}}>
                                {ae && <button onClick={() => setOpenAuthor(isOpen?null:ak)} style={{background:isOpen?"rgba(180,140,60,0.15)":G.goldF,border:"1px solid "+G.goldB,color:G.gold,padding:"2px 10px",borderRadius:12,cursor:"pointer",fontSize:11,fontFamily:"Cinzel,serif"}}>{isOpen?"▲ Hide":"▼ Context"}</button>}
                                <button onClick={() => startQuiz(s)} style={{background:entries.find(e=>e.field_key==="mem_"+s.ref)?"rgba(120,184,120,0.15)":G.purpleF,border:"1px solid "+(entries.find(e=>e.field_key==="mem_"+s.ref)?G.greenB:G.purpleB),color:entries.find(e=>e.field_key==="mem_"+s.ref)?G.green:G.purple,padding:"2px 10px",borderRadius:12,cursor:"pointer",fontSize:11,fontFamily:"Cinzel,serif"}}>
                                  {entries.find(e=>e.field_key==="mem_"+s.ref) ? "✓ Memorized" : "✦ Memorize"}
                                </button>
                              </div>
                            </div>
                            {isOpen && ae && (
                              <div className="sd" style={{background:"linear-gradient(145deg,rgba(176,138,78,0.07),rgba(176,138,78,0.02))",border:"1px solid rgba(176,138,78,0.18)",borderRadius:12,padding:"16px 18px",marginTop:8}}>
                                {[["Author",ae.author],["Location",ae.location],["Audience",ae.audience],["Commentary",ae.commentary]].map(([lb,val]) => (
                                  <div key={lb} style={{marginBottom:8}}>
                                    <span style={{fontSize:10,color:G.gold,fontFamily:"Cinzel,serif",letterSpacing:"0.1em",textTransform:"uppercase"}}>{lb}</span>
                                    <p style={{fontSize:14,color:G.text,lineHeight:1.65,marginTop:3}}>{val}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {EXCERPTS[wk] && (
                    <div style={{background:"linear-gradient(145deg,rgba(176,138,78,0.09),rgba(176,138,78,0.02))",border:"1px solid rgba(176,138,78,0.2)",borderRadius:14,padding:"20px 22px",marginBottom:14}}>
                      <div style={{fontSize:10,color:G.gold,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8,fontFamily:"Cinzel,serif"}}>From the Journal</div>
                      <p style={{fontSize:16,color:G.text,lineHeight:1.8,fontStyle:"italic"}}>{EXCERPTS[wk]}</p>
                    </div>
                  )}
                  {quizMode && quizVerse && (
                    <div className="sd" style={{background:G.purpleF,border:"1px solid "+G.purpleB,borderRadius:12,padding:"18px 20px",marginBottom:10}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                        <span style={{fontSize:11,color:G.purple,fontFamily:"Cinzel,serif",letterSpacing:"0.1em",textTransform:"uppercase"}}>✦ Memorization Quiz</span>
                        <button onClick={() => { setQuizMode(false); setQuizResult(null); }} style={{background:"transparent",border:"none",color:G.dim,cursor:"pointer",fontSize:16}}>&#215;</button>
                      </div>
                      <p style={{fontSize:13,color:G.muted,marginBottom:8,fontStyle:"italic"}}>{quizVerse.ref} &#8212; type the verse from memory:</p>
                      <textarea rows={3} value={quizInput} onChange={e => { setQuizInput(e.target.value); setQuizResult(null); }} placeholder="Type what you remember..." style={{...INP,marginBottom:10,fontSize:15}} />
                      {quizResult === null && <button onClick={checkQuiz} style={{background:G.purpleF,border:"1px solid "+G.purpleB,color:G.purple,padding:"8px 18px",borderRadius:8,cursor:"pointer",fontSize:13,fontFamily:"Cinzel,serif"}}>Check Answer</button>}
                      {quizResult === "pass" && <div style={{background:"rgba(120,184,120,0.1)",border:"1px solid "+G.greenB,borderRadius:8,padding:"12px 16px",color:G.green,fontSize:15}}>✓ Well done! Verse marked as memorized.</div>}
                      {quizResult === "fail" && (
                        <div>
                          <div style={{background:G.redF,border:"1px solid "+G.redB,borderRadius:8,padding:"12px 16px",color:G.red,fontSize:14,marginBottom:8}}>Keep practicing. The verse reads:</div>
                          <div style={{background:G.bgCard,border:"1px solid "+G.border,borderRadius:8,padding:"12px 16px",fontSize:15,color:G.cream,fontStyle:"italic",lineHeight:1.7}}>{quizVerse.text}</div>
                          <button onClick={() => { setQuizInput(""); setQuizResult(null); }} style={{marginTop:10,background:"transparent",border:"1px solid "+G.purpleB,color:G.purple,padding:"7px 16px",borderRadius:8,cursor:"pointer",fontSize:12,fontFamily:"Cinzel,serif"}}>Try Again</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {sec === "verseMap" && (
                <div>
                  <label style={LBL}>Verse Mapping</label>
                  <div style={{background:G.bgCard,border:"1px solid "+G.border,borderRadius:10,padding:"14px 18px",marginBottom:16}}>
                    <div style={{fontSize:10,color:G.gold,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:10,fontFamily:"Cinzel,serif"}}>Key Words &#8212; tap to explore</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                      {kwList.map(kw => {
                        const entry = LEXICON[kw];
                        const active = lexWord === kw;
                        return (
                          <button key={kw} onClick={() => setLexWord(active?null:kw)} style={{background:active?G.goldF:"rgba(255,255,255,0.04)",border:"1px solid "+(active?G.goldB:G.border),color:active?G.gold:G.text,padding:"7px 16px",borderRadius:20,cursor:entry?"pointer":"default",fontSize:15,fontFamily:"EB Garamond,Georgia,serif",fontStyle:"italic",transition:"all .25s",letterSpacing:"0.01em"}}>
                            {kw}{entry ? " ✦" : ""}
                          </button>
                        );
                      })}
                    </div>
                    {lexWord && LEXICON[lexWord] && (() => {
                      const entry = LEXICON[lexWord];
                      if (!entry) return null;
                      return (
                      <div className="sd" style={{marginTop:12,background:"linear-gradient(145deg,rgba(168,154,207,0.1),rgba(168,154,207,0.03))",border:"1px solid rgba(168,154,207,0.25)",borderRadius:14,padding:"18px 20px",boxShadow:"0 8px 24px rgba(0,0,0,0.12)"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                          <span style={{fontFamily:"Cinzel,serif",fontSize:10,color:G.purple,letterSpacing:"0.12em",textTransform:"uppercase"}}>{entry.lang || ""} &#183; {entry.strongs || ""}</span>
                          <button onClick={() => setLexWord(null)} style={{background:"transparent",border:"none",color:G.dim,cursor:"pointer",fontSize:15}}>&#215;</button>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8,flexWrap:"wrap"}}>
                          <span style={{fontSize:21,color:G.cream,fontFamily:"EB Garamond,Georgia,serif"}}>{entry.word || lexWord}</span>
                          <span style={{fontSize:14,color:G.muted,fontStyle:"italic"}}>{entry.transliteration || ""}</span>
                          <button onClick={() => speak(entry)} style={{background:speaking?"rgba(158,136,196,0.25)":G.purpleF,border:"1px solid "+G.purpleB,borderRadius:20,padding:"3px 12px",cursor:"pointer",color:G.purple,fontSize:12,transition:"all .2s"}}>
                            {speaking ? "▶ playing..." : "▶ hear"}
                          </button>
                        </div>
                        <p style={{fontSize:15,color:G.text,lineHeight:1.75}}>{entry.definition || ""}</p>
                      </div>
                      );
                    })()}
                  </div>
                  {crossRefs.length > 0 && (
                    <div style={{background:G.bgCard,border:"1px solid "+G.border,borderRadius:10,padding:"14px 18px",marginBottom:16}}>
                      <div style={{fontSize:10,color:G.muted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:12,fontFamily:"Cinzel,serif"}}>Cross References &#8212; Dig Deeper</div>
                      {crossRefs.map((s,i) => {
                        const crKey = wk + "_cr_" + i;
                        const crOpen = openCrossRef === crKey;
                        return (
                          <div key={i} style={{borderLeft:"2px solid rgba(176,138,78,0.35)",paddingLeft:14,marginBottom:i<crossRefs.length-1?18:0,paddingBottom:i<crossRefs.length-1?18:0,borderBottom:i<crossRefs.length-1?"1px solid rgba(255,255,255,0.04)":"none"}}>
                            <p style={{fontSize:16,color:G.text,lineHeight:1.8,fontStyle:"italic",marginBottom:8}}>
                              {highlightKeywords(s.text, kwList)}
                            </p>
                            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
                              <span style={{fontSize:11,color:G.gold,fontFamily:"Cinzel,serif",letterSpacing:"0.08em",textTransform:"uppercase"}}>{s.ref}</span>
                              <div style={{display:"flex",gap:6}}>
                                {s.context && <button onClick={()=>setOpenCrossRef(crOpen?null:crKey)} style={{background:"rgba(176,138,78,0.1)",border:"1px solid rgba(176,138,78,0.25)",color:G.gold,padding:"2px 10px",borderRadius:12,cursor:"pointer",fontSize:11,fontFamily:"Cinzel,serif"}}>{crOpen?"▲ Hide":"▼ Context"}</button>}
                                <button onClick={() => startQuiz(s)} style={{background:entries.find(e=>e.field_key==="mem_"+s.ref)?"rgba(124,146,132,0.15)":G.purpleF,border:"1px solid "+(entries.find(e=>e.field_key==="mem_"+s.ref)?G.greenB:G.purpleB),color:entries.find(e=>e.field_key==="mem_"+s.ref)?G.green:G.purple,padding:"2px 10px",borderRadius:12,cursor:"pointer",fontSize:11,fontFamily:"Cinzel,serif"}}>
                                  {entries.find(e=>e.field_key==="mem_"+s.ref) ? "✓ Memorized" : "✦ Memorize"}
                                </button>
                              </div>
                            </div>
                            {crOpen && s.context && (
                              <div className="sd" style={{background:"linear-gradient(145deg,rgba(176,138,78,0.06),rgba(176,138,78,0.02))",border:"1px solid rgba(176,138,78,0.15)",borderRadius:10,padding:"12px 14px",marginTop:8}}>
                                <p style={{fontSize:13,color:G.text,lineHeight:1.7,margin:0}}>{s.context}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div style={{marginBottom:18}}>
                    <label style={LBL}>Personal Reflection</label>
                    <p style={{fontSize:14,color:G.muted,fontStyle:"italic",marginBottom:10,lineHeight:1.7}}>What is God showing you through this passage? Write what stands out, convicts, or encourages you.</p>
                    <textarea rows={6} value={get("vm_pr")} onChange={e => set("vm_pr",e.target.value)} placeholder="Write your reflection here..." style={INP} />
                  </div>
                  <SaveBtn onSave={save} flash={flash} />
                </div>
              )}

              {sec === "study" && (
                <div>
                  <label style={LBL}>Study Notes</label>
                  <div style={{background:"linear-gradient(145deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))",border:"1px solid rgba(176,138,78,0.16)",borderRadius:14,padding:"22px 24px",marginBottom:20,fontSize:17,lineHeight:1.9,whiteSpace:"pre-line",color:G.text,boxShadow:"0 8px 24px rgba(0,0,0,0.1)"}}>{week.studyNotes}</div>
                  <label style={LBL}>Your Notes &amp; Insights</label>
                  <p style={{fontSize:14,color:G.muted,fontStyle:"italic",marginBottom:10,lineHeight:1.6}}>Capture what stands out, what convicts you, or what you want to carry with you this week.</p>
                  <textarea rows={7} value={get("study")} onChange={e => set("study",e.target.value)} placeholder="What is God highlighting for you in these notes?" style={INP} />
                  <SaveBtn onSave={save} flash={flash} />
                </div>
              )}

              {sec === "reflect" && (
                <div>
                  <label style={LBL}>Self Reflection</label>
                  {week.reflectionPrompts.map((pr,i) => (
                    <div key={i} style={{marginBottom:18}}>
                      <div style={{background:"linear-gradient(145deg,rgba(176,138,78,0.1),rgba(176,138,78,0.04))",border:"1px solid rgba(176,138,78,0.22)",borderRadius:12,padding:"14px 16px",marginBottom:10}}>
                        <span style={{fontSize:11,color:G.gold,fontFamily:"Cinzel,serif",letterSpacing:"0.1em",marginRight:8}}>0{i+1}</span>
                        <span style={{fontSize:16,color:G.cream,fontStyle:"italic",lineHeight:1.7}}>{pr}</span>
                      </div>
                      <textarea rows={4} value={get("rf"+i)} onChange={e => set("rf"+i,e.target.value)} placeholder="Your honest response..." style={INP} />
                    </div>
                  ))}
                  <label style={{...LBL,marginTop:12}}>Journal Notes</label>
                  <p style={{fontSize:14,color:G.muted,fontStyle:"italic",marginBottom:10,lineHeight:1.6}}>Any additional thoughts, feelings, or prayers stirred by this week&#8217;s reflection.</p>
                  <textarea rows={6} value={get("rfj")} onChange={e => set("rfj",e.target.value)} placeholder="Write freely here..." style={INP} />
                  <SaveBtn onSave={save} flash={flash} />
                </div>
              )}

              {sec === "apply" && (
                <div>
                  <label style={LBL}>Application Challenge</label>
                  <div style={{display:"grid",gap:10,marginBottom:18}}>
                    {[{c:G.gold,t:week.applicationChallenge.title,b:week.applicationChallenge.text},{c:G.green,t:week.renewalChallenge.title,b:week.renewalChallenge.text}].map((card,i) => (
                      <div key={i} style={{background:"rgba("+(card.c===G.gold?"180,140,60":"120,184,120")+",0.07)",border:"1px solid rgba("+(card.c===G.gold?"180,140,60":"120,184,120")+",0.24)",borderRadius:11,padding:"14px 16px"}}>
                        <span style={{fontSize:11,color:card.c,fontFamily:"Cinzel,serif",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:6,display:"block"}}>{card.t}</span>
                        <p style={{fontSize:15,color:G.text,lineHeight:1.65}}>{card.b}</p>
                      </div>
                    ))}
                  </div>
                  <div style={{background:"linear-gradient(145deg,rgba(176,138,78,0.08),rgba(176,138,78,0.03))",border:"1px solid rgba(176,138,78,0.2)",borderRadius:14,padding:"22px 24px",marginBottom:20,textAlign:"center"}}>
                    <div style={{fontSize:10,color:G.muted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:6,fontFamily:"Cinzel,serif"}}>Daily Confession</div>
                    <div style={{fontSize:19,color:G.cream,fontStyle:"italic",lineHeight:1.8,fontFamily:"EB Garamond,Georgia,serif",letterSpacing:"0.01em"}}>&#8220;{week.dailyConfession}&#8221;</div>
                  </div>
                  <label style={LBL}>How Will You Live This Out?</label>
                  <p style={{fontSize:14,color:G.muted,fontStyle:"italic",marginBottom:10,lineHeight:1.6}}>Faith is meant to be walked out. What is one specific way you will live this out this week?</p>
                  <textarea rows={5} value={get("apply")} onChange={e => set("apply",e.target.value)} placeholder="Write your specific plan here..." style={INP} />
                  <SaveBtn onSave={save} flash={flash} />
                </div>
              )}

              {sec === "prayer" && (
                <div>
                  <label style={LBL}>Prayer</label>
                  <div style={{background:"linear-gradient(145deg,rgba(168,154,207,0.09),rgba(168,154,207,0.04))",border:"1px solid rgba(168,154,207,0.22)",borderRadius:14,padding:"22px 24px",marginBottom:22}}>
                    <div style={{fontSize:10,color:G.purple,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:9,fontFamily:"Cinzel,serif"}}>🙏 Prayer Prompt</div>
                    <p style={{fontSize:18,color:G.cream,lineHeight:1.9,fontStyle:"italic",letterSpacing:"0.01em"}}>{week.prayerPrompt}</p>
                  </div>
                  <label style={LBL}>Write Your Own Prayer</label>
                  <p style={{fontSize:14,color:G.muted,fontStyle:"italic",marginBottom:10,lineHeight:1.6}}>Write honestly. Bring your heart before God.</p>
                  <textarea rows={10} value={get("prayer")} onChange={e => set("prayer",e.target.value)} placeholder="Speak freely to Him here..." style={{...INP,minHeight:200,lineHeight:2}} />
                  <SaveBtn onSave={save} flash={flash} />
                </div>
              )}

              {sec === "tracker" && (
                <div>
                  <label style={LBL}>Gratitude + Growth Tracker</label>
                  <p style={{fontSize:15,color:G.muted,fontStyle:"italic",marginBottom:20,lineHeight:1.7}}>{week.trackerLabel}</p>
                  {DAYS.map((d,i) => (
                    <div key={i} style={{marginBottom:12}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                        <button onClick={() => setDay(day===i?-1:i)} style={{background:day===i?G.goldF:"transparent",border:"1px solid "+(day===i?G.goldB:G.border),color:day===i?G.gold:G.muted,padding:"4px 13px",borderRadius:6,cursor:"pointer",fontSize:13,fontFamily:"Cinzel,serif",transition:"all .15s"}}>{d}</button>
                        {(get("tr_"+i)||"").trim() && <span style={{width:7,height:7,borderRadius:"50%",background:G.green,display:"inline-block"}} />}
                      </div>
                      {day === i && <textarea className="fu" rows={3} value={get("tr_"+i)} onChange={e => set("tr_"+i,e.target.value)} placeholder={d+": How did you experience gratitude, growth, or God's presence today?"} style={INP} />}
                    </div>
                  ))}
                  <SaveBtn onSave={save} flash={flash} />
                </div>
              )}

              {sec === "weekEnd" && (
                <div>
                  <label style={LBL}>End of Week Reflection</label>
                  {week.endReflections.map((q,i) => (
                    <div key={i} style={{marginBottom:16}}>
                      <div style={{background:G.bgCard,border:"1px solid "+G.border,borderRadius:9,padding:"10px 14px",marginBottom:7}}>
                        <p style={{fontSize:15,color:G.cream,fontStyle:"italic"}}>{q}</p>
                      </div>
                      <textarea rows={4} value={get("er"+i)} onChange={e => set("er"+i,e.target.value)} placeholder="Reflect honestly..." style={INP} />
                    </div>
                  ))}
                  {wk < 52 && (
                    <button onClick={() => goWk(wk+1)} style={{marginTop:16,width:"100%",background:"linear-gradient(135deg,rgba(176,138,78,0.22),rgba(176,138,78,0.08))",border:"1px solid rgba(176,138,78,0.35)",color:G.gold,padding:"16px",borderRadius:12,cursor:"pointer",fontSize:15,fontFamily:"Cinzel,serif",letterSpacing:"0.07em",boxShadow:"0 4px 16px rgba(0,0,0,0.1)"}}>
                      Begin Week {wk+1}: {ALL_WEEKS.find(w => w.week===wk+1)?.title} &#8594;
                    </button>
                  )}
                  {wk === 52 && (
                    <div style={{textAlign:"center",padding:"32px 24px",background:"linear-gradient(145deg,rgba(176,138,78,0.14),rgba(176,138,78,0.05))",border:"1px solid rgba(176,138,78,0.3)",borderRadius:16,marginTop:16,boxShadow:"0 8px 32px rgba(0,0,0,0.15)"}}>
                      <div style={{fontSize:22,marginBottom:7}}>⚓</div>
                      <div style={{fontFamily:"Cinzel,serif",fontSize:16,color:G.cream,marginBottom:5}}>You Have Finished Well</div>
                      <div style={{fontSize:13,color:G.muted,fontStyle:"italic"}}>Walk steadily. Stay anchored. Trust God with every step.</div>
                    </div>
                  )}
                  <SaveBtn onSave={save} flash={flash} />
                </div>
              )}

              {sec === "community" && (
                <div>
                  <label style={LBL}>Community Reflections &#8212; Week {wk}</label>
                  <p style={{fontSize:15,color:G.muted,fontStyle:"italic",marginBottom:20,lineHeight:1.75}}>Share one insight, takeaway, or truth God highlighted for you this week.</p>
                  <textarea rows={4} value={communityInput} onChange={e => setCommunityInput(e.target.value)} placeholder="Share what God revealed to you this week..." style={{...INP,marginBottom:10}} />
                  <button onClick={submitCommunity} style={{background:communityDone?"rgba(120,184,120,0.15)":G.goldF,border:"1px solid "+(communityDone?G.greenB:G.goldB),color:communityDone?G.green:G.gold,padding:"9px 18px",borderRadius:8,cursor:"pointer",fontSize:12,fontFamily:"Cinzel,serif",letterSpacing:"0.08em",marginBottom:24,transition:"all .3s"}}>
                    {communityDone ? "✓ Shared!" : "Share with Community"}
                  </button>
                  <label style={LBL}>From the Community</label>
                  {communityNotes().length === 0
                    ? <p style={{fontSize:14,color:G.dim,fontStyle:"italic"}}>No community notes yet. Be the first to share.</p>
                    : communityNotes().map((n,i) => (
                      <div key={i} style={{background:G.bgCard,border:"1px solid "+G.border,borderRadius:10,padding:"14px 16px",marginBottom:10}}>
                        <p style={{fontSize:15,color:G.text,lineHeight:1.7,marginBottom:6}}>{n.text}</p>
                        <span style={{fontSize:11,color:G.dim}}>{n.date}</span>
                      </div>
                    ))
                  }
                </div>
              )}

            </div>
          </div>
        )}

        {view === "contents" && (
          <div className="fi">
            <h2 style={{fontFamily:"Cinzel,serif",fontSize:20,color:G.cream,marginBottom:3}}>Table of Contents</h2>
            <p style={{fontSize:13,color:G.muted,fontStyle:"italic",marginBottom:20}}>52 weeks of faith formation. Tap any week to open it.</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(225px,1fr))",gap:8}}>
              {ALL_WEEKS.map(w => {
                const done = daysComplete(w.week);
                const cur = w.week === wk;
                return (
                  <button key={w.week} onClick={() => { goWk(w.week); setView("journal"); }} style={{background:cur?"linear-gradient(145deg,rgba(176,138,78,0.16),rgba(176,138,78,0.06))":done>0?"linear-gradient(145deg,rgba(124,146,132,0.1),rgba(124,146,132,0.03))":G.bgCard,border:"1px solid "+(cur?"rgba(176,138,78,0.4)":done>0?"rgba(124,146,132,0.3)":G.border),borderRadius:12,padding:"12px 14px",cursor:"pointer",textAlign:"left",transition:"all .25s",boxShadow:cur?"0 4px 16px rgba(0,0,0,0.1)":"none"}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                      <span style={{fontSize:9,color:cur?G.gold:"rgba(140,160,175,0.6)",fontFamily:"Cinzel,serif",letterSpacing:"0.1em"}}>WEEK {w.week}</span>
                      {done > 0 && <span style={{fontSize:9,color:G.green}}>{done}/7</span>}
                    </div>
                    <div style={{fontSize:13,color:cur?G.cream:G.text,fontWeight:500,lineHeight:1.3}}>{w.title}</div>
                    <div style={{fontSize:10,color:"rgba(140,160,175,0.65)",marginTop:2,fontStyle:"italic"}}>{w.subtitle.substring(0,42)}{w.subtitle.length>42?"...":""}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {view === "progress" && (
          <div className="fi">
            <h2 style={{fontFamily:"Cinzel,serif",fontSize:20,color:G.cream,marginBottom:3}}>Your Journey</h2>
            <p style={{fontSize:13,color:G.muted,fontStyle:"italic",marginBottom:22}}>Walk steadily. Stay anchored. Trust God with every step.</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:20}}>
              {[[weeksActive,"Weeks Active","📖"],[wk,"Current Week","⚓"],[52-wk,"Weeks Ahead","🗺️"],[streak,"Day Streak","🔥"]].map(([val,lbl,icon],i) => (
                <div key={i} style={{background:"linear-gradient(145deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))",border:"1px solid "+(i===3&&streak>0?"rgba(176,138,78,0.35)":G.border),borderRadius:14,padding:"18px 14px",textAlign:"center",boxShadow:"0 4px 16px rgba(0,0,0,0.08)"}}>
                  <div style={{fontSize:20,marginBottom:4}}>{icon}</div>
                  <div style={{fontSize:24,fontWeight:600,color:G.cream,fontFamily:"Cinzel,serif",marginBottom:2}}>{val}</div>
                  <div style={{fontSize:9,color:G.muted,letterSpacing:"0.07em",marginTop:2}}>{lbl}</div>
                </div>
              ))}
            </div>
            <div style={{background:G.bgCard,border:"1px solid "+G.border,borderRadius:12,padding:"16px",marginBottom:18}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}>
                <span style={{fontSize:10,color:G.gold,fontFamily:"Cinzel,serif",letterSpacing:"0.12em"}}>YEAR PROGRESS</span>
                <span style={{fontSize:11,color:G.muted}}>{Math.round((wk/52)*100)}%</span>
              </div>
              <div style={{background:"rgba(255,255,255,0.06)",borderRadius:5,height:7,overflow:"hidden"}}>
                <div style={{height:"100%",background:"linear-gradient(90deg,#B08A4E,#D6B97A)",width:((wk/52)*100)+"%",transition:"width .6s ease"}} />
              </div>
            </div>
            <div style={{background:G.bgCard,border:"1px solid "+G.border,borderRadius:12,padding:"16px"}}>
              <div style={{fontSize:10,color:G.gold,fontFamily:"Cinzel,serif",letterSpacing:"0.14em",marginBottom:14}}>YOUR JOURNEY MAP</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                {ALL_WEEKS.map(w => {
                  const done = daysComplete(w.week);
                  const cur = w.week === wk;
                  const pct = done/7;
                  const bg = cur?G.gold:pct===1?G.green:pct>0?"rgba(120,184,120,"+(0.25+pct*0.55)+")":"rgba(255,255,255,0.045)";
                  return (
                    <button key={w.week} onClick={() => { goWk(w.week); setView("journal"); }} title={"Week "+w.week+": "+w.title} style={{width:26,height:26,borderRadius:6,background:bg,border:"1px solid "+(cur?"rgba(176,138,78,0.8)":"transparent"),cursor:"pointer",fontSize:9,color:pct>0||cur?"#fff":G.dim,transition:"all .2s",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:cur?"0 0 8px rgba(176,138,78,0.4)":"none"}}>
                      {w.week}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {view === "export" && (
          <div className="fi">
            <h2 style={{fontFamily:"Cinzel,serif",fontSize:20,color:G.cream,marginBottom:8}}>Export Your Journal</h2>
            <p style={{fontSize:13,color:G.muted,fontStyle:"italic",lineHeight:1.6,marginBottom:22}}>Download everything you have written this year.</p>
            <div style={{background:"linear-gradient(145deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))",border:"1px solid rgba(176,138,78,0.18)",borderRadius:16,padding:"32px",textAlign:"center",boxShadow:"0 8px 24px rgba(0,0,0,0.1)"}}>
              <div style={{fontSize:32,marginBottom:12}}>📄</div>
              <div style={{fontFamily:"Cinzel,serif",fontSize:15,color:G.cream,marginBottom:8}}>Your Complete Faith Journal</div>
              <p style={{fontSize:13,color:G.muted,lineHeight:1.7,marginBottom:20}}>All study notes, reflections, prayers, and tracker entries.</p>
              <button onClick={exportNotes} style={{background:"linear-gradient(135deg,rgba(176,138,78,0.28),rgba(176,138,78,0.12))",border:"1px solid rgba(176,138,78,0.4)",color:G.gold,padding:"14px 36px",borderRadius:12,cursor:"pointer",fontSize:14,fontFamily:"Cinzel,serif",letterSpacing:"0.1em",boxShadow:"0 4px 16px rgba(0,0,0,0.1)"}}>&#8595; Download Journal (.txt)</button>
            </div>
          </div>
        )}

      </main>

      {/* Next Step floating button */}
      {view === "journal" && week && sec !== "weekEnd" && (
        <button
          onClick={() => {
            const idx = SECTIONS.findIndex(s => s.id === sec);
            const next = SECTIONS[idx + 1];
            if (next) { setSec(next.id); setAnimK(a => a+1); setLexWord(null); setQuizMode(false); }
          }}
          style={{
            position:"fixed",bottom:28,right:20,
            background:"linear-gradient(135deg,rgba(176,138,78,0.4),rgba(176,138,78,0.2))",
            border:"1px solid rgba(176,138,78,0.5)",
            color:G.gold,padding:"10px 20px",borderRadius:50,
            cursor:"pointer",fontSize:12,fontFamily:"Cinzel,serif",
            letterSpacing:"0.07em",boxShadow:"0 4px 20px rgba(0,0,0,0.35)",
            backdropFilter:"blur(10px)",zIndex:200,
            display:"flex",alignItems:"center",gap:8,
            transition:"all .2s"
          }}
        >
          {SECTIONS[SECTIONS.findIndex(s => s.id === sec)+1]?.label} &#8250;
        </button>
      )}
    </div>
  );
}
