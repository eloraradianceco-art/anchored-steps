// Daily reminders inside the phone app. The phone schedules them itself, so they arrive with the app closed or
// offline and need no server. The next 30 days are scheduled each time the app opens, so a person who stops opening
// the app gets a month of reminders and then they stop. One reminder serves both years.
// The shared Settings section (ReminderSettings) talks to this through window.__nativeReminders.
import { LocalNotifications } from '@capacitor/local-notifications'
import { Preferences } from '@capacitor/preferences'

const PREF_KEY = 'as_daily_reminder'
const FIRST_ID = 3001
const DAYS = 30
const TEST_ID = 3999
const TITLE = 'Anchored Steps'
const MESSAGES = [
  "Today's step is ready. A few minutes in the Word.",
  'Walk steadily. Stay anchored. Your next step is waiting.',
  "Your word is a lamp to my feet. Today's step is ready. (Psalm 119:105)",
  'One step today. That is how a year in Scripture is walked.',
  'Be still for a few minutes. Your passage for today is ready.',
  "Let the word of Christ dwell in you richly. Today's step is ready. (Colossians 3:16)",
  'Keep the rhythm: read, reflect, apply, pray.',
]

const formatTime = (t) => {
  const [h, m] = String(t).split(':').map(Number)
  return `${((h + 11) % 12) + 1}:${String(m || 0).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}
const dayOfYear = (d) => Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000)

async function loadPref() {
  try {
    const { value } = await Preferences.get({ key: PREF_KEY })
    return value ? JSON.parse(value) : { enabled: false, time: '07:00' }
  } catch { return { enabled: false, time: '07:00' } }
}
const savePref = (pref) => Preferences.set({ key: PREF_KEY, value: JSON.stringify(pref) })

async function cancelScheduled() {
  const ids = Array.from({ length: DAYS }, (_, i) => ({ id: FIRST_ID + i }))
  try { await LocalNotifications.cancel({ notifications: ids }) } catch { /* nothing pending */ }
}

async function scheduleDays(time) {
  await cancelScheduled()
  const [h, m] = String(time).split(':').map(Number)
  const now = new Date()
  const notifications = []
  for (let i = 0; notifications.length < DAYS && i <= DAYS; i++) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, h, m, 0, 0)
    if (at <= now) continue
    notifications.push({ id: FIRST_ID + notifications.length, title: TITLE, body: MESSAGES[dayOfYear(at) % MESSAGES.length], schedule: { at, allowWhileIdle: true } })
  }
  await LocalNotifications.schedule({ notifications })
}

export function installNativeReminders() {
  window.__nativeReminders = {
    native: true,
    async getState() {
      const pref = await loadPref()
      const perm = await LocalNotifications.checkPermissions()
      const denied = perm.display === 'denied'
      return { enabled: pref.enabled && perm.display === 'granted', time: pref.time || '07:00', support: denied ? { ok: false, reason: 'denied' } : { ok: true } }
    },
    async save({ enabled, time }) {
      if (enabled) {
        const perm = await LocalNotifications.requestPermissions()
        if (perm.display !== 'granted') throw new Error('denied')
        await scheduleDays(time)
      } else {
        await cancelScheduled()
      }
      await savePref({ enabled, time })
      return { enabled, time }
    },
    async test() {
      const pref = await loadPref()
      await LocalNotifications.schedule({ notifications: [{ id: TEST_ID, title: TITLE, body: `Reminders are on. You'll hear from us every day at ${formatTime(pref.time || '07:00')}.`, schedule: { at: new Date(Date.now() + 3000) } }] })
      return { sent: 1 }
    },
  }
  // Keep a full month scheduled ahead every time the app opens.
  loadPref().then(async (pref) => {
    if (!pref.enabled) return
    const perm = await LocalNotifications.checkPermissions()
    if (perm.display === 'granted') await scheduleDays(pref.time)
  }).catch(() => {})
}
