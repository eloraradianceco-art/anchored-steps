// Read-aloud buttons in each app, against the stand-in speech engine (see speech-check.cjs).
// Run: npx vite build && node tests/speech-ui.cjs src/speech.js as1=dist
const { chromium, serve, openApp } = require('./appkit.cjs')
const { FAKE, tts, reset, check, results, norm, unit } = require('./speech-check.cjs')
const wait = (p, ms) => p.waitForTimeout(ms)
const clickText = async (p, t) => { await p.getByText(t, { exact: false }).first().click(); await wait(p, 600) }

// Listen inside a daily flow (Year 1, Year 2 Daily Steps; Armed & Anchored Drill)
async function flowListen(p, name, open, verseSel) {
  await open(); await wait(p, 500)
  const verse = norm(await p.locator(verseSel).first().innerText())
  await reset(p, 'normal', 1500) // slow enough that a one-sentence verse is still being read when Stop is tapped
  await p.getByRole('button', { name: 'Listen' }).first().click(); await wait(p, 250)
  let t = await tts(p)
  check(`${name}: Listen reads the passage on the card`, norm(t.text) === verse && verse.length > 20, `asked "${t.text.slice(0, 60)}…" vs card "${verse.slice(0, 60)}…"`)
  check(`${name}: Listen asks for English`, t.langs.every((l) => l === 'en-US') && t.langs.length > 0)
  const chip = p.locator('button', { hasText: /^(Listen|Stop)$/ }).first()
  check(`${name}: the chip says Stop while reading`, /Stop/.test(await chip.innerText()), await chip.innerText())
  await chip.click(); await wait(p, 250)
  t = await tts(p)
  check(`${name}: tapping Stop silences it and the chip returns to Listen`, t.cancels === 1 && /Listen/.test(await chip.innerText()) && !(await p.evaluate(() => window.speechSynthesis.speaking)), `cancels ${t.cancels}, chip ${await chip.innerText()}`)
  // reads to the end on its own
  await reset(p, 'normal', 40); await chip.click(); await wait(p, 2200)
  check(`${name}: the chip returns to Listen when the passage ends`, /Listen/.test(await chip.innerText()) && norm((await tts(p)).text) === verse)
  // leaving the card stops it
  await reset(p, 'normal', 1500); await chip.click(); await wait(p, 300)
  await p.getByRole('button', { name: /^Close/ }).first().click(); await wait(p, 300)
  check(`${name}: closing the card stops the reading`, (await tts(p)).cancels === 1 && !(await p.evaluate(() => window.speechSynthesis.speaking)))
  // a device that never starts: the person is told
  await open(); await wait(p, 400); await reset(p, 'silent')
  await p.getByRole('button', { name: 'Listen' }).first().click(); await wait(p, 6600)
  const body = await p.locator('body').innerText()
  check(`${name}: if nothing plays, the chip resets`, (await p.locator('button', { hasText: /^Listen$/ }).count()) > 0)
  check(`${name}: if nothing plays, a message says so`, /Couldn.t play the audio/.test(body), body.match(/Couldn.t[^\n]*/)?.[0] || 'no message')
  await p.getByRole('button', { name: /^Close/ }).first().click(); await wait(p, 300); await reset(p)
}

