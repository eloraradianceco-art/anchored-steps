// Share images that size correctly everywhere (same file in Anchored Steps Y1, Y2 and Armed & Anchored).
// - Every image is a fixed size social apps show well: Post 1080×1350 (4:5) or Story 1080×1920 (9:16).
// - Short text is sized up to fill the card. Text that can't fit at a readable size is split at sentence
//   breaks into a numbered set (1/3, 2/3…) that shares together, so nothing is cut off or rewritten.
// - What you see in the preview is exactly what gets shared (the preview is the real card, scaled down).
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export const SHARE_FORMATS = [
  { id: 'post', label: 'Post', ratio: '4:5', w: 1080, h: 1350 },
  { id: 'story', label: 'Story', ratio: '9:16', w: 1080, h: 1920 },
]
const MAX_FONT = 72   // px on a 1080-wide image
const MIN_FONT = 42   // ≈ 15pt when the image fills a phone screen; never smaller
const LINE_HEIGHT = 1.55
let warmed = false   // Safari sometimes drops images on the very first capture

// ── Text → tokens (sentences, keeping paragraph breaks) ─────────────────────
function tokens(text) {
  const out = []
  for (const part of String(text || '').split(/(\n\s*\n)/)) {
    if (!part) continue
    if (/^\n\s*\n$/.test(part)) { out.push('\n\n'); continue }
    const m = part.match(/[^.!?…]+(?:[.!?…]+[”"’')\]]*)+\s*|[^.!?…]+$/g)
    out.push(...(m || [part]))
  }
  return out
}
const words = (t) => t.match(/\S+\s*/g) || [t]

// ── Body markup (one builder for measuring and for the real card, so they always match) ──
function fillBody(el, page, size, st, ref) {
  el.textContent = ''
  el.style.fontSize = size + 'px'
  el.style.lineHeight = String(LINE_HEIGHT)
  el.style.fontFamily = st.font
  el.style.color = st.color
  el.style.textAlign = st.align
  // Explicit so the card and the measuring box never inherit different text settings.
  el.style.letterSpacing = st.letterSpacing || 'normal'
  el.style.fontWeight = st.weight || '400'
  el.style.textTransform = 'none'
  el.style.wordSpacing = 'normal'
  el.style.webkitTextSizeAdjust = '100%'
  if (page.items) {
    for (const it of page.items) {
      const row = document.createElement('div')
      row.style.cssText = 'display:flex;gap:.5em;align-items:flex-start;text-align:left;margin:0 0 .5em'
      const n = document.createElement('span')
      n.textContent = it.n + '.'
      n.style.cssText = `flex-shrink:0;min-width:1.25em;font-weight:700;color:${st.numColor || st.color};font-family:${st.numFont || st.font}`
      const t = document.createElement('span')
      t.textContent = it.text
      if (st.italic) t.style.fontStyle = 'italic'
      row.append(n, t)
      el.append(row)
    }
  } else {
    // Paragraphs get a half-line gap (a full blank line wastes a lot of a card).
    const paras = String(page.text).split(/\n\s*\n/)
    paras.forEach((para, i) => {
      const p = document.createElement('p')
      p.textContent = para.trim()
      p.style.cssText = `margin:0 0 ${i < paras.length - 1 ? '.45em' : '0'};white-space:pre-line;${st.italic ? 'font-style:italic;' : ''}`
      el.append(p)
    })
  }
  if (ref) {
    const r = document.createElement('div')
    r.textContent = ref
    r.style.cssText = `margin-top:.9em;font-size:${Math.round(Math.max(30, Math.min(40, size * 0.62)))}px;line-height:1.3;letter-spacing:.12em;text-transform:uppercase;color:${st.refColor || st.color};font-family:${st.refFont || st.font};font-style:normal`
    el.append(r)
  }
}

// ── Layout: one card if it fits at a readable size, otherwise an even set of cards ──
function layout(content, W, H, st, refText) {
  const box = document.createElement('div')
  box.setAttribute('aria-hidden', 'true')
  box.style.cssText = `position:fixed;left:-40000px;top:0;width:${W}px;visibility:hidden;pointer-events:none`
  document.body.append(box)
  const fits = (page, size, ref, h = H) => { fillBody(box, page, size, st, ref); return box.offsetHeight <= h - 2 }
  const ref = refText || null
  const isList = Array.isArray(content.items)
  const whole = isList ? { items: content.items.map((text, i) => ({ n: i + 1, text })) } : { text: String(content.text || '').trim() }
  try {
    if (fits(whole, MIN_FONT, ref)) {
      let lo = MIN_FONT, hi = MAX_FONT
      while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (fits(whole, mid, ref)) lo = mid; else hi = mid - 1 }
      return { pages: [whole], size: lo }
    }
    // Pack into pages; every page is measured with the reference so the last one never overflows.
    const pack = (size, h = H) => {
      const pages = []
      if (isList) {
        let cur = []
        for (const it of whole.items) {
          if (fits({ items: [...cur, it] }, size, ref, h)) cur.push(it)
          else { if (cur.length) pages.push({ items: cur }); cur = [it] }
        }
        if (cur.length) pages.push({ items: cur })
        return pages
      }
      let cur = ''
      const push = () => { const t = cur.trim(); if (t) pages.push({ text: t }); cur = '' }
      for (const tok of tokens(whole.text)) {
        if (!cur.trim() && !tok.trim()) continue
        if (fits({ text: (cur + tok).trim() }, size, ref, h)) { cur += tok; continue }
        push()
        if (fits({ text: tok.trim() }, size, ref, h)) { cur = tok; continue }
        for (const w of words(tok)) {          // a single sentence longer than a card
          if (fits({ text: (cur + w).trim() }, size, ref, h)) cur += w
          else { push(); cur = w }
        }
      }
      push()
      return pages
    }
    const n = pack(MIN_FONT).length
    // Largest font that keeps the same number of cards…
    let lo = MIN_FONT, hi = MAX_FONT
    while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (pack(mid).length <= n) lo = mid; else hi = mid - 1 }
    // …then even the cards out so the last one isn't a single line.
    let a = Math.floor(H * 0.5), b = H
    while (b - a > 8) { const mid = Math.floor((a + b) / 2); if (pack(lo, mid).length <= n) b = mid; else a = mid }
    const pages = pack(lo, b)
    return { pages: pages.length <= n ? pages : pack(lo), size: lo }
  } finally {
    box.remove()
  }
}

// ── The card page (fixed size). Header/label/footer come from the app; the body is filled by layout. ──
function CardPage({ fmt, theme, header, label, index, total, page, size, bodyStyle, refText, nodeRef, measureRef }) {
  const bodyRef = useRef(null)
  const single = total === 1
  const plain = !page?.items && (page?.text || '').length <= 320
  const st = { ...bodyStyle, align: single && plain ? 'center' : 'left' }
  useLayoutEffect(() => {
    if (bodyRef.current && page) fillBody(bodyRef.current, page, size, st, index === total - 1 ? refText : null)
  })
  return (
    <div ref={nodeRef} style={{
      width: fmt.w, height: fmt.h, boxSizing: 'border-box', position: 'relative', overflow: 'hidden',
      background: theme.bg, display: 'flex', flexDirection: 'column',
      padding: fmt.id === 'story' ? '150px 96px 130px' : '92px 88px 76px', fontFamily: bodyStyle.font,
    }}>
      {theme.glow && <div style={{ position: 'absolute', inset: 0, background: theme.glow, pointerEvents: 'none' }} />}
      <div style={{ position: 'absolute', inset: 30, border: `2px solid ${theme.frame}`, borderRadius: 30, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', flexShrink: 0 }}>{header}</div>
      <div style={{ position: 'relative', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 24, margin: '40px 0 30px' }}>
        <span style={{ fontSize: 30, letterSpacing: '0.16em', textTransform: 'uppercase', color: theme.label, fontFamily: theme.display }}>{label}</span>
        {total > 1 && <span style={{ fontSize: 30, letterSpacing: '0.08em', color: theme.label, fontFamily: theme.display, flexShrink: 0 }}>{index + 1} / {total}</span>}
      </div>
      <div ref={measureRef} style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: single ? 'center' : 'flex-start' }}>
        <div ref={bodyRef} />
      </div>
      <div style={{ position: 'relative', flexShrink: 0, marginTop: 36, paddingTop: 30, borderTop: `2px solid ${theme.divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 32, color: theme.footer, fontFamily: theme.display, letterSpacing: '0.05em', lineHeight: 1.3 }}>{theme.footerLine}</div>
          <div style={{ fontSize: 28, color: theme.muted, letterSpacing: '0.04em', marginTop: 6, lineHeight: 1.3 }}>{theme.url}</div>
        </div>
        {index < total - 1 && <div style={{ fontSize: 28, color: theme.muted, flexShrink: 0, fontFamily: theme.display, letterSpacing: '0.08em' }}>CONTINUED →</div>}
      </div>
    </div>
  )
}

// ── Composer: preview (swipe through the set) + share actions rendered by the app ──
export function ShareComposer({ formatId = 'post', theme, header, label, content, bodyStyle, refText, background, fileBase, title, renderActions, nativeShare, layoutKey, prerender = true }) {
  const fmt = SHARE_FORMATS.find((f) => f.id === formatId) || SHARE_FORMATS[0]
  const measureRef = useRef(null)
  const nodes = useRef([])
  const wrapRef = useRef(null)
  const stripRef = useRef(null)
  const [res, setRes] = useState(null)
  const [width, setWidth] = useState(320)
  const [current, setCurrent] = useState(0)
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(null)   // { key, urls } rendered ahead so Share opens instantly
  const [note, setNote] = useState('')
  const key = [layoutKey, fmt.id, refText, JSON.stringify(content)].join('|')

  // Lay out after fonts load (and again if they finish later).
  useLayoutEffect(() => {
    let alive = true
    const run = () => {
      const el = measureRef.current
      if (!alive || !el) return
      setRes({ key, ...layout(content, el.clientWidth, el.clientHeight, bodyStyle, refText) })
    }
    run()
    try { document.fonts?.ready?.then(run) } catch {}
    return () => { alive = false }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const update = () => setWidth(el.clientWidth || 320)
    update()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null
    ro?.observe(el)
    return () => ro?.disconnect()
  }, [])
  useEffect(() => { setCurrent(0); setNote(''); stripRef.current?.scrollTo?.({ left: 0 }) }, [key])

  const laidOut = res && res.key === key ? res : null
  const pages = laidOut ? laidOut.pages : [content.items ? { items: [] } : { text: '' }]
  const total = pages.length

  const render = async () => {
    const { toPng, getFontEmbedCSS } = await import('html-to-image')
    try { await document.fonts?.ready } catch {}
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const list = nodes.current.slice(0, total).filter(Boolean)
    const opts = { width: fmt.w, height: fmt.h, pixelRatio: 1, cacheBust: true, backgroundColor: background }
    try { opts.fontEmbedCSS = await getFontEmbedCSS(list[0]) } catch {}
    if (!warmed) { try { await toPng(list[0], opts) } catch {} warmed = true }
    const urls = []
    for (const n of list) urls.push(await toPng(n, opts))
    return urls
  }

  // Render ahead, shortly after the card settles.
  useEffect(() => {
    if (!laidOut || !prerender) return
    let alive = true
    const t = setTimeout(async () => { try { const urls = await render(); if (alive) setReady({ key, urls }) } catch {} }, 450)
    return () => { alive = false; clearTimeout(t) }
  }, [laidOut, key]) // eslint-disable-line react-hooks/exhaustive-deps

  const share = async (only) => {
    if (busy || !laidOut) return
    setBusy(true); setNote('')
    try {
      const all = ready && ready.key === key ? ready.urls : await render()
      if (!ready || ready.key !== key) setReady({ key, urls: all })
      const urls = only == null ? all : [all[only]]
      const names = urls.map((_, i) => `${fileBase}${urls.length > 1 ? '-' + (i + 1) : ''}.png`)
      if (nativeShare) { await nativeShare(urls, names, title); return }
      const files = await Promise.all(urls.map(async (u, i) => new File([await (await fetch(u)).blob()], names[i], { type: 'image/png' })))
      if (navigator.canShare?.({ files })) {
        try { await navigator.share({ files, title }) }
        catch (e) { if (e?.name === 'NotAllowedError') setNote('Ready — tap Share again.') }
      } else {
        urls.forEach((u, i) => { const a = document.createElement('a'); a.href = u; a.download = names[i]; document.body.append(a); a.click(); a.remove() })
      }
    } catch (err) {
      console.error('Share failed:', err)
      setNote('Something went wrong making the image. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const scale = width / fmt.w
  const onScroll = (e) => { const i = Math.round(e.currentTarget.scrollLeft / Math.max(1, width)); if (i !== current) setCurrent(i) }

  return (
    <div ref={wrapRef} style={{ width: '100%' }}>
      <div ref={stripRef} onScroll={onScroll} style={{ display: 'flex', overflowX: total > 1 ? 'auto' : 'hidden', scrollSnapType: 'x mandatory', borderRadius: 14, WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}
        aria-label={total > 1 ? `Share cards, ${total} in this set. Swipe to see each.` : 'Share card preview'}>
        {pages.map((page, i) => (
          <div key={i} style={{ flex: '0 0 100%', width, height: Math.round(fmt.h * scale), overflow: 'hidden', scrollSnapAlign: 'start', position: 'relative' }}>
            <div style={{ transform: `scale(${scale})`, transformOrigin: '0 0', width: fmt.w, height: fmt.h, visibility: laidOut ? 'visible' : 'hidden' }}>
              <CardPage fmt={fmt} theme={theme} header={header} label={label} index={i} total={total} page={laidOut ? page : null}
                size={laidOut?.size || MIN_FONT} bodyStyle={bodyStyle} refText={refText}
                nodeRef={(el) => { nodes.current[i] = el }} measureRef={i === 0 ? measureRef : undefined} />
            </div>
          </div>
        ))}
      </div>
      {total > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 7, margin: '10px 0 2px' }} aria-hidden="true">
          {pages.map((_, i) => (
            <span key={i} style={{ width: i === current ? 18 : 7, height: 7, borderRadius: 7, background: theme.dot || theme.label, opacity: i === current ? 1 : 0.4, transition: 'all .2s' }} />
          ))}
        </div>
      )}
      {renderActions({ share: () => share(null), shareOne: () => share(current), busy, total, current, note, formatId: fmt.id, ready: !!(ready && ready.key === key) })}
    </div>
  )
}

// Short caption text: whole sentences up to about `max` characters (the cards carry the full text).
export function captionExcerpt(text, max = 220) {
  const t = String(text || '').replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  let out = ''
  for (const s of tokens(t)) { if ((out + s).trim().length > max) break; out += s }
  out = out.trim()
  if (!out) { out = t.slice(0, max); out = out.slice(0, out.lastIndexOf(' ')) }
  return out + ' …'
}

export function FormatPicker({ value, onChange, renderButton }) {
  return SHARE_FORMATS.map((f) => renderButton({ key: f.id, active: value === f.id, label: `${f.label} ${f.ratio}`, onClick: () => onChange(f.id) }))
}
