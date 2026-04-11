import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://cvtukqamaqrhjtdvmslb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2dHVrcWFtYXFyaGp0ZHZtc2xiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4NDU1MjQsImV4cCI6MjA5MTQyMTUyNH0.gSksF5jV-UpuaUL7x7vhHHOB6Z7Qq0iehtbc2PoSAxw";
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
  bg:"#0b1825",bgCard:"rgba(255,255,255,0.032)",bgMid:"#132030",
  gold:"#c9a84c",goldL:"#e2c86a",goldF:"rgba(180,140,60,0.1)",goldB:"rgba(180,140,60,0.28)",
  green:"#78b878",greenF:"rgba(120,184,120,0.09)",greenB:"rgba(120,184,120,0.28)",
  purple:"#9e88c4",purpleF:"rgba(158,136,196,0.08)",purpleB:"rgba(158,136,196,0.22)",
  red:"#e07070",redF:"rgba(220,100,100,0.08)",redB:"rgba(220,100,100,0.25)",
  cream:"#ede3cd",text:"#d8cfc0",muted:"#7e92a2",dim:"#3e5060",border:"rgba(255,255,255,0.075)",
};

const INP_STYLE = {width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:8,color:G.cream,fontSize:16,padding:"12px 14px",outline:"none",fontFamily:"EB Garamond,Georgia,serif",marginBottom:12};
const LBL_STYLE = {fontSize:10,color:G.gold,letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:8,display:"block",fontFamily:"Cinzel,serif"};