// Word Study "Hear pronunciation"
async function pronounce(p, name) {
  const btn = p.getByRole('button', { name: 'Hear pronunciation' })
  const n = await btn.count()
  check(`${name}: Word Study has pronunciation buttons`, n > 0, String(n))
  if (!n) return
  await reset(p, 'normal', 500)
  await btn.first().click(); await wait(p, 200)
  const t = await tts(p)
  check(`${name}: pronunciation reads the word in Latin letters, slowly`, t.spoken.length === 1 && /^[A-Za-zÀ-ɏḀ-ỿ' \-ʼʻ’.]+$/.test(t.text) && t.rates[0] === 0.72, `"${t.text}" at ${t.rates[0]}`)
  const during = await btn.first().evaluate((b) => getComputedStyle(b).backgroundColor)
  await wait(p, 900)
  const after = await btn.first().evaluate((b) => getComputedStyle(b).backgroundColor)
  check(`${name}: the button lights while speaking and resets after`, during !== after, `${during} → ${after}`)
  // every word on the page has something to say
  const all = []
  for (let i = 0; i < n; i++) { await reset(p, 'normal', 30); await btn.nth(i).click(); await wait(p, 150); all.push((await tts(p)).text) }
  check(`${name}: every word on this page can be heard (${n})`, all.every((x) => x && x.length > 1), all.join(' | '))
}

const run = {
  async as1(p) {
    await flowListen(p, 'Year 1 Daily Steps', async () => { await p.locator('button[aria-label^="Day 1"]').first().click() }, '.ds-verse')
    await clickText(p, 'See the whole week at once'); await clickText(p, 'Lexicon'); await pronounce(p, 'Year 1')
  },
  async as2(p) {
    await flowListen(p, 'Year 2 Daily Steps', async () => { await p.locator('button[aria-label^="Day 1"]').first().click() }, '.ds-verse')
    await clickText(p, 'See the whole week at once'); await clickText(p, 'Lexicon'); await pronounce(p, 'Year 2')
  },
  async aa(p) {
    await flowListen(p, 'Armed & Anchored Drill', async () => { await p.getByRole('button', { name: 'Start drill' }).first().click() }, '.dr-verse')
    await p.locator('nav[aria-label="Main"] button', { hasText: 'Arsenal' }).click(); await wait(p, 500)
    await clickText(p, 'The Full Armor of God')
    for (const tab of ['Word', 'Lexicon', 'Study']) { if (await p.getByRole('button', { name: 'Hear pronunciation' }).count()) break; const b = p.locator('button', { hasText: tab }).first(); if (await b.count()) { await b.click(); await wait(p, 500) } }
    await pronounce(p, 'Armed & Anchored')
  },
  async rl(p) {
    const name = 'Red Letters'
    // Home: today's passage
    await reset(p, 'normal', 400)
    const listen = p.getByRole('button', { name: /Listen|Stop/ }).first()
    await listen.click(); await wait(p, 250)
    let t = await tts(p)
    check(`${name}: Listen on the home page reads today's passage`, t.text.length > 20 && t.langs.every((l) => l === 'en-US'), t.text.slice(0, 80))
    check(`${name}: the button changes to Stop while reading`, /Stop/.test(await listen.innerText()), await listen.innerText())
    await listen.click(); await wait(p, 200)
    check(`${name}: Stop silences it and the button returns to Listen`, /Listen/.test(await listen.innerText()) && !(await p.evaluate(() => window.speechSynthesis.speaking)))
    // finishes on its own
    await reset(p, 'normal', 40); await listen.click(); await wait(p, 2500)
    check(`${name}: the button returns to Listen when the passage ends`, /Listen/.test(await listen.innerText()), await listen.innerText())
    // never starts
    await reset(p, 'silent'); await listen.click(); await wait(p, 6300)
    const body = await p.locator('body').innerText()
    check(`${name}: if nothing plays, the button resets`, /Listen/.test(await listen.innerText()))
    check(`${name}: if nothing plays, a message says so`, /Couldn.t play the audio/.test(body), body.match(/Couldn.t[^\n]*/)?.[0] || 'no message')
    await reset(p)
    // Passage page
    await clickText(p, 'Read & Study'); await reset(p, 'normal', 400)
    const l2 = p.getByRole('button', { name: /Listen|Stop/ }).first()
    await l2.click(); await wait(p, 250); t = await tts(p)
    const shown = norm(await p.locator('body').innerText())
    check(`${name}: Listen on a passage reads the passage shown`, t.text.length > 20 && shown.includes(norm(t.spoken[0]).slice(0, 40)), t.text.slice(0, 80))
    // moving to another section or passage stops it
    const c0 = (await tts(p)).cancels
    await p.getByRole('button', { name: 'Next passage' }).click(); await wait(p, 300)
    check(`${name}: going to the next passage stops the reading`, (await tts(p)).cancels > c0 && !(await p.evaluate(() => window.speechSynthesis.speaking)))
    await p.getByRole('button', { name: 'Previous passage' }).click(); await wait(p, 400) // back to the passage that has a Word Study
    await p.locator('[aria-label="Word Study"]').first().click(); await wait(p, 500)
    await pronounce(p, name)
  },
}

;(async () => {
  const b = await chromium.launch(); let port = 4970
  await unit(b, process.argv[2])
  for (const a of process.argv.slice(3)) {
    const [name, dist] = a.split('='); const s = await serve(dist, ++port)
    try { const { page, errs } = await openApp(b, port, { init: FAKE }); await run[name](page); check(`${name}: no page errors`, errs.length === 0, errs.join(' | ')); await page.close() }
    catch (e) { check(`${name}: ran to the end`, false, e.message.split('\n')[0]) }
    s.close()
  }
  await b.close(); console.log(results.join('\n')); process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0)
})()
