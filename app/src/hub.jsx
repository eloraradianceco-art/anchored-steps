// The front page of the Anchored Steps phone app: two doors (Year 1, Year 2), sign-in, purchases and the account.
// Each year is its own page (/year1/, /year2/), the same code that runs on the website; see bridge.js and build.mjs.
import React, { useEffect, useRef, useState, useCallback } from 'react'
import ReactDOM from 'react-dom/client'
import { createClient } from '@supabase/supabase-js'
import { inShell, authStorage } from './bridge.js'
import { PURCHASES_ON, storeSignIn, storeSignOut, storeProducts, storeBuy, storeRestore } from './store.js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../year2/src/supabaseConfig.js'
import { AuthCard, GivingLine } from '../../src/components/EntryScreens.jsx'
import ReminderSettings from '../../src/components/ReminderSettings.jsx'
import AccountPrivacy from '../../src/components/AccountPrivacy.jsx'
import { BRAND as Y1_BRAND } from '../../src/entryBrand.js'
import { yourWeek } from '../../src/yourWeek.js'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY,
  inShell ? { auth: { storage: authStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } } : undefined)

const C = Y1_BRAND.colors
const DISPLAY = "'Cinzel',Georgia,serif"
const BODY = "'EB Garamond',Georgia,serif"
const BRAND = { ...Y1_BRAND, name: 'Anchored Steps', shortName: 'Anchored Steps', icon: '/year1/icon-192.png', signinSubtitle: 'Welcome back', signupSubtitle: 'One account opens both years' }

// The two doors. `table` holds the profile row that means "this year is unlocked on this account".
const YEARS = [
  { app: 'as1', key: 'year1', label: 'Year 1', title: '52 Weeks of Faith in Action', icon: '/year1/icon-192.png', page: '/year1/index.html',
    pitch: 'Build a daily rhythm in Scripture that holds: study, reflect, apply and pray, one week at a time.',
    table: 'profiles', idCol: 'id', entries: 'journal_entries', weekKeys: ['as1_my_week', 'as1_current_week'] },
  { app: 'as2', key: 'year2', label: 'Year 2', title: '52 Deeper Weeks of Scripture Study', icon: '/year2/icon-192.png', page: '/year2/index.html',
    pitch: 'Go further: each key verse read inside the whole paragraph it comes from, harder questions, and a faith that keeps walking.',
    table: 'as2_profiles', idCol: 'user_id', entries: 'as2_journal_entries', weekKeys: ['y2_my_week', 'y2_last_week'] },
]

const localDate = (ymd) => { const [y, m, d] = String(ymd).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1) }
function calcStreak(entries) {
  const days = [...new Set(entries.filter((e) => String(e.field_key).startsWith('day_')).map((e) => e.field_key.replace('day_', '')))].sort().reverse()
  let streak = 0; let cursor = new Date(); cursor.setHours(0, 0, 0, 0)
  for (const day of days) {
    const d = localDate(day); const diff = Math.round((cursor - d) / 86400000)
    if (diff === 0 || diff === 1) { streak++; cursor = d } else break
  }
  return streak
}
const storedWeek = (keys) => { try { for (const k of keys) { const n = parseInt(localStorage.getItem(k) || '0'); if (n > 0) return n } } catch { /* private mode */ } return 0 }

// Is each year unlocked on this account, and where is the reader in it?
async function loadYear(y, uid, claim) {
  const fetchProfile = () => supabase.from(y.table).select('current_week').eq(y.idCol, uid).maybeSingle()
  let { data: prof, error } = await fetchProfile()
  if (!prof && !error && claim) {
    // A purchase made on the website (same email or account) is applied here, as it is when the year opens on the web.
    const { data: got } = await supabase.rpc('claim_purchase', { p_app: y.app, checkout_session: null })
    if (got) ({ data: prof, error } = await fetchProfile())
  }
  if (error) return { owned: null }   // could not check (offline): let the year decide when it opens
  if (!prof) return { owned: false }
  const { data: rows } = await supabase.from(y.entries).select('week, field_key, field_value').eq('user_id', uid).or('field_key.like.ds_%,field_key.like.day_%')
  const entries = rows || []
  const week = yourWeek(entries) || storedWeek(y.weekKeys) || prof.current_week || 1
  const steps = new Set(entries.filter((e) => e.week === week && /^ds_[1-7]$/.test(e.field_key) && e.field_value).map((e) => e.field_key)).size
  return { owned: true, week, steps, streak: calcStreak(entries), started: entries.length > 0 }
}

