// EntryScreens.jsx — the same file in Anchored Steps Year 1, Year 2, Armed & Anchored and The Red Letters.
// One front door for every Elora Radiance app, each in its own colors and words (the app's BRAND):
//   <Welcome>       signed out: brand, key verse, what's inside, one main button, "Sign in"
//                   signed in without access: the same page with "I've Paid · Check Again" and Sign out
//   <AuthCard>      sign in / create account / reset password (the app keeps its own sign-in logic)
//   <HomeScreenTip> "Add to your Home Screen" after a new account
import { useState } from 'react'

const DISPLAY = "'Cinzel',Georgia,serif"
const BODY = "'EB Garamond',Georgia,serif"

function Page({ b, children, top = false }) {
  const c = b.colors
  return (
    <div className="er-page" style={{ '--er-ph': c.placeholder || c.muted,
      minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: top ? 'flex-start' : 'center', background: `${c.glow}, ${c.bg}`,
      fontFamily: BODY, color: c.text, textAlign: 'center', boxSizing: 'border-box',
      padding: 'calc(env(safe-area-inset-top, 0px) + 28px) 18px calc(env(safe-area-inset-bottom, 0px) + 32px)',
    }}>
      <style>{'.er-page input::placeholder{color:var(--er-ph);opacity:.75}'}</style>
      <div style={{ maxWidth: 460, width: '100%' }}>{children}</div>
    </div>
  )
}

function Mark({ b, size }) {
  if (b.icon) return <img src={b.icon} alt="" width={size} height={size} style={{ width: size, height: size, borderRadius: Math.round(size * 0.24), display: 'block', margin: '0 auto 14px', boxShadow: '0 4px 16px rgba(0,0,0,0.25)' }} />
  if (b.glyph) return <div aria-hidden="true" style={{ fontSize: Math.round(size * 0.55), lineHeight: 1, marginBottom: 12, color: b.colors.accent }}>{b.glyph}</div>
  return null
}

function Title({ b, size }) {
  const c = b.colors
  return (
    <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
      {b.flank && <span aria-hidden="true" style={{ fontSize: size * 0.8, opacity: 0.65, transform: 'scaleX(-1)', display: 'inline-block' }}>{b.flank}</span>}
      <span style={{ fontSize: size, fontWeight: 700, color: c.title, fontFamily: DISPLAY, letterSpacing: '0.04em', lineHeight: 1.15 }}>{b.name}</span>
      {b.flank && <span aria-hidden="true" style={{ fontSize: size * 0.8, opacity: 0.65 }}>{b.flank}</span>}
    </h1>
  )
}

const Eyebrow = ({ b }) => (
  <div style={{ fontSize: 11, color: b.colors.eyebrow, letterSpacing: '0.22em', fontFamily: DISPLAY, textTransform: 'uppercase', marginBottom: 12 }}>
    Elora Radiance Co.
  </div>
)

const linkBtn = (color) => ({
  background: 'none', border: 'none', color, cursor: 'pointer', fontSize: 14, fontFamily: BODY,
  textDecoration: 'underline', textUnderlineOffset: 3, padding: '6px 2px', touchAction: 'manipulation',
})

const primaryBtn = (c) => ({
  display: 'block', width: '100%', boxSizing: 'border-box', background: c.ctaBg, border: `1px solid ${c.ctaBorder}`,
  color: c.ctaText, padding: '16px 24px', borderRadius: 14, fontSize: 16, fontFamily: DISPLAY,
  letterSpacing: '0.08em', cursor: 'pointer', textDecoration: 'none', textAlign: 'center',
  touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
})

function Note({ c, tone = 'ok', children }) {
  const bg = tone === 'error' ? c.errorBg : c.okBg
  const border = tone === 'error' ? c.errorBorder : c.okBorder
  const color = tone === 'error' ? c.errorText : c.okText
  return <div role={tone === 'error' ? 'alert' : 'status'} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: '12px 14px', marginBottom: 14, fontSize: 15, color, lineHeight: 1.6, textAlign: 'left' }}>{children}</div>
}

