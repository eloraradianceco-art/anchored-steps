import { useState } from 'react'

const G = {
  bg:'#0F1A24', gold:'#B08A4E', goldF:'rgba(176,138,78,0.11)', goldB:'rgba(176,138,78,0.28)',
  cream:'#EDE6D6', text:'#C8BEAA', muted:'#7C90A2', border:'rgba(255,255,255,0.06)',
}

const SLIDES = [
  { icon:'⚓', title:'Welcome to Anchored Steps', color:G.gold,
    subtitle:'52 weeks of faith in action — one week at a time, one day at a time.',
    detail:'Every week gives you a new lens on God\'s Word, organized into seven daily study sections.' },
  { icon:'📅', title:'52 Weeks. Seven Daily Sections.', color:G.gold,
    subtitle:'Each week has a key theme with Scripture, Study, Context, Reflect, Apply, Prayer, and a Week End summary.',
    detail:'Move through each section daily and you\'ll have worked through the full depth of the week by Sunday.' },
  { icon:'📖', title:'Deep Study Tools', color:G.gold,
    subtitle:'Every scripture has a Verse Map — a visual breakdown of the passage with author background, commentary, and cross-references.',
    detail:'Tap the Verse Map tab on any scripture card to dig deeper.' },
  { icon:'📚', title:'Hear the Original Words', color:G.gold,
    subtitle:'Every week opens a Word Study — the key Greek and Hebrew terms behind the passage, with their original meaning.',
    detail:'Tap any word to hear the pronunciation. The original language often carries weight translation flattens.' },
  { icon:'✍️', title:'Your Personal Journal', color:G.gold,
    subtitle:'Write your reflections, prayers, and personal notes on every section. Saved to your account, accessible on every device.',
    detail:'Your entries are private and persistent — phone, tablet, and desktop.' },
  { icon:'🧠', title:'Memorize the Word', color:G.gold,
    subtitle:'Every key passage has a built-in memorization tool with three training modes — Read & Recall, Fill the Gaps, and Write it Out.',
    detail:'Scripture hidden in the heart becomes a weapon ready for any moment.' },
  { icon:'📊', title:'Track Your Progress', color:G.gold,
    subtitle:'Your Progress dashboard shows your journal entries, memorized verses, and weekly completion across all 52 weeks.',
    detail:'Tap Progress in the top nav to see where you\'ve been and what\'s ahead.' },
  { icon:'🌿', title:'You\'re Anchored.', color:G.gold,
    subtitle:'52 weeks of steady, consistent faith. Not performance. Not perfection. Just showing up — week after week.',
    detail:null, isLast:true },
]

export default function Onboarding({ onComplete }) {
  const [slide, setSlide] = useState(0)
  const current = SLIDES[slide]
  const isLast = slide === SLIDES.length - 1

  const next = () => isLast ? onComplete() : setSlide(s => s + 1)

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      background:`radial-gradient(ellipse at 50% 0%, rgba(176,138,78,0.1) 0%, transparent 55%), ${G.bg}`,
      fontFamily:"'EB Garamond',Georgia,serif", padding:'24px 20px' }}>
      <div style={{ maxWidth:420, width:'100%', background:'rgba(13,26,42,0.98)', borderRadius:24,
        border:`1px solid ${G.goldB}`, padding:'48px 32px 36px', boxShadow:'0 12px 40px rgba(0,0,0,0.5)', textAlign:'center' }}>

        <div style={{ fontSize:52, marginBottom:24, lineHeight:1, color:current.color }}>{current.icon}</div>

        <h2 style={{ fontSize:22, fontWeight:700, color:G.cream, fontFamily:"'Cinzel',Georgia,serif",
          letterSpacing:'0.04em', lineHeight:1.25, marginBottom:16 }}>{current.title}</h2>

        <p style={{ fontSize:16, color:G.text, lineHeight:1.8, marginBottom:current.detail?16:32 }}>{current.subtitle}</p>

        {current.detail && (
          <p style={{ fontSize:14, color:G.muted, lineHeight:1.75, marginBottom:32,
            background:G.goldF, border:`1px solid ${G.goldB}`, borderRadius:10, padding:'12px 16px' }}>
            {current.detail}
          </p>
        )}

        <div style={{ display:'flex', justifyContent:'center', gap:6, marginBottom:28 }}>
          {SLIDES.map((_,i) => (
            <div key={i} style={{ width:i===slide?20:6, height:6, borderRadius:3,
              background:i===slide?G.gold:G.border, transition:'all .3s ease' }} />
          ))}
        </div>

        <button onClick={next} style={{ width:'100%', padding:'16px', borderRadius:14, cursor:'pointer',
          background:'linear-gradient(135deg,rgba(176,138,78,0.4),rgba(176,138,78,0.2))',
          border:`1px solid ${G.goldB}`, color:G.cream, fontSize:14,
          fontFamily:"'Cinzel',Georgia,serif", letterSpacing:'0.09em', marginBottom:12 }}>
          {isLast ? 'Begin Week 1 ⚓' : 'Continue →'}
        </button>
        {!isLast && (
          <button onClick={onComplete} style={{ background:'transparent', border:'none',
            color:G.muted, cursor:'pointer', fontSize:13, fontFamily:"'EB Garamond',Georgia,serif" }}>
            Skip intro
          </button>
        )}
      </div>
    </div>
  )
}
