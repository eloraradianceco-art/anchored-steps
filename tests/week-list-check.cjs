// The week list (tap the week's title) shows all 52 weeks with no scrolling, on a small phone, a phone and an iPad.
// Database faked. Run: npx vite build && node tests/week-list-check.cjs dist [screenshot folder]
const path = require('path')
const { chromium, serve, openApp } = require('./appkit.cjs')
const OUT = process.argv[3] || ''
const results = []; const check = (n, ok, x = '') => results.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== '' ? ' — ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 260) : ''))
;(async () => {
  const b = await chromium.launch(); const s = await serve(path.resolve(process.argv[2] || 'dist'), 5131)
  for (const [label, viewport] of [['small iPhone', { width: 375, height: 667 }], ['iPhone', { width: 390, height: 844 }], ['iPad', { width: 1106, height: 830 }], ['iPad upright', { width: 834, height: 1112 }]]) {
    const { page: p, errs } = await openApp(b, 5131, { viewport })
    await p.getByText('See the whole week at once').first().click(); await p.waitForTimeout(700)
    await p.locator('h1').click(); await p.waitForTimeout(400)
    const m = await p.evaluate(() => {
      const g = document.querySelector('[role="dialog"][aria-label="Choose a week"]'); const r = g.getBoundingClientRect(); const nav = [...document.querySelectorAll('nav')].pop().getBoundingClientRect()
      const tiles = [...g.querySelectorAll('button')]; const last = tiles[tiles.length - 1].getBoundingClientRect()
      const cut = tiles.filter((t) => { const x = t.getBoundingClientRect(); return x.bottom > r.bottom + 0.5 || x.right > r.right + 0.5 || x.height < 30 }).length
      const clipped = tiles.filter((t) => t.scrollHeight > t.clientHeight + 1).length
      return { tiles: tiles.length, scrolls: g.scrollHeight > g.clientHeight + 1, cut, clipped, tileH: Math.round(last.height), tileW: Math.round(last.width), top: Math.round(r.top), aboveNav: Math.round(nav.top - r.bottom), sides: [Math.round(r.left), Math.round(window.innerWidth - r.right)], height: Math.round(r.height) }
    })
    check(`${label}: all 52 weeks are in the list`, m.tiles === 52, m.tiles)
    check(`${label}: the list does not scroll and no week is cut off`, !m.scrolls && m.cut === 0 && m.clipped === 0, m)
    check(`${label}: it sits between the top bar and the tab bar`, m.top >= 50 && m.aboveNav >= 8 && m.sides[0] >= 8 && m.sides[1] >= 8, m)
    check(`${label}: the floating share and Next buttons are hidden while it is open`, (await p.locator('button[aria-label="Share"]').count()) === 0)
    check(`${label}: tiles are big enough to tap (${m.tileW} × ${m.tileH})`, m.tileH >= 40 && m.tileW >= 50, m)
    if (OUT) await p.screenshot({ path: path.join(OUT, `weeklist-${viewport.width}x${viewport.height}.png`) })
    await p.locator('[aria-label="Choose a week"] button').nth(51).click(); await p.waitForTimeout(500)
    check(`${label}: tapping week 52 opens it and closes the list`, /Week 52 of 52/i.test(await p.locator('body').innerText()) && (await p.locator('[aria-label="Choose a week"]').count()) === 0)
    await p.locator('h1').click(); await p.waitForTimeout(300); await p.mouse.click(4, viewport.height - 100); await p.waitForTimeout(300)
    check(`${label}: tapping outside closes it`, (await p.locator('[aria-label="Choose a week"]').count()) === 0)
    check(`${label}: no page errors`, errs.length === 0, errs.join(' | ')); await p.close()
  }
  await b.close(); s.close(); console.log(results.join('\n')); process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0)
})()