const primaryBtn = { display: 'block', width: '100%', background: C.ctaBg, border: `1px solid ${C.ctaBorder}`, color: C.ctaText, padding: '15px 20px', borderRadius: 12, fontFamily: DISPLAY, fontSize: 14.5, fontWeight: 600, letterSpacing: '0.07em', textAlign: 'center', textDecoration: 'none', minHeight: 50 }
const ghostBtn = { ...primaryBtn, background: 'transparent', border: `1px solid ${C.cardBorder}`, color: C.accent }
const linkBtn = { background: 'none', border: 'none', color: C.link, fontFamily: BODY, fontSize: 15.5, textDecoration: 'underline', textUnderlineOffset: 3, padding: '10px 6px', minHeight: 44 }

// `center` sets the content in the middle of the screen when there is room to spare (iPad, tall phones); when the
// content is longer than the screen it starts at the top and scrolls as usual.
function Frame({ children, center = false }) {
  return (
    <div style={{ minHeight: '100vh', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', background: `${C.glow}, ${C.bg}`, color: C.text, fontFamily: BODY, padding: 'calc(env(safe-area-inset-top, 0px) + 18px) 18px calc(env(safe-area-inset-bottom, 0px) + 28px)' }}>
      {/* The page scrolls under the phone's clock and battery; this band keeps them readable when it does. */}
      <div aria-hidden="true" style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 'env(safe-area-inset-top, 0px)', background: C.bg, zIndex: 50 }} />
      <div style={{ width: '100%', maxWidth: 520, margin: center ? 'auto' : '0 auto' }}>{children}</div>
    </div>
  )
}

function Note({ tone = 'ok', children }) {
  const err = tone === 'error'
  return <div role={err ? 'alert' : 'status'} style={{ background: err ? C.errorBg : C.okBg, border: `1px solid ${err ? C.errorBorder : C.okBorder}`, color: err ? C.errorText : C.okText, borderRadius: 12, padding: '12px 14px', fontSize: 15.5, lineHeight: 1.55, margin: '14px 0 0', textAlign: 'left' }}>{children}</div>
}

function Splash({ text = 'Opening…' }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontFamily: BODY }}>
      <img src={BRAND.icon} alt="" width="72" height="72" style={{ width: 72, height: 72, borderRadius: 16, boxShadow: '0 6px 22px rgba(0,0,0,0.45)', marginBottom: 18 }} />
      <div style={{ fontFamily: DISPLAY, color: C.accent, fontSize: 12, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>Anchored Steps</div>
      <div style={{ color: C.muted, fontSize: 14 }}>{text}</div>
    </div>
  )
}

