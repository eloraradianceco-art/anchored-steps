// Read-aloud ("Listen" and "hear" buttons). The same file is used by Anchored Steps Year 1 and Year 2,
// Armed & Anchored and Red Letters, so a fix here goes into all four.
//
// Rebuilt 2026-11-15 after people reported that Listen read nothing:
//  • On iPhone and iPad, Safari mutes read-aloud when the Silent switch is on, with no error, so the app can't tell.
//    Inside the tap, the helper asks iOS to treat it as media playback (navigator.audioSession, Safari 16.4+) and
//    plays a tiny silent clip, so the speaker is used even in Silent mode, the way a podcast app works.
//  • It stops what is playing only when something is playing. On Safari, a read queued right after stopping can
//    be dropped, and the old code stopped before every read.
//  • The first read starts inside the tap itself, because iOS ignores speech that starts later.
//  • Long passages are read sentence by sentence. Chrome cuts a single read off after about 15 seconds, and
//    Android limits its length.
//  • It asks for an English voice (a phone set to another language read English badly or not at all), keeps each
//    utterance referenced so its events fire, wakes a speech engine stuck on pause, and stops reading when the app
//    goes to the background so the engine doesn't get stuck.
//  • A button can't stay on "playing" forever, and the caller hears back if nothing started.
//  • The App Store build registers a native speaker (setNativeSpeaker in native.js), because Android's in-app
//    browser has no read-aloud and the iPhone app's audio otherwise follows the Silent switch.

let native = null // { speak({ text, lang, rate }) → Promise (resolves when done), stop() → Promise }
export function setNativeSpeaker(impl) { native = impl || null }

const synth = () => {
  try { return typeof window !== 'undefined' && window.speechSynthesis && window.SpeechSynthesisUtterance ? window.speechSynthesis : null }
  catch (e) { return null }
}
export const canSpeak = () => !!(native || synth())

export const isAppleTouch = () => {
  try {
    const n = navigator
    return /iPad|iPhone|iPod/.test(n.userAgent || '') || (n.platform === 'MacIntel' && (n.maxTouchPoints || 0) > 1)
  } catch (e) { return false }
}
// True on iPhones too old for navigator.audioSession, where only the Silent switch itself brings sound back.
export const silentSwitchMayMute = () => { try { return isAppleTouch() && !('audioSession' in navigator) } catch (e) { return false } }

