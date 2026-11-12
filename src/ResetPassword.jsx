import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || "https://cvtukqamaqrhjtdvmslb.supabase.co",
  import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2dHVrcWFtYXFyaGp0ZHZtc2xiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NDU1MjQsImV4cCI6MjA5MTQyMTUyNH0.gSksF5jV-UpuaUL7x7vhHHOB6Z7Qq0iehtbc2PoSAxw"
);

const G = {
  bg:"#0b1825",bgMid:"#132030",
  gold:"#c9a84c",goldB:"rgba(180,140,60,0.28)",
  green:"#78b878",greenB:"rgba(120,184,120,0.28)",greenF:"rgba(120,184,120,0.08)",
  red:"#e07070",redB:"rgba(220,100,100,0.25)",redF:"rgba(220,100,100,0.08)",
  cream:"#ede3cd",text:"#d8cfc0",muted:"#7e92a2",dim:"#3e5060",
  border:"rgba(255,255,255,0.12)",
};

const INP = {
  width:"100%",background:"rgba(255,255,255,0.06)",
  border:"1px solid rgba(255,255,255,0.12)",borderRadius:8,
  color:G.cream,fontSize:16,padding:"12px 14px",outline:"none",
  fontFamily:"EB Garamond,Georgia,serif",marginBottom:12
};

const LBL = {
  fontSize:10,color:G.gold,letterSpacing:"0.15em",
  textTransform:"uppercase",marginBottom:8,display:"block",
  fontFamily:"Cinzel,serif"
};

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    // Parse the hash from the URL — Supabase puts the token here
    const hash = window.location.hash;
    if (hash && hash.includes("access_token")) {
      // Let Supabase process the hash and establish a session
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setSessionReady(true);
        }
      });
    }

    // Listen for PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setSessionReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async () => {
    setError(""); setMessage("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
    } else {
      setMessage("Password updated! Taking you to your journal...");
      setTimeout(() => {
        window.location.href = "https://steps.eloraradiance.com";
      }, 2000);
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight:"100vh",
      background:"linear-gradient(155deg,#0b1825 0%,#132030 55%,#0b1825 100%)",
      display:"flex",flexDirection:"column",alignItems:"center",
      justifyContent:"center",padding:"24px",
      fontFamily:"EB Garamond,Georgia,serif"
    }}>
      <link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;1,400&family=Cinzel:wght@400;500;600&display=swap" rel="stylesheet"/>
      
      <div style={{fontSize:36,color:G.gold,marginBottom:12}}>&#9875;</div>
      <div style={{fontFamily:"Cinzel,serif",fontSize:22,fontWeight:600,color:G.cream,marginBottom:4}}>Anchored Steps</div>
      <div style={{fontSize:12,color:G.muted,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:28}}>Reset Your Password</div>

      <div style={{
        background:"rgba(255,255,255,0.04)",border:"1px solid "+G.goldB,
        borderRadius:16,padding:"32px",width:"100%",maxWidth:400
      }}>
        {!sessionReady ? (
          <div style={{textAlign:"center",padding:"8px 0"}}>
            <div style={{fontSize:24,marginBottom:12}}>&#8987;</div>
            <p style={{color:G.muted,fontSize:15,lineHeight:1.7,marginBottom:12}}>
              Verifying your reset link...
            </p>
            <p style={{color:G.dim,fontSize:13,fontStyle:"italic"}}>
              If this page stays stuck, go back to the app and request a new password reset link.
            </p>
          </div>
        ) : (
          <div>
            <p style={{color:G.muted,fontSize:15,lineHeight:1.7,marginBottom:20,textAlign:"center",fontStyle:"italic"}}>
              Choose a new password for your journal.
            </p>

            {error && (
              <div style={{background:G.redF,border:"1px solid "+G.redB,borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:13,color:G.red,textAlign:"center"}}>
                {error}
              </div>
            )}
            {message && (
              <div style={{background:G.greenF,border:"1px solid "+G.greenB,borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:13,color:G.green,textAlign:"center"}}>
                {message}
              </div>
            )}

            <label style={LBL}>New Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="min 6 characters"
              style={INP}
            />

            <label style={LBL}>Confirm Password</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="re-enter new password"
              onKeyDown={e => e.key === "Enter" && handleReset()}
              style={{...INP, marginBottom:20}}
            />

            <button
              onClick={handleReset}
              disabled={loading}
              style={{
                width:"100%",
                background:"linear-gradient(135deg,rgba(180,140,60,0.3),rgba(180,140,60,0.15))",
                border:"1px solid "+G.goldB,color:G.gold,padding:"13px",
                borderRadius:8,cursor:"pointer",fontSize:14,
                fontFamily:"Cinzel,serif",letterSpacing:"0.1em",
                opacity:loading?0.7:1
              }}
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