function Door({ y, state, product, busy, canBuy, onOpen, onBuy, flagged }) {
  const owned = state?.owned !== false   // true, or null when it could not be checked
  const pct = owned && state?.week ? Math.max(2, Math.round(((state.week - 1 + (state.steps || 0) / 7) / 52) * 100)) : 0
  const head = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <img src={y.icon} alt="" width="56" height="56" style={{ width: 56, height: 56, borderRadius: 13, flex: 'none', boxShadow: '0 4px 14px rgba(0,0,0,0.35)', opacity: owned ? 1 : 0.82 }} />
      <div style={{ minWidth: 0, textAlign: 'left' }}>
        <div style={{ fontFamily: DISPLAY, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.eyebrow, marginBottom: 3 }}>{y.label}{!owned && <span style={{ marginLeft: 8, letterSpacing: '0.1em', color: C.muted }}>· Week 1 free</span>}</div>
        <div style={{ fontFamily: DISPLAY, fontSize: 17, fontWeight: 600, lineHeight: 1.25, color: C.title }}>{y.title}</div>
      </div>
    </div>
  )
  const card = { display: 'block', width: '100%', background: C.card, border: `1px solid ${flagged ? C.ctaBorder : C.cardBorder}`, borderRadius: 18, padding: '18px 18px 18px', margin: '0 0 14px', color: C.text, textDecoration: 'none', textAlign: 'left', fontFamily: BODY }
  if (owned) {
    return (
      <a className="hub-door hub-in" href={y.page} onClick={(e) => { e.preventDefault(); onOpen(y) }} style={card} aria-label={`Open ${y.label}: ${y.title}`}>
        {head}
        <div style={{ margin: '14px 0 0' }}>
          {state?.owned && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, fontSize: 15.5, color: C.muted }}>
                <span>{state.started ? <>Week <b style={{ color: C.title, fontWeight: 600 }}>{state.week}</b> of 52 · {state.steps} of 7 steps</> : 'Ready when you are: Week 1, Step 1'}</span>
                {state.streak > 0 && <span style={{ color: C.accent, whiteSpace: 'nowrap' }}>🔥 {state.streak}-day streak</span>}
              </div>
              <div aria-hidden="true" style={{ height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.08)', margin: '10px 0 0', overflow: 'hidden' }}>
                <div style={{ width: pct + '%', height: '100%', borderRadius: 4, background: 'linear-gradient(90deg, rgba(207,169,104,0.55), #CFA968)' }} />
              </div>
            </>
          )}
          <div style={{ ...primaryBtn, marginTop: 16 }}>{state?.started ? 'Continue →' : 'Begin →'}</div>
        </div>
      </a>
    )
  }
  return (
    <section className="hub-in" style={card} aria-label={`${y.label}: ${y.title}, week 1 free`}>
      {head}
      <p style={{ fontSize: 16.5, lineHeight: 1.6, color: C.text, margin: '14px 0 0' }}>{y.pitch}</p>
      {/* Free week (2026-11-27): week 1 of each year is open to every account. Coming back from a year to buy
          (flagged), the purchase leads; otherwise the free week does. */}
      <a href={y.page} onClick={(e) => { e.preventDefault(); onOpen(y) }} aria-label={`Start ${y.label} week 1 free`}
        style={{ ...(flagged && canBuy && product ? ghostBtn : primaryBtn), display: 'block', textAlign: 'center', textDecoration: 'none', marginTop: 16 }}>{flagged ? 'Back to Week 1' : 'Start Week 1 Free'} →</a>
      {canBuy && product ? (
        <>
          <button type="button" disabled={busy} onClick={() => onBuy(y.key)} style={{ ...(flagged ? primaryBtn : ghostBtn), marginTop: 12, opacity: busy ? 0.6 : 1 }}>Unlock {y.label}{product.price ? ` · ${product.price}` : ''}</button>
          <p style={{ fontSize: 14, color: C.muted, margin: '10px 0 0', textAlign: 'center' }}>One-time purchase. No subscription. Yours for good.</p>
        </>
      ) : (
        <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.6, margin: '12px 0 0' }}>{flagged ? `${y.label} isn't on this account yet. ` : ''}{canBuy ? "The App Store isn't reachable right now. Check your connection and try again." : `Already own ${y.label}? Sign in with the email you used for it and it opens here.`}</p>
      )}
    </section>
  )
}

