// Read-aloud check for the four apps that share speech.js. The browser's speech engine is replaced by a recorder,
// so this proves what the app asks the device to read and how the buttons behave; it cannot hear real audio.
// Run: node tests/speech-check.cjs src/speech.js   (speech.js on its own; speech-ui.cjs runs this and the app's buttons)
const fs = require('fs')
const { chromium, serve, openApp } = require('./appkit.cjs')
const results = []; const check = (n, ok, x = '') => results.push((ok ? 'PASS ' : 'FAIL ') + n + (x ? ' — ' + String(x).slice(0, 260) : ''))
const norm = (s) => String(s || '').replace(/[“”"'‘’]/g, '').replace(/\s+/g, ' ').trim()

// A stand-in speech engine. mode: 'normal' (speaks, fires events), 'mute-events' (speaks, no events), 'silent' (never starts)
const FAKE = `(() => {
  const T = window.__tts = { spoken: [], cancels: 0, mode: 'normal', per: 60, langs: [], rates: [] }
  let queue = [], timer = null
  const S = { speaking: false, pending: false, paused: false,
    getVoices: () => [], resume() {}, pause() {}, addEventListener() {},
    speak(u) { T.spoken.push(u.text); T.langs.push(u.lang); T.rates.push(u.rate); if (T.mode === 'silent') return; queue.push(u); S.pending = queue.length > 1; if (!timer) next() },
    cancel() { T.cancels++; const q = queue; queue = []; clearTimeout(timer); timer = null; S.speaking = false; S.pending = false
      if (T.mode === 'normal') q.forEach((u) => u.onerror && u.onerror({ error: 'interrupted' })) } }
  function next() { const u = queue[0]; if (!u) { S.speaking = false; S.pending = false; timer = null; return }
    S.speaking = true; if (T.mode === 'normal' && u.onstart) u.onstart({})
    timer = setTimeout(() => { queue.shift(); if (T.mode === 'normal' && u.onend) u.onend({}); timer = null; next() }, T.per) }
  window.SpeechSynthesisUtterance = function (text) { this.text = text; this.lang = ''; this.rate = 1 }
  Object.defineProperty(window, 'speechSynthesis', { value: S, configurable: true })
})()`
const tts = (page) => page.evaluate(() => ({ ...window.__tts, text: window.__tts.spoken.join(' ') }))
const reset = (page, mode = 'normal', per = 60) => page.evaluate(([m, p]) => { const T = window.__tts; T.spoken = []; T.cancels = 0; T.langs = []; T.rates = []; T.mode = m; T.per = p }, [mode, per])

async function unit(browser, speechPath) {
  const page = await browser.newPage(); await page.addInitScript(FAKE)
  await page.route('http://unit.test/**', (r) => r.request().url().endsWith('speech.js') ? r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(speechPath, 'utf8') }) : r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>t</title>' }))
  await page.goto('http://unit.test/')
  const r = await page.evaluate(async () => {
    const m = await import('http://unit.test/speech.js'); const T = window.__tts; const out = {}
    const wait = (ms) => new Promise((r) => setTimeout(r, ms))
    const run = (text, opts = {}) => new Promise((res) => { const ev = []; const ok = m.speak(text, { ...opts, onStart: () => ev.push('start'), onEnd: () => { ev.push('end'); res(ev) }, onError: (e) => { ev.push('error:' + e); res(ev) } }); if (!ok) res(['unsupported']) })
    const clear = () => { T.spoken = []; T.cancels = 0; T.langs = []; T.rates = [] }
    out.canSpeak = m.canSpeak()
    // 1. a short verse
    clear(); out.short = await run('For God so loved the world.'); out.shortSpoken = [...T.spoken]; out.lang = T.langs[0]; out.rate = T.rates[0]
    // 2. a long passage is split into sentences, nothing lost, none over 220 characters
    const long = Array.from({ length: 14 }, (_, i) => `Sentence number ${i + 1} speaks of the Lord who is faithful in every generation and keeps covenant with those who love him.`).join(' ')
    clear(); out.long = await run(long); out.longParts = T.spoken.length; out.longMax = Math.max(...T.spoken.map((s) => s.length)); out.longWhole = T.spoken.join(' ') === long
    // 3. a single sentence with no punctuation, longer than the limit
    const run_on = Array.from({ length: 90 }, (_, i) => 'word' + i).join(' ')
    out.runOnMax = Math.max(...m.chunks(run_on).map((s) => s.length)); out.runOnWhole = m.chunks(run_on).join(' ') === run_on
    // 4. empty text does nothing and is not an error
    clear(); out.empty = m.speak('   '); out.emptySpoken = T.spoken.length
    // 5. a second read replaces the first: the first hears "end", the engine is cancelled once
    clear(); T.per = 400; const firstEv = []; m.speak('First read that is still going.', { onEnd: () => firstEv.push('end'), onError: (e) => firstEv.push('error:' + e) })
    await wait(80); const second = run('Second read.'); await wait(30); out.replacedFirst = [...firstEv]; T.per = 60; out.second = await second; out.replaceCancels = T.cancels; out.secondSpoken = T.spoken[T.spoken.length - 1]
    // 6. stop: engine cancelled, caller hears "end", nothing more is read
    clear(); T.per = 400; const stopEv = []; m.speak('One. Two. Three.', { onStart: () => stopEv.push('start'), onEnd: () => stopEv.push('end'), onError: (e) => stopEv.push('error:' + e) })
    await wait(80); m.stopSpeaking(); await wait(120); out.stop = [...stopEv]; out.stopCancels = T.cancels; out.stopEngineQuiet = !window.speechSynthesis.speaking; T.per = 60
    // 7. an engine that reads but never fires events: start and end are still reported
    clear(); T.mode = 'mute-events'; T.per = 450; out.muteEvents = await run('agape'); T.per = 60; T.mode = 'normal' // one word, under half a second
    // 8. an engine that never starts: the caller hears an error after about six seconds (button resets)
    clear(); T.mode = 'silent'; const t0 = Date.now(); out.silent = await run('Nothing will play.'); out.silentMs = Date.now() - t0; T.mode = 'normal'
    // 9. works again right after a failure
    clear(); out.afterFail = await run('Back again.')
    // 10. leaving the app stops the read
    clear(); T.per = 400; const hidEv = []; m.speak('Reading while the app goes away.', { onEnd: () => hidEv.push('end') }); await wait(60)
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); await wait(60)
    out.hidden = [...hidEv]; out.hiddenCancels = T.cancels; Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); T.per = 60
    // 11. no speech engine at all
    Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true }); out.noEngine = m.speak('Hello.'); out.noEngineCan = m.canSpeak()
    return out
  })
  const U = 'speech.js'
  check(`${U}: a verse is read and reports start then end`, r.canSpeak && r.short.join() === 'start,end' && r.shortSpoken.join(' ') === 'For God so loved the world.', JSON.stringify([r.short, r.shortSpoken]))
  check(`${U}: asks for an English voice at the given pace`, r.lang === 'en-US' && r.rate === 0.9, `${r.lang} ${r.rate}`)
  check(`${U}: a long passage is read in sentences, nothing dropped`, r.long.join() === 'start,end' && r.longParts > 5 && r.longMax <= 220 && r.longWhole, `${r.longParts} parts, longest ${r.longMax}, whole ${r.longWhole}`)
  check(`${U}: a run-on sentence is still split under the limit`, r.runOnMax <= 220 && r.runOnWhole, `${r.runOnMax} ${r.runOnWhole}`)
  check(`${U}: empty text reads nothing and is not an error`, r.empty === true && r.emptySpoken === 0)
  check(`${U}: a new read replaces the one playing`, r.replacedFirst.join() === 'end' && r.second.join() === 'start,end' && r.replaceCancels === 1 && r.secondSpoken === 'Second read.', JSON.stringify([r.replacedFirst, r.second, r.replaceCancels]))
  check(`${U}: stop silences the device and resets the button`, r.stop.join() === 'start,end' && r.stopCancels === 1 && r.stopEngineQuiet, JSON.stringify([r.stop, r.stopCancels]))
  check(`${U}: a device that reads without sending events still reports start and end`, r.muteEvents.join() === 'start,end', r.muteEvents.join())
  check(`${U}: a device that never starts gives an error in about 6 seconds`, r.silent.join() === 'error:no-start' && r.silentMs >= 5500 && r.silentMs <= 7500, `${r.silent.join()} after ${r.silentMs} ms`)
  check(`${U}: reads again after a failure`, r.afterFail.join() === 'start,end', r.afterFail.join())
  check(`${U}: leaving the app stops the read`, r.hidden.join() === 'end' && r.hiddenCancels === 1, JSON.stringify([r.hidden, r.hiddenCancels]))
  check(`${U}: a browser with no read-aloud is reported, not crashed`, r.noEngine === false && r.noEngineCan === false)
  await page.close()
}
module.exports = { FAKE, tts, reset, check, results, norm, unit }
if (require.main === module) (async () => {
  const b = await chromium.launch(); await unit(b, process.argv[2]); await b.close()
  console.log(results.join('\n')); process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0)
})()