// ── Welcome / Locked ────────────────────────────────────────────────────
// buyHref: where the main button goes (paid apps). onPrimary: what it does (free apps).
// purchasable=false (App Store app before in-app purchase): no buy button, unavailableNote instead.
export function Welcome({
  brand: b, session, buyHref, onPrimary, onSignIn, onSignOut, purchasable = true, unavailableNote,
  onCheckAgain, checking = false, checkMessage, notice,
}) {
  const c = b.colors
  const signedIn = !!session
  return (
    <Page b={b}>
      <Mark b={b} size={64} />
      <Eyebrow b={b} />
      <Title b={b} size={30} />
      <div style={{ fontSize: 12, color: c.muted, letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: DISPLAY, margin: '8px 0 28px' }}>
        {b.tagline}
      </div>

      <div style={{ background: c.card, border: `1px solid ${c.cardBorder}`, borderRadius: 16, padding: '22px 22px 10px', marginBottom: 22, boxShadow: c.cardShadow || 'none' }}>
        <p style={{ fontSize: 18, color: c.title, lineHeight: 1.7, margin: '0 0 6px', fontStyle: 'italic' }}>“{b.verse.text}”</p>
        <div style={{ fontSize: 11, color: c.accent, fontFamily: DISPLAY, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 18 }}>{b.verse.ref}</div>
        <ul style={{ listStyle: 'none', margin: 0, padding: '16px 0 0', borderTop: `1px solid ${c.divider}`, textAlign: 'left' }}>
          {b.features.map((f) => (
            <li key={f.text} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
              <span aria-hidden="true" style={{ fontSize: 17, width: 22, textAlign: 'center', flexShrink: 0, marginTop: 1 }}>{f.icon}</span>
              <span style={{ fontSize: 16, color: c.text, lineHeight: 1.5 }}>{f.text}</span>
            </li>
          ))}
        </ul>
      </div>

      {purchasable ? (
        <>
          {buyHref
            ? <a href={buyHref} style={primaryBtn(c)}>{b.cta}</a>
            : <button type="button" onClick={onPrimary} style={primaryBtn(c)}>{b.cta}</button>}
          <p style={{ fontSize: 14, color: c.muted, lineHeight: 1.6, margin: '12px 0 0' }}>{b.fine}</p>
        </>
      ) : (
        <>
          {!signedIn && <button type="button" onClick={onSignIn} style={primaryBtn(c)}>Sign In</button>}
          {unavailableNote && <p style={{ fontSize: 14, color: c.muted, lineHeight: 1.6, margin: '12px 0 0' }}>{unavailableNote}</p>}
        </>
      )}

      {signedIn && onCheckAgain && (
        <button type="button" onClick={onCheckAgain} disabled={checking} style={{
          ...primaryBtn(c), marginTop: 12, background: 'transparent', border: `1px solid ${c.cardBorder}`,
          color: c.accent, fontSize: 14, padding: '13px 20px', cursor: checking ? 'default' : 'pointer',
        }}>{checking ? 'Checking…' : "I've Paid · Check Again"}</button>
      )}
      {(notice || checkMessage) && <div style={{ marginTop: 14 }}>{notice && <Note c={c}>{notice}</Note>}{checkMessage && <Note c={c}>{checkMessage}</Note>}</div>}

      <div style={{ marginTop: 22, fontSize: 14, color: c.muted, lineHeight: 1.6 }}>
        {signedIn ? (
          <>
            Signed in as <span style={{ color: c.text }}>{session.user?.email}</span>{onSignOut && <> · <button type="button" onClick={onSignOut} style={linkBtn(c.link)}>Sign out</button></>}
            {purchasable && <div style={{ fontSize: 13, marginTop: 4 }}>Paid with a different email? Sign out and sign in with that one.</div>}
          </>
        ) : (purchasable || b.free) && onSignIn && (
          <>{b.signInPrompt || 'Already have access?'} <button type="button" onClick={onSignIn} style={linkBtn(c.link)}>Sign in</button></>
        )}
      </div>
    </Page>
  )
}