function Home({ session, onSignOut }) {
  const uid = session.user.id
  const [years, setYears] = useState(null)          // { as1: {...}, as2: {...} }
  const [products, setProducts] = useState(undefined) // undefined = not asked yet; null = store unreachable
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [note, setNote] = useState(null)             // { tone, text }
  const [view, setView] = useState('home')
  const [from] = useState(() => { try { return new URLSearchParams(window.location.search).get('from') } catch { return null } })
  const alive = useRef(true)
  useEffect(() => () => { alive.current = false }, [])
  useEffect(() => { try { if (window.location.search) window.history.replaceState(null, '', window.location.pathname) } catch { /* fine */ } }, [])

  const load = useCallback(async (claim = true) => {
    const [a, b] = await Promise.all(YEARS.map((y) => loadYear(y, uid, claim)))
    const next = { as1: a, as2: b }
    if (alive.current) setYears(next)
    return next
  }, [uid])

  const sync = () => supabase.functions.invoke('store-sync', { body: { action: 'sync', app: 'as' } }).catch(() => null)

  useEffect(() => {
    let on = true
    ;(async () => {
      const first = await load()
      if (!PURCHASES_ON) { if (on) setProducts(null); return }
      // Apple purchases made earlier (another device, or before a reinstall) are applied when the app opens
      await storeSignIn(uid)
      if (first.as1.owned === false || first.as2.owned === false) { await sync(); await load(false) }
      const p = await storeProducts(uid)
      if (on) setProducts(p)
    })()
    return () => { on = false }
  }, [uid]) // eslint-disable-line react-hooks/exhaustive-deps

  // After Apple takes a purchase (or a restore), the server reads it from Apple and unlocks the account; check a few
  // times while that lands.
  const confirm = async (want) => {
    setConfirming(true)
    let got = null
    for (let i = 0; i < 8; i++) {
      if (i % 3 === 0) await sync()
      got = await load(false)
      if (want.every((app) => got[app].owned)) break
      await new Promise((r) => setTimeout(r, 2000))
    }
    if (alive.current) setConfirming(false)
    return want.every((app) => got?.[app]?.owned)
  }

  const buy = async (key) => {
    const product = products?.[key]
    if (!product || busy) return
    setBusy(true); setNote(null)
    const r = await storeBuy(uid, product.pkg)
    if (r === 'cancelled') { setBusy(false); return }
    if (r === 'pending') { setBusy(false); setNote({ tone: 'ok', text: 'Your purchase is waiting for approval. It will unlock here as soon as it is approved.' }); return }
    if (r?.error) { setBusy(false); setNote({ tone: 'error', text: r.error }); return }
    const want = key === 'both' ? ['as1', 'as2'] : [key === 'year1' ? 'as1' : 'as2']
    const ok = await confirm(want)
    setBusy(false)
    setNote(ok ? { tone: 'ok', text: key === 'both' ? 'Both years are unlocked. Welcome.' : `${key === 'year1' ? 'Year 1' : 'Year 2'} is unlocked. Welcome.` }
      : { tone: 'error', text: 'Apple has your purchase, but it has not reached your account yet. Tap “Restore purchases” in a moment; you will not be charged again.' })
  }

  const restore = async () => {
    if (busy) return
    setBusy(true); setNote(null)
    const owned = await storeRestore(uid)
    if (!owned) { setBusy(false); setNote({ tone: 'error', text: "The App Store isn't reachable right now. Try again in a moment." }); return }
    const want = ['as1', 'as2'].filter((a) => owned[a])
    if (!want.length) { await load(); setBusy(false); setNote({ tone: 'ok', text: 'No App Store purchases were found for this Apple ID. A purchase made on the website opens when you sign in with that email.' }); return }
    const ok = await confirm(want)
    setBusy(false)
    setNote(ok ? { tone: 'ok', text: 'Your purchases are restored.' } : { tone: 'error', text: 'We found your purchase but could not apply it yet. Try again in a moment.' })
  }

  const open = (y) => { if (window.ERApp?.open) window.ERApp.open(y.app); else window.location.href = y.page }

  if (!years) return <Splash />
  if (confirming) return <Splash text="Confirming your purchase…" />
  if (view === 'account') return <Account session={session} onBack={() => setView('home')} onSignOut={onSignOut} onRestore={PURCHASES_ON ? restore : null} busy={busy} note={note} />

  const locked = YEARS.filter((y) => years[y.app].owned === false)
  const canBuy = PURCHASES_ON
  const both = canBuy && locked.length === 2 ? products?.both : null
  const save = both && products?.year1?.amount != null && products?.year2?.amount != null && both.amount != null ? Math.round((products.year1.amount + products.year2.amount - both.amount) * 100) / 100 : 0
  const anyOwned = YEARS.some((y) => years[y.app].owned !== false)

  return (
    <Frame center>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '0 0 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={BRAND.icon} alt="" width="32" height="32" style={{ width: 32, height: 32, borderRadius: 8 }} />
          <h1 style={{ margin: 0, fontFamily: DISPLAY, fontSize: 18, fontWeight: 600, letterSpacing: '0.04em', color: C.title }}>Anchored Steps</h1>
        </div>
        <button type="button" onClick={() => { setNote(null); setView('account') }} style={{ background: 'transparent', border: `1px solid ${C.cardBorder}`, color: C.accent, borderRadius: 10, padding: '9px 14px', fontFamily: DISPLAY, fontSize: 12, letterSpacing: '0.1em', minHeight: 44 }}>Account</button>
      </header>

      <p style={{ fontSize: 19, fontStyle: 'italic', lineHeight: 1.5, color: C.text, margin: '0 0 18px' }}>{anyOwned ? 'Walk steadily. Stay anchored.' : 'Choose where to begin.'}</p>

      {YEARS.map((y) => (
        <Door key={y.app} y={y} state={years[y.app]} product={products?.[y.key]} busy={busy} canBuy={canBuy} onOpen={open} onBuy={buy} flagged={from === y.app && years[y.app].owned === false} />
      ))}

      {both && (
        <div className="hub-in" style={{ margin: '4px 0 14px', padding: '16px 18px', border: `1px solid ${C.cardBorder}`, borderRadius: 18, textAlign: 'center' }}>
          <div style={{ fontFamily: DISPLAY, fontSize: 15, fontWeight: 600, color: C.title, marginBottom: 4 }}>Both years together</div>
          <p style={{ fontSize: 15.5, color: C.muted, lineHeight: 1.55, margin: '0 0 12px' }}>Two years of guided Scripture study on one account.{save > 0 ? ` Save ${both.price.replace(/[\d.,\s]+/, '')}${save.toFixed(2).replace(/\.00$/, '')} over buying each.` : ''}</p>
          <button type="button" disabled={busy} onClick={() => buy('both')} style={{ ...ghostBtn, opacity: busy ? 0.6 : 1 }}>Unlock Both Years{both.price ? ` · ${both.price}` : ''}</button>
        </div>
      )}

      {canBuy && locked.length > 0 && <GivingLine b={BRAND} />}
      {note && <Note tone={note.tone}>{note.text}</Note>}

      {locked.length > 0 && (
        <div style={{ textAlign: 'center', margin: '14px 0 0' }}>
          {canBuy && <button type="button" onClick={restore} disabled={busy} style={linkBtn}>Restore purchases</button>}
          <button type="button" onClick={async () => { setBusy(true); setNote(null); if (PURCHASES_ON) await sync(); const y = await load(); setBusy(false); if (YEARS.some((x) => y[x.app].owned === false)) setNote({ tone: 'ok', text: 'Checked. Nothing new on this account yet.' }) }} disabled={busy} style={linkBtn}>{busy ? 'Checking…' : 'Check again'}</button>
        </div>
      )}
      {canBuy && locked.length > 0 && (
        <p style={{ textAlign: 'center', fontSize: 14, color: C.muted, margin: '6px 0 0' }}>
          <a href="https://eloraradiance.com/terms.html" target="_blank" rel="noopener noreferrer" style={{ color: C.link }}>Terms</a> · <a href="https://eloraradiance.com/privacy.html" target="_blank" rel="noopener noreferrer" style={{ color: C.link }}>Privacy</a>
        </p>
      )}
    </Frame>
  )
}

