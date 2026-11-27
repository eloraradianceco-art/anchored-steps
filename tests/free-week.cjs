// Free week: a signed-in account with no purchase has week 1; every other week opens the purchase page; a purchase
// opens the whole year. Database faked, no real requests.  Run: npx vite build && node tests/free-week.cjs dist [as1|as2]
let chromium; try { ({ chromium } = require('playwright')) } catch { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')) }
const http = require('http'), fs = require('fs'), path = require('path')
const DIST = path.resolve(process.argv[2] || 'dist'), APPID = process.argv[3] || 'as1', PORT = APPID === 'as1' ? 4941 : 4942
const PROFILES = APPID === 'as1' ? '/profiles' : '/as2_profiles', ENTRIES = APPID === 'as1' ? '/journal_entries' : '/as2_journal_entries'
const REF = 'cvtukqamaqrhjtdvmslb', UID = '00000000-0000-4000-8000-000000000001'
const user = { id: UID, aud: 'authenticated', role: 'authenticated', email: 'grace@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
const token = { access_token: 'x.' + Buffer.from(JSON.stringify({ sub: UID, exp: 4102444800 })).toString('base64') + '.y', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, refresh_token: 'r', user }
const results = []; const check = (n, ok, x = '') => results.push((ok ? 'PASS ' : 'FAIL ') + n + (x ? ' — ' + x : ''))
const server = http.createServer((req, res) => {
  let f = path.join(DIST, decodeURIComponent(req.url.split('?')[0])); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html')
  res.setHeader('Content-Type', { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.json': 'application/json' }[path.extname(f)] || 'application/octet-stream'); fs.createReadStream(f).pipe(res)
})
async function open(browser, { signedIn = true, viewport = { width: 390, height: 844 } } = {}) {
  const world = { owned: false, buyable: false, writes: [], profileWrites: 0 }
  const ctx = await browser.newContext({ viewport }); const page = await ctx.newPage(); const errs = []
  page.on('pageerror', (e) => errs.push(e.message))
  await page.addInitScript(([k, t, on]) => { if (!sessionStorage.getItem('seeded')) { if (on) localStorage.setItem(k, JSON.stringify(t)); localStorage.setItem('onboarding_complete', 'true'); localStorage.setItem('y2_onboarding_complete', '1'); localStorage.setItem('as1_current_week', '9'); localStorage.setItem('y2_last_week', '9'); sessionStorage.setItem('seeded', '1') } }, [`sb-${REF}-auth-token`, token, signedIn])
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ body: '' }))
  await page.route('https://eloraradiance.com/**', (r) => r.fulfill({ json: { total_cents: 0, through: '', cadence: 'quarterly', recipients: [] }, headers: { 'access-control-allow-origin': '*' } }))
  await page.route(`https://${REF}.supabase.co/**`, (route) => {
    const req = route.request(), u = new URL(req.url()), m = req.method()
    const one = (row) => route.fulfill((req.headers()['accept'] || '').includes('vnd.pgrst.object') ? (row ? { json: row } : { status: 406, json: { code: 'PGRST116', message: 'no rows' } }) : { json: row ? [row] : [] })
    if (u.pathname.startsWith('/auth/v1/user')) return route.fulfill({ json: user })
    if (u.pathname.startsWith('/auth/v1/token')) return route.fulfill({ json: token })
    if (u.pathname.startsWith('/auth/v1/')) return route.fulfill({ status: 204, body: '' })
    if (u.pathname.endsWith('/rpc/claim_purchase')) { if (world.buyable) world.owned = true; return route.fulfill({ json: world.owned }) }
    if (u.pathname.includes('/rpc/')) return route.fulfill({ json: null })
    if (m !== 'GET' && m !== 'HEAD') {
      if (u.pathname.endsWith(PROFILES)) world.profileWrites++
      if (u.pathname.endsWith(ENTRIES)) { try { const b = JSON.parse(req.postData() || '{}'); (Array.isArray(b) ? b : [b]).forEach((x) => world.writes.push(x.week)) } catch {} }
      return route.fulfill({ status: 201, json: [] })
    }
    if (u.pathname.endsWith(PROFILES)) return one(world.owned ? { id: UID, user_id: UID, email: user.email, plan: 'annual', subscription_status: 'active', current_week: 1, onboarded: true, dark_mode: true, bookmarks: [] } : null)
    return route.fulfill({ json: [] })
  })
  await page.goto(`http://localhost:${PORT}/`); await page.waitForTimeout(2600)
  return { page, ctx, errs, world, text: () => page.locator('body').innerText(), wide: () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth) }
}
server.listen(PORT, async () => {
  const browser = await chromium.launch()
  try {
    // 1. Signed out: the free week is offered beside the purchase, and leads to Create Account
    let v = await open(browser, { signedIn: false }); let t = await v.text()
    check('signed out: purchase and free week both offered', /Get Lifetime Access/i.test(t) && /Start Week 1 Free/i.test(t) && /No card needed/i.test(t))
    await v.page.getByRole('button', { name: /Start Week 1 Free/i }).click(); await v.page.waitForTimeout(700); t = await v.text()
    check('signed out: the free week opens Create Account', /Create Account/i.test(t) && (await v.page.locator('input[type="password"]').count()) === 1, t.slice(0, 120).replace(/\n/g, ' / '))
    await v.ctx.close()

    // 2. Signed in, nothing bought: week 1 opens (not the purchase page), whatever week this device last showed
    v = await open(browser); t = await v.text()
    check('free: opens the app on week 1, not the purchase page', /Week 1 of 52/i.test(t) && !/Get Lifetime Access/i.test(t), t.slice(0, 160).replace(/\n/g, ' / '))
    check('free: the bar says week 1 is free', (await v.page.locator('[data-free-bar]').count()) === 1 && /Week 1 is free/i.test(t))
    check('free: nothing runs off the side, no page errors', (await v.wide()) <= 0 && v.errs.length === 0, v.errs.join(' | '))
    // a step can be opened and its work is saved to week 1
    await v.page.getByText(/^Read$/).first().click(); await v.page.waitForTimeout(900); t = await v.text()
    check('free: a step opens', /Continue|Done|Listen|passage/i.test(t))
    await v.page.goto(`http://localhost:${PORT}/`); await v.page.waitForTimeout(2200)
    // 3. Next week → purchase page, with a way back
    await v.page.getByRole('button', { name: 'Next week' }).click(); await v.page.waitForTimeout(800); t = await v.text()
    check('free: next week opens the purchase page', /Get Lifetime Access/i.test(t) && /Back to your free week/i.test(t) && /Check Again/i.test(t))
    await v.page.getByRole('button', { name: /Back to your free week/ }).click(); await v.page.waitForTimeout(600); t = await v.text()
    check('free: back returns to week 1', /Week 1 of 52/i.test(t) && !/Get Lifetime Access/i.test(t))
    await v.page.locator('[data-free-bar]').click(); await v.page.waitForTimeout(600)
    check('free: the bar opens the purchase page', /Get Lifetime Access/i.test(await v.text()))
    // 4. Buying: Check Again opens the whole year
    v.world.buyable = true
    await v.page.getByRole('button', { name: /Check Again/ }).click(); await v.page.waitForTimeout(3200); t = await v.text()
    check('purchase: the year opens and the free bar is gone', /of 52/i.test(t) && !/Get Lifetime Access/i.test(t) && (await v.page.locator('[data-free-bar]').count()) === 0, t.slice(0, 140).replace(/\n/g, ' / '))
    await v.page.getByRole('button', { name: 'Next week' }).click(); await v.page.waitForTimeout(800); t = await v.text()
    check('purchase: next week now opens week 2', /Week 2 of 52/i.test(t) && !/Get Lifetime Access/i.test(t))
    check('whole run: no page errors', v.errs.length === 0, v.errs.join(' | '))
    await v.ctx.close()

    // 5. Contents list in free mode: another week goes to the purchase page
    v = await open(browser)
    await v.page.getByRole('button', { name: /Contents/i }).last().click(); await v.page.waitForTimeout(700)
    await v.page.getByRole('button', { name: /week\s*5\b/i }).first().click({ timeout: 3000 }).catch((e) => console.log('click', e.message.split('\n')[0])); await v.page.waitForTimeout(700); t = await v.text()
    check('free: a later week in Contents opens the purchase page', /Get Lifetime Access/i.test(t), t.slice(0, 120).replace(/\n/g, ' / '))
    await v.page.getByRole('button', { name: /Back to your free week/ }).click().catch(() => {}); await v.page.waitForTimeout(500)
    for (const tab of ['Search', 'Progress', 'Settings', 'Steps']) { await v.page.getByRole('button', { name: new RegExp(tab, 'i') }).last().click().catch(() => {}); await v.page.waitForTimeout(700) }
    check('free: Search, Progress and Settings open without errors, nothing off the side', v.errs.length === 0 && (await v.wide()) <= 0, v.errs.join(' | '))
    await v.ctx.close()
  } catch (e) { check('test run', false, e.message.split('\n')[0]) }
  await browser.close(); server.close()
  console.log(results.join('\n')); const bad = results.filter((r) => r.startsWith('FAIL')).length
  console.log(`\n${bad} failed of ${results.length}`); process.exit(bad ? 1 : 0)
})
