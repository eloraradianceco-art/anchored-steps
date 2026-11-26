import React, { useState, useEffect, useCallback, useRef, useMemo } from "react"; // v2.3
import { createClient } from "@supabase/supabase-js";
import { speak as readAloud } from "./speech.js";
import { ShareComposer, FormatPicker, captionExcerpt } from "./shareKit.jsx";
import Onboarding from "./Onboarding.jsx";
import Reviews from "./Reviews";
import DailySteps from "./DailySteps.jsx";
import ReminderSettings from "./ReminderSettings.jsx";
import AccountPrivacy from "./AccountPrivacy.jsx";
import ScriptureCredits from "./ScriptureCredits.jsx";
import { Welcome, AuthCard, HomeScreenTip } from "./EntryScreens.jsx";
import { BRAND } from "./entryBrand.js";

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabaseConfig.js";
import { yourWeek } from "./yourWeek.js";
// Inside the combined Anchored Steps phone app the app shell sets window.ERApp before this file runs (app/src/bridge.js
// on the `capacitor` branch of the anchored-steps repo). The website never has it, so every `APP` check is false there.
const APP = typeof window !== "undefined" ? window.ERApp || null : null;
const ASSET = import.meta.env.BASE_URL;   // "/" on the website; "/year2/" inside the phone app
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, APP ? { auth: { storage: APP.authStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } } : undefined);

const Y2_CHECKOUT_KEY = "as2_checkout_session";
const Y2_JUST_PAID_KEY = "as2_just_paid";

// Stripe sends buyers back with ?paid=true&session_id=… . Keep the checkout id until the
// purchase is applied to an account (they may still need to create one), then tidy the URL.
(function rememberCheckout() {
  try {
    const q = new URLSearchParams(window.location.search);
    const s = q.get("session_id");
    if (s && /^cs_/.test(s)) localStorage.setItem(Y2_CHECKOUT_KEY, s);
    if (q.get("paid") === "true" || s) sessionStorage.setItem(Y2_JUST_PAID_KEY, "1");
    if (q.has("session_id") || q.has("paid")) {
      q.delete("session_id"); q.delete("paid");
      const rest = q.toString();
      window.history.replaceState(null, "", window.location.pathname + (rest ? "?" + rest : "") + window.location.hash);
    }
  } catch { /* storage unavailable */ }
})();

const y2JustPaid = () => { try { return sessionStorage.getItem(Y2_JUST_PAID_KEY) === "1" } catch { return false } };

// No access codes: a Year 2 purchase unlocks the account with the same email, the account
// that was signed in at checkout, or the checkout this browser just came back from.
async function claimY2Purchase() {
  let checkout = null;
  try { checkout = localStorage.getItem(Y2_CHECKOUT_KEY) } catch {}
  const { data, error } = await supabase.rpc("claim_purchase", { p_app: "as2", checkout_session: checkout });
  if (error) { console.error("claim_purchase:", error.message); return false; }
  if (data) { try { localStorage.removeItem(Y2_CHECKOUT_KEY); sessionStorage.removeItem(Y2_JUST_PAID_KEY) } catch {} }
  return !!data;
}

function y2BuyLink(base, email, userId) {
  const q = new URLSearchParams();
  if (email) q.set("prefilled_email", email);
  if (userId) q.set("client_reference_id", userId);
  const qs = q.toString();
  return base + (qs ? "?" + qs : "");
}

// Signed in, but no Year 2 purchase is linked to this account yet (e.g. they came from Year 1 or Armed & Anchored).
function Y2NoAccess({ email, userId, buyLink, onUnlocked, onSignOut }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const check = async () => {
    setBusy(true); setMsg("");
    const ok = await claimY2Purchase();
    setBusy(false);
    if (ok) onUnlocked();
    else setMsg("We don't see a Year 2, Both Years or Anchored Library purchase for " + (email || "this account") + " yet. If you just paid, give it a minute and check again.");
  };
  return <Welcome brand={BRAND} session={{ user: { email } }} buyHref={y2BuyLink(buyLink, email, userId)}
    bothHref={y2BuyLink(BOTH_LINK, email, userId)} bundleHref={y2BuyLink(LIBRARY_LINK, email, userId)}
    onCheckAgain={check} checking={busy} checkMessage={msg} onSignOut={onSignOut} />;
}

// Safari (iOS 26) colors the status-bar area and its bottom bar from the page background,
// and the phone's Reduce Transparency setting decides whether that area is see-through
// (blurred page) or solid. Keeping the page background, the header and theme-color one
// solid color makes the top of the app look the same with the setting on or off.
function paintChrome(color) {
  try {
    document.documentElement.style.backgroundColor = color;
    document.body.style.backgroundColor = color;
    let m = document.querySelector('meta[name="theme-color"]');
    if (!m) { m = document.createElement("meta"); m.setAttribute("name", "theme-color"); document.head.appendChild(m); }
    m.setAttribute("content", color);
  } catch { /* no DOM */ }
}

// ───────── Stripe Payment Links ─────────
const STRIPE_LINK = "https://buy.stripe.com/6oUfZg0IYgKa5uv43x57W0e";   // Year 2 lifetime, $39.99 (since 2026-11-25)
// Both years ($59.99): Year 1 + Year 2 in one purchase. Checkout returns to Year 1; claim_purchase opens both.
const BOTH_LINK = "https://buy.stripe.com/5kQ6oG4Ze8dE7CDgQj57W0g";
// Anchored Library ($79): Year 1 + Year 2 + Armed & Anchored in one purchase. Checkout returns to
// eloraradiance.com/library-welcome, which opens each app with the checkout id.
const LIBRARY_LINK = "https://buy.stripe.com/28EfZg0IYalM6yzeIb57W0b";

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const SECTIONS = [
  {id:"passage",    label:"📖 Passage"},
  {id:"context",    label:"🧭 Context"},
  {id:"dontmiss",   label:"⚠️ Don't Miss"},
  {id:"study",      label:"🧠 Study"},
  {id:"lexicon",    label:"📚 Lexicon"},
  {id:"reflect",    label:"💭 Reflect"},
  {id:"apply",      label:"⚒️ Apply"},
  {id:"prayer",     label:"🙏 Prayer"},
  {id:"tracker",    label:"📊 Tracker"},
  {id:"community",  label:"🌿 Community"},
];

// ───────── Complete Theme System (Dark + Light) ─────────
const DARK_THEME = {
  bg:"#0D1820",bgCard:"rgba(255,255,255,0.035)",bgMid:"#172330",
  gold:"#C9A15F",goldL:"#D6B97A",goldF:"rgba(160,120,64,0.12)",goldB:"rgba(160,120,64,0.28)",
  green:"#9DB5A6",greenF:"rgba(124,146,132,0.12)",greenB:"rgba(124,146,132,0.28)",
  purple:"#BCB0E0",purpleF:"rgba(168,154,207,0.08)",purpleB:"rgba(168,154,207,0.22)",
  red:"#E89090",redF:"rgba(217,122,122,0.08)",redB:"rgba(217,122,122,0.24)",
  cream:"#F0ECE3",text:"#E0D8CA",muted:"#BAC4CC",dim:"#92A1AD",border:"rgba(255,255,255,0.06)",borderGold:"rgba(201,161,95,0.32)",
};

const LIGHT_THEME = {
  bg:"#F0EAE0",bgCard:"rgba(0,0,0,0.04)",bgMid:"#E4DDCF",
  gold:"#7A5A28",goldL:"#A07840",goldF:"rgba(122,90,40,0.10)",goldB:"rgba(122,90,40,0.30)",
  green:"#3F5F4C",greenF:"rgba(92,114,100,0.10)",greenB:"rgba(92,114,100,0.30)",
  purple:"#4E3F8C",purpleF:"rgba(78,63,140,0.08)",purpleB:"rgba(78,63,140,0.25)",
  red:"#8E2B27",redF:"rgba(168,80,80,0.08)",redB:"rgba(168,80,80,0.25)",
  cream:"#1A1008",text:"#2C1F0E",muted:"#5A4535",dim:"#6A5545",border:"rgba(0,0,0,0.10)",borderGold:"rgba(122,90,40,0.32)",
};

const ALL_WEEKS = (typeof window !== 'undefined' && window.__APPDATA_Y2__?.ALL_WEEKS) || [];

