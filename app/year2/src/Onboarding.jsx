import { useState } from 'react'

const SLIDES = [
  { icon:'⚓', title:'Welcome to Anchored Steps Year 2',
    subtitle:'A deeper dive — Year 2 builds on Year 1 with richer study, longer passages, and deeper application.',
    detail:'Every week gives you seven sections: Passage, Context, Don\'t Miss, Study, Reflect, Apply, Prayer, and Tracker.' },
  { icon:'📅', title:'52 More Weeks. Seven Sections.', 
    subtitle:'Same daily rhythm. New depth. Each week covers a different theme across all seven study sections.',
    detail:'Work through each section daily and complete the full study by Sunday.' },
  { icon:'⚠️', title:'"Don\'t Miss This"',
    subtitle:'Year 2 introduces a new section — a single line or idea in the passage that most readers skip over entirely.',
    detail:'Often it\'s the most important thing Jesus said. Don\'t miss it.' },
  { icon:'📚', title:'Hear the Original Words',
    subtitle:'Every week opens a Word Study — the key Greek and Hebrew terms behind the passage, with their original meaning.',
    detail:'Tap any word to hear the pronunciation aloud. The original language carries depth translation loses.' },
  { icon:'✍️', title:'Your Personal Journal',
    subtitle:'Write your reflections on every section. Private, persistent, accessible on every device.',
    detail:'Year 1 journal entries carry over — your whole journey is in one place.' },
  { icon:'🧠', title:'Memorize the Word',
    subtitle:'Built-in memorization for every key passage — Read & Recall, Fill the Gaps, and Write it Out.',
    detail:'The sword of the Spirit is only as sharp as you keep it.' },
  { icon:'📊', title:'Track Your Progress',
    subtitle:'Your Tracker section gives you weekly check-ins, habit logs, and a progress view across all 52 weeks.',
    detail:'Tap Progress in the top nav to see your full Year 2 journey.' },
  { icon:'🌿', title:'You\'re Back.',
    subtitle:'Year 2 rewards the person who stayed. Keep going.',
    detail:null, isLast:true },
]

export default function Onboarding({ onComplete, darkMode, G: T }) {
  const [slide, setSlide] = useState(0)
  const current = SLIDES[slide]
  const isLast = slide === SLIDES.length - 1
  const G = T || {
    bg:'#0D1820', gold:'#A07840', goldF:'rgba(160,120,64,0.12)', goldB:'rgba(160,120,64,0.28)',
    cream:'#F0ECE3', text:'#E0D8CA', muted:'#A0AAB2', border:'rgba(255,255,255,0.06)',
  }
  const next = () => isLast ? onComplete() : setSlide(s => s + 1)

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      background:`radial-gradient(ellipse at 50% 0%, rgba(160,120,64,0.1) 0%, transparent 55%), ${G.bg}`,
      fontFamily:"EB Garamond,Georgia,serif", padding:'24px 20px' }}>
      <div style={{ maxWidth:420, width:'100%', background:'rgba(13,26,42,0.98)', borderRadius:24,
        border:`1px solid ${G.goldB}`, padding:'48px 32px 36px', boxShadow:'0 12px 40px rgba(0,0,0,0.5)', textAlign:'center' }}>

        <div style={{ fontSize:52, marginBottom:24, lineHeight:1, color:G.gold }}>{current.icon}</div>
        <h2 style={{ fontSize:22, fontWeight:700, color:G.cream, fontFamily:'Cinzel,serif',
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
              background:i===slide?G.gold:G.border, transition:'all .3s' }} />
          ))}
        </div>

        <button onClick={next} style={{ width:'100%', padding:'16px', borderRadius:14, cursor:'pointer',
          background:'linear-gradient(135deg,rgba(160,120,64,0.4),rgba(160,120,64,0.2))',
          border:`1px solid ${G.goldB}`, color:G.cream, fontSize:14,
          fontFamily:'Cinzel,serif', letterSpacing:'0.09em', marginBottom:12 }}>
          {isLast ? 'Begin Week 1 ⚓' : 'Continue →'}
        </button>
        {!isLast && (
          <button onClick={onComplete} style={{ background:'transparent', border:'none',
            color:G.muted, cursor:'pointer', fontSize:13, fontFamily:'EB Garamond,Georgia,serif' }}>
            Skip intro
          </button>
        )}
      </div>
    </div>
  )
}