function todayStr() { return new Date().toISOString().split("T")[0]; }

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
    <button onClick={onSave} style={{marginTop:16,background:flash?"rgba(120,184,120,0.12)":"rgba(180,140,60,0.09)",border:"1px solid "+(flash?"rgba(120,184,120,0.32)":"rgba(180,140,60,0.28)"),color:flash?G.green:G.gold,padding:"8px 18px",borderRadius:8,cursor:"pointer",fontSize:12,fontFamily:"Cinzel,serif",letterSpacing:"0.08em",transition:"all .3s"}}>
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
    background:"linear-gradient(155deg,#0b1825 0%,#132030 55%,#0b1825 100%)",
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
      redirectTo: window.location.origin,
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
        <div style={{textAlign:"center",fontSize:13,color:G.muted}}>
          <span onClick={handleReset} style={{color:G.gold,cursor:"pointer",textDecoration:"none"}}>Forgot password?</span>
          {" · "}
          <span onClick={()=>{setScreen("signup");setError("");}} style={{color:G.gold,cursor:"pointer"}}>New subscriber</span>
        </div>
        <div style={{marginTop:20,textAlign:"center",fontSize:12,color:G.dim,lineHeight:1.6}}>
          Don&#8217;t have an account?{" "}
          <a href="https://buy.stripe.com/9B69ASezO3Xo5uveIb57W00" target="_blank" rel="noreferrer" style={{color:G.gold,textDecoration:"none"}}>Subscribe &#8594;</a>
        </div>
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
        <div style={{textAlign:"center",fontSize:13,color:G.muted}}>
          Already have an account?{" "}
          <span onClick={()=>{setScreen("login");setError("");}} style={{color:G.gold,cursor:"pointer"}}>Sign in</span>
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
  const [communityInput, setCommunityInput] = useState("");
  const [communityDone, setCommunityDone] = useState(false);

  // Safety check for data loading
  if (!window.__APPDATA__) {
    return (
      <div style={{minHeight:"100vh",background:"#0b1825",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
        <div style={{fontSize:32,color:"#c9a84c"}}>&#9875;</div>
        <div style={{fontFamily:"Cinzel,serif",color:"#7e92a2",fontSize:12,letterSpacing:"0.1em"}}>Loading journal data...</div>
      </div>
    );
  }
  const ALL_WEEKS = window.__APPDATA__.ALL_WEEKS;
  const LEXICON = window.__APPDATA__.LEXICON;
  const CROSS_REFS = window.__APPDATA__.CROSS_REFS;
  const EXCERPTS = window.__APPDATA__.EXCERPTS;
  const AUTHOR_DATA = window.__APPDATA__.AUTHOR_DATA;

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
    if (prof) { setProfile(prof); setWk(prof.current_week || 1); }
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
  const INP = {width:"100%",background:"rgba(255,255,255,0.028)",border:"1px solid "+G.border,borderRadius:10,color:G.text,fontSize:16,lineHeight:1.8,padding:"14px 16px",fontFamily:"EB Garamond,Georgia,serif",outline:"none"};
  const LBL = {fontSize:10,color:G.gold,letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:8,display:"block",fontFamily:"Cinzel,serif"};
  const kwList = week ? week.keywords.split(",").map(k => k.trim()) : [];
  const crossRefs = CROSS_REFS[wk] || [];

  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(155deg,"+G.bg+" 0%,"+G.bgMid+" 55%,"+G.bg+" 100%)"}}>

      <header style={{position:"sticky",top:0,zIndex:100,background:"rgba(11,24,37,0.95)",backdropFilter:"blur(20px)",borderBottom:"1px solid "+G.goldB}}>
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
              <div style={{height:"100%",background:"linear-gradient(90deg,"+G.gold+","+G.goldL+")",width:((wk/52)*100)+"%",transition:"width .5s ease"}} />
            </div>

            <div style={{display:"flex",gap:3,marginBottom:20,flexWrap:"wrap"}}>
              {SECTIONS.map(s => (
                <button key={s.id} onClick={() => { setSec(s.id); setAnimK(a=>a+1); setLexWord(null); setQuizMode(false); }} style={{background:sec===s.id?G.goldF:"transparent",border:"1px solid "+(sec===s.id?G.goldB:G.border),color:sec===s.id?G.gold:G.muted,padding:"5px 9px",borderRadius:6,cursor:"pointer",fontSize:11,transition:"all .18s"}}>{s.label}</button>
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
                      <div key={i} style={{background:i===0?"linear-gradient(135deg,rgba(180,140,60,0.11),rgba(180,140,60,0.04))":G.bgCard,border:"1px solid "+(i===0?G.goldB:G.border),borderRadius:13,padding:"18px 20px",marginBottom:10}}>
                        <div style={{display:"flex",gap:10}}>
                          <span style={{color:G.gold,fontSize:24,lineHeight:1,opacity:.4,flexShrink:0,marginTop:3}}>&#8220;</span>
                          <div style={{flex:1}}>
                            <p style={{fontSize:17,lineHeight:1.75,color:G.cream,fontStyle:"italic",marginBottom:8}}>{s.text}</p>
                            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8,marginBottom:ae?8:0}}>
                              <span style={{fontSize:12,color:G.gold,fontFamily:"Cinzel,serif",fontWeight:500}}>{s.ref}</span>
                              <div style={{display:"flex",gap:6}}>
                                {ae && <button onClick={() => setOpenAuthor(isOpen?null:ak)} style={{background:isOpen?"rgba(180,140,60,0.15)":G.goldF,border:"1px solid "+G.goldB,color:G.gold,padding:"2px 10px",borderRadius:12,cursor:"pointer",fontSize:11,fontFamily:"Cinzel,serif"}}>{isOpen?"▲ Hide":"▼ Context"}</button>}
                                <button onClick={() => startQuiz(s)} style={{background:entries.find(e=>e.field_key==="mem_"+s.ref)?"rgba(120,184,120,0.15)":G.purpleF,border:"1px solid "+(entries.find(e=>e.field_key==="mem_"+s.ref)?G.greenB:G.purpleB),color:entries.find(e=>e.field_key==="mem_"+s.ref)?G.green:G.purple,padding:"2px 10px",borderRadius:12,cursor:"pointer",fontSize:11,fontFamily:"Cinzel,serif"}}>
                                  {entries.find(e=>e.field_key==="mem_"+s.ref) ? "✓ Memorized" : "✦ Memorize"}
                                </button>
                              </div>
                            </div>
                            {isOpen && ae && (
                              <div className="sd" style={{background:"rgba(180,140,60,0.05)",border:"1px solid rgba(180,140,60,0.15)",borderRadius:8,padding:"12px 14px",marginTop:4}}>
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
                    <div style={{background:"linear-gradient(135deg,rgba(180,140,60,0.07),rgba(180,140,60,0.02))",border:"1px solid rgba(180,140,60,0.18)",borderRadius:10,padding:"16px 18px",marginBottom:10}}>
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
                          <button key={kw} onClick={() => setLexWord(active?null:kw)} style={{background:active?G.goldF:"rgba(255,255,255,0.04)",border:"1px solid "+(active?G.goldB:G.border),color:active?G.gold:G.text,padding:"5px 14px",borderRadius:20,cursor:entry?"pointer":"default",fontSize:14,fontFamily:"EB Garamond,Georgia,serif",fontStyle:"italic",transition:"all .2s"}}>
                            {kw}{entry ? " ✦" : ""}
                          </button>
                        );
                      })}
                    </div>
                    {lexWord && LEXICON[lexWord] && (
                      <div className="sd" style={{marginTop:12,background:"linear-gradient(135deg,rgba(158,136,196,0.1),rgba(158,136,196,0.04))",border:"1px solid "+G.purpleB,borderRadius:10,padding:"14px 16px"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                          <span style={{fontFamily:"Cinzel,serif",fontSize:10,color:G.purple,letterSpacing:"0.12em",textTransform:"uppercase"}}>{LEXICON[lexWord].lang} &#183; {LEXICON[lexWord].strongs}</span>
                          <button onClick={() => setLexWord(null)} style={{background:"transparent",border:"none",color:G.dim,cursor:"pointer",fontSize:15}}>&#215;</button>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8,flexWrap:"wrap"}}>
                          <span style={{fontSize:21,color:G.cream,fontFamily:"EB Garamond,Georgia,serif"}}>{LEXICON[lexWord].word}</span>
                          <span style={{fontSize:14,color:G.muted,fontStyle:"italic"}}>{LEXICON[lexWord].transliteration}</span>
                          <button onClick={() => speak(LEXICON[lexWord])} style={{background:speaking?"rgba(158,136,196,0.25)":G.purpleF,border:"1px solid "+G.purpleB,borderRadius:20,padding:"3px 12px",cursor:"pointer",color:G.purple,fontSize:12,transition:"all .2s"}}>
                            {speaking ? "▶ playing..." : "▶ hear"}
                          </button>
                        </div>
                        <p style={{fontSize:15,color:G.text,lineHeight:1.75}}>{LEXICON[lexWord].definition}</p>
                      </div>
                    )}
                  </div>
                  {crossRefs.length > 0 && (
                    <div style={{background:G.bgCard,border:"1px solid "+G.border,borderRadius:10,padding:"14px 18px",marginBottom:16}}>
                      <div style={{fontSize:10,color:G.muted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:12,fontFamily:"Cinzel,serif"}}>Cross References &#8212; Dig Deeper</div>
                      {crossRefs.map((s,i) => (
                        <div key={i} style={{borderLeft:"2px solid "+G.goldB,paddingLeft:14,marginBottom:i<crossRefs.length-1?14:0,paddingBottom:i<crossRefs.length-1?14:0,borderBottom:i<crossRefs.length-1?"1px solid rgba(255,255,255,0.04)":"none"}}>
                          <p style={{fontSize:15,color:G.text,lineHeight:1.7,fontStyle:"italic",marginBottom:4}}>{s.text}</p>
                          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
                            <span style={{fontSize:12,color:G.gold,fontFamily:"Cinzel,serif"}}>{s.ref}</span>
                            <button onClick={() => startQuiz(s)} style={{background:entries.find(e=>e.field_key==="mem_"+s.ref)?"rgba(120,184,120,0.1)":G.purpleF,border:"1px solid "+(entries.find(e=>e.field_key==="mem_"+s.ref)?G.greenB:G.purpleB),color:entries.find(e=>e.field_key==="mem_"+s.ref)?G.green:G.purple,padding:"2px 10px",borderRadius:12,cursor:"pointer",fontSize:11,fontFamily:"Cinzel,serif"}}>
                              {entries.find(e=>e.field_key==="mem_"+s.ref) ? "✓ Memorized" : "✦ Memorize"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{marginBottom:18}}>
                    <label style={LBL}>Personal Reflection</label>
                    <p style={{fontSize:12,color:G.dim,fontStyle:"italic",marginBottom:7}}>What does this week&#8217;s Scripture mean to you personally?</p>
                    <textarea rows={6} value={get("vm_pr")} onChange={e => set("vm_pr",e.target.value)} placeholder="Write your reflection here..." style={INP} />
                  </div>
                  <SaveBtn onSave={save} flash={flash} />
                </div>
              )}

              {sec === "study" && (
                <div>
                  <label style={LBL}>Study Notes</label>
                  <div style={{background:G.bgCard,border:"1px solid "+G.border,borderRadius:12,padding:"20px",marginBottom:18,fontSize:16,lineHeight:1.85,whiteSpace:"pre-line",color:G.text}}>{week.studyNotes}</div>
                  <label style={LBL}>Your Notes &amp; Insights</label>
                  <textarea rows={7} value={get("study")} onChange={e => set("study",e.target.value)} placeholder="What stands out? What questions arise?" style={INP} />
                  <SaveBtn onSave={save} flash={flash} />
                </div>
              )}

              {sec === "reflect" && (
                <div>
                  <label style={LBL}>Self Reflection</label>
                  {week.reflectionPrompts.map((pr,i) => (
                    <div key={i} style={{marginBottom:18}}>
                      <div style={{background:G.goldF,border:"1px solid "+G.goldB,borderRadius:9,padding:"10px 14px",marginBottom:8}}>
                        <span style={{fontSize:12,color:G.gold}}>{i+1}. </span>
                        <span style={{fontSize:15,color:G.cream,fontStyle:"italic"}}>{pr}</span>
                      </div>
                      <textarea rows={4} value={get("rf"+i)} onChange={e => set("rf"+i,e.target.value)} placeholder="Your honest response..." style={INP} />
                    </div>
                  ))}
                  <label style={{...LBL,marginTop:8}}>Journal Notes</label>
                  <textarea rows={6} value={get("rfj")} onChange={e => set("rfj",e.target.value)} placeholder="Additional thoughts..." style={INP} />
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
                  <div style={{background:G.bgCard,border:"1px solid "+G.border,borderRadius:10,padding:"13px 16px",marginBottom:18,textAlign:"center"}}>
                    <div style={{fontSize:10,color:G.muted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:6,fontFamily:"Cinzel,serif"}}>Daily Confession</div>
                    <div style={{fontSize:16,color:G.cream,fontStyle:"italic",lineHeight:1.6}}>&#8220;{week.dailyConfession}&#8221;</div>
                  </div>
                  <label style={LBL}>How Will You Live This Out?</label>
                  <textarea rows={5} value={get("apply")} onChange={e => set("apply",e.target.value)} placeholder="Your specific plan..." style={INP} />
                  <SaveBtn onSave={save} flash={flash} />
                </div>
              )}

              {sec === "prayer" && (
                <div>
                  <label style={LBL}>Prayer</label>
                  <div style={{background:G.purpleF,border:"1px solid "+G.purpleB,borderRadius:12,padding:"18px 20px",marginBottom:20}}>
                    <div style={{fontSize:10,color:G.purple,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:9,fontFamily:"Cinzel,serif"}}>🙏 Prayer Prompt</div>
                    <p style={{fontSize:16,color:G.cream,lineHeight:1.8,fontStyle:"italic"}}>{week.prayerPrompt}</p>
                  </div>
                  <label style={LBL}>Write Your Own Prayer</label>
                  <textarea rows={10} value={get("prayer")} onChange={e => set("prayer",e.target.value)} placeholder="Write your personal prayer..." style={{...INP,minHeight:180}} />
                  <SaveBtn onSave={save} flash={flash} />
                </div>
              )}

              {sec === "tracker" && (
                <div>
                  <label style={LBL}>Gratitude + Growth Tracker</label>
                  <p style={{fontSize:13,color:G.muted,fontStyle:"italic",marginBottom:16}}>{week.trackerLabel}</p>
                  {DAYS.map((d,i) => (
                    <div key={i} style={{marginBottom:12}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                        <button onClick={() => setDay(day===i?-1:i)} style={{background:day===i?G.goldF:"transparent",border:"1px solid "+(day===i?G.goldB:G.border),color:day===i?G.gold:G.muted,padding:"4px 13px",borderRadius:6,cursor:"pointer",fontSize:13,fontFamily:"Cinzel,serif",transition:"all .15s"}}>{d}</button>
                        {(get("tr_"+i)||"").trim() && <span style={{width:7,height:7,borderRadius:"50%",background:G.green,display:"inline-block"}} />}
                      </div>
                      {day === i && <textarea className="fu" rows={3} value={get("tr_"+i)} onChange={e => set("tr_"+i,e.target.value)} placeholder={d+": How did you experience gratitude or growth today?"} style={INP} />}
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
                    <button onClick={() => goWk(wk+1)} style={{marginTop:12,width:"100%",background:"linear-gradient(135deg,rgba(180,140,60,0.18),rgba(180,140,60,0.07))",border:"1px solid "+G.goldB,color:G.gold,padding:"12px",borderRadius:10,cursor:"pointer",fontSize:14,fontFamily:"Cinzel,serif",letterSpacing:"0.07em"}}>
                      Begin Week {wk+1}: {ALL_WEEKS.find(w => w.week===wk+1)?.title} &#8594;
                    </button>
                  )}
                  {wk === 52 && (
                    <div style={{textAlign:"center",padding:"22px",background:G.goldF,border:"1px solid "+G.goldB,borderRadius:12,marginTop:12}}>
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
                  <p style={{fontSize:13,color:G.muted,fontStyle:"italic",marginBottom:18,lineHeight:1.6}}>Share one reflection from this week with the Anchored Steps community.</p>
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
                  <button key={w.week} onClick={() => { goWk(w.week); setView("journal"); }} style={{background:cur?"linear-gradient(135deg,rgba(180,140,60,0.14),rgba(180,140,60,0.05))":done>0?G.greenF:G.bgCard,border:"1px solid "+(cur?G.goldB:done>0?G.greenB:G.border),borderRadius:10,padding:"10px 12px",cursor:"pointer",textAlign:"left",transition:"all .2s"}}>
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
                <div key={i} style={{background:G.bgCard,border:"1px solid "+(i===3&&streak>0?G.goldB:G.border),borderRadius:12,padding:"14px",textAlign:"center"}}>
                  <div style={{fontSize:20,marginBottom:4}}>{icon}</div>
                  <div style={{fontSize:22,fontWeight:600,color:"rgba(200,185,155,0.75)",fontFamily:"Cinzel,serif"}}>{val}</div>
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
                <div style={{height:"100%",background:"linear-gradient(90deg,"+G.gold+","+G.goldL+")",width:((wk/52)*100)+"%",transition:"width .6s ease"}} />
              </div>
            </div>
            <div style={{background:G.bgCard,border:"1px solid "+G.border,borderRadius:12,padding:"16px"}}>
              <div style={{fontSize:10,color:G.gold,fontFamily:"Cinzel,serif",letterSpacing:"0.12em",marginBottom:10}}>52-WEEK MAP</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                {ALL_WEEKS.map(w => {
                  const done = daysComplete(w.week);
                  const cur = w.week === wk;
                  const pct = done/7;
                  const bg = cur?G.gold:pct===1?G.green:pct>0?"rgba(120,184,120,"+(0.25+pct*0.55)+")":"rgba(255,255,255,0.045)";
                  return (
                    <button key={w.week} onClick={() => { goWk(w.week); setView("journal"); }} title={"Week "+w.week+": "+w.title} style={{width:25,height:25,borderRadius:5,background:bg,border:"1px solid "+(cur?G.gold:"transparent"),cursor:"pointer",fontSize:9,color:pct>0||cur?"#fff":G.dim,transition:"all .15s",display:"flex",alignItems:"center",justifyContent:"center"}}>
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
            <div style={{background:G.bgCard,border:"1px solid "+G.border,borderRadius:12,padding:"24px",textAlign:"center"}}>
              <div style={{fontSize:32,marginBottom:12}}>📄</div>
              <div style={{fontFamily:"Cinzel,serif",fontSize:15,color:G.cream,marginBottom:8}}>Your Complete Faith Journal</div>
              <p style={{fontSize:13,color:G.muted,lineHeight:1.7,marginBottom:20}}>All study notes, reflections, prayers, and tracker entries.</p>
              <button onClick={exportNotes} style={{background:"linear-gradient(135deg,rgba(180,140,60,0.25),rgba(180,140,60,0.1))",border:"1px solid "+G.goldB,color:G.gold,padding:"13px 32px",borderRadius:10,cursor:"pointer",fontSize:14,fontFamily:"Cinzel,serif",letterSpacing:"0.1em"}}>&#8595; Download Journal (.txt)</button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