// 0.05 s of silence (8 kHz, 8-bit WAV)
const SILENT_WAV = 'data:audio/wav;base64,UklGRrQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YZABAACA' + 'gICA'.repeat(133)
let clip = null
function useSpeaker() {
  if (!isAppleTouch()) return
  try { if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback' } catch (e) { /* older iOS */ }
  try {
    if (!clip) { clip = new Audio(SILENT_WAV); clip.setAttribute('playsinline', '') }
    clip.currentTime = 0
    const p = clip.play()
    if (p && p.catch) p.catch(() => {})
  } catch (e) { /* no audio element */ }
}

// Sentences of up to `max` characters; an overlong sentence is split at a comma or a space.
export function chunks(text, max = 220) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim()
  if (!clean) return []
  const sentences = clean.match(/[^.!?;:]*[.!?;:]+["'”’)\]]*|[^.!?;:]+$/g) || [clean]
  const out = []
  let cur = ''
  const push = (s) => {
    s = s.trim()
    while (s.length > max) {
      let cut = s.lastIndexOf(', ', max - 1)
      if (cut < max / 3) cut = s.lastIndexOf(' ', max)
      if (cut < max / 3) { out.push(s.slice(0, max)); s = s.slice(max).trim(); continue }
      out.push(s.slice(0, cut + (s[cut] === ',' ? 1 : 0)).trim())
      s = s.slice(cut + 1).trim()
    }
    if (s) out.push(s)
  }
  for (const raw of sentences) {
    const s = raw.trim()
    if (!s) continue
    if (cur && (cur + ' ' + s).length <= max) cur += ' ' + s
    else { if (cur) push(cur); cur = s }
  }
  if (cur) push(cur)
  return out
}

// A local English voice where one exists (Chrome's online voices stop mid-read and need a connection).
// On Apple devices (iPhone, iPad, Mac) the system already picks the person's own English voice from `lang`, and
// naming one can pick a voice that isn't downloaded (reads nothing) or a novelty voice such as "Albert", so none
// is named there.
const isApple = () => { try { return isAppleTouch() || /Macintosh|Mac OS X/.test(navigator.userAgent || '') } catch (e) { return false } }
function pickVoice(s, lang) {
  if (isApple()) return null
  try {
    const all = s.getVoices() || []
    const base = lang.split('-')[0]
    const norm = (v) => String(v.lang || '').replace('_', '-').toLowerCase()
    const exact = all.filter((v) => norm(v) === lang.toLowerCase())
    const same = all.filter((v) => norm(v).split('-')[0] === base)
    return exact.find((v) => v.localService && v.default) || exact.find((v) => v.localService) ||
      same.find((v) => v.localService) || null
  } catch (e) { return null }
}

let session = 0 // each read gets a number; events from an older read are ignored
let live = null // { id, done(kind, err) } for the read in progress
let held = [] // utterances kept referenced until they finish (otherwise their events can be lost)
let begunBefore = false // a read has started on this page, so speech is unlocked and may start after a pause

function settle(kind, err) {
  const cur = live
  live = null
  held = []
  if (cur) cur.done(kind, err)
}

// Reads `text` aloud. Returns false when this device can't read aloud at all.
// onStart: sound started · onEnd: finished or stopped · onError(reason): nothing could be played.
export function speak(text, { rate = 0.9, lang = 'en-US', onStart, onEnd, onError } = {}) {
  const parts = chunks(text)
  if (!parts.length) return true
  const s = synth()
  if (!native && !s) return false
  settle('end') // the read this one replaces counts as finished (its button resets)
  const id = ++session
  let begun = false, finished = false, timers = []
  const clear = () => { timers.forEach((t) => clearTimeout(t) || clearInterval(t)); timers = [] }
  const done = (kind, err) => {
    if (finished) return
    finished = true
    clear()
    if (kind === 'error') { if (onError) onError(err || 'error'); else if (onEnd) onEnd() } else if (onEnd) onEnd()
  }
  const started = () => {
    if (begun || id !== session) return
    begun = true
    begunBefore = true
    if (onStart) onStart()
  }
  live = { id, done }

  if (native) {
    started()
    native.speak({ text: parts.join(' '), lang, rate })
      .then(() => { if (id === session) settle('end') })
      .catch((e) => { if (id === session) settle('error', (e && e.message) || 'native') })
    return true
  }

  useSpeaker()
  try { if (s.paused) s.resume() } catch (e) { /* ignore */ }
  const busy = !!(s.speaking || s.pending)

  const go = () => {
    if (id !== session) return
    held = parts.map((p, i) => {
      const u = new window.SpeechSynthesisUtterance(p)
      u.lang = lang
      u.rate = rate
      const v = pickVoice(s, lang)
      if (v) u.voice = v
      u.onstart = () => { if (id === session) started() }
      u.onend = () => { if (id === session && i === parts.length - 1) settle('end') }
      u.onerror = (e) => {
        if (id !== session) return
        const why = e && e.error
        if (why === 'interrupted' || why === 'canceled') return
        settle('error', why || 'error')
      }
      return u
    })
    held.forEach((u) => s.speak(u))
    // If no event arrives, look at the engine itself: reading → started; quiet again → finished.
    timers.push(setInterval(() => {
      if (id !== session) return
      if (s.speaking && !s.paused) started()
      else if (begun && !s.pending) settle('end')
    }, 500))
    // Nothing at all after 6 seconds: tell the caller so the button resets and a hint can show.
    timers.push(setTimeout(() => {
      if (id !== session || begun) return
      if (s.speaking) { started(); return }
      try { s.cancel() } catch (e) { /* ignore */ }
      settle('error', 'no-start')
    }, 6000))
  }

  if (busy) {
    try { s.cancel() } catch (e) { /* ignore */ }
    // Safari can drop a read queued in the same moment as cancel(). Once speech has started on this page it is
    // unlocked, so a short pause is safe; before that the read has to start inside the tap.
    if (begunBefore) timers.push(setTimeout(go, 120))
    else go()
  } else go()
  return true
}

export function stopSpeaking() {
  session++
  settle('end')
  if (native) { try { native.stop().catch(() => {}) } catch (e) { /* ignore */ } return }
  const s = synth()
  try { if (s && (s.speaking || s.pending || s.paused)) s.cancel() } catch (e) { /* ignore */ }
}

// Reading stops when the app goes to the background (the speech engine can otherwise stay stuck until a reload).
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && live) stopSpeaking() })
  if (typeof window !== 'undefined') window.addEventListener('pagehide', () => { if (live) stopSpeaking() })
}
// Voices load late in Chrome; asking once wakes the list up.
try { const s = synth(); if (s) { s.getVoices(); if (s.addEventListener) s.addEventListener('voiceschanged', () => {}) } } catch (e) { /* ignore */ }
