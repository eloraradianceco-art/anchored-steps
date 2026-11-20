// The floating share button in Year 1, Year 2 and The Red Letters (database faked).
// Run: npx vite build && node tests/share-check.cjs as1=dist [--out folder]
const path = require('path')
const { chromium, serve, openApp } = require('./appkit.cjs')
const args = process.argv.slice(2); const oi = args.indexOf('--out'); const OUT = oi >= 0 ? args[oi + 1] : ''
const results = []; const check = (n, ok, x = '') => results.push((ok ? 'PASS ' : 'FAIL ') + n + (x ? ' — ' + String(x).slice(0, 240) : ''))
const wait = (p, ms) => p.waitForTimeout(ms)
const shot = async (p, n) => { if (OUT) await p.screenshot({ path: path.join(OUT, n + '.png') }) }
const fabInfo = (p, label) => p.evaluate((label) => {
  const b = document.querySelector(`button[aria-label="${label}"]`); if (!b) return null
  const r = b.getBoundingClientRect(); const nav = document.querySelector('nav[aria-label="Main"]') || [...document.querySelectorAll('nav')].pop()
  const others = [...document.querySelectorAll('button')].filter((x) => x !== b && x.offsetParent && getComputedStyle(x.closest('[style*="fixed"]') || x).position === 'fixed' && !x.closest('nav'))
  const hit = others.filter((x) => { const o = x.getBoundingClientRect(); return !(o.right <= r.left || o.left >= r.right || o.bottom <= r.top || o.top >= r.bottom) }).length
  return { w: Math.round(r.width), h: Math.round(r.height), right: Math.round(window.innerWidth - r.right), aboveNav: nav ? Math.round(nav.getBoundingClientRect().top - r.bottom) : null, overlaps: hit, fixed: getComputedStyle(b).position === 'fixed' || !!b.closest('[style*="fixed"]') }
}, label)
const pressed = (p) => p.evaluate(() => { const d = document.querySelector('[role="dialog"][aria-label="Share card"]'); return d ? [...d.querySelectorAll('button[aria-pressed="true"]')].map((b) => b.innerText.trim()) : null })

