// Shared helpers for the browser checks in this folder: serve a dist folder and open an app signed in with a faked database.
let chromium; try { ({ chromium } = require('playwright')) } catch { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')) }
const http = require('http'), fs = require('fs'), path = require('path')
const REF = 'cvtukqamaqrhjtdvmslb', UID = '00000000-0000-4000-8000-000000000001'
const user = { id: UID, aud: 'authenticated', role: 'authenticated', email: 'test@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
const token = { access_token: 'x.' + Buffer.from(JSON.stringify({ sub: UID, exp: 4102444800 })).toString('base64') + '.y', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, refresh_token: 'r', user }
const profile = { id: UID, email: user.email, current_week: 3, onboarded: true, dark_mode: true, light_mode: false, bookmarks: [], saved: [], subscription_status: 'active', plan: 'annual', paid: true }
function serve(dist, port) {
  const DIST = path.resolve(dist)
  const server = http.createServer((req, res) => {
    let f = path.join(DIST, decodeURIComponent(req.url.split('?')[0]))
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html')
    res.setHeader('Content-Type', { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' }[path.extname(f)] || 'application/octet-stream')
    fs.createReadStream(f).pipe(res)
  })
  return new Promise((r) => server.listen(port, () => r(server)))
}
async function openApp(browser, port, { viewport = { width: 390, height: 844 }, init } = {}) {
  const page = await browser.newPage({ viewport }); const errs = []; page.on('pageerror', (e) => errs.push(e.message))
  if (init) await page.addInitScript(init)
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
  await page.goto(`http://localhost:${port}/`)
  await page.evaluate(([k, s]) => { localStorage.clear(); localStorage.setItem(k, JSON.stringify(s)); for (const f of ['aa_onboarded', 'as1_onboarded', 'as2_onboarded', 'rl_onboarded', 'onboarded']) localStorage.setItem(f, 'true') }, [`sb-${REF}-auth-token`, token])
  await page.goto(`http://localhost:${port}/`); await page.waitForTimeout(1800)
  return { page, errs }
}
module.exports = { chromium, serve, openApp }
