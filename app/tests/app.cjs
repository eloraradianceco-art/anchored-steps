// Browser check of the built phone app (front page + both years), with the database, the App Store and the phone
// itself faked. No real requests.   Run from app/:  npm run build && node tests/app.cjs dist [screenshot folder]
let chromium; try { ({ chromium } = require('playwright')) } catch { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')) }
const http = require('http'), fs = require('fs'), path = require('path')
const DIST = path.resolve(process.argv[2] || 'dist'), OUT = process.argv[3] || '', PORT = 4931
const REF = 'cvtukqamaqrhjtdvmslb', UID = '00000000-0000-4000-8000-000000000001'
const user = { id: UID, aud: 'authenticated', role: 'authenticated', email: 'grace@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
const token = { access_token: 'x.' + Buffer.from(JSON.stringify({ sub: UID, exp: 4102444800 })).toString('base64') + '.y', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, refresh_token: 'r', user }
const results = []; const check = (n, ok, x = '') => results.push((ok ? 'PASS ' : 'FAIL ') + n + (x ? ' — ' + x : ''))

// Served the way the phone serves it: real files as they are, anything else gets the front page.
const server = http.createServer((req, res) => {
  let f = path.join(DIST, decodeURIComponent(req.url.split('?')[0]))
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html')
  res.setHeader('Content-Type', { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.json': 'application/json' }[path.extname(f)] || 'application/octet-stream')
  fs.createReadStream(f).pipe(res)
})

const today = new Date(); const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
const daysAgo = (n) => { const d = new Date(today); d.setDate(d.getDate() - n); return ymd(d) }
const journal = (week) => [
  ...[1, 2, 3].map((s) => ({ id: 'a' + s, user_id: UID, week, field_key: 'ds_' + s, field_value: daysAgo(0) })),
  ...[0, 1, 2, 3].map((n) => ({ id: 'd' + n, user_id: UID, week, field_key: 'day_' + daysAgo(n), field_value: '1' })),
]

// One fake world per page: which years the account owns, whether a website purchase is waiting, what the store sells.
async function open(browser, { owned = [], signedIn = true, store = null, webPurchase = [], viewport = { width: 390, height: 844 }, start = '/index.html' } = {}) {
  const world = { owned: new Set(owned), apple: new Set(), syncs: 0, claims: 0 }
  const ctx = await browser.newContext({ viewport }); const page = await ctx.newPage(); const errs = []
  page.on('pageerror', (e) => errs.push(e.message))
  await page.addInitScript(([k, t, on, st]) => {
    window.__ER_TEST_SHELL__ = true
    if (on && !sessionStorage.getItem('seeded')) { localStorage.setItem('CapacitorStorage.' + k, JSON.stringify(t)); localStorage.setItem('onboarding_complete', 'true'); localStorage.setItem('y2_onboarding_complete', 'true'); sessionStorage.setItem('seeded', '1') }
    if (st) {
      const P = { year1: { pkg: { identifier: 'year1' }, price: '$39.99', amount: 39.99 }, year2: { pkg: { identifier: 'year2' }, price: '$39.99', amount: 39.99 }, both: { pkg: { identifier: 'both' }, price: '$69.99', amount: 69.99 } }
      window.__ER_TEST_STORE__ = {
        products: async () => Object.fromEntries(st.sells.map((k) => [k, P[k]])),
        buy: async (pkg) => { if (st.cancel) return 'cancelled'; await fetch('https://test.store/bought?p=' + pkg.identifier); return { ok: { as1: pkg.identifier !== 'year2', as2: pkg.identifier !== 'year1' } } },
        restore: async () => { const r = await fetch('https://test.store/restore'); return r.json() },
      }
    }
  }, [`sb-${REF}-auth-token`, token, signedIn, store])
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ body: '' }))
  await page.route('https://eloraradiance.com/**', (r) => r.fulfill({ json: { total_cents: 0, through: '', cadence: 'quarterly', recipients: [] }, headers: { 'access-control-allow-origin': '*' } }))
  await page.route('https://test.store/**', (r) => {
    const u = new URL(r.request().url())
    if (u.pathname === '/bought') { const p = u.searchParams.get('p'); if (p !== 'year2') world.apple.add('as1'); if (p !== 'year1') world.apple.add('as2') }
    if (u.pathname === '/restore') return r.fulfill({ json: { as1: !!store?.appleOwns?.includes('as1'), as2: !!store?.appleOwns?.includes('as2') }, headers: { 'access-control-allow-origin': '*' } })
    return r.fulfill({ json: {}, headers: { 'access-control-allow-origin': '*' } })
  })
  await page.route(`https://${REF}.supabase.co/**`, (route) => {
    const req = route.request(), u = new URL(req.url()), m = req.method()
    const one = (row) => route.fulfill((req.headers()['accept'] || '').includes('vnd.pgrst.object') ? (row ? { json: row } : { status: 406, json: { code: 'PGRST116', details: 'The result contains 0 rows', message: 'no rows' } }) : { json: row ? [row] : [] })
    if (u.pathname.startsWith('/auth/v1/user')) return route.fulfill({ json: user })
    if (u.pathname.startsWith('/auth/v1/token')) return route.fulfill({ json: token })
    if (u.pathname.startsWith('/auth/v1/logout')) return route.fulfill({ status: 204, body: '' })
    if (u.pathname.startsWith('/auth/v1/')) return route.fulfill({ status: 204, body: '' })
    if (u.pathname.endsWith('/functions/v1/store-sync')) {
      world.syncs++
      if (store?.appleOwns) store.appleOwns.forEach((a) => world.apple.add(a))
      world.apple.forEach((a) => world.owned.add(a))   // the server reads Apple and unlocks the account
      return route.fulfill({ json: { ok: true }, headers: { 'access-control-allow-origin': '*' } })
    }
    if (u.pathname.endsWith('/rpc/claim_purchase')) {
      world.claims++
      const app = JSON.parse(req.postData() || '{}').p_app
      const got = webPurchase.includes(app); if (got) world.owned.add(app)
      return route.fulfill({ json: got })
    }
    if (u.pathname.includes('/rpc/')) return route.fulfill({ json: null })
    if (m !== 'GET' && m !== 'HEAD') return route.fulfill({ status: 204, body: '' })
    if (u.pathname.endsWith('/as2_profiles')) return one(world.owned.has('as2') ? { id: 'p2', user_id: UID, email: user.email, plan: 'annual', subscription_status: 'active', current_week: 5, onboarded: true, dark_mode: true, bookmarks: [] } : null)
    if (u.pathname.endsWith('/profiles')) return one(world.owned.has('as1') ? { id: UID, email: user.email, plan: 'annual', subscription_status: 'active', current_week: 12, onboarded: true, dark_mode: true, bookmarks: [] } : null)
    if (u.pathname.endsWith('/as2_journal_entries')) return route.fulfill({ json: world.owned.has('as2') ? journal(5).slice(0, 2) : [] })
    if (u.pathname.endsWith('/journal_entries')) return route.fulfill({ json: world.owned.has('as1') ? journal(12) : [] })
    return route.fulfill({ json: [] })
  })
  await page.goto(`http://localhost:${PORT}${start}`); await page.waitForTimeout(1600)
  const text = () => page.locator('body').innerText()
  const wide = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  const shot = async (name) => { if (OUT) await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: true }) }
  return { page, ctx, errs, world, text, wide, shot, at: () => new URL(page.url()).pathname }
}