const run = {
  async as1(p, name) {
    await p.getByText('See the whole week at once').first().click(); await wait(p, 600)
    check(`${name}: no small share buttons beside the verses`, (await p.getByRole('button', { name: 'Share as an image' }).count()) === 0)
    const f = await fabInfo(p, 'Share')
    check(`${name}: one floating share button, 48 px, above the tab bar, clear of other buttons`, f && f.w === 48 && f.h === 48 && f.fixed && f.aboveNav > 0 && f.overlaps === 0, JSON.stringify(f))
    check(`${name}: the Next Step button still sits under it`, await p.locator('button', { hasText: /Verse Map/ }).last().isVisible())
    await shot(p, name + '-fab')
    await p.getByRole('button', { name: 'Share', exact: true }).click(); await wait(p, 600)
    let on = await pressed(p)
    check(`${name}: opens the share sheet on Scripture`, on && on.some((x) => /Scripture/.test(x)), JSON.stringify(on))
    const picker = p.locator('[role="group"][aria-label="Which passage"] button'); const n = await picker.count()
    check(`${name}: the sheet lets you pick among the week's passages`, n > 1, String(n))
    const first = await p.locator('[role="dialog"]').innerText()
    await picker.nth(1).click(); await wait(p, 500)
    const second = await p.locator('[role="dialog"]').innerText()
    check(`${name}: picking another passage changes the card`, first !== second && (await picker.nth(1).getAttribute('aria-pressed')) === 'true')
    await shot(p, name + '-sheet')
    await p.getByRole('button', { name: 'Close' }).click(); await wait(p, 300)
    // on the Prayer section it opens on Prayer
    await p.locator('button', { hasText: /^🙏 Prayer$/ }).first().click(); await wait(p, 500)
    await p.getByRole('button', { name: 'Share', exact: true }).click(); await wait(p, 600)
    on = await pressed(p)
    check(`${name}: on the Prayer section it opens on Prayer`, on && on.some((x) => /Prayer/.test(x)), JSON.stringify(on))
    await p.getByRole('button', { name: 'Close' }).click(); await wait(p, 300)
    await p.locator('nav button', { hasText: 'Steps' }).first().click(); await wait(p, 500)
    check(`${name}: no floating share button on the Steps page`, (await p.getByRole('button', { name: 'Share', exact: true }).count()) === 0)
  },
  async as2(p, name) {
    await p.getByText('See the whole week at once').first().click(); await wait(p, 600)
    check(`${name}: no small share buttons beside the verse or prayer`, (await p.getByRole('button', { name: 'Share as an image' }).count()) === 0)
    const f = await fabInfo(p, 'Share')
    check(`${name}: one floating share button, 48 px, above the tab bar, clear of other buttons`, f && f.w === 48 && f.h === 48 && f.fixed && f.aboveNav > 0 && f.overlaps === 0, JSON.stringify(f))
    await shot(p, name + '-fab')
    await p.getByRole('button', { name: 'Share', exact: true }).click(); await wait(p, 600)
    let on = await pressed(p)
    check(`${name}: opens the share sheet on Passage`, on && on.some((x) => /Passage/.test(x)), JSON.stringify(on))
    await shot(p, name + '-sheet')
    await p.getByRole('button', { name: 'Close' }).click(); await wait(p, 300)
    await p.locator('button', { hasText: /^🙏 Prayer$/ }).first().click(); await wait(p, 500)
    await p.getByRole('button', { name: 'Share', exact: true }).click(); await wait(p, 600)
    on = await pressed(p)
    check(`${name}: on the Prayer section it opens on Prayer`, on && on.some((x) => /Prayer/.test(x)), JSON.stringify(on))
    await p.getByRole('button', { name: 'Close' }).click(); await wait(p, 300)
    await p.locator('nav button', { hasText: 'Steps' }).first().click(); await wait(p, 500)
    check(`${name}: no floating share button on the Steps page`, (await p.getByRole('button', { name: 'Share', exact: true }).count()) === 0)
  },
  async rl(p, name) {
    check(`${name}: no floating share button on the home page`, (await p.getByRole('button', { name: 'Share this passage' }).count()) === 0)
    await p.getByText('Read & Study').first().click(); await wait(p, 600)
    check(`${name}: exactly one share button on a passage`, (await p.getByRole('button', { name: 'Share this passage' }).count()) === 1)
    const f = await fabInfo(p, 'Share this passage')
    check(`${name}: it floats, 48 px, above the tab bar, clear of other buttons`, f && f.w === 48 && f.h === 48 && f.fixed && f.aboveNav > 0 && f.overlaps === 0, JSON.stringify(f))
    await shot(p, name + '-fab')
    await p.getByRole('button', { name: 'Share this passage' }).click(); await wait(p, 700)
    const t = await p.locator('body').innerText()
    check(`${name}: opens the share sheet`, /Share|Download|Copy/i.test(t) && (await p.getByRole('button', { name: /Download|Save|Share image|Copy/i }).count()) > 0)
    await shot(p, name + '-sheet')
  },
}
;(async () => {
  const b = await chromium.launch(); let port = 5010
  for (const a of args.filter((x) => x.includes('='))) {
    const [name, dist] = a.split('='); const s = await serve(dist, ++port)
    for (const [label, viewport] of [['iPhone', { width: 390, height: 844 }], ['small iPhone', { width: 375, height: 667 }]]) {
      const tag = `${name}, ${label}`
      try { const { page, errs } = await openApp(b, port, { viewport }); await run[name](page, tag); check(`${tag}: no page errors`, errs.length === 0, errs.join(' | ')); await page.close() }
      catch (e) { check(`${tag}: ran to the end`, false, e.message.split('\n')[0]) }
    }
    s.close()
  }
  await b.close(); console.log(results.join('\n')); process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0)
})()