function Account({ session, onBack, onSignOut, onRestore, busy, note }) {
  const theme = { text: C.text, muted: C.muted, accent: C.accent, accentF: 'rgba(176,138,78,0.14)', accentB: C.cardBorder, card: 'rgba(255,255,255,0.035)', border: 'rgba(255,255,255,0.09)', dark: true,
    danger: '#D9786B', dangerF: 'rgba(217,120,107,0.12)', dangerB: 'rgba(217,120,107,0.35)' }
  const [leaving, setLeaving] = useState(false)
  return (
    <Frame>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 22px' }}>
        <button type="button" onClick={onBack} aria-label="Back" style={{ background: 'transparent', border: 'none', color: C.accent, fontSize: 28, lineHeight: 1, padding: '6px 12px 10px 0', minHeight: 44, minWidth: 44, textAlign: 'left' }}>‹</button>
        <h1 style={{ margin: 0, fontFamily: DISPLAY, fontSize: 18, fontWeight: 600, letterSpacing: '0.04em', color: C.title }}>Account</h1>
      </header>
      <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14, padding: '14px 16px', margin: '0 0 22px' }}>
        <div style={{ fontFamily: DISPLAY, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.muted, marginBottom: 4 }}>Signed in as</div>
        <div style={{ fontSize: 17, color: C.title, overflowWrap: 'anywhere' }}>{session.user.email}</div>
        <p style={{ fontSize: 14.5, color: C.muted, lineHeight: 1.55, margin: '8px 0 0' }}>Your journal and what you own follow this account onto every device and the website.</p>
      </div>
      <ReminderSettings supabase={supabase} app="as1" theme={theme} />
      {onRestore && (
        <div style={{ margin: '0 0 22px' }}>
          <button type="button" onClick={onRestore} disabled={busy} style={{ ...ghostBtn, opacity: busy ? 0.6 : 1 }}>{busy ? 'Checking…' : 'Restore Purchases'}</button>
          {note && <Note tone={note.tone}>{note.text}</Note>}
        </div>
      )}
      <AccountPrivacy supabase={supabase} theme={theme} />
      <button type="button" disabled={leaving} onClick={async () => { setLeaving(true); await onSignOut() }} style={{ ...ghostBtn, marginTop: 8, color: C.muted, borderColor: theme.border }}>{leaving ? 'Signing out…' : 'Sign Out'}</button>
      <p style={{ textAlign: 'center', fontSize: 13.5, color: C.muted, margin: '18px 0 0' }}>Anchored Steps · Elora Radiance Co.</p>
    </Frame>
  )
}

