// Daily reminders, shared by every Elora Radiance app.
//
// On the website (and the app saved to a Home Screen) this uses real web push: the device
// subscribes once, the time and time zone are saved on the shared database, and the server
// (anchored-steps.vercel.app/api/send-reminders, run every 15 minutes) sends the reminder
// even when the app is closed.
//
// Inside the App Store app, the phone schedules the reminders itself. That build sets
// window.__nativeReminders, and every function below hands off to it.

const VAPID_PUBLIC_KEY = 'BFqWoG-75HGUXY-JHYdrh2cinBepOmHGprWojb12kuu5QL3Zq-xKAUsy8zHbLxL84Jsa6x4vhHuSfU_Pio-_vZw'
const SENDER_URL = 'https://anchored-steps.vercel.app/api/send-reminders'
const DEFAULT_TIME = '07:00'

export function nativeReminders() {
  return typeof window !== 'undefined' ? window.__nativeReminders || null : null
}

export function formatTime(t) {
  const [h, m] = String(t || DEFAULT_TIME).split(':').map(Number)
  return `${((h + 11) % 12) + 1}:${String(m || 0).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

export function localTimeZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago' } catch { return 'America/Chicago' }
}

// { ok: true } or { ok: false, reason: 'ios-home-screen' | 'unsupported' | 'denied' }
export function webPushSupport() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return { ok: false, reason: 'unsupported' }
  const ua = navigator.userAgent || ''
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true
  const capable = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  if (!capable) return { ok: false, reason: isIOS && !standalone ? 'ios-home-screen' : 'unsupported' }
  if (Notification.permission === 'denied') return { ok: false, reason: 'denied' }
  return { ok: true }
}

function keyToBytes(base64url) {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4)
  const raw = atob((base64url + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

async function currentSubscription() {
  if (!('serviceWorker' in navigator)) return null
  const reg = await navigator.serviceWorker.getRegistration('/')
  return reg ? reg.pushManager.getSubscription() : null
}

// Reads this device's reminder: { enabled, time, support }
export async function getReminder(supabase, app) {
  const native = nativeReminders()
  if (native) return native.getState()
  const support = webPushSupport()
  const off = { enabled: false, time: DEFAULT_TIME, support }
  if (!support.ok || Notification.permission !== 'granted') return off
  const sub = await currentSubscription()
  if (!sub) return off
  const { data } = await supabase.from('push_subscriptions')
    .select('remind_time, enabled').eq('endpoint', sub.endpoint).eq('app', app).maybeSingle()
  if (!data) return off
  return { enabled: !!data.enabled, time: String(data.remind_time).slice(0, 5), support }
}

// Turns the reminder on (at `time`) or off. Call it straight from a tap: iPhone only shows
// the permission prompt when it comes from a tap.
export async function saveReminder(supabase, app, { enabled, time }) {
  const native = nativeReminders()
  if (native) return native.save({ enabled, time })

  if (!enabled) {
    const sub = await currentSubscription()
    if (sub) {
      await supabase.rpc('remove_push_subscription', { p_endpoint: sub.endpoint })
      try { await sub.unsubscribe() } catch { /* already gone */ }
    }
    return { enabled: false, time }
  }

  const support = webPushSupport()
  if (!support.ok) throw new Error(support.reason)
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('denied')

  await navigator.serviceWorker.register('/sw.js')
  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(VAPID_PUBLIC_KEY) })
  const json = sub.toJSON()

  const { error } = await supabase.rpc('save_push_subscription', {
    p_app: app, p_endpoint: json.endpoint, p_p256dh: json.keys.p256dh, p_auth: json.keys.auth,
    p_time: time || DEFAULT_TIME, p_timezone: localTimeZone(), p_enabled: true,
  })
  if (error) throw error
  return { enabled: true, time }
}

// Sends a test reminder to this device right away.
export async function sendTestReminder(supabase, app) {
  const native = nativeReminders()
  if (native) return native.test()
  const sub = await currentSubscription()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('signed-out')
  const r = await fetch(SENDER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ app, endpoint: sub ? sub.endpoint : undefined }),
  })
  if (!r.ok) throw new Error('test-failed')
  return r.json()
}
