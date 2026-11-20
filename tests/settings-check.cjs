// Opens each app signed in (database faked), goes to Settings, and checks the folded layout. No real requests.
// Run: npx vite build && node tests/settings-check.cjs app=dist [--out folder]
let chromium; try { ({ chromium } = require('playwright')) } catch { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')) }
const http = require('http'), fs = require('fs'), path = require('path')
const args = process.argv.slice(2); const oi = args.indexOf('--out'); const OUT = oi >= 0 ? args[oi + 1] : ''
const apps = args.filter((a) => a.includes('=')).map((a) => a.split('='))
const REF = 'cvtukqamaqrhjtdvmslb', UID = '00000000-0000-4000-8000-000000000001'
const user = { id: UID, aud: 'authenticated', role: 'authenticated', email: 'test@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
const token = { access_token: 'x.' + Buffer.from(JSON.stringify({ sub: UID, exp: 4102444800 })).toString('base64') + '.y', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, refresh_token: 'r', user }
const profile = { id: UID, email: user.email, current_week: 3, onboarded: true, dark_mode: true, light_mode: false, bookmarks: [], saved: [], subscription_status: 'active', plan: 'annual', paid: true }
const results = []; const check = (n, ok, x = '') => results.push((ok ? 'PASS ' : 'FAIL ') + n + (x ? ' — ' + x : ''))
;(async () => {
  const browser = await chromium.launch(); let port = 4900
  for (const [name, dist] of apps) {
    const DIST = path.resolve(dist); const PORT = ++port
    const server = http.createServer((req, res) => {
      let f = path.join(DIST, decodeURIComponent(req.url.split('?')[0]))
      if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html')
      res.setHeader('Content-Type', { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' }[path.extname(f)] || 'application/octet-stream')
      fs.createReadStream(f).pipe(res)
    }); await new Promise((r) => server.listen(PORT, r))
    for (const [label, viewport] of [['iPhone', { width: 390, height: 844 }], ['small iPhone', { width: 375, height: 667 }]]) {
      const tag = `${name}, ${label}`
      try {
        const page = await browser.newPage({ viewport }); const errs = []; page.on('pageerror', (e) => errs.push(e.message))
        await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ body: '' }))
        await page.route('https://eloraradiance.com/**', (r) => r.fulfill({ json: {} }))
        await page.route(`https://${REF}.supabase.co/**`, (route) => {
          const req = route.request(), u = new URL(req.url()), m = req.method()
          if (u.pathname.startsWith('/auth/v1/user')) return route.fulfill({ json: user })
          if (u.pathname.startsWith('/auth/v1/token')) return route.fulfill({ json: token })
          if (u.pathname.startsWith('/auth/v1/')) return route.fulfill({ status: 204, body: '' })
          if (m !== 'GET' && m !== 'HEAD' && !u.pathname.includes('/rpc/')) return route.fulfill({ status: 204, body: '' })
          if (/profiles$/.test(u.pathname)) return route.fulfill({ json: (req.headers()['accept'] || '').includes('vnd.pgrst.object') ? profile : [profile] })
          if (u.pathname.includes('/rpc/') && /profile/.test(u.pathname)) return route.fulfill({ json: profile })
          if (u.pathname.includes('/rpc/')) return route.fulfill({ json: null })
          return route.fulfill({ json: [] })
        })
        await page.goto(`http://localhost:${PORT}/`)
        await page.evaluate(([k, s]) => { localStorage.clear(); localStorage.setItem(k, JSON.stringify(s)); for (const f of ['aa_onboarded', 'as1_onboarded', 'as2_onboarded', 'rl_onboarded', 'onboarded']) localStorage.setItem(f, 'true') }, [`sb-${REF}-auth-token`, token])
        await page.goto(`http://localhost:${PORT}/`); await page.waitForTimeout(1800)
        await page.locator('nav button', { hasText: 'Settings' }).first().click(); await page.waitForTimeout(700)
        const st = await page.evaluate(() => {
          const rows = [...document.querySelectorAll('details.as-fold, details.aa-fold')]
          const sc = [...document.querySelectorAll('div')].find((d) => getComputedStyle(d).position === 'fixed' && getComputedStyle(d).overflowY === 'auto' && d.querySelector('details'))
          return { rows: rows.map((d) => d.querySelector('summary').innerText.split('\n')[1].trim()), open: rows.filter((d) => d.open).length, screens: sc ? +(sc.scrollHeight / window.innerHeight).toFixed(2) : null, wide: document.documentElement.scrollWidth - window.innerWidth }
        })
        check(`${tag}: nine rows, all closed`, st.rows.length === 9 && st.open === 0, st.rows.join(' | '))
        check(`${tag}: under a screen and a half`, st.screens !== null && st.screens <= 1.5, String(st.screens))
        const t = await page.locator('body').innerText()
        check(`${tag}: account, light/dark switch and Sign Out visible`, /test@example\.com/.test(t) && /(Light|Dark) Mode/.test(t) && await page.getByRole('button', { name: 'Sign Out' }).isVisible())
        if (OUT) await page.screenshot({ path: path.join(OUT, `${name}-${viewport.width}.png`) })
        for (const id of ['set-reminders', 'set-progress', 'set-data', 'set-share', 'set-support', 'set-privacy', 'set-more', 'set-credits', 'set-about']) { await page.locator(`#${id} > summary`).click(); await page.waitForTimeout(120) }
        const all = await page.evaluate(() => ({ open: document.querySelectorAll('details[open]').length, wide: document.documentElement.scrollWidth - window.innerWidth, empty: [...document.querySelectorAll('details[open]')].filter((d) => d.lastElementChild.innerText.trim().length < 8).map((d) => d.id) }))
        check(`${tag}: every row opens and has content`, all.open === 9 && all.empty.length === 0, JSON.stringify(all))
        check(`${tag}: export and email support reachable`, await page.getByRole('button', { name: /Export Journal/ }).isVisible() && await page.getByRole('link', { name: /Email|Support|Contact/ }).first().isVisible())
        check(`${tag}: nothing runs off the side`, all.wide <= 0 && st.wide <= 0, String(all.wide))
        if (OUT) await page.screenshot({ path: path.join(OUT, `${name}-${viewport.width}-open.png`), fullPage: false })
        check(`${tag}: no page errors`, errs.length === 0, errs.join(' | ').slice(0, 200)); await page.close()
      } catch (e) { check(`${tag}: ran`, false, e.message.slice(0, 240)) }
    }
    server.close()
  }
  await browser.close(); console.log(results.join('\n')); process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0)
})()
