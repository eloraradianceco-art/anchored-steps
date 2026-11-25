// The link between the phone app and the two years.
//
// The Anchored Steps phone app is three pages in one package: the front page (index.html) and each year as its own
// page (/year1/index.html, /year2/index.html), exactly as they run on the website. This file is loaded on all three,
// before the page's own code, and sets window.ERApp. Year 1 and Year 2 check for it (`const APP = window.ERApp`)
// to: keep the sign-in in the phone's own storage, go back to the front page, share through the share sheet, read
// aloud with the phone's voice and set daily reminders on the device. On the website window.ERApp never exists.
import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import { Share } from '@capacitor/share'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { StatusBar, Style } from '@capacitor/status-bar'
import { TextToSpeech } from '@capacitor-community/text-to-speech'
import { installNativeReminders } from './reminders.js'

// `__ER_TEST_SHELL__` is set only by the browser checks in app/tests, which run the built app without a phone.
export const isNative = Capacitor.isNativePlatform()
export const inShell = isNative || (typeof window !== 'undefined' && window.__ER_TEST_SHELL__ === true)

// The sign-in, kept where iOS never clears it on its own. All three pages read the same entry, so signing in on the
// front page signs both years in.
export const authStorage = {
  getItem: async (key) => (await Preferences.get({ key })).value,
  setItem: async (key, value) => { await Preferences.set({ key, value }) },
  removeItem: async (key) => { await Preferences.remove({ key }) },
}

const toBase64 = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader()
  r.onload = () => resolve(String(r.result).split(',')[1] || '')
  r.onerror = () => reject(r.error)
  r.readAsDataURL(blob)
})

async function share({ title, text, url, files } = {}) {
  const uris = []
  let n = 0
  for (const f of files || []) {
    const { uri } = await Filesystem.writeFile({ path: f.name || `anchored-steps-${++n}.png`, data: await toBase64(f), directory: Directory.Cache })
    uris.push(uri)
  }
  try { await Share.share({ title, text, url, files: uris.length ? uris : undefined, dialogTitle: title }) } catch { /* share sheet closed */ }
}

// A text or HTML file handed to the share sheet (Save to Files, Print, Mail…): journal exports.
async function shareFile(content, fileName, title) {
  const { uri } = await Filesystem.writeFile({ path: fileName, data: content, directory: Directory.Cache, encoding: Encoding.UTF8 })
  try { await Share.share({ title, files: [uri], dialogTitle: title }) } catch { /* closed */ }
}

const PAGES = { as1: '/year1/index.html', as2: '/year2/index.html' }

if (inShell) {
  window.ERApp = {
    native: isNative,
    authStorage,
    // Back to the front page. `from` says which year sent the reader back (signed out or not unlocked there).
    home: (from) => { window.location.href = '/index.html' + (from ? '?from=' + encodeURIComponent(from) : '') },
    open: (app) => { if (PAGES[app]) window.location.href = PAGES[app] },
    share,
    shareFile,
    statusBar: (lightTheme) => { if (isNative) StatusBar.setStyle({ style: lightTheme ? Style.Light : Style.Dark }).catch(() => {}) },
    // Read-aloud uses the phone's own speech engine: on iPhone AppDelegate sets audio to "playback", so it is heard
    // with the Silent switch on.
    speaker: isNative ? {
      speak: ({ text, lang, rate }) => TextToSpeech.speak({ text, lang, rate, category: 'playback' }),
      stop: () => TextToSpeech.stop(),
    } : null,
  }

  if (isNative) {
    // Both years share with navigator.share (text, links and share-card images). Inside the app that goes through
    // the phone's share sheet, which also takes image files reliably.
    try {
      Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true })
      Object.defineProperty(navigator, 'share', { value: (data) => share(data), configurable: true })
    } catch { /* leave the built-in one */ }
    // Daily reminders are scheduled on the device (Settings → Daily Reminder in either year, or Account on the front page).
    installNativeReminders()
  }
}
