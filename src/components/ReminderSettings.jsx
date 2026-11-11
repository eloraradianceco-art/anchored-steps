import { useEffect, useRef, useState } from 'react'
import { getReminder, saveReminder, sendTestReminder, formatTime } from '../reminders'

// "Daily Reminder" section for Settings. Same component in every Elora Radiance app;
// each app passes its own colors through `theme`.
//   theme: { text, muted, accent, accentF, accentB, card, border, dark }

const EXPLAIN = {
  denied: "Notifications are turned off for this app. Turn them on in your device's Settings under Notifications, then try again.",
  'ios-home-screen': 'On iPhone and iPad, reminders work once this app is on your Home Screen. Tap Share, then Add to Home Screen, and open it from there.',
  unsupported: "This browser can't show reminders. Open the app from your Home Screen or try another browser.",
  'signed-out': 'Please sign in again, then try once more.',
  'test-failed': "The test didn't go through. Turn the reminder off and on, then try again.",
}
const BLOCKING = new Set(['ios-home-screen', 'unsupported'])

const body = "'EB Garamond',Georgia,serif"
const heading = "'Cinzel',Georgia,serif"

export default function ReminderSettings({ supabase, app, theme: t, label = 'Daily Reminder' }) {
  const [state, setState] = useState({ loading: true, enabled: false, time: '07:00', reason: null })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const saveTimer = useRef(null)

  useEffect(() => {
    let live = true
    getReminder(supabase, app)
      .then((r) => live && setState({
        loading: false, enabled: !!r.enabled, time: r.time || '07:00',
        reason: r.support && !r.support.ok ? r.support.reason : null,
      }))
      .catch(() => live && setState((s) => ({ ...s, loading: false })))
    return () => { live = false; clearTimeout(saveTimer.current) }
  }, [app]) // eslint-disable-line react-hooks/exhaustive-deps

  const fail = (e) => {
    const key = e && e.message
    setMessage(EXPLAIN[key] || 'Something went wrong. Please try again.')
    if (EXPLAIN[key]) setState((s) => ({ ...s, reason: key }))
  }

  // Runs straight from the tap so the phone allows the permission prompt.
  const toggle = () => {
    if (busy || state.loading) return
    setBusy(true); setMessage('')
    saveReminder(supabase, app, { enabled: !state.enabled, time: state.time })
      .then((r) => {
        setState((s) => ({ ...s, enabled: r.enabled, reason: null }))
        setMessage(r.enabled ? `Set for ${formatTime(state.time)} every day.` : 'Reminder turned off.')
      })
      .catch(fail)
      .finally(() => setBusy(false))
  }

  const changeTime = (value) => {
    if (!value) return
    setState((s) => ({ ...s, time: value }))
    if (!state.enabled) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveReminder(supabase, app, { enabled: true, time: value })
        .then(() => setMessage(`Moved to ${formatTime(value)} every day.`))
        .catch(fail)
    }, 700)
  }

  const test = () => {
    if (busy) return
    setBusy(true); setMessage('')
    sendTestReminder(supabase, app)
      .then(() => setMessage('Test sent. It should arrive in a few seconds.'))
      .catch(fail)
      .finally(() => setBusy(false))
  }

  const blocked = BLOCKING.has(state.reason)
  const note = message || (state.reason ? EXPLAIN[state.reason] : '')

  return (
    <div>
      <div style={{ marginTop: 24, marginBottom: 8 }}>
        <div style={{ fontSize: 9, color: t.muted, letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: heading, marginBottom: 4 }}>{label}</div>
      </div>
      <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18, width: 26, textAlign: 'center' }} aria-hidden="true">🔔</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, color: t.text, fontFamily: body }}>Remind me every day</div>
            <div style={{ fontSize: 13, color: t.muted, fontFamily: body, fontStyle: 'italic' }}>Even when the app is closed.</div>
          </div>
          <button
            type="button" role="switch" aria-checked={state.enabled} aria-label="Daily reminder"
            onClick={toggle} disabled={busy || state.loading || blocked}
            style={{
              width: 48, height: 28, borderRadius: 14, padding: 0, flexShrink: 0, position: 'relative',
              background: state.enabled ? t.accent : t.border, border: `1px solid ${state.enabled ? t.accent : t.border}`,
              cursor: busy || blocked ? 'default' : 'pointer', opacity: blocked ? 0.45 : 1, transition: 'background .2s',
            }}>
            <span style={{
              position: 'absolute', top: 3, left: state.enabled ? 23 : 3, width: 20, height: 20, borderRadius: '50%',
              background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'left .2s',
            }} />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, paddingLeft: 38, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 14, color: t.muted, fontFamily: body }}>
            Time{' '}
            <input
              type="time" value={state.time} disabled={blocked}
              onChange={(e) => changeTime(e.target.value)}
              style={{
                marginLeft: 6, background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 8,
                color: t.text, padding: '6px 10px', fontSize: 16, fontFamily: body,
                colorScheme: t.dark ? 'dark' : 'light',
              }}
            />
          </label>
          {state.enabled && (
            <button type="button" onClick={test} disabled={busy} style={{
              background: t.accentF, border: `1px solid ${t.accentB}`, color: t.accent, padding: '6px 14px',
              borderRadius: 10, fontSize: 12, fontFamily: heading, letterSpacing: '0.06em', cursor: busy ? 'default' : 'pointer',
            }}>Send a test</button>
          )}
        </div>

        {note && (
          <div role="status" style={{ marginTop: 12, paddingLeft: 38, fontSize: 14, lineHeight: 1.5, color: t.muted, fontFamily: body, fontStyle: 'italic' }}>
            {note}
          </div>
        )}
      </div>
    </div>
  )
}