// Signed out: what the app is, then sign in or create an account.
function Front({ onSignIn, onSignUp }) {
  return (
    <Frame center>
      <div style={{ textAlign: 'center' }}>
        <img src={BRAND.icon} alt="" width="76" height="76" style={{ width: 76, height: 76, borderRadius: 18, boxShadow: '0 6px 22px rgba(0,0,0,0.45)' }} />
        <div style={{ fontFamily: DISPLAY, fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.eyebrow, margin: '16px 0 8px' }}>Elora Radiance Co.</div>
        <h1 style={{ margin: 0, fontFamily: DISPLAY, fontSize: 30, fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1.15, color: C.title }}>Anchored Steps</h1>
        <p style={{ fontSize: 19, fontStyle: 'italic', lineHeight: 1.5, color: C.text, margin: '12px auto 22px', maxWidth: 380 }}>A steady walk through Scripture, one week at a time.</p>
      </div>
      {YEARS.map((y) => (
        <div key={y.app} className="hub-in" style={{ display: 'flex', gap: 14, alignItems: 'flex-start', background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 18, padding: '16px 18px', margin: '0 0 12px' }}>
          <img src={y.icon} alt="" width="48" height="48" style={{ width: 48, height: 48, borderRadius: 11, flex: 'none' }} />
          <div>
            <div style={{ fontFamily: DISPLAY, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.eyebrow, marginBottom: 2 }}>{y.label}</div>
            <div style={{ fontFamily: DISPLAY, fontSize: 15.5, fontWeight: 600, lineHeight: 1.3, color: C.title }}>{y.title}</div>
            <p style={{ fontSize: 15.5, lineHeight: 1.55, color: C.muted, margin: '6px 0 0' }}>{y.pitch}</p>
          </div>
        </div>
      ))}
      <button type="button" onClick={onSignUp} style={{ ...primaryBtn, marginTop: 10 }}>Create Account</button>
      <button type="button" onClick={onSignIn} style={{ ...ghostBtn, marginTop: 12 }}>Sign In</button>
      <p style={{ textAlign: 'center', fontSize: 14.5, color: C.muted, lineHeight: 1.55, margin: '14px 0 0' }}>One account keeps your journal on every device. Already use Anchored Steps on the website? Sign in with the same email.</p>
    </Frame>
  )
}