const prices = async (v) => { await v.page.locator('[data-see-prices]').click(); await v.page.waitForTimeout(500); return v.text() }
server.listen(PORT, async () => {
  const browser = await chromium.launch()
  try {
    // 1. Signed out: the front page explains the app; no prices, no buy buttons, no outside checkout links
    let v = await open(browser, { signedIn: false })
    let t = await v.text()
    check('signed out: front page with both years', /Anchored Steps/.test(t) && /Year 1/i.test(t) && /Year 2/i.test(t) && /Create Account/i.test(t) && /Sign In/i.test(t))
    check('signed out: no price, no checkout link', !/\$\d/.test(t) && (await v.page.locator('a[href*="stripe.com"]').count()) === 0)
    check('signed out: nothing runs off the side, no errors', (await v.wide()) <= 0 && v.errs.length === 0, v.errs.join(' | '))
    await v.shot('1-signed-out')
    await v.page.getByRole('button', { name: 'Sign In', exact: true }).click(); await v.page.waitForTimeout(300)
    await v.page.locator('input[type="email"]').fill('grace@example.com'); await v.page.locator('input[type="password"]').fill('secret-pass')
    await v.shot('2-sign-in')
    await v.page.locator('form button[type="submit"]').click(); await v.page.waitForTimeout(1800)
    t = await v.text()
    check('sign in: lands on the front page with the doors (nothing owned, purchases off → no buy buttons)', /Choose where to begin/.test(t) && !/Unlock Year/.test(t) && /Already own Year 1\?/.test(t))
    check('sign in: a website purchase was looked for on both years', v.world.claims === 2, String(v.world.claims))
    await v.ctx.close()

    // 2. Signed out and a year's page is opened directly: back to the front page
    v = await open(browser, { signedIn: false, start: '/year1/index.html' })
    check('year 1 opened signed out: returns to the front page', v.at() === '/index.html' && /Create Account/i.test(await v.text()), v.at())
    await v.ctx.close()

    // 3. Owns both: progress on each door, opens each year, the header goes back
    v = await open(browser, { owned: ['as1', 'as2'] })
    t = await v.text()
    check('owns both: Year 1 shows week, steps and streak', /Week 12 of 52 · 3 of 7 steps/.test(t) && /4-day streak/.test(t), t.slice(0, 300).replace(/\n/g, ' / '))
    check('owns both: Year 2 shows its week', /Week 5 of 52 · 2 of 7 steps/.test(t))
    check('owns both: nothing for sale is shown', !/Unlock/.test(t) && !/Restore purchases/i.test(t) && !/given to ministry/.test(t))
    check('owns both: nothing runs off the side, no errors', (await v.wide()) <= 0 && v.errs.length === 0, v.errs.join(' | '))
    await v.shot('3-owns-both')
    await v.page.getByRole('link', { name: /Open Year 1/ }).click(); await v.page.waitForTimeout(2500)
    t = await v.text()
    check('Year 1 opens as its own page and runs', v.at() === '/year1/index.html' && /Anchored Steps/.test(t) && /Steps/i.test(t) && v.errs.length === 0, v.at() + ' ' + v.errs.join(' | '))
    check('Year 1: images load from its own folder', await v.page.evaluate(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0)))
    check('Year 1: nothing runs off the side', (await v.wide()) <= 0, String(await v.wide()))
    await v.shot('4-year1')
    const back1 = v.page.getByRole('button', { name: 'All studies' })
    check('Year 1: the header has the way back', (await back1.count()) === 1)
    await back1.click(); await v.page.waitForTimeout(1500)
    check('Year 1 header: back on the front page', v.at() === '/index.html' && /Week 12 of 52/.test(await v.text()), v.at())
    await v.page.getByRole('link', { name: /Open Year 2/ }).click(); await v.page.waitForTimeout(2500)
    t = await v.text()
    check('Year 2 opens as its own page and runs', v.at() === '/year2/index.html' && /Year 2/.test(t) && v.errs.length === 0, v.at() + ' ' + v.errs.join(' | '))
    check('Year 2: images load from its own folder', await v.page.evaluate(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0)))
    check('Year 2: nothing runs off the side', (await v.wide()) <= 0, String(await v.wide()))
    await v.shot('5-year2')
    // Settings inside a year: the list of other apps (links to other paid web apps) is not shown in the phone app
    await v.page.getByRole('button', { name: /Settings/ }).last().click(); await v.page.waitForTimeout(700)
    t = await v.text()
    check('Year 2 settings: no "More from Elora Radiance" list in the phone app', /Settings/i.test(t) && !/More from Elora Radiance/i.test(t))
    await v.page.getByRole('button', { name: 'All studies' }).click().catch(() => {}); await v.page.waitForTimeout(600)
    await v.ctx.close()

    // 4. Owns Year 1 only; the store sells all three: only Year 2 is offered, and buying it unlocks it
    v = await open(browser, { owned: ['as1'], store: { sells: ['year1', 'year2', 'both'] } })
    t = await v.text()
    check('owns Year 1: the front page shows one Get Lifetime Access button and no prices', /Get Lifetime Access/.test(t) && !/\$\d/.test(t) && !/given to ministry/.test(t))
    t = await prices(v)
    check('owns Year 1: Year 2 is offered at Apple\'s price', /Unlock Year 2 · \$39\.99/.test(t) && !/Unlock Year 1/.test(t) && !/Unlock Both Years/i.test(t) && /Choose Your Access/i.test(t))
    check('owns Year 1: giving line, restore, terms and privacy are on the page', /10% of net sales is given to ministry\./.test(t) && /Restore purchases/i.test(t) && /Terms/.test(t) && /Privacy/.test(t) && !/Children/.test(t))
    await v.shot('6-owns-year1')
    await v.page.getByRole('button', { name: /Unlock Year 2/ }).click(); await v.page.waitForTimeout(2600)
    t = await v.text()
    check('buy Year 2: the server was asked to read the purchase and Year 2 opened up', v.world.syncs >= 1 && /Year 2 is unlocked/.test(t) && !/Unlock Year 2/.test(t), `syncs ${v.world.syncs}`)
    await v.shot('7-after-purchase')
    await v.ctx.close()

    // 5. Owns nothing; all three for sale: each year and the pair, with the saving worked out from Apple's prices
    v = await open(browser, { store: { sells: ['year1', 'year2', 'both'] }, viewport: { width: 320, height: 640 } })
    await v.shot('8a-front-small'); check('owns nothing, small iPhone, front page: nothing runs off the side', (await v.wide()) <= 0, String(await v.wide()))
    t = await prices(v)
    check('owns nothing: both years and the pair are offered', /Unlock Year 1 · \$39\.99/.test(t) && /Unlock Year 2 · \$39\.99/.test(t) && /Unlock Both Years · \$69\.99/i.test(t) && /Save \$9\.99/.test(t), t.match(/Save[^.]*\./)?.[0] || '')
    check('owns nothing, small iPhone: nothing runs off the side, no errors', (await v.wide()) <= 0 && v.errs.length === 0, String(await v.wide()) + v.errs.join(' | '))
    await v.shot('8-nothing-owned-small')
    await v.page.getByRole('button', { name: /Unlock Both Years/ }).click(); await v.page.waitForTimeout(2600)
    t = await v.text()
    check('buy both: both years unlocked', /Both years are unlocked/.test(t) && !/Unlock/.test(t.replace('unlocked', '')))
    await v.ctx.close()

    // 6. Cancelled purchase: nothing changes, no error shown
    v = await open(browser, { owned: ['as1'], store: { sells: ['year2'], cancel: true } })
    await prices(v)
    await v.page.getByRole('button', { name: /Unlock Year 2/ }).click(); await v.page.waitForTimeout(700)
    t = await v.text()
    check('cancelled purchase: still offered, no message, server not asked again', /Unlock Year 2/.test(t) && !/didn.t go through|unlocked/.test(t))
    await v.ctx.close()

    // 7. Restore: Apple already has Year 2 for this Apple ID
    v = await open(browser, { owned: [], store: { sells: ['year1', 'year2', 'both'], appleOwns: ['as2'] } })
    t = await v.text()
    const t7 = await prices(v)
    check('opening the app applies an earlier Apple purchase without a tap', /Week 5 of 52/.test(t) && /Unlock Year 1/.test(t7) && !/Unlock Year 2/.test(t7))
    await v.ctx.close()

    // 8. A purchase made on the website opens here (claimed by email at sign-in)
    v = await open(browser, { owned: [], webPurchase: ['as1'] })
    t = await v.text()
    check('website purchase: Year 1 is open, Year 2 locked with no buy button (purchases off)', /Week 12 of 52/.test(t) && /Already own Year 2\?/.test(t) && !/Unlock/.test(t))
    await v.ctx.close()

    // 9. Free week: a year the account doesn't own opens on week 1; other weeks go to the front page to buy
    v = await open(browser, { owned: ['as2'], store: { sells: ['year1', 'year2', 'both'] } })
    t = await v.text()
    check('front page: an unowned year offers week 1 free and the purchase', /Year 1\s*· Week 1 free/i.test(t) && /Start Week 1 Free/.test(t) && /Get Lifetime Access/.test(t) && !/\$\d/.test(t) && !/Locked/i.test(t), t.slice(0, 200).replace(/\n/g, ' / '))
    await v.page.getByRole('link', { name: /Start Year 1 week 1 free/ }).click(); await v.page.waitForTimeout(2600)
    t = await v.text()
    check('free week: Year 1 opens on week 1 with the bar', v.at() === '/year1/index.html' && /Week 1 of 52/.test(t) && /Week 1 is free/.test(t) && v.errs.length === 0, v.at() + ' ' + v.errs.join(' | '))
    check('free week: no price and no outside checkout link inside the year', !/\$\d/.test(t) && (await v.page.locator('a[href*="stripe.com"]').count()) === 0)
    check('free week: nothing runs off the side', (await v.wide()) <= 0, String(await v.wide()))
    await v.page.getByRole('button', { name: 'Next week' }).click(); await v.page.waitForTimeout(1800)
    t = await v.text()
    check('free week: next week goes to the front page, purchase first', v.at() === '/index.html' && /Unlock Year 1 · \$39\.99/.test(t) && /Back to Week 1/.test(t), v.at())
    await v.page.getByRole('button', { name: /Unlock Year 1/ }).click(); await v.page.waitForTimeout(2600)
    t = await v.text()
    check('free week: buying from there unlocks the year', /Year 1 is unlocked/.test(t) && !/Unlock Year 1/.test(t))
    await v.ctx.close()
    v = await open(browser, { owned: [], start: '/year2/index.html' })
    await v.page.waitForTimeout(1200); t = await v.text()
    check('free week: Year 2 opened directly stays on its week 1', v.at() === '/year2/index.html' && /Week 1 of 52/.test(t) && /Week 1 is free/.test(t) && v.errs.length === 0, v.at() + ' ' + v.errs.join(' | '))
    await v.ctx.close()

    // 10. Account: email, reminder, delete account, sign out
    v = await open(browser, { owned: ['as1', 'as2'], viewport: { width: 820, height: 1180 } })
    check('iPad: nothing runs off the side', (await v.wide()) <= 0)
    await v.shot('9-ipad')
    await v.page.getByRole('button', { name: 'Account' }).click(); await v.page.waitForTimeout(700)
    t = await v.text()
    check('account: email, daily reminder, privacy and account, sign out', /grace@example\.com/.test(t) && /Daily Reminder/i.test(t) && /Privacy & Account/i.test(t) && /Sign Out/i.test(t))
    await v.shot('10-account')
    await v.page.getByRole('button', { name: 'Sign Out' }).click(); await v.page.waitForTimeout(1200)
    check('sign out: back to the signed-out front page', /Create Account/i.test(await v.text()))
    check('account flow: no page errors', v.errs.length === 0, v.errs.join(' | '))
    await v.ctx.close()
  } catch (e) { check('test ran', false, e.message.split('\n')[0]) }
  await browser.close(); server.close()
  console.log(results.join('\n')); const bad = results.filter((r) => r.startsWith('FAIL')).length
  console.log(`\n${bad} failed of ${results.length}`); process.exit(bad ? 1 : 0)
})
