// Year 1 weeks (2026-11-17): the app opens on YOUR week (the one you're working through on the Steps page),
// not the last week you browsed; Next / Previous stay put; "Back to your week".
// Run: npm run build && node tests/week-test.cjs dist   (needs Playwright: npm install --no-save playwright && npx playwright install chromium)
// The database is faked in the browser, so nothing real is touched.
const { chromium, devices } = require('playwright')
const http = require('http'), fs = require('fs'), path = require('path')
const DIST = process.argv[2], PORT = 4873, REF = 'cvtukqamaqrhjtdvmslb'
const UID = '7a1c2e9b-4d3f-4b8a-9c21-5e6f7a8b9c0d'
const user = { id: UID, aud: 'authenticated', role: 'authenticated', email: 'grace@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-04-01T00:00:00Z' }
const token = { access_token: 'x.' + Buffer.from(JSON.stringify({ sub: UID, exp: 4102444800 })).toString('base64') + '.y', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, refresh_token: 'r', user }
const TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' }
const server = http.createServer((req, res) => {
  let f = path.join(DIST, decodeURIComponent(req.url.split('?')[0]))
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html')
  res.setHeader('Content-Type', TYPES[path.extname(f)] || 'application/octet-stream'); fs.createReadStream(f).pipe(res)
})
const results = []
const check = (k, ok, x) => results.push((ok ? 'PASS ' : 'FAIL ') + k + (x !== undefined ? ' — ' + (typeof x === 'string' ? x : JSON.stringify(x)) : ''))

async function open(browser, { localWeek, serverWeek, entries = [], homeScreen = false }) {
  const db = { profile: { id: UID, email: user.email, current_week: serverWeek, onboarded: true, dark_mode: true, bookmarks: [], subscription_status: 'active' }, saves: [], reads: 0 }
  const ctx = await browser.newContext({ ...devices['iPhone 14'] })
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ body: '' }))
  await ctx.route(`https://${REF}.supabase.co/**`, async (route) => {
    const req = route.request(), u = new URL(req.url()), m = req.method()
    if (u.pathname.startsWith('/auth/v1/user')) return route.fulfill({ json: user })
    if (u.pathname.startsWith('/auth/v1/token')) return route.fulfill({ json: token })
    if (u.pathname.startsWith('/auth/v1/')) return route.fulfill({ status: 204, body: '' })
    const obj = (req.headers()['accept'] || '').includes('vnd.pgrst.object')
    if (u.pathname === '/rest/v1/profiles') {
      if (m === 'GET') { db.reads++; return route.fulfill({ json: obj ? db.profile : [db.profile] }) }
      const body = JSON.parse(req.postData() || '{}'); db.saves.push(body); Object.assign(db.profile, body); return route.fulfill({ status: 204, body: '' })
    }
    if (u.pathname === '/rest/v1/journal_entries' && m === 'GET') return route.fulfill({ json: entries })
    if (u.pathname.startsWith('/rest/v1/rpc/')) return route.fulfill({ json: null })
    if (m !== 'GET' && m !== 'HEAD') return route.fulfill({ status: 201, json: [] })
    return route.fulfill({ json: [] })
  })
  await ctx.addInitScript(([t, wk]) => {
    if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1')
    localStorage.setItem('sb-cvtukqamaqrhjtdvmslb-auth-token', t); localStorage.setItem('onboarding_complete', 'true')
    if (wk) localStorage.setItem('as1_current_week', String(wk))
  }, [JSON.stringify(token), localWeek])
  if (homeScreen) await ctx.addInitScript(() => { Object.defineProperty(navigator, 'standalone', { get: () => true }) })
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message))
  const week = async () => Number(((await p.locator('.ds-wk').innerText().catch(() => '')).match(/Week (\d+)/) || [])[1] || 0)
  const next = () => p.getByRole('button', { name: 'Next week' }).click()
  const prev = () => p.getByRole('button', { name: 'Previous week' }).click()
  const away = async (ms) => {
    await p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')) })
    await p.waitForTimeout(ms)
    await p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')) })
    await p.waitForTimeout(600)
  }
  return { ctx, p, db, errs, week, next, prev, away, pill: p.locator('.ds-yourweek') }
}