function Auth({ start, onBack }) {
  const [mode, setMode] = useState(start)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resetSent, setResetSent] = useState(false)

  const signIn = async () => {
    setError(''); setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) setError(error.message === 'Invalid login credentials' ? 'Incorrect email or password.' : error.message)
  }
  // One account works across Elora Radiance apps: an email that already has one signs in with its password.
  const signUp = async () => {
    if (!email || password.length < 6) { setError('Enter your email and a password of at least 6 characters.'); return }
    setError(''); setLoading(true)
    let { data, error } = await supabase.auth.signUp({ email, password, options: { data: { app: 'as' } } })
    if (error && /already (registered|exists)/i.test(error.message)) {
      const res = await supabase.auth.signInWithPassword({ email, password })
      if (res.error) { setError('This email already has an Elora Radiance account. Enter that password to sign in, or use Forgot password.'); setLoading(false); return }
      data = res.data; error = null
    }
    setLoading(false)
    if (error) { setError(error.message); return }
    if (!data?.session) setError('Check your email to confirm your account, then sign in.')
  }
  const forgot = async () => {
    if (!email) { setError('Enter your email first.'); return }
    setLoading(true)
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: 'https://steps.eloraradiance.com' })
    setResetSent(true); setLoading(false)
  }
  return (
    <AuthCard brand={BRAND} mode={mode} onMode={(m) => { setMode(m); setError('') }}
      email={email} onEmail={setEmail} password={password} onPassword={setPassword}
      onSubmit={mode === 'signin' ? signIn : mode === 'forgot' ? forgot : signUp} loading={loading} error={error}
      resetSent={resetSent} onResetDone={() => { setResetSent(false); setMode('signin') }} onBack={onBack} />
  )
}

function App() {
  const [session, setSession] = useState(undefined)   // undefined = still reading the saved sign-in
  const [entry, setEntry] = useState(null)            // null | 'signin' | 'signup'
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session || null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => { setSession(s || null); if (!s) { setEntry(null); storeSignOut() } })
    return () => subscription.unsubscribe()
  }, [])
  useEffect(() => { window.ERApp?.statusBar?.(false) }, [])
  if (session === undefined) return <Splash />
  if (!session) return entry ? <Auth start={entry} onBack={() => setEntry(null)} /> : <Front onSignIn={() => setEntry('signin')} onSignUp={() => setEntry('signup')} />
  return <Home key={session.user.id} session={session} onSignOut={() => supabase.auth.signOut()} />
}

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) { console.error('Anchored Steps front page:', error, info) }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <Frame>
        <div style={{ textAlign: 'center', paddingTop: '18vh' }}>
          <h1 style={{ fontFamily: DISPLAY, fontSize: 18, color: C.title }}>Something went wrong</h1>
          <p style={{ color: C.muted, fontSize: 15, lineHeight: 1.6 }}>{String(this.state.error?.message || this.state.error)}</p>
          <button type="button" onClick={() => window.location.reload()} style={{ ...ghostBtn, maxWidth: 220, margin: '14px auto 0' }}>Reload</button>
        </div>
      </Frame>
    )
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><ErrorBoundary><App /></ErrorBoundary></React.StrictMode>)
