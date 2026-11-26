// Scripture moved to the BSB (2026-11-26). Marks and saved verses made under the old translation labels must still
// belong to the same verse, and nothing on screen may carry an old label. Database faked.
// Run: npx vite build && node tests/bsb-check.cjs dist [screenshot folder]
let chromium; try { ({ chromium } = require('playwright')) } catch { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')) }
const http = require('http'), fs = require('fs'), path = require('path')
const DIST = path.resolve(process.argv[2] || 'dist'), OUT = process.argv[3] || '', PORT = 4797
const REF = 'cvtukqamaqrhjtdvmslb', UID = '00000000-0000-4000-8000-000000000001'
const user = { id: UID, aud: 'authenticated', role: 'authenticated', email: 'test@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
const token = { access_token: 'x.' + Buffer.from(JSON.stringify({ sub: UID, exp: 4102444800 })).toString('base64') + '.y', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, refresh_token: 'r', user }
const OLD = process.env.OLD_KEY || 'Hebrews 11:1 (ESV)', WEEK = Number(process.env.WEEK || 3)
const profile = { id: UID, email: user.email, current_week: WEEK, onboarded: true, dark_mode: true, light_mode: false, saved: [], subscription_status: 'active', plan: 'annual', paid: true,
  bookmarks: [{ key: `${OLD}_${WEEK}`, ref: OLD, text: 'OLD WORDING SAVED BEFORE THE MOVE', week: WEEK, section: 'scripture', date: '11/1/2026' }] }
const entries = [{ id: 1, user_id: UID, week: WEEK, field_key: 'mem_' + OLD, field_value: '1' }]
let fails = 0; const check = (n, ok, extra = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? ' — ' + extra : '')); if (!ok) fails++ }
const server = http.createServer((req, res) => { let f = path.join(DIST, decodeURIComponent(req.url.split('?')[0])); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html'); res.setHeader('Content-Type', { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png' }[path.extname(f)] || 'application/octet-stream'); fs.createReadStream(f).pipe(res) })
;(async () => {
  await new Promise((r) => server.listen(PORT, r))
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 390, height: 844 } }); const errs = []; page.on('pageerror', (e) => errs.push(e.message))
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ body: '' }))
  await page.route('https://eloraradiance.com/**', (r) => r.fulfill({ json: {} }))
  await page.route(`https://${REF}.supabase.co/**`, (route) => {
    const req = route.request(), u = new URL(req.url()), m = req.method()
    if (u.pathname.startsWith('/auth/v1/user')) return route.fulfill({ json: user })
    if (u.pathname.startsWith('/auth/v1/token')) return route.fulfill({ json: token })
    if (u.pathname.startsWith('/auth/v1/')) return route.fulfill({ status: 204, body: '' })
    if (m !== 'GET' && m !== 'HEAD' && !u.pathname.includes('/rpc/')) return route.fulfill({ status: 204, body: '' })
    if (/profiles$/.test(u.pathname)) return route.fulfill({ json: (req.headers()['accept'] || '').includes('vnd.pgrst.object') ? profile : [profile] })
    if (/journal_entries$/.test(u.pathname) || /entries$/.test(u.pathname)) return route.fulfill({ json: entries })
    if (u.pathname.includes('/rpc/') && /profile/.test(u.pathname)) return route.fulfill({ json: profile })
    if (u.pathname.includes('/rpc/')) return route.fulfill({ json: null })
    return route.fulfill({ json: [] })
  })
  await page.goto(`http://localhost:${PORT}/`)
  await page.evaluate(([k, s]) => { localStorage.clear(); localStorage.setItem(k, JSON.stringify(s)); for (const f of ['as1_onboarded', 'as2_onboarded', 'onboarded']) localStorage.setItem(f, '1') }, [`sb-${REF}-auth-token`, token])
  await page.goto(`http://localhost:${PORT}/`); await page.waitForTimeout(2000)
  // the whole data set carries no old label on a reference
  const refs = await page.evaluate(() => { const A = window.__APPDATA__ || {}; const W = A.ALL_WEEKS || A.WEEKS || []; const out = []; W.forEach((w) => (w.scriptures || []).forEach((s) => out.push(s.ref))); Object.values(A.CROSS_REFS || {}).forEach((v) => v.forEach((s) => out.push(s.ref))); return out })
  check('data loaded', refs.length > 20, refs.length + ' references')
  check('no reference is labelled ESV, NIV, NKJV or NLT', !refs.some((r) => /\((ESV|NIV|NKJV|NLT)\)/.test(r)))
  // saved verse shows today's wording
  await page.getByRole('button', { name: /search/i }).first().click().catch(() => {}); await page.waitForTimeout(900)
  let body = await page.locator('body').innerText()
  check('saved verse is listed', /Saved verses · 1/i.test(body))
  check('saved verse shows the BSB wording, not the stored copy', !/OLD WORDING/.test(body) && !/\(ESV\)|\(NIV\)|\(NKJV\)/.test(body))
  if (OUT) await page.screenshot({ path: path.join(OUT, 'bsb-saved.png') })
  // the memorized mark still shows on that verse
  await page.getByRole('button', { name: /^(Go|Open)\b/ }).first().click().catch(() => {}); await page.waitForTimeout(1200)
  body = await page.locator('body').innerText()
  check('memorized mark made under the old label still shows', /✓ Memorized/.test(body))
  check('the verse is starred as saved', /★/.test(body))
  if (OUT) await page.screenshot({ path: path.join(OUT, 'bsb-scripture.png'), fullPage: true })
  // Settings credits
  check('no page errors', errs.length === 0, errs.join(' | '))
  await b.close(); server.close(); console.log(fails + ' failed'); process.exit(fails ? 1 : 0)
})()
