import { useState } from 'react'
import Reviews from './Reviews'

export default function Settings({ profile, userId, supabase, entries, wk, ALL_WEEKS, darkMode, onToggleDarkMode, onResetWeek, onClose }) {
  const [copiedShare, setCopiedShare] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [resetDone, setResetDone] = useState(false)

  const G = {
    bg: darkMode ? '#0F1A24' : '#F5F1E8',
    bgCard: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)',
    border: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)',
    cream: darkMode ? '#EDE6D6' : '#1A1209',
    text: darkMode ? '#C8BEAA' : '#3D2E1A',
    muted: darkMode ? '#7C90A2' : '#7A6A5A',
    dim: darkMode ? '#4E6070' : '#B0A090',
    gold: darkMode ? '#B08A4E' : '#8B6A30',
    goldF: darkMode ? 'rgba(176,138,78,0.11)' : 'rgba(139,106,48,0.1)',
    goldB: darkMode ? 'rgba(176,138,78,0.28)' : 'rgba(139,106,48,0.28)',
    green: '#7C9284', greenF: 'rgba(124,146,132,0.15)', greenB: 'rgba(124,146,132,0.4)',
  }

  // Progress stats
  const weeksJournaled = ALL_WEEKS ? ALL_WEEKS.filter(w =>
    entries?.some(e => e.week === w.week && ['study','rfj','apply','prayer'].includes(e.field_key) && (e.field_value||'').trim())
  ).length : 0
  const versesMemorized = entries?.filter(e => e.field_key?.startsWith('mem_') && e.field_value === '1').length || 0
  const bookmarks = entries?.filter(e => e.field_key === 'bookmark' && e.field_value === '1').length || 0

  const shareText = `I've been using Anchored Steps — a 52-week Scripture devotional with daily study, reflection, prayer, and journal. Worth every week.\n\nanchored-steps.vercel.app`

  const handleShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: 'Anchored Steps', text: shareText, url: 'https://anchored-steps.vercel.app' }) } catch {}
    } else {
      try { await navigator.clipboard.writeText(shareText); setCopiedShare(true); setTimeout(() => setCopiedShare(false), 2500) } catch {}
    }
  }

  const handleExportTxt = async () => {
    if (!userId || exporting) return
    setExporting(true)
    try {
      const { data } = await supabase.from('journal_entries').select('*').eq('user_id', userId)
      const get = (week, key) => data?.find(e => e.week === week && e.field_key === key)?.field_value || ''
      const lines = []
      lines.push('ANCHORED STEPS — YEAR 1 JOURNAL')
      lines.push('Elora Radiance Co. | anchored-steps.vercel.app')
      lines.push(`Exported: ${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}`)
      lines.push('='.repeat(50))
      if (ALL_WEEKS) {
        for (const w of ALL_WEEKS) {
          const study = get(w.week, 'study')
          const apply = get(w.week, 'apply')
          const prayer = get(w.week, 'prayer')
          const rfj = get(w.week, 'rfj')
          if (!study && !apply && !prayer && !rfj) continue
          lines.push(''); lines.push(`WEEK ${w.week}: ${w.title.toUpperCase()}`); lines.push('-'.repeat(40))
          if (study)  { lines.push(''); lines.push('STUDY:');   lines.push(study) }
          if (rfj)    { lines.push(''); lines.push('REFLECT:'); lines.push(rfj) }
          if (apply)  { lines.push(''); lines.push('APPLY:');   lines.push(apply) }
          if (prayer) { lines.push(''); lines.push('PRAYER:');  lines.push(prayer) }
        }
      }
      lines.push(''); lines.push('='.repeat(50)); lines.push('Walk steadily. Stay anchored.')
      const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `anchored-steps-y1-${new Date().toISOString().split('T')[0]}.txt`; a.click()
      URL.revokeObjectURL(url)
    } catch(e) { console.error(e) }
    setExporting(false)
  }

  const handlePrintPDF = async () => {
    if (!userId) return
    const { data } = await supabase.from('journal_entries').select('*').eq('user_id', userId)
    const get = (week, key) => data?.find(e => e.week === week && e.field_key === key)?.field_value || ''
    let html = `<!DOCTYPE html><html><head><title>Anchored Steps Year 1 Journal</title>
    <style>body{font-family:Georgia,serif;max-width:700px;margin:0 auto;padding:40px;color:#1a1209;line-height:1.8}
    h1{font-size:26px;color:#1a1209;text-align:center;margin-bottom:4px}
    .sub{text-align:center;color:#8B6A2E;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:36px}
    h2{font-size:17px;color:#1a1209;border-bottom:1px solid #B08A4E;padding-bottom:6px;margin-top:32px}
    h3{font-size:12px;color:#8B6A2E;letter-spacing:0.1em;text-transform:uppercase;margin:14px 0 5px}
    p{line-height:1.85;margin:0 0 10px}@media print{body{padding:20px}}</style></head><body>
    <h1>Anchored Steps · Year 1</h1>
    <p class="sub">Journal — Exported ${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</p>`
    if (ALL_WEEKS) {
      for (const w of ALL_WEEKS) {
        const study = get(w.week,'study'), apply = get(w.week,'apply'), prayer = get(w.week,'prayer'), rfj = get(w.week,'rfj')
        if (!study && !apply && !prayer && !rfj) continue
        html += `<h2>Week ${w.week} — ${w.title}</h2>`
        if (study)  html += `<h3>Study</h3><p>${study.split('\n').join('<br/>')}</p>`
        if (rfj)    html += `<h3>Reflect</h3><p>${rfj.split('\n').join('<br/>')}</p>`
        if (apply)  html += `<h3>Apply</h3><p>${apply.split('\n').join('<br/>')}</p>`
        if (prayer) html += `<h3>Prayer</h3><p>${prayer.split('\n').join('<br/>')}</p>`
      }
    }
    html += `<hr/><p style="text-align:center;font-size:12px;color:#999">Walk steadily. Stay anchored. — anchored-steps.vercel.app</p></body></html>`
    // Print via a hidden iframe so we never navigate away or trap the user (critical in standalone PWA mode)
    const frame = document.createElement('iframe')
    frame.setAttribute('aria-hidden', 'true')
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0'
    document.body.appendChild(frame)
    const cleanup = () => setTimeout(() => { try { frame.remove() } catch (e) {} }, 1500)
    const fdoc = frame.contentWindow.document
    fdoc.open(); fdoc.write(html); fdoc.close()
    frame.contentWindow.onafterprint = cleanup
    setTimeout(() => {
      try { frame.contentWindow.focus(); frame.contentWindow.print() } catch (e) { console.error(e) }
      cleanup()
    }, 400)
  }

  const handleSignOut = async () => { setSigningOut(true); await supabase.auth.signOut() }

  const [showReviews, setShowReviews] = useState(false)

  const Row = ({ icon, label, children, border = true }) => (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 0', borderBottom: border ? `1px solid ${G.border}` : 'none' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <span style={{ fontSize:18, width:26, textAlign:'center' }}>{icon}</span>
        <span style={{ fontSize:16, color:G.text, fontFamily:"'EB Garamond',Georgia,serif" }}>{label}</span>
      </div>
      {children}
    </div>
  )

  return (
    <div style={{ position:'fixed', inset:0, zIndex:400, background: darkMode ? '#0F1A24' : '#F5F1E8', fontFamily:"'EB Garamond',Georgia,serif", overflowY:'auto' }}>
      {showReviews && <Reviews app="as1" appName="Anchored Steps" eyebrow="Anchored Steps" userEmail={profile?.email} C={{ ...G, red: G.gold, redL: G.gold }} lightMode={!darkMode} onClose={() => setShowReviews(false)} />}
      <div style={{ maxWidth:560, margin:'0 auto', padding:'0 0 80px' }}>

        {/* Sticky header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:`1px solid ${G.border}`, position:'sticky', top:0, zIndex:10, background: darkMode ? '#0F1A24' : '#F5F1E8', backdropFilter:'blur(12px)' }}>
          <div>
            <div style={{ fontSize:9, color:G.gold, letterSpacing:'0.16em', textTransform:'uppercase', fontFamily:"'Cinzel',Georgia,serif" }}>Anchored Steps · Year 1</div>
            <div style={{ fontSize:18, fontWeight:700, color:G.cream, fontFamily:"'Cinzel',Georgia,serif" }}>Settings</div>
          </div>
          <button onClick={onClose} style={{ background:G.bgCard, border:`1px solid ${G.border}`, color:G.muted, width:36, height:36, borderRadius:9, cursor:'pointer', fontSize:18 }}>←</button>
        </div>

        <div style={{ padding:'8px 20px' }}>

          {/* Progress */}
          <div style={{ marginTop:24, marginBottom:8 }}>
            <div style={{ fontSize:9, color:G.muted, letterSpacing:'0.14em', textTransform:'uppercase', fontFamily:"'Cinzel',Georgia,serif", marginBottom:4 }}>Your Progress</div>
          </div>
          <div style={{ background:G.bgCard, border:`1px solid ${G.border}`, borderRadius:14, padding:'16px' }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:14 }}>
              {[[weeksJournaled,'Weeks','📖'],[versesMemorized,'Memorized','✦'],[bookmarks,'Saved','☆']].map(([v,l,icon]) => (
                <div key={l} style={{ background:G.goldF, border:`1px solid ${G.goldB}`, borderRadius:12, padding:'14px 8px', textAlign:'center' }}>
                  <div style={{ fontSize:26, fontWeight:700, color:G.gold, fontFamily:"'Cinzel',Georgia,serif", lineHeight:1 }}>{v}</div>
                  <div style={{ fontSize:10, color:G.muted, marginTop:4 }}>{l}</div>
                </div>
              ))}
            </div>
            <div style={{ height:5, background:G.bgCard, borderRadius:3, overflow:'hidden', border:`1px solid ${G.border}` }}>
              <div style={{ height:'100%', background:`linear-gradient(90deg,${G.gold},#C9A96E)`, width:`${Math.round((weeksJournaled/52)*100)}%`, transition:'width .4s ease' }}/>
            </div>
            <div style={{ fontSize:12, color:G.muted, textAlign:'center', marginTop:8, marginBottom:14 }}>Week {wk} of 52 · {Math.round((wk/52)*100)}% through the year</div>
            <button onClick={() => { if(window.confirm("Reset to Week 1? Journal entries will be kept.")) { onResetWeek(); setResetDone(true) } }}
              style={{ width:'100%', background:'transparent', border:`1px solid ${G.border}`, color:G.muted, padding:'10px', borderRadius:10, cursor:'pointer', fontSize:12, fontFamily:"'Cinzel',Georgia,serif", letterSpacing:'0.06em' }}>
              {resetDone ? '✓ Reset to Week 1' : '↺ Reset to Week 1'}
            </button>
          </div>

          {/* Account */}
          <div style={{ marginTop:24, marginBottom:8 }}>
            <div style={{ fontSize:9, color:G.muted, letterSpacing:'0.14em', textTransform:'uppercase', fontFamily:"'Cinzel',Georgia,serif", marginBottom:4 }}>Account</div>
          </div>
          <div style={{ background:G.bgCard, border:`1px solid ${G.border}`, borderRadius:14, padding:'0 16px' }}>
            <Row icon="✉️" label={profile?.email || 'Your account'}>
              <span style={{ fontSize:11, color:G.gold, fontFamily:"'Cinzel',Georgia,serif" }}>
                {'Lifetime ✦'}
              </span>
            </Row>
            <Row icon="⭐" label="Ratings & Reviews">
              <button onClick={() => setShowReviews(true)} style={{ background: G.goldF, border: `1px solid ${G.goldB}`, color: G.gold, padding: '6px 16px', borderRadius: 10, fontSize: 12, fontFamily: "'Cinzel',Georgia,serif", cursor: 'pointer', letterSpacing: '0.06em' }}>Open</button>
            </Row>
            <Row icon="🛟" label="Email Support">
              <a href="mailto:eloraradiance.co@gmail.com" style={{ background:G.goldF, border:`1px solid ${G.goldB}`, color:G.gold, padding:'6px 16px', borderRadius:10, fontSize:12, fontFamily:"'Cinzel',Georgia,serif", textDecoration:'none', display:'inline-block', letterSpacing:'0.06em' }}>Contact</a>
            </Row>
            <Row icon="🚪" label="Sign Out" border={false}>
              <button onClick={handleSignOut} disabled={signingOut} style={{ background:G.goldF, border:`1px solid ${G.goldB}`, color:G.gold, padding:'6px 16px', borderRadius:10, cursor:'pointer', fontSize:12, fontFamily:"'Cinzel',Georgia,serif", letterSpacing:'0.07em' }}>
                {signingOut ? 'Signing out...' : 'Sign Out'}
              </button>
            </Row>
          </div>

          {/* Appearance */}
          <div style={{ marginTop:24, marginBottom:8 }}>
            <div style={{ fontSize:9, color:G.muted, letterSpacing:'0.14em', textTransform:'uppercase', fontFamily:"'Cinzel',Georgia,serif", marginBottom:4 }}>Appearance</div>
          </div>
          <div style={{ background:G.bgCard, border:`1px solid ${G.border}`, borderRadius:14, padding:'0 16px' }}>
            <Row icon={darkMode ? '🌙' : '☀️'} label={darkMode ? 'Dark Mode' : 'Light Mode'} border={false}>
              <div onClick={onToggleDarkMode} style={{ width:48, height:28, borderRadius:14, cursor:'pointer', background: darkMode ? G.gold : G.bgCard, border:`1px solid ${darkMode ? G.goldB : G.border}`, position:'relative', transition:'all .25s' }}>
                <div style={{ position:'absolute', top:3, left: darkMode ? 22 : 3, width:20, height:20, borderRadius:'50%', background: darkMode ? '#fff' : G.muted, transition:'left .25s', boxShadow:'0 1px 4px rgba(0,0,0,0.3)' }}/>
              </div>
            </Row>
          </div>

          {/* Share */}
          <div style={{ marginTop:24, marginBottom:8 }}>
            <div style={{ fontSize:9, color:G.muted, letterSpacing:'0.14em', textTransform:'uppercase', fontFamily:"'Cinzel',Georgia,serif", marginBottom:4 }}>Share & Referral</div>
          </div>
          <div style={{ background:G.bgCard, border:`1px solid ${G.border}`, borderRadius:14, padding:'16px' }}>
            <p style={{ fontSize:15, color:G.text, lineHeight:1.75, marginBottom:14 }}>Know someone ready to walk steadily with God this year? Share Anchored Steps with them.</p>
            <div style={{ background: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)', border:`1px solid ${G.border}`, borderRadius:10, padding:'12px 14px', marginBottom:12, fontSize:13, color:G.muted, fontStyle:'italic', lineHeight:1.7 }}>
              "{shareText.split('\n')[0]}"
            </div>
            <button onClick={handleShare} style={{ width:'100%', background: copiedShare ? G.greenF : G.goldF, border:`1px solid ${copiedShare ? G.greenB : G.goldB}`, color: copiedShare ? G.green : G.gold, padding:'13px', borderRadius:12, cursor:'pointer', fontSize:13, fontFamily:"'Cinzel',Georgia,serif", letterSpacing:'0.08em', transition:'all .25s' }}>
              {copiedShare ? '✓ Copied — Send It to Someone' : '🔗 Share Anchored Steps'}
            </button>
          </div>

          {/* More from Elora Radiance */}
          <div style={{ marginTop:24, marginBottom:8 }}>
            <div style={{ fontSize:9, color:G.muted, letterSpacing:'0.14em', textTransform:'uppercase', fontFamily:"'Cinzel',Georgia,serif", marginBottom:4 }}>More from Elora Radiance Co.</div>
          </div>
          <div style={{ background:G.bgCard, border:`1px solid ${G.border}`, borderRadius:14, padding:'12px 16px' }}>
            <p style={{ fontSize:13, color:G.muted, fontStyle:'italic', lineHeight:1.7, marginBottom:14 }}>The rest of the Elora Radiance ecosystem — Scripture-based tools for the whole Christian life.</p>
            {[
              { label:'Armed & Anchored', desc:'Spiritual warfare training — 23 weapons', url:'https://armedandanchored.vercel.app/', icon:'⚔️' },
              { label:'Anchored Steps · Year 2', desc:'Daily devotional — deeper study', url:'https://anchored-steps-year2.vercel.app/', icon:'⚓' },
              { label:'The Red Letters', desc:'Complete words of Jesus by theme — free', url:'https://redletters.vercel.app/', icon:'✦' },
              { label:'Anchored Verse', desc:'Scripture for every emotion — free', url:'https://anchoredverse.vercel.app/', icon:'📖' },
              { label:'The Living Planner', desc:'Faith-centered life planner', url:'https://the-living-planner.vercel.app/', icon:'📓' },
            ].map(app => (
              <a key={app.url} href={app.url} target="_blank" rel="noopener noreferrer" style={{ display:'flex', alignItems:'center', gap:14, padding:'13px 14px', borderRadius:12, marginBottom:8, background:G.goldF, border:`1px solid ${G.goldB}`, textDecoration:'none', transition:'all .2s' }}>
                <span style={{ fontSize:22, flexShrink:0 }}>{app.icon}</span>
                <span style={{ flex:1 }}>
                  <span style={{ display:'block', fontSize:13, color:G.cream, fontFamily:"'Cinzel',Georgia,serif", letterSpacing:'0.05em', marginBottom:2 }}>{app.label}</span>
                  <span style={{ display:'block', fontSize:12, color:G.muted, fontStyle:'italic' }}>{app.desc}</span>
                </span>
                <span style={{ fontSize:13, color:G.gold }}>↗</span>
              </a>
            ))}
          </div>

          {/* About */}
          <div style={{ marginTop:24, marginBottom:8 }}>
            <div style={{ fontSize:9, color:G.muted, letterSpacing:'0.14em', textTransform:'uppercase', fontFamily:"'Cinzel',Georgia,serif", marginBottom:4 }}>About</div>
          </div>
          <div style={{ background:G.bgCard, border:`1px solid ${G.border}`, borderRadius:14, padding:'0 16px' }}>
            <Row icon="⚓" label="Anchored Steps · Year 1">
              <span style={{ fontSize:11, color:G.dim }}>v1.0</span>
            </Row>
            <Row icon="🌿" label="Elora Radiance Co." border={false}>
              <span style={{ fontSize:11, color:G.dim }}>eloraradiance.com</span>
            </Row>
          </div>

          {/* Export */}
          <div style={{ marginTop:24, marginBottom:8 }}>
            <div style={{ fontSize:9, color:G.muted, letterSpacing:'0.14em', textTransform:'uppercase', fontFamily:"'Cinzel',Georgia,serif", marginBottom:4 }}>Your Data</div>
          </div>
          <div style={{ background:G.bgCard, border:`1px solid ${G.border}`, borderRadius:14, padding:'16px' }}>
            <p style={{ fontSize:14, color:G.text, lineHeight:1.7, marginBottom:14 }}>Download all your journal entries as a text file, or print as a formatted PDF.</p>
            <button onClick={handleExportTxt} disabled={exporting} style={{ width:'100%', background: exporting ? 'transparent' : G.goldF, border:`1px solid ${exporting ? G.border : G.goldB}`, color: exporting ? G.muted : G.gold, padding:'13px', borderRadius:12, cursor: exporting ? 'default' : 'pointer', fontSize:13, fontFamily:"'Cinzel',Georgia,serif", letterSpacing:'0.08em', transition:'all .25s', marginBottom:8 }}>
              {exporting ? 'Preparing Export…' : '📥 Export Journal'}
            </button>
            <button onClick={handlePrintPDF} style={{ width:'100%', padding:'13px', borderRadius:12, cursor:'pointer', background:G.bgCard, border:`1px solid ${G.border}`, color:G.muted, fontSize:12, fontFamily:"'Cinzel',Georgia,serif", letterSpacing:'0.08em' }}>
              🖨️ Print as PDF
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