// ── Sign in / create account / reset ────────────────────────────────────
// mode: 'signin' | 'signup' | 'forgot'. The app owns the state and the submit handler.
export function AuthCard({
  brand: b, mode, onMode, email, onEmail, password, onPassword, onSubmit, loading = false,
  error, message, resetSent = false, onResetDone, onBack, allowSignup = true, hideForm = false, children,
}) {
  const c = b.colors
  const [showPw, setShowPw] = useState(false)
  const subtitle = mode === 'forgot' ? 'Reset your password'
    : mode === 'signup' ? (b.signupSubtitle || 'Create your account') : (b.signinSubtitle || 'Welcome back')
  const label = { fontSize: 11, color: c.muted, letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: DISPLAY, margin: '0 0 6px', display: 'block', textAlign: 'left' }
  const input = {
    width: '100%', background: c.inputBg, border: `1px solid ${c.inputBorder}`, borderRadius: 10, color: c.inputText,
    fontSize: 16, padding: '14px 16px', fontFamily: BODY, outline: 'none', boxSizing: 'border-box', marginBottom: 14,
  }
  const submit = (e) => { e.preventDefault(); if (!loading) onSubmit() }
  const switchTo = (m) => { setShowPw(false); onMode(m) }
  return (
    <Page b={b} top>
      <div style={{ marginTop: '6vh', background: c.panel, border: `1px solid ${c.panelBorder}`, borderRadius: 20, padding: '26px 24px 28px', boxShadow: c.panelShadow || '0 12px 40px rgba(0,0,0,0.35)', textAlign: 'center' }}>
        {onBack && (
          <div style={{ textAlign: 'left', marginTop: -8, marginBottom: 4 }}>
            <button type="button" onClick={onBack} style={{ ...linkBtn(c.link), textDecoration: 'none' }}>← Back</button>
          </div>
        )}
        <Mark b={b} size={52} />
        <Eyebrow b={b} />
        <Title b={b} size={22} />
        <div style={{ fontSize: 15, color: c.muted, fontStyle: 'italic', margin: '6px 0 22px' }}>{subtitle}</div>

        {mode !== 'forgot' && allowSignup && !hideForm && (
          <div role="tablist" style={{ display: 'flex', marginBottom: 20, background: c.tabBg, borderRadius: 10, border: `1px solid ${c.divider}`, overflow: 'hidden' }}>
            {[['signin', 'Sign In'], ['signup', 'Create Account']].map(([m, txt], i) => (
              <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => switchTo(m)} style={{
                flex: 1, padding: '12px 8px', border: 'none', borderLeft: i ? `1px solid ${c.divider}` : 'none',
                background: mode === m ? c.tabActiveBg : 'transparent', color: mode === m ? c.tabActiveText : c.muted,
                fontSize: 13, fontFamily: DISPLAY, letterSpacing: '0.08em', cursor: 'pointer', touchAction: 'manipulation',
              }}>{txt}</button>
            ))}
          </div>
        )}

        {error && <Note c={c} tone="error">{error}</Note>}
        {message && <Note c={c}>{message}</Note>}

        {resetSent ? (
          <Note c={c}>
            ✓ Check <strong>{email}</strong> for a link to reset your password.
            <div><button type="button" onClick={onResetDone} style={linkBtn(c.link)}>Back to sign in</button></div>
          </Note>
        ) : !hideForm && (
          <form onSubmit={submit} noValidate>
            <label style={label} htmlFor="er-email">Email</label>
            <input id="er-email" type="email" value={email} onChange={(e) => onEmail(e.target.value)} placeholder="you@email.com"
              autoComplete="email" autoCapitalize="none" autoCorrect="off" style={input} />
            {mode !== 'forgot' && (
              <>
                <label style={label} htmlFor="er-password">Password</label>
                <div style={{ position: 'relative', marginBottom: 18 }}>
                  <input id="er-password" type={showPw ? 'text' : 'password'} value={password} onChange={(e) => onPassword(e.target.value)}
                    placeholder={mode === 'signup' ? 'At least 6 characters' : 'Your password'}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} style={{ ...input, marginBottom: 0, paddingRight: 70 }} />
                  <button type="button" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? 'Hide password' : 'Show password'} style={{
                    position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none',
                    color: c.accent, fontSize: 11, fontFamily: DISPLAY, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', padding: '10px 10px',
                  }}>{showPw ? 'Hide' : 'Show'}</button>
                </div>
              </>
            )}
            <button type="submit" disabled={loading} style={{ ...primaryBtn(c), opacity: loading ? 0.6 : 1, cursor: loading ? 'default' : 'pointer' }}>
              {loading ? 'Please wait…' : mode === 'signup' ? (b.signupCta || 'Create Account') : mode === 'forgot' ? 'Send Reset Link' : 'Sign In'}
            </button>
          </form>
        )}

        {!resetSent && !hideForm && (
          <div style={{ marginTop: 10 }}>
            {mode === 'signin' && <button type="button" onClick={() => switchTo('forgot')} style={linkBtn(c.link)}>Forgot password?</button>}
            {mode === 'forgot' && <button type="button" onClick={() => switchTo('signin')} style={linkBtn(c.link)}>← Back to sign in</button>}
          </div>
        )}
        {mode !== 'forgot' && !hideForm && (
          <p style={{ fontSize: 14, color: c.muted, lineHeight: 1.6, margin: '14px 0 0' }}>One Elora Radiance account works across all our apps.</p>
        )}
        {children}
      </div>
    </Page>
  )
}

// ── After a new account: add the app to the Home Screen ─────────────────
export function HomeScreenTip({ brand: b, onContinue, continueLabel }) {
  const c = b.colors
  const steps = [
    ['iPhone / iPad (Safari)', ['Tap the Share button', 'Tap “Add to Home Screen”', 'Tap “Add”']],
    ['Android (Chrome)', ['Tap the ⋮ menu', 'Tap “Add to Home Screen” or “Install app”', 'Tap “Add”']],
  ]
  return (
    <div style={{ marginTop: 6, textAlign: 'left' }}>
      <Note c={c}>✓ Account created. You're in.</Note>
      <div style={{ fontSize: 12, color: c.accent, letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: DISPLAY, marginBottom: 8 }}>Add {b.shortName || b.name} to your Home Screen</div>
      <p style={{ fontSize: 15, color: c.text, lineHeight: 1.6, margin: '0 0 12px' }}>It opens like an app, full screen, with one tap.</p>
      {steps.map(([os, list]) => (
        <div key={os} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: c.accent, fontFamily: DISPLAY, letterSpacing: '0.06em', marginBottom: 4 }}>{os}</div>
          <ol style={{ margin: 0, paddingLeft: 22, color: c.text, fontSize: 15, lineHeight: 1.6 }}>{list.map((s) => <li key={s}>{s}</li>)}</ol>
        </div>
      ))}
      {onContinue && <button type="button" onClick={onContinue} style={{ ...primaryBtn(c), marginTop: 8 }}>{continueLabel || `Open ${b.shortName || b.name} →`}</button>}
    </div>
  )
}