server.listen(PORT, async () => {
  const browser = await chromium.launch()
  const URL_ = `http://localhost:${PORT}/`
  const dayAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
  const ds = (week, key, n, id) => ({ id, user_id: UID, week, field_key: 'ds_' + key, field_value: dayAgo(n) })
  const W1D2 = [ds(1, 'start', 1, 11), ds(1, '1', 1, 12)]

  // 1. No steps done yet: opens where you left off, and Next / Previous stay put (as before)
  let t = await open(browser, { localWeek: 4, serverWeek: 4 })
  await t.p.goto(URL_); await t.p.waitForTimeout(2800)
  check('no steps yet: opens where you left off (week 4)', (await t.week()) === 4 && (await t.pill.count()) === 0, await t.week())
  await t.next(); await t.p.waitForTimeout(1500)
  check('Next → week 5, and stays', (await t.week()) === 5, await t.week())
  await t.next(); await t.next(); await t.prev(); await t.p.waitForTimeout(1500)
  check('quick taps → week 6, and stays', (await t.week()) === 6 && t.db.profile.current_week === 6, [await t.week(), t.db.profile.current_week])
  await t.p.reload(); await t.p.waitForTimeout(2800)
  check('no steps yet: reopening returns to where you left off (week 6)', (await t.week()) === 6, await t.week())
  check('no page errors', t.errs.length === 0, t.errs.slice(0, 2))
  await t.ctx.close()

  // 2. Week 1, day two: browse ahead, close, open → week 1
  t = await open(browser, { localWeek: 1, serverWeek: 1, entries: W1D2 })
  await t.p.goto(URL_); await t.p.waitForTimeout(2800)
  check('your week: opens on week 1', (await t.week()) === 1 && (await t.pill.count()) === 0, await t.week())
  await t.next(); await t.p.waitForTimeout(1200)
  check('browsing week 2 shows "Back to your week (Week 1)"', (await t.week()) === 2 && /Back to your week \(Week 1\)/.test(await t.pill.innerText().catch(() => '')))
  if (process.env.SHOT) await t.p.screenshot({ path: process.env.SHOT })
  await t.away(2500)
  check('browser tab: a short trip away keeps the week you were browsing', (await t.week()) === 2, await t.week())
  await t.p.reload(); await t.p.waitForTimeout(2800)
  check('close and open after browsing week 2 → week 1', (await t.week()) === 1, await t.week())
  await t.next(); await t.next(); await t.p.waitForTimeout(500); await t.pill.click(); await t.p.waitForTimeout(700)
  check('"Back to your week" from week 3 → week 1', (await t.week()) === 1 && (await t.pill.count()) === 0, await t.week())
  check('your week: no page errors', t.errs.length === 0, t.errs.slice(0, 2))
  await t.ctx.close()

  // 3. Home Screen app: coming back counts as opening; never while a step is open
  t = await open(browser, { localWeek: 1, serverWeek: 1, entries: W1D2, homeScreen: true })
  await t.p.goto(URL_); await t.p.waitForTimeout(2800)
  await t.next(); await t.p.waitForTimeout(500); await t.away(2500)
  check('Home Screen app: browse week 2, leave, come back → week 1', (await t.week()) === 1, await t.week())
  await t.next(); await t.p.waitForTimeout(500)
  await t.p.locator('.ds-stone').first().click(); await t.p.waitForTimeout(700)
  const stepOpen = (await t.p.locator('.ds-overlay').count()) > 0
  await t.away(2500)
  const stillOpen = (await t.p.locator('.ds-overlay').count()) > 0
  await t.p.keyboard.press('Escape'); await t.p.waitForTimeout(500)
  check('Home Screen app: a step open on week 2 is left alone', stepOpen && stillOpen && (await t.week()) === 2, { stepOpen, stillOpen, week: await t.week() })
  await t.ctx.close()

  // 4. Another device that last browsed week 5: step progress wins
  t = await open(browser, { localWeek: 5, serverWeek: 5, entries: W1D2 })
  await t.p.goto(URL_); await t.p.waitForTimeout(2800)
  check('second device (last browsed week 5): opens on week 1', (await t.week()) === 1, await t.week())
  await t.next(); await t.p.waitForTimeout(400)
  await t.p.evaluate(() => window.dispatchEvent(new Event('focus'))); await t.p.waitForTimeout(1500)
  check('a session refresh while browsing does not move you', (await t.week()) === 2, await t.week())
  await t.ctx.close()

  // 5. Week 1 finished → opens on week 2
  t = await open(browser, { localWeek: 1, serverWeek: 1, entries: [ds(1, 'start', 8, 20), ...[1, 2, 3, 4, 5, 6, 7].map((n) => ds(1, String(n), 8 - n, 20 + n))] })
  await t.p.goto(URL_); await t.p.waitForTimeout(2800)
  check('week 1 finished: opens on week 2', (await t.week()) === 2, await t.week())
  await t.prev(); await t.p.waitForTimeout(600)
  check('finished week 1: no duplicate button (it already says Start week 2)', (await t.pill.count()) === 0 && /Start week 2/.test(await t.p.locator('body').innerText()))
  await t.ctx.close()

  await browser.close(); server.close()
  console.log(results.join('\n')); console.log(results.filter((r) => r.startsWith('FAIL')).length + ' failed of ' + results.length)
})