// ───────── Error Boundary ─────────
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error('Anchored Steps Y2 crash:', error.message, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{minHeight:"100vh",background:DARK_THEME.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
          <div style={{maxWidth:380,textAlign:"center"}}>
            <img src={ASSET+"icon2.png"} alt="⚓" style={{width:50,height:50,borderRadius:12,marginBottom:16,opacity:.6}}/>
            <div style={{fontFamily:"Cinzel,serif",fontSize:14,color:DARK_THEME.gold,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:12}}>Something went wrong</div>
            <p style={{fontSize:16,color:DARK_THEME.muted,marginBottom:20,lineHeight:1.7}}>The page hit an unexpected error. Reload to try again.</p>
            <button onClick={()=>window.location.reload()} style={{background:"rgba(160,120,64,0.18)",border:"1px solid rgba(160,120,64,0.4)",color:DARK_THEME.gold,padding:"12px 28px",borderRadius:10,cursor:"pointer",fontSize:12,fontFamily:"Cinzel,serif",letterSpacing:"0.08em"}}>Reload</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ───────── Reusable Components ─────────
function SaveBtn({onSave,flash,T}){
  return (
    <button onClick={onSave} style={{marginTop:12,width:"100%",background:flash?T.greenF:T.goldF,border:"1px solid "+(flash?T.greenB:T.goldB),color:flash?T.green:T.gold,padding:"11px",borderRadius:10,cursor:"pointer",fontSize:12,fontFamily:"Cinzel,serif",letterSpacing:"0.08em",transition:"all .3s"}}>
      {flash ? "✓ Saved" : "Save Notes"}
    </button>
  );
}

function CopyBtn({text, label="Copy", T, style={}}){
  const [copied,setCopied]=React.useState(false);
  const handle=()=>{ navigator.clipboard.writeText(text||'').then(()=>{ setCopied(true); setTimeout(()=>setCopied(false),1800); }); };
  return (
    <button onClick={handle} style={{background:copied?T.greenF:"transparent",border:"1px solid "+(copied?T.greenB:T.border),color:copied?T.green:T.muted,padding:"5px 12px",borderRadius:8,cursor:"pointer",fontSize:11,fontFamily:"Cinzel,serif",letterSpacing:"0.06em",transition:"all .2s",...style}}>
      {copied?"✓ Copied":label}
    </button>
  );
}

function MemorizeModal({verse,onClose,onPass,T}){
  const [mode,setMode]=useState(null);
  const [revealed,setRevealed]=useState(false);
  const [typed,setTyped]=useState('');
  const [score,setScore]=useState(null);
  const verseText = verse.text||verse.verseText||'';
  const verseRef = verse.ref||verse.verseRef||'';
  const words=verseText.split(' ');
  const blankedWords=words.map((w,i)=>(i+1)%3===0?'___':w);
  const markMemo=()=>{onPass();onClose();};
  const checkScore=()=>{
    const norm=s=>s.toLowerCase().replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim();
    const tw=norm(typed).split(' ').filter(Boolean);
    const ow=norm(verseText).split(' ').filter(Boolean);
    const pct=ow.length?Math.round(tw.filter(w=>ow.includes(w)).length/ow.length*100):0;
    setScore(pct);
    if(pct>=70)onPass();
  };
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",padding:"calc(16px + var(--safe-top, env(safe-area-inset-top, 0px))) 16px calc(16px + env(safe-area-inset-bottom, 0px))",overflowY:"auto"}} onClick={()=>{if(!mode)onClose();}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"linear-gradient(145deg,"+T.bg+","+T.bgMid+")",border:"1px solid "+T.goldB,borderRadius:20,padding:24,maxWidth:420,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,0.6)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div style={{fontSize:11,color:T.gold,fontFamily:"Cinzel,serif",letterSpacing:"0.16em",textTransform:"uppercase"}}>{mode?"← ":""}✦ Memorize</div>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:T.muted,cursor:"pointer",fontSize:20,lineHeight:1}}>×</button>
        </div>
        <div style={{fontSize:14,color:T.gold,fontFamily:"Cinzel,serif",letterSpacing:"0.1em",marginBottom:16,paddingBottom:14,borderBottom:"1px solid "+T.goldB,textAlign:"center"}}>{verseRef}</div>
        {!mode?(
          <div>
            <p style={{fontSize:16,color:T.muted,textAlign:"center",marginBottom:16,fontStyle:"italic",lineHeight:1.6}}>Choose your memorization method:</p>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {[{id:"recall",icon:"🧠",title:"Read & Recall",desc:"See the reference, recite aloud, then reveal to check"},{id:"blanks",icon:"✏️",title:"Fill the Gaps",desc:"Read the verse with every 3rd word blanked out"},{id:"type",icon:"⌨️",title:"Write it Out",desc:"Type the verse from memory and get a score"}].map(m=>(
                <button key={m.id} onClick={()=>{setMode(m.id);setRevealed(false);setTyped('');setScore(null);}} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 16px",borderRadius:12,cursor:"pointer",textAlign:"left",background:T.goldF,border:"1px solid "+T.goldB,transition:"all .2s"}}>
                  <span style={{fontSize:22,flexShrink:0}}>{m.icon}</span>
                  <span>
                    <span style={{display:"block",fontSize:13,color:T.cream,fontFamily:"Cinzel,serif",letterSpacing:"0.06em",marginBottom:2}}>{m.title}</span>
                    <span style={{display:"block",fontSize:15,color:T.muted,fontStyle:"italic"}}>{m.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ):mode==='recall'?(
          <div>
            {!revealed?(
              <div style={{textAlign:"center"}}>
                <p style={{fontSize:16,color:T.muted,fontStyle:"italic",marginBottom:20,lineHeight:1.7}}>Say the verse aloud from memory, then reveal to check yourself.</p>
                <button onClick={()=>setRevealed(true)} style={{background:T.goldF,border:"1px solid "+T.goldB,color:T.gold,padding:"12px 28px",borderRadius:50,cursor:"pointer",fontSize:12,fontFamily:"Cinzel,serif",letterSpacing:"0.08em"}}>Reveal Verse</button>
              </div>
            ):(
              <div>
                <p style={{fontSize:17,color:T.cream,fontStyle:"italic",lineHeight:1.85,marginBottom:20,textAlign:"center"}}>"{verseText}"</p>
                <button onClick={markMemo} style={{width:"100%",background:"rgba(124,146,132,0.15)",border:"1px solid rgba(124,146,132,0.4)",color:T.green,padding:"13px",borderRadius:12,cursor:"pointer",fontSize:13,fontFamily:"Cinzel,serif",letterSpacing:"0.08em",marginBottom:10}}>✓ I've Got It — Mark Memorized</button>
                <button onClick={()=>setRevealed(false)} style={{width:"100%",background:"transparent",border:"none",color:T.muted,cursor:"pointer",fontSize:16,fontFamily:"EB Garamond,Georgia,serif"}}>Try Again</button>
              </div>
            )}
          </div>
        ):mode==='blanks'?(
          <div>
            <p style={{fontSize:16,color:T.muted,fontStyle:"italic",marginBottom:14,lineHeight:1.6,textAlign:"center"}}>Read aloud, filling in the blanked words from memory.</p>
            <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid "+T.border,borderRadius:12,padding:"16px",marginBottom:16}}>
              <p style={{fontSize:17,color:T.cream,fontStyle:"italic",lineHeight:2.1,margin:0}}>
                {blankedWords.map((w,i)=>(
                  <span key={i} style={{color:w==='___'?T.gold:T.cream,borderBottom:w==='___'?"1px solid "+T.gold:undefined,padding:w==='___'?"0 4px":undefined,letterSpacing:w==='___'?"0.1em":undefined}}>{w}{i<blankedWords.length-1?" ":""}</span>
                ))}
              </p>
            </div>
            {!revealed?(
              <button onClick={()=>setRevealed(true)} style={{width:"100%",background:T.goldF,border:"1px solid "+T.goldB,color:T.gold,padding:"12px",borderRadius:12,cursor:"pointer",fontSize:12,fontFamily:"Cinzel,serif",letterSpacing:"0.08em",marginBottom:10}}>Reveal Missing Words</button>
            ):(
              <div style={{background:"rgba(124,146,132,0.08)",border:"1px solid rgba(124,146,132,0.25)",borderRadius:10,padding:"12px 14px",marginBottom:12}}>
                <p style={{fontSize:16,color:T.text,fontStyle:"italic",lineHeight:1.8,margin:0}}>
                  {words.map((w,i)=>(
                    <span key={i} style={{color:(i+1)%3===0?T.green:T.text,fontWeight:(i+1)%3===0?600:400}}>{w}{i<words.length-1?" ":""}</span>
                  ))}
                </p>
              </div>
            )}
            <button onClick={markMemo} style={{width:"100%",background:"rgba(124,146,132,0.15)",border:"1px solid rgba(124,146,132,0.4)",color:T.green,padding:"12px",borderRadius:12,cursor:"pointer",fontSize:12,fontFamily:"Cinzel,serif",letterSpacing:"0.08em"}}>✓ Mark as Memorized</button>
          </div>
        ):(
          <div>
            <p style={{fontSize:16,color:T.muted,fontStyle:"italic",marginBottom:12,lineHeight:1.6,textAlign:"center"}}>Type the verse from memory, then check your score.</p>
            {score===null?(
              <div>
                <textarea rows={5} value={typed} onChange={e=>setTyped(e.target.value)} placeholder="Type the verse here from memory..." style={{width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid "+T.border,borderRadius:10,color:T.cream,fontSize:16,padding:"12px",fontFamily:"EB Garamond,Georgia,serif",outline:"none",resize:"none",boxSizing:"border-box",marginBottom:10,lineHeight:1.7}}/>
                <button onClick={checkScore} disabled={!typed.trim()} style={{width:"100%",background:T.goldF,border:"1px solid "+T.goldB,color:T.gold,padding:"12px",borderRadius:12,cursor:"pointer",fontSize:12,fontFamily:"Cinzel,serif",letterSpacing:"0.08em",opacity:typed.trim()?1:0.4}}>Check My Score</button>
              </div>
            ):(
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:48,fontWeight:700,color:score>=80?T.green:score>=50?T.gold:T.red,fontFamily:"Cinzel,serif",marginBottom:4}}>{score}%</div>
                <div style={{fontSize:16,color:T.muted,marginBottom:16}}>{score>=90?"Nearly perfect!":score>=70?"Great progress!":score>=50?"Good start!":"Keep practicing!"}</div>
                <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid "+T.border,borderRadius:10,padding:"12px",marginBottom:14,textAlign:"left"}}>
                  <p style={{fontSize:16,color:T.text,fontStyle:"italic",lineHeight:1.8,margin:0}}>"{verseText}"</p>
                </div>
                {score>=70&&<button onClick={markMemo} style={{width:"100%",background:"rgba(124,146,132,0.15)",border:"1px solid rgba(124,146,132,0.4)",color:T.green,padding:"12px",borderRadius:12,cursor:"pointer",fontSize:12,fontFamily:"Cinzel,serif",letterSpacing:"0.08em",marginBottom:10}}>✓ Mark as Memorized</button>}
                <button onClick={()=>{setTyped('');setScore(null);}} style={{width:"100%",background:"transparent",border:"none",color:T.muted,cursor:"pointer",fontSize:16,fontFamily:"EB Garamond,Georgia,serif"}}>Try Again</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ContextModal({ae,onClose,T}){
  if(!ae) return null;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.78)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:"calc(24px + var(--safe-top, env(safe-area-inset-top, 0px))) 24px calc(24px + env(safe-area-inset-bottom, 0px))"}} onClick={onClose}>
      <div style={{background:"linear-gradient(145deg,"+T.bg+","+T.bgMid+")",border:"1px solid "+T.goldB,borderRadius:20,padding:28,maxWidth:420,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,0.5)",maxHeight:"85vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontSize:11,color:T.gold,fontFamily:"Cinzel,serif",letterSpacing:"0.14em",textTransform:"uppercase"}}>Scripture Context</div>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:T.muted,cursor:"pointer",fontSize:20,lineHeight:1}}>&#215;</button>
        </div>
        {ae.ref&&<div style={{background:T.goldF,border:"1px solid "+T.goldB,borderRadius:10,padding:"10px 14px",marginBottom:20}}>
          <span style={{fontSize:11,color:T.gold,fontFamily:"Cinzel,serif",letterSpacing:"0.08em",textTransform:"uppercase"}}>{ae.ref}</span>
        </div>}
        {[["Author",ae.author],["Location",ae.location],["Audience",ae.audience],["Commentary",ae.commentary]].map(([lb,val])=>val?(
          <div key={lb} style={{marginBottom:16,paddingBottom:16,borderBottom:"1px solid "+T.border}}>
            <div style={{fontSize:11,color:T.gold,fontFamily:"Cinzel,serif",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:7}}>{lb}</div>
            <p style={{fontSize:16,color:T.text,lineHeight:1.85,margin:0}}>{val}</p>
          </div>
        ):null)}
        <button onClick={onClose} style={{width:"100%",marginTop:4,background:"transparent",border:"1px solid "+T.border,color:T.muted,padding:"11px",borderRadius:8,cursor:"pointer",fontSize:16,fontFamily:"EB Garamond,Georgia,serif"}}>Close</button>
      </div>
    </div>
  );
}

// ───────── Main App ─────────
// Bottom tab bar height; the phone's home-indicator inset is added where it's used
const TAB_BAR_H = 60;
const BELOW_BAR = `calc(${TAB_BAR_H}px + env(safe-area-inset-bottom, 0px))`;

function AnchoredStepsY2Inner(){
  const [session,setSession]=useState(null);
  const [loading,setLoading]=useState(true);
  const [email,setEmail]=useState('');
  const [pw,setPw]=useState('');
  const [showPw,setShowPw]=useState(false)
  const [authErr,setAuthErr]=useState('');
  const [authMode,setAuthMode]=useState(()=>y2JustPaid()?'signup':'login');
  const [justSignedUp,setJustSignedUp]=useState(false);
  const [searchQuery,setSearchQuery]=useState('');
  const [searchResults,setSearchResults]=useState([]);
  const [resetMode,setResetMode]=useState(false);
  const [resetSent,setResetSent]=useState(false);
  // Signed out: the welcome page first, the sign-in card after "Sign in" (straight there after checkout)
  const [entry,setEntry]=useState(()=>y2JustPaid()?'auth':'welcome');
  const [authBusy,setAuthBusy]=useState(false);

  // Restore last visited week
  // The app opens on YOUR week: the one you're working through on the Steps page (see yourWeek.js), not the last
  // week you happened to browse. Until any step is done there is no "your week", so it opens where you left off.
  const [wk,setWk]=useState(()=>{
    try { return Number(localStorage.getItem('y2_my_week')) || Number(localStorage.getItem('y2_last_week')) || 1; } catch { return 1; }
  });
  const myWeekRef=useRef((()=>{ try { return Number(localStorage.getItem('y2_my_week')) || 0; } catch { return 0; } })());
  const [stepsLoaded,setStepsLoaded]=useState(false); // step progress for the whole year has arrived
  const stepsBusyRef=useRef(false);                   // a step is open on the Steps page
  // Week sync with the account (fixed 2026-11-17: Next used to jump back a week).
  // The account's week is read ONCE per sign-in. After that this device is the one moving, so it only saves.
  const wkRef=useRef(wk); wkRef.current=wk;
  const weekMovedRef=useRef(false);   // the reader changed weeks here since the app opened
  const savedWeekRef=useRef(null);    // the week the account holds (null = not read yet, so nothing is saved over it)
  const darkLoadedRef=useRef(false);  // same idea for dark mode: don't save over the account's setting before reading it
  const myWeekSettledRef=useRef(false); // the opening week has been chosen for this sign-in
  const [profileTick,setProfileTick]=useState(0); // bump to read the profile again (after "I've Paid · Check Again")
  const [sec,setSec]=useState('passage');
  const [entries,setEntries]=useState([]);
  const [flash,setFlash]=useState(false);
  const [saveStatus,setSaveStatus]=useState('idle'); // 'idle'|'saving'|'saved'
  const [showWeekJump,setShowWeekJump]=useState(false);
  const [darkMode,setDarkMode]=useState(()=>{
    try { return localStorage.getItem('y2_dark_mode') !== '0'; } catch { return true; }
  });
  const [view,setView]=useState('steps');
  const viewRef=useRef(view); viewRef.current=view;
  const [animK,setAnimK]=useState(0);
  const [quizVerse,setQuizVerse]=useState(null);
  const [shareVerse,setShareVerse]=useState(null);
  const [shareCardType,setShareCardType]=useState('passage')
  const [shareCardLight,setShareCardLight]=useState(false)
  const [captionCopied,setCaptionCopied]=useState(false)
  const [shareFormat,setShareFormat]=useState('post')
  const [textCopied,setTextCopied]=useState(false)
  const [bookmarks,setBookmarks]=useState(()=>{try{return JSON.parse(localStorage.getItem('y2_bookmarks')||'[]')}catch{return []}});
  const [showSettings,setShowSettings]=useState(false);
    const [showOnboarding,setShowOnboarding]=useState(()=>{
    try { return !localStorage.getItem('y2_onboarding_complete'); } catch { return false; }
  });
  const [profile,setProfile]=useState(null);
  const [access,setAccess]=useState('checking'); // 'checking' | 'yes' | 'no' — is Year 2 unlocked on this account
  const [day,setDay]=useState(-1);
  const [communityInput,setCommunityInput]=useState('');
  const [communityDone,setCommunityDone]=useState(false);
  const [communityNotes,setCommunityNotes]=useState([]);
  const [showSignOutConfirm,setShowSignOutConfirm]=useState(false);
  const [speaking,setSpeaking]=useState(false);
  // Word Study pronunciation (read-aloud fixes live in speech.js)
  const speak = entry => {
    let text = entry.transliteration || "";
    if (!text && entry.original) {
      const m = entry.original.match(/\(([^)]+)\)/);
      text = m ? m[1].trim() : entry.original;
    }
    if (!text) return;
    readAloud(text, { rate: 0.72, onStart: () => setSpeaking(true), onEnd: () => setSpeaking(false), onError: () => setSpeaking(false) });
  };

  // Debounce timer ref for saves
  const saveTimerRef = useRef({});
  const pendingSavesRef = useRef({});
  const saveStatusTimerRef = useRef(null);

  // Active theme
  const T = darkMode ? DARK_THEME : LIGHT_THEME;
  // The unlock screen is always dark; everything else follows the theme.
  const chromeColor = (darkMode || access === 'no') ? "#0D1820" : "#F0EAE0";
  useEffect(() => { paintChrome(chromeColor); }, [chromeColor]);
  useEffect(() => { if (APP?.statusBar) APP.statusBar(!darkMode); }, [darkMode]);

  const week = useMemo(() => ALL_WEEKS.find(w=>w.week===wk), [wk]);

  const LBL = {fontSize:11,color:T.gold,fontFamily:"Cinzel,serif",letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:12,display:"block"};
  const INP = {width:"100%",background:darkMode?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.04)",border:"1px solid "+T.border,borderRadius:10,padding:"12px 14px",color:T.text,fontSize:16,fontFamily:"EB Garamond,Georgia,serif",resize:"vertical",boxSizing:"border-box",outline:"none",lineHeight:1.7};

  const uid = session?.user?.id || null;
  // Save the week to the account, but only once the account's own week is known and only when it differs
  const saveWeek = useCallback((n)=>{
    if (!uid || savedWeekRef.current === null || savedWeekRef.current === n) return;
    savedWeekRef.current = n;
    supabase.from('as2_profiles').update({ current_week: n }).eq('user_id', uid)
      .then(({ error }) => { if (error) { console.warn('week sync:', error.message); if (savedWeekRef.current === n) savedWeekRef.current = -1; } });
  }, [uid]);

  // Persist last visited week
  useEffect(()=>{
    try { localStorage.setItem('y2_last_week', String(wk)); } catch {}
    saveWeek(wk);
  }, [wk, saveWeek]);

  // Persist dark mode preference
  useEffect(()=>{
    try { localStorage.setItem('y2_dark_mode', darkMode ? '1' : '0'); } catch {}
    if (uid && darkLoadedRef.current) {
      supabase.from('as2_profiles').update({ dark_mode: darkMode }).eq('user_id', uid)
        .then(({ error }) => { if (error) console.warn('dark sync:', error.message) });
    }
  }, [darkMode, uid]);

  // Auth session management
  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{setSession(session);setLoading(false);});
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_,s)=>{setSession(s);setLoading(false);if(!s)setAccess('checking');});
    return ()=>subscription.unsubscribe();
  },[]);

  // Phone app: signing in and buying happen on the app's front page, so a signed-out or locked year goes back there.
  useEffect(()=>{ if(APP && !loading && (!session || access==='no')) APP.home("as2"); },[loading,session,access]);

  // Load the profile once per sign-in. (It used to re-run on every week change and every session refresh, and each
  // run put the account's saved week back on screen: tap Next, and a read that beat the save sent you back a week.)
  useEffect(()=>{
    savedWeekRef.current = null; darkLoadedRef.current = false; weekMovedRef.current = false;
    if(!uid) return;
    let cancelled = false;

    const fetchProfile = () => supabase.from('as2_profiles').select('*').eq('user_id',uid).maybeSingle();
    (async () => {
      let { data, error } = await fetchProfile();
      // An as2_profiles row means Year 2 is unlocked. Otherwise apply a matching purchase.
      // Right after checkout Stripe's notice can take a few seconds, so keep trying briefly.
      if (!data && !error) {
        const tries = y2JustPaid() ? 8 : 1;
        for (let i = 0; i < tries && !cancelled; i++) {
          if (await claimY2Purchase()) break;
          if (i < tries - 1) await new Promise(r => setTimeout(r, 2000));
        }
        ({ data, error } = await fetchProfile());
      }
      return { data, error };
    })().then(({data, error})=>{
      if(cancelled) return;
      setAccess(data ? 'yes' : (error ? 'yes' : 'no'));
      if(!data) return;
      setProfile(data);
      // Cross-device sync hydration
      if (Array.isArray(data.bookmarks) && data.bookmarks.length > 0) {
        setBookmarks(data.bookmarks);
        try { localStorage.setItem('y2_bookmarks', JSON.stringify(data.bookmarks)) } catch {}
      }
      if (typeof data.dark_mode === 'boolean') {
        setDarkMode(data.dark_mode);
        try { localStorage.setItem('y2_dark_mode', data.dark_mode ? '1' : '0') } catch {}
      }
      darkLoadedRef.current = true;
      // The week: pick up where the account left off (another device may be further along), unless the reader
      // has already moved on this device while this was loading. Then this device's week is the newer one.
      const accountWeek = typeof data.current_week === 'number' && data.current_week > 0 ? data.current_week : 0;
      savedWeekRef.current = accountWeek;
      if (accountWeek && !weekMovedRef.current && !myWeekRef.current) {
        setWk(accountWeek);
        try { localStorage.setItem('y2_last_week', String(accountWeek)) } catch {}
      } else {
        saveWeek(wkRef.current);
      }
      if (data.onboarded) {
        try { localStorage.setItem('y2_onboarding_complete', '1') } catch {}
        setShowOnboarding(false);
      }
    });
    return () => { cancelled = true; };
  },[uid, saveWeek, profileTick]);

  // Entries for the week on screen (± 5 weeks), reloaded as the reader moves
  useEffect(()=>{
    if(!uid) return;
    let cancelled = false;

    // Load entries for current week ± 5 weeks (smarter than loading all 1500+)
    const minWeek = Math.max(1, wk - 5);
    const maxWeek = Math.min(52, wk + 5);
    supabase.from('as2_journal_entries')
      .select('*')
      .eq('user_id', uid)
      .gte('week', minWeek)
      .lte('week', maxWeek)
      .then(({data})=>{
        // Merge, so step progress and tracker rows loaded in parallel aren't dropped
        if(!cancelled && data) setEntries(prev => {
          const ids = new Set(data.map(d => d.id));
          return [...data, ...prev.filter(e => !ids.has(e.id) && e.user_id === uid)];
        });
      });
    return () => { cancelled = true; };
  },[uid, wk]);

  // Whole-year progress and live updates from other devices: once per sign-in
  useEffect(()=>{
    setStepsLoaded(false);
    if(!uid) return;
    let cancelled = false;

    // Step progress across all weeks (Steps year strip and streak)
    supabase.from('as2_journal_entries')
      .select('id, week, field_key, field_value, user_id')
      .eq('user_id', uid)
      .like('field_key', 'ds_%')
      .then(({data})=>{
        if(!cancelled && data) {
          setEntries(prev => {
            const existing = new Set(prev.map(e => e.id));
            return [...prev, ...data.filter(d => !existing.has(d.id))];
          });
          setStepsLoaded(true);
        }
      });

    // Also load just field_key='tr_*' across all weeks for progress stats
    supabase.from('as2_journal_entries')
      .select('id, week, field_key, field_value, user_id')
      .eq('user_id', uid)
      .like('field_key', 'tr_%')
      .then(({data})=>{
        if(!cancelled && data) {
          setEntries(prev => {
            const existing = new Set(prev.map(e => e.id));
            const newOnes = data.filter(d => !existing.has(d.id));
            return [...prev, ...newOnes];
          });
        }
      });

    // Realtime subscription for entries — sync across devices
    const channel = supabase
      .channel('y2_entries_'+uid)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'as2_journal_entries',
        filter: `user_id=eq.${uid}`,
      }, payload => {
        if(cancelled) return;
        const row = payload.new || payload.old;
        if(!row) return;
        if(payload.eventType === 'DELETE') {
          setEntries(prev => prev.filter(e => e.id !== row.id));
        } else if(payload.eventType === 'UPDATE') {
          setEntries(prev => prev.map(e => e.id === row.id ? row : e));
        } else if(payload.eventType === 'INSERT') {
          setEntries(prev => {
            if(prev.some(e => e.id === row.id)) return prev;
            return [...prev, row];
          });
        }
      })
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  },[uid]);

  // Your week, from step progress across the year (0 until that progress has loaded, or if no step is done yet)
  const myWeek = useMemo(() => (stepsLoaded ? yourWeek(entries.filter(e => e.user_id === uid), 52) : 0), [entries, stepsLoaded, uid]);
  useEffect(()=>{
    if (!stepsLoaded) return;
    myWeekRef.current = myWeek;
    try { if (myWeek) localStorage.setItem('y2_my_week', String(myWeek)); else localStorage.removeItem('y2_my_week'); } catch {}
    // On opening the app: go to your week (or, with no steps done yet, to where the account left off)
    if (!myWeekSettledRef.current) {
      myWeekSettledRef.current = true;
      if (!weekMovedRef.current) {
        if (myWeek) setWk(myWeek);
        else if (savedWeekRef.current > 0) setWk(savedWeekRef.current);
      }
    }
  }, [myWeek, stepsLoaded]);
  useEffect(()=>{ myWeekSettledRef.current = false; }, [uid]);

  // Coming back to the app counts as opening it: from the Home Screen icon the app usually resumes where it was,
  // so if you were only browsing other weeks on the Steps page, it returns to your week. Never while a step is open
  // or you are in the journal. In a browser tab this waits 5 minutes away, so flipping between tabs doesn't move you.
  useEffect(()=>{
    let hiddenAt = 0;
    const standalone = () => { try { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; } catch { return false; } };
    const onVis = () => {
      if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
      if (!hiddenAt) return;
      const away = Date.now() - hiddenAt; hiddenAt = 0;
      if (away < (standalone() ? 1500 : 5 * 60 * 1000)) return;
      if (viewRef.current !== 'steps' || stepsBusyRef.current || !myWeekRef.current || wkRef.current === myWeekRef.current) return;
      setWk(myWeekRef.current); setDay(-1); window.scrollTo(0,0);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Load community notes for current week
  useEffect(()=>{
    if(!session) return;
    supabase.from('community_notes_y2')
      .select('*')
      .eq('week', wk)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({data, error})=>{
        if(!error && data) setCommunityNotes(data);
      });
  }, [session, wk]);

  const get=useCallback((key)=>{
    const e=entries.find(e=>e.week===wk&&e.field_key===key);
    return e?.field_value||'';
  },[entries,wk]);

  // Debounced set — collects rapid changes, writes once per 600ms per key
  const set=useCallback((key,val)=>{
    if(!session) return;
    const fullKey = `${wk}_${key}`;
    pendingSavesRef.current[fullKey] = val;

    // Optimistically update local state immediately
    setEntries(prev => {
      const existing = prev.find(e => e.week===wk && e.field_key===key);
      if(existing) {
        return prev.map(e => e.id === existing.id ? {...e, field_value: val} : e);
      } else {
        return [...prev, { id: 'temp_'+fullKey, week: wk, field_key: key, field_value: val, user_id: session.user.id, _temp: true }];
      }
    });

    // Show saving indicator
    setSaveStatus('saving');
    if(saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);

    // Debounce Supabase write
    if(saveTimerRef.current[fullKey]) clearTimeout(saveTimerRef.current[fullKey]);
    saveTimerRef.current[fullKey] = setTimeout(async () => {
      const valueToSave = pendingSavesRef.current[fullKey];
      delete pendingSavesRef.current[fullKey];
      delete saveTimerRef.current[fullKey];

      // Find existing real row
      const existing = entries.find(e => e.week===wk && e.field_key===key && !e._temp);
      if(existing) {
        await supabase.from('as2_journal_entries').update({field_value:valueToSave}).eq('id',existing.id);
      } else {
        const {data} = await supabase.from('as2_journal_entries')
          .insert({user_id:session.user.id, week:wk, field_key:key, field_value:valueToSave})
          .select().single();
        if(data) {
          setEntries(prev => prev.map(e => e.id === 'temp_'+fullKey ? data : e));
        }
      }
      setSaveStatus('saved');
      if(saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
      saveStatusTimerRef.current = setTimeout(()=>setSaveStatus('idle'), 2200);
    }, 600);
  },[entries,wk,session]);

  // Save button — flushes pending saves and shows feedback
  const save=useCallback(async()=>{
    // Force-flush any pending debounced saves
    for(const key in saveTimerRef.current) {
      clearTimeout(saveTimerRef.current[key]);
    }
    const pending = {...pendingSavesRef.current};
    pendingSavesRef.current = {};
    saveTimerRef.current = {};

    for(const fullKey in pending) {
      const [wkStr, ...keyParts] = fullKey.split('_');
      const wkNum = Number(wkStr);
      const key = keyParts.join('_');
      const val = pending[fullKey];
      const existing = entries.find(e => e.week===wkNum && e.field_key===key && !e._temp);
      if(existing) {
        await supabase.from('as2_journal_entries').update({field_value:val}).eq('id',existing.id);
      } else if(session) {
        await supabase.from('as2_journal_entries').insert({user_id:session.user.id, week:wkNum, field_key:key, field_value:val});
      }
    }

    setFlash(true);
    setSaveStatus('saved');
    if(saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
    saveStatusTimerRef.current = setTimeout(()=>{setFlash(false);setSaveStatus('idle');}, 2200);
  },[entries, session]);

  const goWk=useCallback((n)=>{
    weekMovedRef.current = true;
    setWk(Math.max(1,Math.min(52,n)));
    setSec('passage');
    setAnimK(a=>a+1);
    setDay(-1);
    setShowWeekJump(false);
    window.scrollTo(0,0);
  },[]);

  const toggleBookmark=(verse,weekNum,secId)=>{
    const key=`${verse.verseKey||verse.verseRef||verse.ref}_${weekNum}`;
    const exists=bookmarks.find(b=>b.key===key);
    const updated=exists?bookmarks.filter(b=>b.key!==key):[...bookmarks,{key,ref:verse.verseRef||verse.ref,text:verse.verseText||verse.text,week:weekNum,section:secId}];
    setBookmarks(updated);
    try { localStorage.setItem('y2_bookmarks',JSON.stringify(updated)); } catch {}
    // Also sync bookmarks to Supabase profile
    if(session) {
      // .then() sends it: an unawaited Supabase query never runs
      supabase.from('as2_profiles').update({bookmarks: updated}).eq('user_id', session.user.id)
        .then(({error})=>{ if(error) console.warn('bookmarks sync:', error.message); });
    }
  };

  const isBookmarked=(ref,weekNum)=>bookmarks.some(b=>b.key===`${ref}_${weekNum}`);
  // A week's progress (0-7): the Daily Steps done, or the older daily tracker if that's further along.
  const trackerDays=n=>entries.filter(e=>e.week===n&&e.field_key.startsWith('tr_')&&(e.field_value||'').trim()).length;
  const stepsDone=n=>entries.filter(e=>e.week===n&&/^ds_[1-7]$/.test(e.field_key)&&(e.field_value||'').trim()).length;
  const daysComplete=n=>Math.max(stepsDone(n),trackerDays(n));

  const handlePasswordReset = async () => {
    setAuthErr('');
    if(!email) { setAuthErr('Enter your email first'); return; }
    const {error} = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset-password',
    });
    if(error) setAuthErr(error.message);
    else setResetSent(true);
  };

  if(loading || (APP && (!session || access==='no'))) return (
    <div style={{position:"fixed",inset:0,zIndex:50,background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",textAlign:"center"}}>
      <img src={ASSET+"icon-192.png"} alt="" width="72" height="72" style={{width:72,height:72,borderRadius:16,boxShadow:"0 6px 22px rgba(0,0,0,0.45)",objectFit:"cover",display:"block",marginBottom:18}}/>
      <div style={{fontFamily:"Cinzel,Georgia,serif",color:T.gold,fontSize:12,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:8}}>Anchored Steps · Year 2</div>
      <div style={{color:T.muted,fontSize:14}}>Loading your journal…</div>
    </div>
  );

  if(!session){
    if(justSignedUp) return (
      <AuthCard brand={BRAND} mode="signup" onMode={()=>{}} email={email} onEmail={setEmail} password={pw} onPassword={setPw} onSubmit={()=>{}} hideForm>
        <HomeScreenTip brand={BRAND} onContinue={()=>setJustSignedUp(false)} continueLabel="⚓ Open Year 2 →" />
      </AuthCard>
    );
    if(entry==='welcome') return <Welcome brand={BRAND} buyHref={STRIPE_LINK} bothHref={BOTH_LINK} bundleHref={LIBRARY_LINK} onSignIn={()=>setEntry('auth')} />;
    const mode = resetMode ? 'forgot' : authMode==='signup' ? 'signup' : 'signin';
    const submitAuth = async () => {
      setAuthErr('');
      if(mode==='forgot'){ setAuthBusy(true); await handlePasswordReset(); setAuthBusy(false); return; }
      setAuthBusy(true);
      try {
        if(mode==='signin'){
          const{error}=await supabase.auth.signInWithPassword({email,password:pw});
          if(error)setAuthErr(error.message==="Invalid login credentials"?"Incorrect email or password.":error.message);
        } else {
          if(!email||pw.length<6){setAuthErr("Enter your email and a password of at least 6 characters.");return;}
          let{data:authData,error}=await supabase.auth.signUp({email,password:pw,options:{data:{app:"as2"}}});
          if(error&&/already (registered|exists)/i.test(error.message)){
            // One account works across Elora Radiance apps: sign in with it and add Year 2
            const res=await supabase.auth.signInWithPassword({email,password:pw});
            if(res.error){setAuthErr("This email already has an Elora Radiance account (from Year 1 or Armed & Anchored). Enter that password to add Year 2 to it, or use Forgot password.");return;}
            authData=res.data;error=null;
          }
          if(error){setAuthErr(error.message);return;}
          if(!authData?.session){setAuthErr("Check your email to confirm your account, then sign in.");return;}
          setJustSignedUp(true);
        }
      } finally { setAuthBusy(false); }
    };
    return (
      <AuthCard brand={BRAND} mode={mode}
        onMode={(m)=>{ setAuthErr(''); setResetSent(false); if(m==='forgot'){ setResetMode(true); } else { setResetMode(false); setAuthMode(m==='signup'?'signup':'login'); } }}
        email={email} onEmail={setEmail} password={pw} onPassword={setPw} onSubmit={submitAuth} loading={authBusy}
        error={authErr} message={!authErr&&mode!=='forgot'&&y2JustPaid()?'Payment received. Create your account (or sign in) to open Year 2.':''}
        resetSent={resetSent} onResetDone={()=>{ setResetMode(false); setResetSent(false); }}
        onBack={()=>setEntry('welcome')} />
    );
  }

  // Signed in, but Year 2 isn't unlocked on this account yet
  if(access==='checking') return (
    <div style={{position:"fixed",inset:0,zIndex:50,background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",textAlign:"center"}}>
      <img src={ASSET+"icon-192.png"} alt="" width="72" height="72" style={{width:72,height:72,borderRadius:16,boxShadow:"0 6px 22px rgba(0,0,0,0.45)",objectFit:"cover",display:"block",marginBottom:18}}/>
      <div style={{fontFamily:"Cinzel,Georgia,serif",color:T.gold,fontSize:12,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:8}}>Anchored Steps · Year 2</div>
      <div style={{color:T.muted,fontSize:14}}>Loading your journal…</div>
    </div>
  );
  if(access==='no') return (
    <Y2NoAccess email={session.user?.email} userId={session.user?.id} buyLink={STRIPE_LINK}
      onUnlocked={()=>{ setAccess('checking'); setProfileTick(t=>t+1); }}
      onSignOut={()=>supabase.auth.signOut()} />
  );




// A row that opens on tap: emoji, title, one line of detail. Defined outside Settings so a row stays open when the
// page re-renders (a component defined inside would be rebuilt each time and snap shut).
function FoldRow({ C, id, emoji, title, sub, first = false, children }) {
  return (
    <details id={id} className="as-fold" style={{ borderTop: first ? 'none' : `1px solid ${C.border}` }}>
      <summary style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer', listStyle: 'none', touchAction: 'manipulation' }}>
        <span aria-hidden="true" style={{ fontSize: 20, width: 28, textAlign: 'center', flexShrink: 0 }}>{emoji}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14, color: C.cream, fontFamily: "'Cinzel',Georgia,serif", letterSpacing: '0.04em' }}>{title}</span>
          {sub && <span style={{ display: 'block', fontSize: 15, color: C.muted, fontStyle: 'italic', marginTop: 1 }}>{sub}</span>}
        </span>
        <span aria-hidden="true" className="as-fold-caret" style={{ color: C.muted, fontSize: 13, flexShrink: 0 }}>▾</span>
      </summary>
      <div style={{ padding: '2px 14px 16px' }}>{children}</div>
    </details>
  )
}

function Settings({ profile, session, supabase, entries, wk, ALL_WEEKS, darkMode, onToggleDarkMode, onClose, savedCount, onOpenSaved }) {
  const [copiedShare, setCopiedShare] = useState(false)
  const [showReviews, setShowReviews] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [exporting, setExporting] = useState(false)

  const T = {
    bg: darkMode ? '#0D1820' : '#F2EDE3',
    bgCard: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)',
    border: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)',
    cream: darkMode ? '#F0ECE3' : '#1A1209',
    text: darkMode ? '#E0D8CA' : '#3D2E1A',
    muted: darkMode ? '#A0AAB2' : '#5E4E3C',
    dim: darkMode ? '#8A9AAA' : '#6E6052',
    gold: darkMode ? '#C9A15F' : '#6B4E18',
    goldF: darkMode ? 'rgba(160,120,64,0.12)' : 'rgba(139,106,48,0.1)',
    goldB: darkMode ? 'rgba(160,120,64,0.28)' : 'rgba(139,106,48,0.28)',
    green: '#7C9284', greenF: 'rgba(124,146,132,0.15)', greenB: 'rgba(124,146,132,0.4)',
  }

  // Progress stats
  const weeksJournaled = ALL_WEEKS ? ALL_WEEKS.filter(w =>
    entries?.some(e => e.week === w.week && ['study','apply','prayer'].includes(e.field_key) && (e.field_value||'').trim())
  ).length : 0
  const versesMemorized = entries?.filter(e => e.field_key?.startsWith('mem_') && e.field_value === '1').length || 0
  const bookmarks = typeof savedCount === 'number' ? savedCount : (entries?.filter(e => e.field_key === 'bookmark' && e.field_value === '1').length || 0)

  const shareText = `I've been using Anchored Steps Year 2 — deeper Scripture, harder questions, and a faith that doesn't quit. 52 weeks of going further with God.\n\nsteps2.eloraradiance.com`

  const handleShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: 'Anchored Steps Year 2', text: shareText, url: 'https://steps2.eloraradiance.com' }) } catch {}
    } else {
      try { await navigator.clipboard.writeText(shareText); setCopiedShare(true); setTimeout(() => setCopiedShare(false), 2500) } catch {}
    }
  }

  const handleExportTxt = async () => {
    if (!session?.user?.id || exporting) return
    setExporting(true)
    try {
      const { data } = await supabase.from('as2_journal_entries').select('*').eq('user_id', session.user.id)
      const get = (week, key) => data?.find(e => e.week === week && e.field_key === key)?.field_value || ''
      const lines = []
      lines.push('ANCHORED STEPS — YEAR 2 JOURNAL')
      lines.push('Elora Radiance Co. | steps2.eloraradiance.com')
      lines.push(`Exported: ${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}`)
      lines.push('='.repeat(50))
      if (ALL_WEEKS) {
        for (const w of ALL_WEEKS) {
          const study = get(w.week,'study'), apply = get(w.week,'apply'), prayer = get(w.week,'prayer'), reflect = [0,1,2,3,4].map(i=>get(w.week,'rq'+i)).filter(Boolean).join('\n')
          if (!study && !apply && !prayer && !reflect) continue
          lines.push(''); lines.push(`WEEK ${w.week}: ${(w.theme||w.title||'').toUpperCase()}`); lines.push('-'.repeat(40))
          if (study)   { lines.push(''); lines.push('STUDY:');   lines.push(study) }
          if (reflect) { lines.push(''); lines.push('REFLECT:'); lines.push(reflect) }
          if (apply)   { lines.push(''); lines.push('APPLY:');   lines.push(apply) }
          if (prayer)  { lines.push(''); lines.push('PRAYER:');  lines.push(prayer) }
        }
      }
      lines.push(''); lines.push('='.repeat(50)); lines.push('Walk steadily. Stay anchored.')
      const fileName = `anchored-steps-year2-${new Date().toISOString().split('T')[0]}.txt`
      if (APP) { await APP.shareFile(lines.join('\n'), fileName, 'My Anchored Steps Journal'); setExporting(false); return }
      const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = fileName; a.click()
      URL.revokeObjectURL(url)
    } catch(e) { console.error(e) }
    setExporting(false)
  }

  const handlePrintPDF = async () => {
    if (!session?.user?.id) return
    const { data } = await supabase.from('as2_journal_entries').select('*').eq('user_id', session.user.id)
    const get = (week, key) => data?.find(e => e.week === week && e.field_key === key)?.field_value || ''
    let html = `<!DOCTYPE html><html><head><title>Anchored Steps Year 2 Journal</title>
    <style>body{font-family:Georgia,serif;max-width:700px;margin:0 auto;padding:40px;color:#1a1209;line-height:1.8}
    h1{font-size:26px;text-align:center;margin-bottom:4px}
    .sub{text-align:center;color:#8B6A2E;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:36px}
    h2{font-size:17px;border-bottom:1px solid #B08A4E;padding-bottom:6px;margin-top:32px}
    h3{font-size:12px;color:#8B6A2E;letter-spacing:0.1em;text-transform:uppercase;margin:14px 0 5px}
    p{line-height:1.85;margin:0 0 10px}@media print{body{padding:20px}}</style></head><body>
    <h1>Anchored Steps · Year 2</h1>
    <p class="sub">Journal — Exported ${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</p>`
    if (ALL_WEEKS) {
      for (const w of ALL_WEEKS) {
        const study = get(w.week,'study'), apply = get(w.week,'apply'), prayer = get(w.week,'prayer')
        const reflect = [0,1,2,3,4].map(i=>get(w.week,'rq'+i)).filter(Boolean).join('<br/>')
        if (!study && !apply && !prayer && !reflect) continue
        html += `<h2>Week ${w.week} — ${w.theme||w.title||''}</h2>`
        if (study)   html += `<h3>Study</h3><p>${study.split('\n').join('<br/>')}</p>`
        if (reflect) html += `<h3>Reflect</h3><p>${reflect}</p>`
        if (apply)   html += `<h3>Apply</h3><p>${apply.split('\n').join('<br/>')}</p>`
        if (prayer)  html += `<h3>Prayer</h3><p>${prayer.split('\n').join('<br/>')}</p>`
      }
    }
    html += `<hr/><p style="text-align:center;font-size:12px;color:#999">Walk steadily. Stay anchored. — steps2.eloraradiance.com</p></body></html>`
    // Phone app: printing isn't available inside the app, so hand the journal to the share sheet (Print, Save to Files, Mail…)
    if (APP) { await APP.shareFile(html, 'anchored-steps-year-2-journal.html', 'My Anchored Steps Journal'); return }
    // Print via a hidden iframe so we never navigate away or trap the user (critical in standalone PWA mode)
    const frame = document.createElement('iframe')
    frame.setAttribute('aria-hidden', 'true')
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0'
    document.body.appendChild(frame)
    const cleanup = () => setTimeout(() => { try { frame.remove() } catch (e) {} }, 1500)
    const fdoc = frame.contentWindow.document
    fdoc.open(); fdoc.write(html); fdoc.close()
    frame.contentWindow.onafterprint = cleanup
    setTimeout(() => {
      try { frame.contentWindow.focus(); frame.contentWindow.print() } catch (e) { console.error(e) }
      cleanup()
    }, 400)
  }

  const handleSignOut = async () => { setSigningOut(true); await supabase.auth.signOut() }

  const Row = ({ icon, label, children, border = true }) => (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 0', borderBottom: border ? `1px solid ${T.border}` : 'none' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <span style={{ fontSize:18, width:26, textAlign:'center' }}>{icon}</span>
        <span style={{ fontSize:16, color:T.text, fontFamily:"'EB Garamond',Georgia,serif" }}>{label}</span>
      </div>
      {children}
    </div>
  )

  return (
    <div style={{ position:'fixed', inset:0, zIndex:400, background: darkMode ? '#0D1820' : '#F2EDE3', fontFamily:"'EB Garamond',Georgia,serif", overflowY:'auto' }}>
      <div style={{ maxWidth:860 /* the same page column as Steps, Search, Contents and Progress */, margin:'0 auto', padding:'0 0 calc(100px + env(safe-area-inset-bottom, 0px))' /* clears the bottom tab bar */ }}>
      {showReviews && <Reviews app="as2" appName="Anchored Steps · Year 2" eyebrow="Anchored Steps · Year 2" userEmail={session?.user?.email || profile?.email} C={{ ...T, red: T.gold, redL: T.gold }} lightMode={!darkMode} onClose={() => setShowReviews(false)} />}

        {/* Sticky header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'calc(16px + var(--safe-top, env(safe-area-inset-top, 0px))) 20px 16px', borderBottom:`1px solid ${T.border}`, position:'sticky', top:0, zIndex:10, background: darkMode ? '#0D1820' : '#F2EDE3', backdropFilter:'blur(12px)' }}>
          <div>
            <div style={{ fontSize:11, color:T.gold, letterSpacing:'0.16em', textTransform:'uppercase', fontFamily:"'Cinzel',Georgia,serif" }}>Anchored Steps · Year 2</div>
            <div style={{ fontSize:18, fontWeight:700, color:T.cream, fontFamily:"'Cinzel',Georgia,serif" }}>Settings</div>
          </div>
          <button onClick={onClose} style={{ background:T.bgCard, border:`1px solid ${T.border}`, color:T.muted, width:36, height:36, borderRadius:9, cursor:'pointer', fontSize:18 }}>←</button>
        </div>

        <div style={{ padding:'8px 20px' }}>

          {/* Settings 2026-11-19: your account and the light/dark switch stay open; everything else is a row that opens on tap */}
          <style>{`.as-fold > summary::-webkit-details-marker{display:none}.as-fold-caret{display:inline-block;transition:transform .2s}.as-fold[open] > summary .as-fold-caret{transform:rotate(180deg)}`}</style>
          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, padding: '0 16px', marginTop: 18 }}>
            <Row icon="✉️" label={session?.user?.email || profile?.email || 'Your account'}>
              <span style={{ fontSize:11, color:T.gold, fontFamily:"'Cinzel',Georgia,serif" }}>
                Lifetime ✦
              </span>
            </Row>
            <Row icon={darkMode ? '🌙' : '☀️'} label={darkMode ? 'Dark Mode' : 'Light Mode'} border={false}>
              <div onClick={onToggleDarkMode} style={{ width:48, height:28, borderRadius:14, cursor:'pointer', background: darkMode ? T.gold : T.bgCard, border:`1px solid ${darkMode ? T.goldB : T.border}`, position:'relative', transition:'all .25s' }}>
                <div style={{ position:'absolute', top:3, left: darkMode ? 22 : 3, width:20, height:20, borderRadius:'50%', background: darkMode ? '#fff' : T.muted, transition:'left .25s', boxShadow:'0 1px 4px rgba(0,0,0,0.3)' }}/>
              </div>
            </Row>
          </div>

          <div style={{ border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden', marginTop: 14, background: T.bgCard }}>
            <FoldRow C={T} id="set-reminders" emoji="🔔" title="Reminders" sub="A daily nudge to keep going" first>
              <div style={{ marginTop: -22 }}>
          <ReminderSettings supabase={supabase} app="as2" theme={{
            text: T.text, muted: T.muted, accent: T.gold, accentF: T.goldF, accentB: T.goldB,
            card: T.bgCard, border: T.border, dark: darkMode,
          }} />
              </div>
            </FoldRow>
            <FoldRow C={T} id="set-progress" emoji="📊" title="Progress" sub="Where you are, and your saved verses">
          <div style={{ background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:14, padding:'16px' }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:14 }}>
              {[[weeksJournaled,'Weeks','📖'],[versesMemorized,'Memorized','✦'],[bookmarks,'Saved','☆']].map(([v,l,icon]) => (
                <div key={l} style={{ background:T.goldF, border:`1px solid ${T.goldB}`, borderRadius:12, padding:'14px 8px', textAlign:'center' }}>
                  <div style={{ fontSize:26, fontWeight:700, color:T.gold, fontFamily:"'Cinzel',Georgia,serif", lineHeight:1 }}>{v}</div>
                  <div style={{ fontSize:14, color:T.muted, marginTop:4 }}>{l}</div>
                </div>
              ))}
            </div>
            <div style={{ height:5, background:T.bgCard, borderRadius:3, overflow:'hidden', border:`1px solid ${T.border}` }}>
              <div style={{ height:'100%', background:`linear-gradient(90deg,${T.gold},#C9A96E)`, width:`${Math.round((wk/52)*100)}%`, transition:'width .4s ease' }}/>
            </div>
            <div style={{ fontSize:15, color:T.muted, textAlign:'center', marginTop:8 }}>Week {wk} of 52 · {Math.round((wk/52)*100)}% complete</div>
            <button onClick={()=>{ if(window.confirm('Reset to Week 1? Journal entries will be kept.')) goWk(1) }} style={{ width:'100%', background:'transparent', border:`1px solid ${T.border}`, color:T.muted, padding:'10px', borderRadius:10, cursor:'pointer', fontSize:12, fontFamily:"'Cinzel',Georgia,serif", letterSpacing:'0.06em', marginTop:10 }}>↺ Reset to Week 1</button>
          </div>
          {onOpenSaved && (
            <button onClick={onOpenSaved} style={{ width:'100%', marginTop:10, display:'flex', alignItems:'center', justifyContent:'space-between', background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:14, padding:'14px 16px', cursor:'pointer', textAlign:'left' }}>
              <span style={{ display:'flex', alignItems:'center', gap:12 }}>
                <span style={{ fontSize:18, width:26, textAlign:'center', color:T.gold }}>☆</span>
                <span style={{ fontSize:16, color:T.text, fontFamily:"'EB Garamond',Georgia,serif" }}>Saved verses</span>
              </span>
              <span style={{ fontSize:13, color:T.gold, fontFamily:"'Cinzel',Georgia,serif" }}>{bookmarks} →</span>
            </button>
          )}
            </FoldRow>
            <FoldRow C={T} id="set-data" emoji="📥" title="Your Data" sub="Export or print your journal">
          <div style={{ background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:14, padding:'16px' }}>
            <p style={{ fontSize:16, color:T.text, lineHeight:1.7, marginBottom:14 }}>Download all your journal entries as a text file, or print as a formatted PDF.</p>
            <button onClick={handleExportTxt} disabled={exporting} style={{ width:'100%', background: exporting ? 'transparent' : T.goldF, border:`1px solid ${exporting ? T.border : T.goldB}`, color: exporting ? T.muted : T.gold, padding:'13px', borderRadius:12, cursor: exporting ? 'default' : 'pointer', fontSize:13, fontFamily:"'Cinzel',Georgia,serif", letterSpacing:'0.08em', transition:'all .25s', marginBottom:8 }}>
              {exporting ? 'Preparing Export…' : '📥 Export Journal'}
            </button>
            <button onClick={handlePrintPDF} style={{ width:'100%', padding:'13px', borderRadius:12, cursor:'pointer', background:T.bgCard, border:`1px solid ${T.border}`, color:T.muted, fontSize:12, fontFamily:"'Cinzel',Georgia,serif", letterSpacing:'0.08em' }}>
              🖨️ Print as PDF
            </button>
          </div>
            </FoldRow>
            <FoldRow C={T} id="set-share" emoji="🔗" title="Share" sub="Send the app to someone who needs it">
          <div style={{ background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:14, padding:'16px' }}>
            <p style={{ fontSize:16, color:T.text, lineHeight:1.75, marginBottom:14 }}>Know someone who finished Year 1 and is ready to go deeper? Share Year 2 with them.</p>
            <div style={{ background: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)', border:`1px solid ${T.border}`, borderRadius:10, padding:'12px 14px', marginBottom:12, fontSize:16, color:T.muted, fontStyle:'italic', lineHeight:1.7 }}>
              "{shareText.split('\n')[0]}"
            </div>
            <button onClick={handleShare} style={{ width:'100%', background: copiedShare ? T.greenF : T.goldF, border:`1px solid ${copiedShare ? T.greenB : T.goldB}`, color: copiedShare ? T.green : T.gold, padding:'13px', borderRadius:12, cursor:'pointer', fontSize:13, fontFamily:"'Cinzel',Georgia,serif", letterSpacing:'0.08em', transition:'all .25s' }}>
              {copiedShare ? '✓ Copied — Send It to Someone' : '🔗 Share Anchored Steps Year 2'}
            </button>
          </div>
            </FoldRow>
            <FoldRow C={T} id="set-support" emoji="🛟" title="Reviews & Support" sub="Leave a review or email us">
              <div style={{ padding: '0 4px' }}>
            <Row icon="⭐" label="Ratings & Reviews">
              <button onClick={() => setShowReviews(true)} style={{ background:T.goldF, border:`1px solid ${T.goldB}`, color:T.gold, padding:'6px 16px', borderRadius:10, cursor:'pointer', fontSize:12, fontFamily:"'Cinzel',Georgia,serif", letterSpacing:'0.06em' }}>Open</button>
            </Row>
            <Row icon="🛟" label="Email Support" border={false}>
              <a href="mailto:support@eloraradiance.com" style={{ background:T.goldF, border:`1px solid ${T.goldB}`, color:T.gold, padding:'6px 16px', borderRadius:10, fontSize:12, fontFamily:"'Cinzel',Georgia,serif", textDecoration:'none', display:'inline-block', letterSpacing:'0.06em' }}>Contact</a>
            </Row>
              </div>
            </FoldRow>
            <FoldRow C={T} id="set-privacy" emoji="🔒" title="Privacy & Account" sub="Policies and deleting your account">
              <div style={{ marginTop: -22 }}>
          <AccountPrivacy supabase={supabase} theme={{
            text: T.text, muted: T.muted, card: T.bgCard, border: T.border, dark: darkMode,
            danger: darkMode ? '#D9786B' : '#8E2B27', dangerF: darkMode ? 'rgba(217,120,107,0.12)' : 'rgba(168,68,58,0.08)', dangerB: darkMode ? 'rgba(217,120,107,0.35)' : 'rgba(168,68,58,0.3)',
          }} />
              </div>
            </FoldRow>
            {!APP && <FoldRow C={T} id="set-more" emoji="🌿" title="More from Elora Radiance Co." sub="The other apps in the family">
          <div style={{ background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:14, padding:'12px 16px' }}>
            <p style={{ fontSize:16, color:T.muted, fontStyle:'italic', lineHeight:1.7, marginBottom:14 }}>The rest of the Elora Radiance ecosystem — Scripture-based tools for the whole Christian life.</p>
            {[
              { label:'Armed & Anchored', desc:'Spiritual warfare training — 26 weapons', url:'https://armed.eloraradiance.com/', icon:'⚔️' },
              { label:'Anchored Steps · Year 1', desc:'52 weeks of faith in action', url:'https://steps.eloraradiance.com/', icon:'⚓' },
              { label:'The Red Letters', desc:'The words of Jesus by theme — free', url:'https://redletters.eloraradiance.com/', icon:'✦' },
              { label:'Anchored Verse', desc:'Scripture for every emotion — free', url:'https://verse.eloraradiance.com/', icon:'📖' },
              { label:'The Living Planner', desc:'Faith-centered life planner', url:'https://planner.eloraradiance.com/', icon:'📓' },
            ].map(app => (
              <a key={app.url} href={app.url} target="_blank" rel="noopener noreferrer" style={{ display:'flex', alignItems:'center', gap:14, padding:'13px 14px', borderRadius:12, marginBottom:8, background:T.goldF, border:`1px solid ${T.goldB}`, textDecoration:'none', transition:'all .2s' }}>
                <span style={{ fontSize:22, flexShrink:0 }}>{app.icon}</span>
                <span style={{ flex:1 }}>
                  <span style={{ display:'block', fontSize:13, color:T.cream, fontFamily:"'Cinzel',Georgia,serif", letterSpacing:'0.05em', marginBottom:2 }}>{app.label}</span>
                  <span style={{ display:'block', fontSize:15, color:T.muted, fontStyle:'italic' }}>{app.desc}</span>
                </span>
                <span style={{ fontSize:16, color:T.gold }}>↗</span>
              </a>
            ))}
          </div>
            </FoldRow>}
            <FoldRow C={T} id="set-credits" emoji="📖" title="Scripture Credits" sub="Translations used in this app">
              <div style={{ marginTop: -22 }}>
          <ScriptureCredits notices={['BSB']} theme={{ text: T.text, muted: T.muted, card: T.bgCard, border: T.border }} />
              </div>
            </FoldRow>
            <FoldRow C={T} id="set-about" emoji="ℹ️" title="About" sub="Anchored Steps · Year 2 v1.0">
          <div style={{ background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:14, padding:'0 16px' }}>
            <Row icon="⚓" label="Anchored Steps · Year 2">
              <span style={{ fontSize:14, color:T.dim }}>v1.0</span>
            </Row>
            <a href="https://eloraradiance.com" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
            <Row icon="🌿" label="Elora Radiance Co." border={false}>
              <span style={{ fontSize:14, color:T.gold }}>eloraradiance.com &rarr;</span>
            </Row>
            </a>
          </div>
            </FoldRow>
          </div>

          <div style={{ marginTop: 18, display: 'flex', justifyContent: 'center' }}>
              <button onClick={handleSignOut} disabled={signingOut} style={{ background:T.goldF, border:`1px solid ${T.goldB}`, color:T.gold, padding:'6px 16px', borderRadius:10, cursor:'pointer', fontSize:12, fontFamily:"'Cinzel',Georgia,serif", letterSpacing:'0.07em' }}>
                {signingOut ? 'Signing out...' : 'Sign Out'}
              </button>
          </div>

        </div>
      </div>
    </div>
  )
}

  // ── Bottom tab bar ─────────────────────────────────────────────
  // Steps, Contents, Search, Progress and Settings sit at the bottom where a thumb reaches them
  // (they were a row of small links under the header). Same pattern as The Living Planner. 2026-11-13
  const activeTab = showSettings ? 'settings' : view === 'journal' ? 'steps' : view;
  const goTab = (id) => {
    if (id === activeTab && !(id === 'steps' && view === 'journal')) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (id === 'settings') { setShowSettings(true); return; }
    setShowSettings(false); setView(id); window.scrollTo(0, 0);
  };
  const tabBar = () => (
    <nav aria-label="Main" style={{
      position:'fixed',left:0,right:0,bottom:0,zIndex:450,
      background:darkMode?'rgba(13,24,32,0.97)':'rgba(240,234,224,0.97)',
      backdropFilter:'blur(18px)',WebkitBackdropFilter:'blur(18px)',
      borderTop:'1px solid '+T.border,boxShadow:'0 -8px 28px rgba(0,0,0,'+(darkMode?'0.28':'0.08')+')',
      paddingBottom:'env(safe-area-inset-bottom, 0px)',
    }}>
      <div style={{display:'flex',maxWidth:560,margin:'0 auto'}}>
        {[['steps','\uD83D\uDC63','Steps'],['contents','\uD83D\uDCD6','Contents'],['search','\uD83D\uDD0D','Search'],['progress','\uD83D\uDCCA','Progress'],['settings','\u2699\uFE0F','Settings']].map(([id,icon,label]) => {
          const on = activeTab === id;
          return (
            <button key={id} onClick={() => goTab(id)} aria-current={on ? 'page' : undefined}
              style={{flex:1,minHeight:TAB_BAR_H,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:3,
                background:'transparent',border:'none',cursor:'pointer',touchAction:'manipulation',padding:'8px 2px 6px',position:'relative'}}>
              {on && <span style={{position:'absolute',top:0,left:'28%',right:'28%',height:2,borderRadius:2,background:T.gold}}/>}
              <span style={{fontSize:21,lineHeight:1,filter:on?'none':'saturate(0.55)',opacity:on?1:0.78}}>{icon}</span>
              <span style={{fontSize:11,letterSpacing:'0.08em',textTransform:'uppercase',fontFamily:'Cinzel,serif',fontWeight:on?700:500,color:on?T.gold:T.muted}}>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );

  if(showSettings) return (
    <>
    <Settings
      profile={profile}
      session={session}
      supabase={supabase}
      entries={entries}
      wk={wk}
      ALL_WEEKS={ALL_WEEKS}
      darkMode={darkMode}
      onToggleDarkMode={()=>setDarkMode(d=>!d)}
      savedCount={bookmarks.length}
      onOpenSaved={()=>{ setShowSettings(false); setSearchQuery(''); setSearchResults([]); setView('search'); window.scrollTo(0,0); }}
      onClose={()=>setShowSettings(false)}
    />
    {tabBar()}
    </>
  )

  if(showOnboarding){
    return <Onboarding onComplete={async ()=>{
      try{localStorage.setItem('y2_onboarding_complete','1')}catch{}
      if (session?.user?.id) {
        try { await supabase.from('as2_profiles').update({ onboarded: true }).eq('user_id', session.user.id) } catch(e) { console.warn('onboarded sync:', e) }
      }
      setShowOnboarding(false);
    }} darkMode={darkMode} G={T}/>;
  }

  // No week found — show error state instead of crashing
  if(!week && view === 'journal') {
    return (
      <div style={{minHeight:"100vh",background:T.bg,color:T.text,fontFamily:"EB Garamond,Georgia,serif",padding:24,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{textAlign:"center",maxWidth:380}}>
          <div style={{fontFamily:"Cinzel,serif",fontSize:14,color:T.gold,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:14}}>Week Not Found</div>
          <p style={{color:T.muted,marginBottom:20,lineHeight:1.7}}>Week {wk} data isn't available. The content may still be loading.</p>
          <button onClick={()=>goWk(1)} style={{background:T.goldF,border:"1px solid "+T.goldB,color:T.gold,padding:"12px 24px",borderRadius:10,cursor:"pointer",fontSize:12,fontFamily:"Cinzel,serif",letterSpacing:"0.08em"}}>Go to Week 1</button>
        </div>
      </div>
    );
  }

  // Saved verses (shown on the Search screen before you type)
  // A saved verse shows the verse as it reads now, found by its saved-data name (the reference it was saved under).
  const freshBookmark = bm => { const w = ALL_WEEKS.find(x => x.week === bm.week && `${x.verseKey||x.verseRef}_${x.week}` === bm.key); return w ? { ...bm, ref: w.verseRef, text: w.verseText } : bm; };
  const savedCards = (
    <>
      {bookmarks.map(freshBookmark).map((bm,i)=>(
        <div key={i} style={{background:T.bgCard,border:"1px solid "+T.border,borderRadius:12,padding:"16px 18px",marginBottom:10}}>
          <p style={{fontSize:16,color:T.text,fontStyle:"italic",lineHeight:1.75,marginBottom:8}}>&#8220;{bm.text}&#8221;</p>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <span style={{fontSize:11,color:T.gold,fontFamily:"Cinzel,serif",letterSpacing:"0.08em"}}>{bm.ref}</span>
              <button onClick={()=>{weekMovedRef.current=true;setWk(bm.week);setView('journal');setSec(bm.section||'passage');setAnimK(a=>a+1);window.scrollTo(0,0);}} style={{background:"transparent",border:"none",color:T.muted,cursor:"pointer",fontSize:14,textDecoration:"underline"}}>Open</button>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <span style={{fontSize:14,color:T.muted}}>Week {bm.week}</span>
              <button onClick={()=>{
                if(window.confirm(`Remove ${bm.ref} from saved?`)) {
                  const updated = bookmarks.filter(b => b.key !== bm.key);
                  setBookmarks(updated);
                  try { localStorage.setItem('y2_bookmarks', JSON.stringify(updated)); } catch {}
                  if (session?.user?.id) supabase.from('as2_profiles').update({ bookmarks: updated }).eq('user_id', session.user.id)
                    .then(({error})=>{ if(error) console.warn('bookmarks sync:', error.message); });
                }
              }} style={{background:"transparent",border:"none",color:T.muted,cursor:"pointer",fontSize:16,padding:"2px 6px"}}>✕</button>
            </div>
          </div>
        </div>
      ))}
    </>
  );

  return (
    <div style={{minHeight:"100vh",background:T.bg,color:T.text,fontFamily:"EB Garamond,Georgia,serif"}}>
      {/* Header */}
      <div style={{position:"sticky",top:0,zIndex:100,paddingTop:"var(--safe-top, env(safe-area-inset-top, 0px))",marginTop:"calc(-1 * env(safe-area-inset-top, 0px))",background:darkMode?"#0D1820":"#F0EAE0",borderBottom:"1px solid "+T.border}}>
        {/* Layout matched to Year 1 (2026-11-22): same bar height, icon and title size; the Year 2 tag tells the two apart */}
        <div style={{padding:"10px 18px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          {/* Phone app: the icon and title go back to the front page (Year 1, Year 2). On the website they do nothing. */}
          <div {...(APP ? {role:"button",tabIndex:0,"aria-label":"All studies",onClick:()=>APP.home()} : {})} style={{display:"flex",alignItems:"center",gap:8,cursor:APP?"pointer":"default"}}>
            {APP && <span aria-hidden="true" style={{fontSize:24,lineHeight:1,color:T.gold,marginRight:-2,marginTop:-3}}>‹</span>}
            <img src={ASSET+"icon2.png"} alt="⚓" style={{width:26,height:26,borderRadius:6,verticalAlign:"middle"}}/>
            <span style={{fontFamily:"Cinzel,serif",fontSize:14,fontWeight:600,color:T.cream}}>Anchored Steps</span>
            <span style={{background:T.goldF,border:"1px solid "+T.goldB,borderRadius:12,padding:"1px 8px",fontSize:11,color:T.gold,fontFamily:"Cinzel,serif",letterSpacing:"0.08em"}}>Year 2</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {saveStatus!=='idle'&&(
              <div style={{fontSize:11,fontFamily:"Cinzel,serif",letterSpacing:"0.06em",color:saveStatus==='saved'?T.green:T.muted,transition:"color .3s"}}>
                {saveStatus==='saving'?"Saving…":"✓ Saved"}
              </div>
            )}
            <span style={{fontSize:14,color:T.muted}}>{session?.user?.email?.split('@')[0]}</span>
          </div>
        </div>
      </div>

      <div style={{maxWidth:860,margin:"0 auto",padding:`26px 18px calc(40px + ${BELOW_BAR})`}}>
        {/* JOURNAL VIEW */}
        {view==='steps' && week && (
          <div className="fi">
            <DailySteps week={week} wk={wk} totalWeeks={52} entries={entries} get={get} set={set} darkMode={darkMode}
              onOpenWeek={()=>{ setView('journal'); setSec('passage'); window.scrollTo(0,0); }}
              onGoWeek={n=>goWk(n)} yourWeek={myWeek} onBusy={b=>{ stepsBusyRef.current = b; }} />
          </div>
        )}

        {view==='journal' && week && (
          <div className="fi">
            {/* Week nav */}
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18}}>
              <button onClick={()=>goWk(Math.max(1,wk-1))} disabled={wk===1} aria-label="Previous week" style={{background:T.goldF,border:"1px solid "+T.goldB,color:T.gold,width:34,height:34,borderRadius:8,cursor:"pointer",fontSize:16,flexShrink:0,opacity:wk===1?.3:1}}>&#8249;</button>
              <div style={{flex:1,textAlign:"center",minWidth:0}}>
                <div style={{fontSize:11,color:T.gold,letterSpacing:"0.16em",textTransform:"uppercase",fontFamily:"Cinzel,serif",marginBottom:1}}>Week {wk} of 52</div>
                <button onClick={()=>setShowWeekJump(v=>!v)} aria-expanded={showWeekJump} style={{background:"transparent",border:"none",cursor:"pointer",padding:0,touchAction:"manipulation",maxWidth:"100%"}}>
                  <h1 style={{fontSize:23,fontWeight:600,color:T.cream,fontFamily:"Cinzel,serif",margin:"15px 0",lineHeight:"normal"}}>{week.theme} <span style={{fontSize:16,color:T.muted}}>{showWeekJump?"▲":"▼"}</span></h1>
                </button>
                {week.verseRef && <p style={{fontSize:16,color:T.muted,fontStyle:"italic",marginTop:1,marginBottom:16}}>{week.verseRef}</p>}
              </div>
              <button onClick={()=>goWk(Math.min(52,wk+1))} disabled={wk===52} aria-label="Next week" style={{background:T.goldF,border:"1px solid "+T.goldB,color:T.gold,width:34,height:34,borderRadius:8,cursor:"pointer",fontSize:16,flexShrink:0,opacity:wk===52?.3:1}}>&#8250;</button>
            </div>

            {/* Week list: opens over the page, like Year 1 */}
            {showWeekJump&&(
              <div onClick={()=>setShowWeekJump(false)} style={{position:"fixed",inset:0,zIndex:800}}>
                {/* Week list (2026-11-22): all 52 weeks fit on the screen with no scrolling. Six across, nine rows; the rows share
                  the space between the top bar and the tab bar, so it fits a small phone and stops growing on a tall one. */}
                <div onClick={e=>e.stopPropagation()} role="dialog" aria-label="Choose a week" style={{position:"fixed",top:"calc(58px + var(--safe-top, env(safe-area-inset-top, 0px)))",bottom:`calc(12px + ${BELOW_BAR})`,left:10,right:10,maxWidth:840,maxHeight:560,margin:"0 auto",background:T.bg,border:"1px solid "+T.border,borderRadius:16,padding:10,overflow:"hidden",display:"grid",gridTemplateColumns:"repeat(6,minmax(0,1fr))",gridTemplateRows:"repeat(9,minmax(0,1fr))",gap:4,zIndex:900,boxShadow:"0 8px 32px rgba(0,0,0,0.5)"}}>
                  {ALL_WEEKS.map(w=>{
                    const isCur=w.week===wk
                    return (
                      <button key={w.week} onClick={()=>{goWk(w.week);setShowWeekJump(false)}} style={{background:isCur?"linear-gradient(145deg,"+T.goldF+","+T.goldF+")":"transparent",border:"1px solid "+(isCur?T.goldB:T.border),borderRadius:8,color:isCur?T.gold:T.muted,padding:"2px 2px",minWidth:0,cursor:"pointer",fontFamily:"Cinzel,serif",textAlign:"center",lineHeight:1.3,touchAction:"manipulation",minHeight:0,overflow:"hidden",display:"flex",flexDirection:"column",alignItems:"stretch",justifyContent:"center"}}>
                        <div style={{fontSize:13,fontWeight:600,lineHeight:1.15}}>{w.week}</div>
                        {/* Year 2 themes are phrases, so the tile shows up to two lines of the theme, not just its first word */}
                        <div style={{overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",fontSize:10,lineHeight:1.15,overflowWrap:"anywhere"}}>{w.theme}</div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Progress bar */}
            <div style={{background:"rgba(255,255,255,0.05)",borderRadius:3,height:3,marginBottom:20,overflow:"hidden"}}>
              <div style={{height:"100%",background:"linear-gradient(90deg,"+T.gold+","+T.goldL+")",width:((wk/52)*100)+"%",transition:"width .5s ease"}}/>
            </div>

            {/* Section tabs */}
            <div style={{display:"flex",gap:3,flexWrap:"wrap",marginBottom:20}}>
              {SECTIONS.map(s=>{
                const hasData = (s.id==='study'&&(get('study')||'').trim()) ||
                  (s.id==='reflect'&&[0,1,2,3,4].some(i=>(get('rq'+i)||'').trim())) ||
                  (s.id==='apply'&&(get('apply')||'').trim()) ||
                  (s.id==='prayer'&&(get('prayer')||'').trim()) ||
                  (s.id==='tracker'&&(DAYS.some((_,i)=>(get('tr_'+i)||'').trim())||(get('gratitude')||'').trim())) ||
                  (s.id==='community'&&communityDone);
                return (
                  <button key={s.id} onClick={()=>{setSec(s.id);setAnimK(a=>a+1);window.scrollTo(0,0);}} style={{background:sec===s.id?"linear-gradient(135deg,"+T.goldF+","+T.goldF+")":"transparent",border:"1px solid "+(sec===s.id?T.goldB:T.border),color:sec===s.id?T.gold:T.muted,padding:"6px 10px",borderRadius:8,cursor:"pointer",fontSize:14,transition:"all .18s",position:"relative"}}>
                    {s.label}
                    {hasData&&<span style={{position:"absolute",top:2,right:2,width:5,height:5,borderRadius:"50%",background:T.green,display:"block"}}/>}
                  </button>
                );
              })}
            </div>

            {/* Section content */}
            <div key={wk+"-"+sec+"-"+animK} className="fu">
              {/* PASSAGE */}
              {sec==="passage" && (
                <div>
                  <label style={LBL}>Primary Passage — Week {wk}</label>
                  <div style={{background:"linear-gradient(145deg,"+T.goldF+","+T.goldF+")",border:"1px solid "+T.goldB,borderRadius:16,padding:"22px 24px",marginBottom:14,boxShadow:"0 8px 24px rgba(0,0,0,0.12)"}}>
                    <div style={{display:"flex",gap:10}}>
                      <span style={{color:T.gold,fontSize:32,lineHeight:1,opacity:.3,flexShrink:0,fontFamily:"Georgia,serif"}}>&#8220;</span>
                      <div style={{flex:1}}>
                        <p style={{fontSize:20,lineHeight:1.9,color:T.cream,fontStyle:"italic",marginBottom:14,letterSpacing:"0.01em"}}>{week.verseText || '(Verse text missing)'}</p>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
                          <span style={{fontSize:11,color:T.gold,fontFamily:"Cinzel,serif",fontWeight:500,letterSpacing:"0.08em",textTransform:"uppercase"}}>{week.verseRef || ''}{week.verseTranslation ? ' (' + week.verseTranslation + ')' : ''}</span>
                          <div style={{display:"flex",gap:6}}>
                            <button onClick={()=>setQuizVerse({text:week.verseText,ref:week.verseRef,key:week.verseKey||week.verseRef})} style={{background:get("mem_"+(week.verseKey||week.verseRef))?T.greenF:T.purpleF,border:"1px solid "+(get("mem_"+(week.verseKey||week.verseRef))?T.greenB:T.purpleB),color:get("mem_"+(week.verseKey||week.verseRef))?T.green:T.purple,padding:"3px 11px",borderRadius:12,cursor:"pointer",fontSize:11,fontFamily:"Cinzel,serif"}}>
                              {get("mem_"+(week.verseKey||week.verseRef))?"✓ Memorized":"✦ Memorize"}
                            </button>
                            <button onClick={()=>toggleBookmark({verseRef:week.verseRef,verseKey:week.verseKey,verseText:week.verseText},wk,"passage")} style={{background:isBookmarked(week.verseKey||week.verseRef,wk)?T.goldF:"transparent",border:"1px solid "+(isBookmarked(week.verseKey||week.verseRef,wk)?T.goldB:T.border),color:isBookmarked(week.verseKey||week.verseRef,wk)?T.gold:T.muted,padding:"3px 10px",borderRadius:12,cursor:"pointer",fontSize:16}}>
                              {isBookmarked(week.verseKey||week.verseRef,wk)?"★":"☆"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <label style={{...LBL,marginTop:20}}>Read in Context</label>
                  <div style={{background:T.bgCard,border:"1px solid "+T.border,borderRadius:12,padding:"16px 20px",marginBottom:14}}>
                    <p style={{fontSize:18,color:T.text,lineHeight:1.85,margin:0,whiteSpace:"pre-line"}}>{week.readInContext || 'No context available for this week.'}</p>
                    <div style={{marginTop:12,paddingTop:10,borderTop:"1px solid "+T.border,display:"flex",justifyContent:"flex-end",gap:8}}>
                      <CopyBtn text={week.readInContext||''} label="Copy Context" T={T}/>
                    </div>
                  </div>
                  <SaveBtn onSave={save} flash={flash} T={T}/>
                </div>
              )}

              {/* CONTEXT */}
              {sec==="context" && (
                <div>
                  <label style={LBL}>Where Are We in the Story?</label>
                  <div style={{background:T.bgCard,border:"1px solid "+T.border,borderRadius:12,padding:"16px 20px",marginBottom:18}}>
                    <p style={{fontSize:18,color:T.text,lineHeight:1.85,margin:0,whiteSpace:"pre-line"}}>{week.whereAreWe || 'Context information not available.'}</p>
                    <div style={{marginTop:12,paddingTop:10,borderTop:"1px solid "+T.border,display:"flex",justifyContent:"flex-end",gap:8}}>
                      <CopyBtn text={week.whereAreWe||''} label="Copy Story Context" T={T}/>
                    </div>
                  </div>
                </div>
              )}

              {/* DON'T MISS THIS */}
              {sec==="dontmiss" && (
                <div>
                  <label style={LBL}>⚠️ Don't Miss This</label>
                  <div style={{background:"linear-gradient(145deg,"+T.goldF+","+T.goldF+")",border:"1px solid "+T.goldB,borderRadius:12,padding:"16px 20px",marginBottom:18}}>
                    <p style={{fontSize:16,color:T.text,lineHeight:1.85,margin:0,whiteSpace:"pre-line"}}>{week.dontMissThis || 'No key insight for this week.'}</p>
                    <div style={{marginTop:12,paddingTop:10,borderTop:"1px solid "+T.border,display:"flex",justifyContent:"flex-end",gap:8}}>
                      <CopyBtn text={"\u26a0\ufe0f Don't Miss This — Week "+wk+"\n\n"+(week.dontMissThis||'')} label="Copy Don't Miss This" T={T}/>
                    </div>
                  </div>
                </div>
              )}

              {/* STUDY */}
              {sec==="study" && (
                <div>
                  <label style={LBL}>Passage Study Prompt</label>
                  <div style={{background:T.purpleF,border:"1px solid "+T.purpleB,borderRadius:12,padding:"16px 20px",marginBottom:18}}>
                    <div style={{fontSize:11,color:T.purple,fontFamily:"Cinzel,serif",letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:10}}>Ask:</div>
                    <p style={{fontSize:18,color:T.text,lineHeight:1.85,margin:"0 0 20px",whiteSpace:"pre-line"}}>{week.studyPrompt || 'Study prompt not available.'}</p>
                    <div style={{borderTop:"1px solid "+T.purpleB,paddingTop:16}}>
                      <div style={{fontSize:11,color:T.purple,fontFamily:"Cinzel,serif",letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:10}}>{week.verseRef || ''}{week.verseTranslation ? ' (' + week.verseTranslation + ')' : ''}</div>
                      <p style={{fontSize:17,color:T.cream,lineHeight:1.9,fontStyle:"italic",margin:0}}>&#8220;{week.verseText || ''}&#8221;</p>
                    </div>
                  </div>
                  <label style={LBL}>Study Notes</label>
                  <div style={{background:T.bgCard,border:"1px solid "+T.border,borderRadius:12,padding:"16px 20px",marginBottom:18}}>
                    <p style={{fontSize:18,color:T.text,lineHeight:1.85,margin:0,whiteSpace:"pre-line"}}>{week.studyNotes || 'No study notes for this week.'}</p>
                    <div style={{marginTop:12,paddingTop:10,borderTop:"1px solid "+T.border,display:"flex",justifyContent:"flex-end",gap:8}}>
                      <CopyBtn text={(week.verseRef||'')+" — Study Notes\n\n"+(week.studyNotes||'')} label="Copy Study Notes" T={T}/>
                    </div>
                  </div>
                  <label style={LBL}>Your Notes</label>
                  <textarea rows={6} defaultValue={get("study")} onFocus={e => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)} onChange={e=>set("study",e.target.value)} placeholder="Write your personal study notes here..." style={INP}/>
                  <SaveBtn onSave={save} flash={flash} T={T}/>
                </div>
              )}

              {/* LEXICON */}
              {sec==="lexicon" && (
                <div>
                  <label style={LBL}>Word Study</label>
                  <p style={{fontSize:16,color:T.muted,fontStyle:"italic",marginBottom:14,lineHeight:1.7}}>Key Greek &amp; Hebrew words from this week&apos;s Scripture. Tap 🔊 to hear pronunciation.</p>
                  {(week?.lexicon || []).map((entry, i) => (
                    <div key={i} style={{background:T.bgCard,border:"1px solid "+T.borderGold,borderRadius:14,padding:"20px 22px 18px",marginBottom:14}}>
                      <div style={{fontSize:18,fontFamily:"'Cinzel',Georgia,serif",color:T.cream,letterSpacing:"0.04em",marginBottom:6}}>{entry.word}</div>
                      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:2}}>
                        <div style={{fontSize:16,color:T.gold,fontFamily:"'EB Garamond',Georgia,serif",fontStyle:"italic",flex:1}}>{entry.original}</div>
                        <button onClick={() => speak(entry)} aria-label="Hear pronunciation" style={{background:speaking?"rgba(176,138,78,0.35)":"rgba(176,138,78,0.12)",border:"1px solid "+T.borderGold,color:T.gold,width:32,height:32,borderRadius:"50%",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,padding:0,touchAction:"manipulation"}}>{speaking?"▶":"🔊"}</button>
                      </div>
                      <div style={{fontSize:11,color:T.muted,fontFamily:"'Cinzel',Georgia,serif",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:12}}>{entry.language}</div>
                      <div style={{height:1,background:T.borderGold,marginBottom:12}} />
                      <p style={{fontSize:16,color:T.text,lineHeight:1.85,marginBottom:12,fontFamily:"'EB Garamond',Georgia,serif"}}>{entry.meaning}</p>
                      {entry.note && <p style={{fontSize:16,color:T.muted,lineHeight:1.85,fontStyle:"italic",fontFamily:"'EB Garamond',Georgia,serif"}}>{entry.note}</p>}
                    </div>
                  ))}
                  {(!week?.lexicon || week.lexicon.length === 0) && (
                    <p style={{fontSize:16,color:T.muted,fontStyle:"italic",textAlign:"center",padding:"24px 0"}}>Lexicon entries coming soon for this week.</p>
                  )}
                </div>
              )}

              {/* REFLECT */}
              {sec==="reflect" && (
                <div>
                  <label style={LBL}>Reflection Questions</label>
                  {(week.reflectionQuestions || []).map((q,i)=>(
                    <div key={i} style={{marginBottom:18}}>
                      <div style={{background:T.bgCard,border:"1px solid "+T.border,borderRadius:9,padding:"12px 16px",marginBottom:8}}>
                        <p style={{fontSize:16,color:T.cream,fontStyle:"italic",margin:0,lineHeight:1.7}}>{q}</p>
                      </div>
                      <textarea rows={4} defaultValue={get("rq"+i)} onFocus={e => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)} onChange={e=>set("rq"+i,e.target.value)} placeholder="Reflect honestly..." style={INP}/>
                      {(get("rq"+i)||'').trim()&&(
                        <div style={{marginTop:6,display:"flex",justifyContent:"flex-end"}}>
                          <CopyBtn text={q+"\n\n"+get("rq"+i)} label="Copy Reflection" T={T}/>
                        </div>
                      )}
                    </div>
                  ))}
                  {(!week.reflectionQuestions || week.reflectionQuestions.length === 0) && (
                    <p style={{color:T.muted,fontStyle:"italic",marginBottom:18}}>No reflection questions for this week.</p>
                  )}
                  <SaveBtn onSave={save} flash={flash} T={T}/>
                </div>
              )}

              {/* APPLY */}
              {sec==="apply" && (
                <div>
                  <label style={LBL}>Application + Action Step</label>
                  <div style={{background:"linear-gradient(145deg,"+T.goldF+","+T.goldF+")",border:"1px solid "+T.goldB,borderRadius:14,padding:"20px 22px",marginBottom:18}}>
                    <p style={{fontSize:16,color:T.text,lineHeight:1.85,margin:0,whiteSpace:"pre-line"}}>{week.application || 'No application content this week.'}</p>
                    <div style={{marginTop:12,paddingTop:10,borderTop:"1px solid "+T.border,display:"flex",justifyContent:"flex-end",gap:8}}>
                      <CopyBtn text={"Week "+wk+" Application\n\n"+(week.application||'')} label="Copy Application" T={T}/>
                    </div>
                  </div>
                  <label style={LBL}>How Will You Live This Out?</label>
                  <textarea rows={5} defaultValue={get("apply")} onFocus={e => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)} onChange={e=>set("apply",e.target.value)} placeholder="Write your specific plan here..." style={INP}/>
                  <SaveBtn onSave={save} flash={flash} T={T}/>
                </div>
              )}

              {/* PRAYER */}
              {sec==="prayer" && (
                <div>
                  <label style={LBL}>This Week's Prayer</label>
                  <div style={{background:T.purpleF,border:"1px solid "+T.purpleB,borderRadius:14,padding:"22px 24px",marginBottom:4}}>
                    <p style={{fontSize:17,color:T.cream,lineHeight:1.65,fontStyle:"italic",margin:"0 0 14px",whiteSpace:"pre-line"}}>{week.prayer || 'No prayer text for this week.'}</p>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      <CopyBtn text={week.prayer||''} label="Copy Prayer" T={T}/>
                    </div>
                  </div>
                  <div style={{marginBottom:18}}/>
                  <label style={LBL}>Your Personal Prayer</label>
                  <textarea rows={6} defaultValue={get("prayer")} onFocus={e => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)} onChange={e=>set("prayer",e.target.value)} placeholder="Write your own prayer for this week..." style={INP}/>
                  <SaveBtn onSave={save} flash={flash} T={T}/>
                </div>
              )}

              {/* TRACKER */}
              {sec==="tracker" && (
                <div>
                  <label style={LBL}>Daily Tracker — Week {wk}</label>
                  <div style={{display:"grid",gap:8,marginBottom:20}}>
                    {DAYS.map((d,i)=>(
                      <div key={i} style={{background:T.bgCard,border:"1px solid "+T.border,borderRadius:10,padding:"10px 14px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                          <button onClick={()=>setDay(day===i?-1:i)} style={{background:day===i?T.goldF:"transparent",border:"1px solid "+(day===i?T.goldB:T.border),color:day===i?T.gold:T.muted,padding:"4px 14px",borderRadius:6,cursor:"pointer",fontSize:13,fontFamily:"Cinzel,serif",transition:"all .15s"}}>{d}</button>
                          {(get("tr_"+i)||"").trim()&&<span style={{width:7,height:7,borderRadius:"50%",background:T.green,display:"inline-block"}}/>}
                        </div>
                        {day===i&&<textarea className="fu" rows={3} defaultValue={get("tr_"+i)} onFocus={e => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)} onChange={e=>set("tr_"+i,e.target.value)} placeholder={d+": Where did you see surrender, growth, or God's faithfulness today?"} style={INP}/>}
                      </div>
                    ))}
                  </div>
                  <label style={LBL}>Gratitude (3 things this week)</label>
                  <textarea rows={3} defaultValue={get("gratitude")} onFocus={e => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)} onChange={e=>set("gratitude",e.target.value)} placeholder="What are you grateful for this week?" style={{...INP,marginBottom:14}}/>
                  <label style={LBL}>End of Week Reflection</label>
                  <textarea rows={4} defaultValue={get("weekreflect")} onFocus={e => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)} onChange={e=>set("weekreflect",e.target.value)} placeholder="What changed in you this week?" style={INP}/>
                  <SaveBtn onSave={save} flash={flash} T={T}/>
                </div>
              )}

              {/* COMMUNITY */}
              {sec==="community" && (
                <div>
                  <label style={LBL}>Community Reflections — Week {wk}</label>
                  <p style={{fontSize:16,color:T.muted,fontStyle:"italic",marginBottom:20,lineHeight:1.75}}>Share one insight, takeaway, or truth God highlighted for you this week.</p>
                  <textarea rows={4} value={communityInput} onChange={e=>setCommunityInput(e.target.value)} placeholder="Share what God revealed to you this week..." style={{...INP,marginBottom:10}}/>
                  <button onClick={async()=>{
                    if(!communityInput.trim()) return;
                    const {data} = await supabase.from('community_notes_y2').insert({user_id:session.user.id,week:wk,text:communityInput.trim(),date:new Date().toLocaleDateString()}).select().single();
                    if(data) setCommunityNotes(prev => [data, ...prev]);
                    setCommunityDone(true);
                    setCommunityInput('');
                    setTimeout(()=>setCommunityDone(false),3000);
                  }} style={{background:communityDone?T.greenF:T.goldF,border:"1px solid "+(communityDone?T.greenB:T.goldB),color:communityDone?T.green:T.gold,padding:"9px 18px",borderRadius:8,cursor:"pointer",fontSize:12,fontFamily:"Cinzel,serif",letterSpacing:"0.08em",marginBottom:24,transition:"all .3s"}}>
                    {communityDone?"✓ Shared!":"Share with Community"}
                  </button>

                  {/* Display community notes */}
                  {communityNotes.length > 0 && (
                    <div>
                      <div style={{fontFamily:"Cinzel,serif",fontSize:11,color:T.gold,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:12}}>What Others Are Sharing</div>
                      {communityNotes.map((note,i)=>(
                        <div key={note.id || i} style={{background:T.bgCard,border:"1px solid "+T.border,borderRadius:10,padding:"12px 16px",marginBottom:8}}>
                          <p style={{fontSize:16,color:T.text,lineHeight:1.7,margin:"0 0 6px",fontStyle:"italic"}}>"{note.text}"</p>
                          <p style={{fontSize:14,color:T.muted,margin:0}}>{note.created_at ? new Date(note.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'}) : note.date}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* PROGRESS VIEW */}
        {view==='contents' && (
          <div className="fi">
            <h2 style={{fontFamily:"Cinzel,serif",fontSize:20,color:T.cream,marginTop:17,marginBottom:3}}>Table of Contents</h2>
            <p style={{fontSize:16,color:T.muted,fontStyle:"italic",marginTop:16,marginBottom:20}}>52 weeks of deeper formation. Tap any week to open it.</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(225px,1fr))",gap:8}}>
              {ALL_WEEKS.map(w=>{
                const done=daysComplete(w.week);
                const cur=w.week===wk;
                return (
                  <button key={w.week} onClick={()=>{goWk(w.week);setView('journal');}} style={{background:cur?"linear-gradient(145deg,"+T.goldF+","+T.goldF+")":done>0?"linear-gradient(145deg,"+T.greenF+","+T.greenF+")":T.bgCard,border:"1px solid "+(cur?T.goldB:done>0?T.greenB:T.border),borderRadius:12,padding:"13px 16px",cursor:"pointer",textAlign:"left",transition:"all .25s"}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                      <span style={{fontSize:11,color:cur?T.gold:T.muted,fontFamily:"Cinzel,serif",letterSpacing:"0.1em"}}>WEEK {w.week}</span>
                      {done>0&&<span style={{fontSize:14,color:T.green}}>{done}/7</span>}
                    </div>
                    <div style={{fontSize:16,color:cur?T.cream:T.text,fontWeight:600,lineHeight:1.3}}>{w.theme}</div>
                    {w.verseRef&&<div style={{fontSize:14,color:T.muted,marginTop:2,fontStyle:"italic"}}>{w.verseRef}</div>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {view==='progress' && (
          <div className="fi">
            <h2 style={{fontFamily:"Cinzel,serif",fontSize:20,color:T.cream,marginTop:17,marginBottom:3}}>Your Progress</h2>
            <p style={{fontSize:16,color:T.muted,fontStyle:"italic",marginTop:16,marginBottom:22}}>Year 2 — 52 weeks of deeper formation.</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:8,marginBottom:20}}>
              {[
                [ALL_WEEKS.filter(w=>daysComplete(w.week)>0).length,"Weeks Active","📖"],
                [wk,"Current Week","⚓"],
                [ALL_WEEKS.reduce((a,w)=>a+daysComplete(w.week),0),"Days Logged","✅"],
                [entries.filter(e=>e.field_key==='prayer'&&(e.field_value||'').trim()).length,"Prayers Written","🙏"],
              ].map(([val,label,icon])=>(
                <div key={label} style={{background:T.bgCard,border:"1px solid "+T.border,borderRadius:14,padding:"18px 8px",textAlign:"center",boxShadow:"0 4px 16px rgba(0,0,0,0.08)",minWidth:0}}>
                  <div style={{fontSize:20,marginBottom:4}}>{icon}</div>
                  <div style={{fontSize:24,fontWeight:600,color:T.cream,fontFamily:"Cinzel,serif",marginBottom:2}}>{val}</div>
                  <div style={{fontSize:14,color:T.muted,letterSpacing:"0.04em",marginTop:2,overflowWrap:"anywhere"}}>{label}</div>
                </div>
              ))}
            </div>
            <div style={{background:T.bgCard,border:"1px solid "+T.border,borderRadius:12,padding:"16px",marginBottom:18}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}>
                <span style={{fontSize:11,color:T.gold,fontFamily:"Cinzel,serif",letterSpacing:"0.12em",textTransform:"uppercase"}}>Year Progress</span>
                <span style={{fontSize:14,color:T.muted}}>Week {wk} of 52 · {Math.round((wk/52)*100)}%</span>
              </div>
              <div style={{background:T.border,borderRadius:5,height:7,overflow:"hidden"}}>
                <div style={{height:"100%",background:"linear-gradient(90deg,#A07840,#C9A96E)",width:((wk/52)*100)+"%",transition:"width .6s ease"}} />
              </div>
            </div>
            <div style={{background:T.bgCard,border:"1px solid "+T.border,borderRadius:12,padding:"16px"}}>
              <div style={{fontSize:11,color:T.gold,fontFamily:"Cinzel,serif",letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:14}}>Your Journey Map</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                {ALL_WEEKS.map(w=>{
                  const done=daysComplete(w.week);
                  const cur=w.week===wk;
                  const pct=done/7;
                  const bg=cur?T.gold:pct===1?T.green:pct>0?"rgba(124,146,132,"+(0.25+pct*0.55)+")":T.bgCard;
                  return (
                    <button key={w.week} onClick={()=>{goWk(w.week);setView('journal');}} title={"Week "+w.week+": "+w.theme} style={{width:26,height:26,borderRadius:6,background:bg,border:"1px solid "+(cur?T.goldB:T.border),cursor:"pointer",fontSize:11,color:cur?T.bg:pct===1?(darkMode?T.bg:"#fff"):pct>0?T.cream:T.muted,fontFamily:"Cinzel,serif",padding:0}}>
                      {w.week}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {view==='search' && (
          <div className="fi">
            <h2 style={{fontFamily:"Cinzel,serif",fontSize:20,color:T.cream,marginTop:17,marginBottom:4}}>Search</h2>
            <p style={{fontSize:16,color:T.muted,fontStyle:"italic",marginTop:16,marginBottom:16}}>Search across all 52 weeks of Year 2.</p>
            <input
              value={searchQuery}
              onChange={e=>{
                const q=e.target.value; setSearchQuery(q);
                if(!q.trim()){setSearchResults([]);return;}
                const ql=q.toLowerCase();
                const results=[];
                (ALL_WEEKS||[]).forEach(w=>{
                  const fields=['theme','passage','context','dontmiss','study','reflect','apply','prayer'];
                  fields.forEach(f=>{
                    const val=(w[f]||'').toLowerCase();
                    if(val.includes(ql)){
                      results.push({week:w.week,theme:w.theme,field:f,snippet:(w[f]||'').slice(0,120)});
                    }
                  });
                });
                setSearchResults(results.slice(0,40));
              }}
              placeholder="Search weeks, themes, study notes…"
              style={{width:'100%',background:T.bgCard,border:'1px solid '+T.goldB,borderRadius:10,
                color:T.cream,fontSize:16,padding:'12px 14px',outline:'none',
                fontFamily:"'EB Garamond',Georgia,serif",boxSizing:'border-box',marginBottom:20}}
            />
            {searchQuery.trim() && (
              <div style={{fontSize:12,color:T.muted,marginBottom:12,fontFamily:"Cinzel,serif",letterSpacing:"0.06em"}}>
                {searchResults.length} result{searchResults.length!==1?'s':''} for "{searchQuery}"
              </div>
            )}
            {searchResults.map((r,i)=>(
              <div key={i} onClick={()=>{ goWk(r.week); setView('journal'); setSearchQuery(''); }}
                style={{background:T.bgCard,border:'1px solid '+T.border,borderRadius:12,
                  padding:'14px 16px',marginBottom:8,cursor:'pointer',transition:'border-color .2s'}}
                onMouseEnter={e=>e.currentTarget.style.borderColor=T.goldB}
                onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:5}}>
                  <span style={{fontSize:11,color:T.gold,fontFamily:"Cinzel,serif",letterSpacing:'0.1em',textTransform:'uppercase'}}>
                    Week {r.week} · {r.theme}
                  </span>
                  <span style={{fontSize:11,color:T.muted,fontFamily:"Cinzel,serif",letterSpacing:'0.06em',textTransform:'uppercase',background:T.goldF,border:'1px solid '+T.goldB,borderRadius:6,padding:'2px 8px'}}>
                    {r.field==='dontmiss'?"Don't Miss":r.field.charAt(0).toUpperCase()+r.field.slice(1)}
                  </span>
                </div>
                <p style={{fontSize:16,color:T.text,lineHeight:1.7,margin:0}}>{r.snippet}{r.snippet.length>=120?'…':''}</p>
              </div>
            ))}
            {searchQuery.trim() && searchResults.length===0 && (
              <div style={{textAlign:'center',padding:'48px 0',color:T.muted,fontSize:16,fontStyle:'italic'}}>
                No results for "{searchQuery}"
              </div>
            )}
            {!searchQuery.trim() && bookmarks.length===0 && (
              <div style={{textAlign:'center',padding:'48px 0',color:T.muted,fontSize:16,fontStyle:'italic'}}>
                Start typing to search across all 52 weeks.
                <div style={{fontSize:16,marginTop:6}}>Tap ☆ on any verse to save it. Your saved verses show up here.</div>
              </div>
            )}
            {!searchQuery.trim() && bookmarks.length>0 && (
              <div>
                <div style={{fontSize:11,color:T.gold,fontFamily:"Cinzel,serif",letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:12}}>☆ Saved verses · {bookmarks.length}</div>
                {savedCards}
              </div>
            )}
          </div>
        )}

        {/* SETTINGS VIEW */}
        {view==='settings' && (
          <div className="fi" style={{padding:18}}>
            <h2 style={{fontFamily:"Cinzel,serif",fontSize:20,color:T.cream,marginBottom:20}}>Settings</h2>

            {/* Appearance */}
            <div style={{background:T.bgCard,border:"1px solid "+T.border,borderRadius:14,padding:"18px 20px",marginBottom:12}}>
              <div style={{fontFamily:"Cinzel,serif",fontSize:11,color:T.gold,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:14}}>Appearance</div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <span style={{fontSize:16,color:T.text}}>Dark Mode</span>
                <button onClick={()=>setDarkMode(d=>!d)} style={{background:darkMode?T.goldF:"transparent",border:"1px solid "+(darkMode?T.goldB:T.border),color:darkMode?T.gold:T.muted,padding:"6px 16px",borderRadius:20,cursor:"pointer",fontSize:12,fontFamily:"Cinzel,serif"}}>
                  {darkMode?"On":"Off"}
                </button>
              </div>
            </div>

            {/* Refer a Friend */}
            <div style={{background:T.bgCard,border:"1px solid "+T.border,borderRadius:14,padding:"18px 20px",marginBottom:12}}>
              <div style={{fontFamily:"Cinzel,serif",fontSize:11,color:T.gold,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:10}}>Refer a Friend</div>
              <p style={{fontSize:16,color:T.muted,lineHeight:1.65,marginBottom:14}}>Share Anchored Steps Year 2 with someone ready to go deeper.</p>
              <div style={{background:T.goldF,border:"1px solid "+T.goldB,borderRadius:10,padding:"12px 14px",marginBottom:12,fontFamily:"Cinzel,serif",fontSize:12,color:T.gold,letterSpacing:"0.04em"}}>
                steps2.eloraradiance.com
              </div>
              <button onClick={()=>{navigator.clipboard.writeText("steps2.eloraradiance.com").then(()=>alert("Link copied!"));}} style={{width:"100%",background:T.goldF,border:"1px solid "+T.goldB,color:T.gold,padding:"10px",borderRadius:10,cursor:"pointer",fontSize:12,fontFamily:"Cinzel,serif",letterSpacing:"0.08em"}}>
                Copy Link
              </button>
            </div>

            {/* Account */}
            <div style={{background:T.bgCard,border:"1px solid "+T.border,borderRadius:14,padding:"18px 20px",marginBottom:12}}>
              <div style={{fontFamily:"Cinzel,serif",fontSize:11,color:T.gold,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:14}}>Account</div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <span style={{fontSize:16,color:T.muted}}>Email</span>
                <span style={{fontSize:16,color:T.text}}>{session.user.email}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
                <span style={{fontSize:16,color:T.muted}}>Plan</span>
                <span style={{fontSize:12,color:T.gold,fontFamily:"Cinzel,serif",background:T.goldF,border:"1px solid "+T.goldB,padding:"3px 10px",borderRadius:12}}>'Lifetime Access'</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:14,borderTop:"1px solid "+T.border}}>
                <span style={{fontSize:16,color:T.muted}}>Progress</span>
                <span style={{fontSize:16,color:T.text}}>{ALL_WEEKS.filter(w=>entries.some(e=>e.week===w.week&&(e.field_value||'').trim())).length} / 52 weeks</span>
              </div>
            </div>

            {/* Support */}
            <div style={{background:T.bgCard,border:"1px solid "+T.border,borderRadius:14,padding:"18px 20px",marginBottom:12}}>
              <div style={{fontFamily:"Cinzel,serif",fontSize:11,color:T.gold,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:10}}>Support</div>
              <p style={{fontSize:16,color:T.muted,lineHeight:1.65,marginBottom:14}}>Questions, feedback, or need help with your account?</p>
              <a href="mailto:support@eloraradiance.com" style={{display:"block",textAlign:"center",width:"100%",boxSizing:"border-box",background:T.goldF,border:"1px solid "+T.goldB,color:T.gold,padding:"10px",borderRadius:10,fontSize:12,fontFamily:"Cinzel,serif",letterSpacing:"0.08em",textDecoration:"none"}}>
                Email Support
              </a>
            </div>

            {/* Sign Out */}
            <button onClick={()=>setShowSignOutConfirm(true)} style={{width:"100%",background:"transparent",border:"1px solid "+T.redB,color:T.red,padding:"12px",borderRadius:10,cursor:"pointer",fontSize:13,fontFamily:"Cinzel,serif",letterSpacing:"0.06em"}}>Sign Out</button>
          </div>
        )}
      </div>

      {/* Sign Out Confirm Modal */}
      {showSignOutConfirm && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:"calc(24px + var(--safe-top, env(safe-area-inset-top, 0px))) 24px calc(24px + env(safe-area-inset-bottom, 0px))"}} onClick={()=>setShowSignOutConfirm(false)}>
          <div style={{background:"linear-gradient(145deg,"+T.bg+","+T.bgMid+")",border:"1px solid "+T.goldB,borderRadius:18,padding:24,maxWidth:340,width:"100%"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontFamily:"Cinzel,serif",fontSize:11,color:T.gold,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:12,textAlign:"center"}}>Sign Out?</div>
            <p style={{fontSize:16,color:T.text,lineHeight:1.7,marginBottom:18,textAlign:"center"}}>Your progress is saved automatically. You can sign back in anytime.</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <button onClick={()=>setShowSignOutConfirm(false)} style={{background:"transparent",border:"1px solid "+T.border,color:T.muted,padding:"11px",borderRadius:10,cursor:"pointer",fontSize:12,fontFamily:"Cinzel,serif",letterSpacing:"0.08em"}}>Cancel</button>
              <button onClick={()=>supabase.auth.signOut()} style={{background:T.redF,border:"1px solid "+T.redB,color:T.red,padding:"11px",borderRadius:10,cursor:"pointer",fontSize:12,fontFamily:"Cinzel,serif",letterSpacing:"0.08em"}}>Sign Out</button>
            </div>
          </div>
        </div>
      )}

      {/* Quiz Modal */}
      {quizVerse && (
        <MemorizeModal verse={quizVerse} onClose={()=>setQuizVerse(null)} onPass={()=>set("mem_"+(quizVerse.key||quizVerse.ref),"1")} T={T}/>
      )}


      {/* Share Verse Modal */}
       {shareVerse && (()=>{
        const TYPES=[
          {id:'passage',  icon:'📖', label:'Passage',     body:shareVerse?.verseText||shareVerse?.verse||shareVerse?.text||'', ref:shareVerse?.verseRef||null, show:true},
          {id:'context',  icon:'🧭', label:'Context',     body:week?.whereAreWe||week?.readInContext||'', ref:null, show:!!(week?.whereAreWe||week?.readInContext)},
          {id:'dontmiss', icon:'⚠️', label:"Don't Miss", body:week?.dontMissThis||'', ref:null, show:!!(week?.dontMissThis)},
          {id:'study',    icon:'🧠', label:'Study',       body:week?.studyNotes||'', ref:null, show:!!(week?.studyNotes)},
          {id:'reflect',  icon:'💭', label:'Reflect',     body:(week?.reflectionQuestions||[])[0]||'', ref:null, show:!!((week?.reflectionQuestions||[])[0])},
          {id:'apply',    icon:'⚒️', label:'Apply',       body:week?.application||'', ref:null, show:!!(week?.application)},
          {id:'prayer',   icon:'🙏', label:'Prayer',      body:week?.prayer||'', ref:null, show:!!(week?.prayer)},
        ].filter(t=>t.show)
        const ct=TYPES.find(t=>t.id===shareCardType)||TYPES[0]
        if(!ct)return null
        const D=DARK_THEME // the share sheet is always dark, whatever the app theme
        const QUOTE={passage:true}
        const ITALIC={passage:true,reflect:true,prayer:true}
        const excerpt=captionExcerpt(ct.body)
        const captionText=[
          ct.body?(QUOTE[ct.id]?'“'+excerpt+'”':excerpt):null,
          ct.ref?'— '+ct.ref:null,
          '',
          'Week '+wk+': '+(week?.theme||''),
          '',
          'Anchored Steps Year 2 — Deeper faith. Harder truth. Real growth.',
          'steps2.eloraradiance.com',
        ].filter(l=>l!==null).join('\n').replace(/\n{3,}/g,'\n\n').trim()
        // Card colors (contrast-checked on each background)
        const cc=shareCardLight
          ?{bg:'linear-gradient(155deg,#F2EDE3 0%,#E8E1D4 100%)',canvas:'#F2EDE3',frame:'rgba(107,78,24,0.35)',divider:'rgba(107,78,24,0.28)',text:'#1A1209',gold:'#6B4E18',muted:'#5E4E3C',glow:'radial-gradient(ellipse at 85% 0%, rgba(160,120,64,0.12) 0%, transparent 55%)'}
          :{bg:'linear-gradient(155deg,#0D1820 0%,#172330 100%)',canvas:'#0D1820',frame:'rgba(201,161,95,0.35)',divider:'rgba(201,161,95,0.28)',text:'#F0ECE3',gold:'#C9A15F',muted:'#AEBBC6',glow:'radial-gradient(ellipse at 85% 0%, rgba(160,120,64,0.16) 0%, transparent 55%)'}
        const cardHeader=(
          <div style={{display:'flex',alignItems:'center',gap:30}}>
            <img src={ASSET+"icon2.png"} alt="" style={{width:112,height:112,borderRadius:24,flexShrink:0}}/>
            <div style={{minWidth:0}}>
              <div style={{fontSize:46,color:cc.gold,fontFamily:'Cinzel,serif',letterSpacing:'0.05em',lineHeight:1.2}}>Anchored Steps · Year 2</div>
              <div style={{fontSize:36,color:cc.muted,lineHeight:1.3,marginTop:4,fontFamily:'EB Garamond,Georgia,serif'}}>Week {wk} · {week?.theme}</div>
            </div>
          </div>
        )
        const pill=(on)=>({padding:'8px 6px',borderRadius:9,cursor:'pointer',fontSize:12,fontFamily:'Cinzel,serif',background:on?D.goldF:'rgba(255,255,255,0.04)',border:'1px solid '+(on?'rgba(201,161,95,0.45)':'rgba(255,255,255,0.1)'),color:on?D.gold:D.muted,transition:'all .2s'})
        const copyBody=()=>{navigator.clipboard?.writeText(ct.body+(ct.ref?'\n— '+ct.ref:''));setTextCopied(true);setTimeout(()=>setTextCopied(false),2000)}
        return(
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:500,display:'flex',alignItems:'flex-start',justifyContent:'center',overflowY:'auto',padding:'calc(16px + var(--safe-top, env(safe-area-inset-top, 0px))) 16px calc(48px + env(safe-area-inset-bottom, 0px))'}} onClick={()=>setShareVerse(null)}>
            <div role="dialog" aria-modal="true" aria-label="Share card" style={{background:'linear-gradient(145deg,'+D.bg+',#172330)',border:'1px solid '+D.goldB,borderRadius:20,padding:'20px 16px',width:'100%',maxWidth:440,marginTop:24}} onClick={e=>e.stopPropagation()}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
                <div style={{fontSize:12,color:D.gold,fontFamily:'Cinzel,serif',letterSpacing:'0.18em',textTransform:'uppercase'}}>Share Card</div>
                <button onClick={()=>setShareVerse(null)} aria-label="Close" style={{background:'transparent',border:'none',color:D.muted,cursor:'pointer',fontSize:24,lineHeight:1,minWidth:44,minHeight:44}}>×</button>
              </div>
              <div style={{display:'flex',gap:6,marginBottom:10,flexWrap:'wrap'}}>
                {TYPES.map(t=>(
                  <button key={t.id} onClick={()=>setShareCardType(t.id)} aria-pressed={ct.id===t.id} style={{...pill(ct.id===t.id),flex:'1 1 auto'}}>
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:14}}>
                <div style={{display:'flex',gap:6}}>
                  {[['☀ Light',true],['🌙 Dark',false]].map(([label,val])=>(
                    <button key={String(val)} onClick={()=>setShareCardLight(val)} aria-pressed={shareCardLight===val} style={{...pill(shareCardLight===val),flex:1}}>{label}</button>
                  ))}
                </div>
                <div style={{display:'flex',gap:6}}>
                  <FormatPicker value={shareFormat} onChange={setShareFormat} renderButton={({key,active,label,onClick})=>(
                    <button key={key} onClick={onClick} aria-pressed={active} style={{...pill(active),flex:1}}>{label}</button>
                  )}/>
                </div>
              </div>
              <ShareComposer
                formatId={shareFormat}
                theme={{bg:cc.bg,glow:cc.glow,frame:cc.frame,divider:cc.divider,label:cc.gold,footer:cc.gold,muted:cc.muted,dot:D.gold,display:'Cinzel, serif',footerLine:'Walk steadily. Stay anchored.',url:'steps2.eloraradiance.com'}}
                header={cardHeader}
                label={ct.label}
                content={{text:ct.body}}
                refText={ct.ref}
                bodyStyle={{font:'EB Garamond, Georgia, serif',italic:!!ITALIC[ct.id],color:cc.text,refColor:cc.gold,refFont:'Cinzel, serif'}}
                background={cc.canvas}
                fileBase={'anchored-steps-y2-week'+wk+'-'+ct.id}
                title="Anchored Steps Year 2"
                layoutKey={[wk,ct.id,shareCardLight].join(':')}
                renderActions={({share,shareOne,busy,total,current,note,formatId})=>(
                  <div style={{marginTop:14}}>
                    {total>1&&<p style={{fontSize:14,color:D.muted,textAlign:'center',margin:'0 0 10px',lineHeight:1.5}}>This one is long, so it's a set of {total} cards. Swipe to see each; they share together.{formatId==='post'&&total>=4?' Story size fits more on each card.':''}</p>}
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                      <button onClick={share} disabled={busy} style={{background:'linear-gradient(135deg,rgba(160,120,64,0.3),rgba(160,120,64,0.12))',border:'1px solid rgba(201,161,95,0.45)',color:D.gold,padding:'13px',borderRadius:10,cursor:'pointer',fontSize:13,fontFamily:'Cinzel,serif',letterSpacing:'0.06em',opacity:busy?0.6:1,minHeight:48}}>
                        {busy?'Preparing…':total>1?'🔗 Share all '+total:'🔗 Share Image'}
                      </button>
                      {total>1
                        ?<button onClick={shareOne} disabled={busy} style={{background:'transparent',border:'1px solid rgba(255,255,255,0.12)',color:D.muted,padding:'13px',borderRadius:10,cursor:'pointer',fontSize:13,fontFamily:'Cinzel,serif',minHeight:48}}>Just card {current+1}</button>
                        :<button onClick={copyBody} style={{background:'transparent',border:'1px solid rgba(255,255,255,0.12)',color:D.muted,padding:'13px',borderRadius:10,cursor:'pointer',fontSize:13,fontFamily:'Cinzel,serif',minHeight:48}}>{textCopied?'✓ Copied':'Copy Text'}</button>}
                    </div>
                    {total>1&&<button onClick={copyBody} style={{width:'100%',marginTop:8,background:'transparent',border:'1px solid rgba(255,255,255,0.12)',color:D.muted,padding:'11px',borderRadius:10,cursor:'pointer',fontSize:12,fontFamily:'Cinzel,serif',minHeight:44}}>{textCopied?'✓ Copied':'Copy Full Text'}</button>}
                    {note&&<p role="status" style={{fontSize:14,color:D.gold,textAlign:'center',margin:'10px 0 0'}}>{note}</p>}
                  </div>
                )}
              />
              <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:12,padding:'14px 16px',marginTop:14}}>
                <div style={{fontSize:11,color:D.gold,fontFamily:'Cinzel,serif',letterSpacing:'0.14em',textTransform:'uppercase',marginBottom:10}}>Suggested Caption</div>
                <p style={{fontSize:16,color:D.muted,lineHeight:1.7,margin:'0 0 12px',fontStyle:'italic',whiteSpace:'pre-line'}}>{captionText}</p>
                <button onClick={()=>{navigator.clipboard?.writeText(captionText);setCaptionCopied(true);setTimeout(()=>setCaptionCopied(false),2000)}} style={{width:'100%',background:captionCopied?D.greenF:'transparent',border:'1px solid '+(captionCopied?D.greenB:'rgba(160,120,64,0.3)'),color:captionCopied?D.green:D.gold,padding:'10px',borderRadius:8,cursor:'pointer',fontSize:12,fontFamily:'Cinzel,serif',transition:'all .25s',minHeight:44}}>
                  {captionCopied?'✓ Copied':'Copy Caption'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
      {/* Floating share button (2026-11-19): one share button for the whole week. It opens the share sheet on the
          section you are reading. */}
      {view === 'journal' && week && !shareVerse && !showWeekJump && ( /* hidden while the week list is open, so they never sit on top of it */
        <div style={{position:'fixed',bottom:`calc(14px + ${BELOW_BAR})`,right:16,zIndex:200,display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
          <button
            onClick={() => { setShareCardType(({context:'context',dontmiss:'dontmiss',study:'study',reflect:'reflect',apply:'apply',prayer:'prayer'})[sec] || 'passage'); setShareVerse({verseText:week.verseText,verseRef:week.verseRef}) }}
            aria-label="Share"
            style={{
              width:48, height:48, borderRadius:'50%',
              background:'linear-gradient(135deg, #C9A15F, #7A5A28)',
              border:'none', color:'#fff', fontSize:20, cursor:'pointer',
              boxShadow:'0 6px 18px rgba(0,0,0,0.35), 0 2px 6px rgba(0,0,0,0.3)',
              display:'flex', alignItems:'center', justifyContent:'center',
              touchAction:'manipulation', flexShrink:0,
            }}
          >↗</button>
          {SECTIONS[SECTIONS.findIndex(x=>x.id===sec)+1] && (
            <button
              onClick={() => { const next = SECTIONS[SECTIONS.findIndex(x=>x.id===sec)+1]; if (next) { setSec(next.id); setAnimK(a=>a+1); window.scrollTo(0,0); } }}
              style={{
                backgroundColor:T.bg,backgroundImage:'linear-gradient(135deg,rgba(176,138,78,0.4),rgba(176,138,78,0.2))',
                border:'1px solid rgba(176,138,78,0.5)',
                color:darkMode?T.goldL:T.gold,padding:'10px 20px',borderRadius:50,
                cursor:'pointer',fontSize:12,fontFamily:'Cinzel,serif',
                letterSpacing:'0.07em',boxShadow:'0 4px 20px rgba(0,0,0,0.35)',
                backdropFilter:'blur(10px)',
                display:'flex',alignItems:'center',gap:8,
                transition:'all .2s',touchAction:'manipulation'
              }}
            >
              {SECTIONS[SECTIONS.findIndex(x=>x.id===sec)+1].label} &#8250;
            </button>
          )}
        </div>
      )}
      {tabBar()}
    </div>
  );
}

// Wrap with error boundary
export default function AnchoredStepsY2() {
  return (
    <ErrorBoundary>
      <AnchoredStepsY2Inner />
    </ErrorBoundary>
  );
}
