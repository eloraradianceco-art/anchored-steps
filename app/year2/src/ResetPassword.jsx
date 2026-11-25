import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabaseConfig.js";

// Same shared database as App_Y2
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const G = {
  bg: "#0D1820", bgMid: "#172330",
  gold: "#A07840", goldF: "rgba(160,120,64,0.12)", goldB: "rgba(160,120,64,0.28)",
  cream: "#F0ECE3", text: "#E0D8CA", muted: "#A0AAB2",
  red: "#D97A7A", redF: "rgba(217,122,122,0.08)", redB: "rgba(217,122,122,0.24)",
  green: "#7C9284", greenF: "rgba(124,146,132,0.12)", greenB: "rgba(124,146,132,0.28)",
  border: "rgba(255,255,255,0.06)",
};

const INP = {
  width: "100%",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 10,
  padding: "12px 14px",
  color: G.text,
  fontSize: 15,
  fontFamily: "EB Garamond,Georgia,serif",
  boxSizing: "border-box",
  outline: "none",
  lineHeight: 1.7,
};

export default function ResetPassword() {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  // 'waiting' = page loaded, watching for recovery session
  // 'ready'   = recovery session confirmed, show the form
  // 'saving'  = submitting
  // 'done'    = password changed successfully
  // 'error'   = something failed
  const [phase, setPhase] = useState("waiting");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    // Supabase v2 automatically parses the #access_token from the URL hash
    // and fires PASSWORD_RECOVERY when the link comes from a reset email.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "PASSWORD_RECOVERY") {
          setPhase("ready");
        }
      }
    );

    // Also check if we already have a valid session (e.g. page refresh)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && phase === "waiting") {
        setPhase("ready");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async () => {
    setErrorMsg("");
    if (!pw) { setErrorMsg("Please enter a new password."); return; }
    if (pw.length < 6) { setErrorMsg("Password must be at least 6 characters."); return; }
    if (pw !== confirm) { setErrorMsg("Passwords don't match."); return; }

    setPhase("saving");
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) {
      setErrorMsg(error.message);
      setPhase("ready");
    } else {
      setPhase("done");
      // Sign out so they land on a clean login screen
      setTimeout(() => supabase.auth.signOut(), 1500);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: `linear-gradient(155deg, ${G.bg} 0%, ${G.bgMid} 55%, ${G.bg} 100%)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "32px 24px",
      fontFamily: "EB Garamond, Georgia, serif",
    }}>
      <link
        href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500&family=EB+Garamond:ital,wght@0,400;0,500;1,400&display=swap"
        rel="stylesheet"
      />

      <div style={{ maxWidth: 380, width: "100%" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <img
            src={import.meta.env.BASE_URL + "icon2.png"} alt="⚓"
            style={{ width: 60, height: 60, borderRadius: 14, marginBottom: 14, boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}
          />
          <div style={{ fontFamily: "Cinzel,serif", fontSize: 11, color: G.gold, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 4 }}>
            Anchored Steps
          </div>
          <div style={{ fontFamily: "Cinzel,serif", fontSize: 20, color: G.cream }}>Year 2</div>
        </div>

        <div style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 18, padding: 28,
        }}>

          {/* ── WAITING for recovery session ── */}
          {phase === "waiting" && (
            <div style={{ textAlign: "center" }}>
              <div style={{
                fontFamily: "Cinzel,serif", fontSize: 11, color: G.gold,
                letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 16,
              }}>
                Verifying Reset Link
              </div>
              <p style={{ fontSize: 14, color: G.muted, lineHeight: 1.75, marginBottom: 20 }}>
                One moment while we confirm your reset link…
              </p>
              <p style={{ fontSize: 12, color: G.dim, lineHeight: 1.65 }}>
                If this page doesn't update, your link may have expired.{" "}
                <a href="/" style={{ color: G.gold, textDecoration: "none" }}>
                  Request a new one →
                </a>
              </p>
            </div>
          )}

          {/* ── FORM ── */}
          {phase === "ready" && (
            <>
              <div style={{
                fontFamily: "Cinzel,serif", fontSize: 11, color: G.gold,
                letterSpacing: "0.14em", textTransform: "uppercase",
                marginBottom: 20, textAlign: "center",
              }}>
                Set a New Password
              </div>

              <input
                value={pw}
                onChange={e => setPw(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
                placeholder="New password"
                type="password"
                autoFocus
                style={{ ...INP, marginBottom: 12 }}
              />
              <input
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
                placeholder="Confirm new password"
                type="password"
                style={{ ...INP, marginBottom: 12 }}
              />

              {errorMsg && (
                <div style={{ color: G.red, fontSize: 13, marginBottom: 12, textAlign: "center" }}>
                  {errorMsg}
                </div>
              )}

              <button
                onClick={handleSubmit}
                style={{
                  width: "100%",
                  background: G.goldF,
                  border: `1px solid ${G.goldB}`,
                  color: G.gold,
                  padding: "14px",
                  borderRadius: 12,
                  cursor: "pointer",
                  fontSize: 13,
                  fontFamily: "Cinzel,serif",
                  letterSpacing: "0.1em",
                  marginBottom: 14,
                  transition: "all .2s",
                }}
              >
                Update Password
              </button>

              <div style={{ textAlign: "center" }}>
                <a href="/" style={{ fontSize: 12, color: G.muted, textDecoration: "none" }}>
                  Back to Sign In
                </a>
              </div>
            </>
          )}

          {/* ── SAVING ── */}
          {phase === "saving" && (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontFamily: "Cinzel,serif", fontSize: 12, color: G.gold, letterSpacing: "0.1em" }}>
                Updating…
              </div>
            </div>
          )}

          {/* ── DONE ── */}
          {phase === "done" && (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>✓</div>
              <div style={{
                fontFamily: "Cinzel,serif", fontSize: 13, color: G.green,
                letterSpacing: "0.08em", marginBottom: 10,
              }}>
                Password Updated
              </div>
              <p style={{ fontSize: 14, color: G.muted, lineHeight: 1.75, marginBottom: 20 }}>
                Your password has been changed. Redirecting you to sign in…
              </p>
              <a
                href="/"
                style={{
                  display: "block", textAlign: "center",
                  background: G.goldF, border: `1px solid ${G.goldB}`,
                  color: G.gold, padding: "12px", borderRadius: 10,
                  fontSize: 12, fontFamily: "Cinzel,serif",
                  letterSpacing: "0.08em", textDecoration: "none",
                }}
              >
                Sign In
              </a>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
