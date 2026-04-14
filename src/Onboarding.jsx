import { useState } from "react";

const G = {
  bg:"#0F1A24",bgMid:"#1A2A38",
  gold:"#B08A4E",goldB:"rgba(176,138,78,0.28)",goldF:"rgba(176,138,78,0.12)",
  cream:"#F5F1E8",text:"#E6DED0",muted:"#A8B3BC",dim:"#6C7A86",
};

const STEPS = [
  {
    id: 1,
    icon: null,
    title: "Welcome to\nAnchored Steps",
    body: "A guided journey to help you grow in faith with intention — through Scripture, reflection, and daily application.",
    btn: "Begin",
  },
  {
    id: 2,
    icon: "🌿",
    title: "If you've ever struggled\nwith consistency...",
    body: "You're not alone. Many believers desire a deeper relationship with God but feel stuck, distracted, or unsure where to start.\n\nAnchored Steps gives you structure — without pressure.",
    btn: "Continue",
  },
  {
    id: 3,
    icon: null,
    title: "A Simple Weekly Rhythm",
    body: null,
    features: [
      { icon: "📖", label: "Scripture", desc: "Engage God's Word intentionally" },
      { icon: "🪞", label: "Reflection", desc: "Process what He's showing you" },
      { icon: "⚡", label: "Application", desc: "Live it out in real life" },
      { icon: "🙏", label: "Prayer", desc: "Stay connected to Him daily" },
    ],
    btn: "I'm Ready",
  },
  {
    id: 4,
    icon: null,
    title: "Let's Begin",
    body: "Take a moment. Slow down.\n\nYou don't need to rush.\nJust be present with God.",
    verse: {
      text: "Let your roots grow down into him, and let your lives be built on him.",
      ref: "Colossians 2:7",
    },
    btn: "Enter Your Journal",
  },
];

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0);
  const [animating, setAnimating] = useState(false);

  const current = STEPS[step];

  const next = () => {
    if (animating) return;
    if (step === STEPS.length - 1) {
      localStorage.setItem("onboarding_complete", "true");
      onComplete();
      return;
    }
    setAnimating(true);
    setTimeout(() => {
      setStep(s => s + 1);
      setAnimating(false);
    }, 300);
  };

  return (
    <div style={{
      minHeight:"100vh",
      background:`linear-gradient(155deg,${G.bg} 0%,${G.bgMid} 55%,${G.bg} 100%)`,
      display:"flex",flexDirection:"column",alignItems:"center",
      justifyContent:"center",padding:"32px 24px",
      fontFamily:"EB Garamond,Georgia,serif",
      opacity: animating ? 0 : 1,
      transition: "opacity 0.3s ease",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=Cinzel:wght@400;500;600&display=swap" rel="stylesheet"/>

      {/* Progress dots */}
      <div style={{display:"flex",gap:8,marginBottom:40}}>
        {STEPS.map((_,i) => (
          <div key={i} style={{
            width: i === step ? 24 : 8,
            height:8,borderRadius:4,
            background: i <= step ? G.gold : "rgba(255,255,255,0.1)",
            transition:"all .3s ease"
          }}/>
        ))}
      </div>

      <div style={{width:"100%",maxWidth:400,textAlign:"center"}}>

        {/* Icon / Image */}
        {step === 0 && (
          <img src="/icon.png" alt="Anchored Steps"
            style={{width:96,height:96,borderRadius:20,marginBottom:28,boxShadow:"0 12px 40px rgba(0,0,0,0.4)"}}
          />
        )}
        {current.icon && (
          <div style={{fontSize:48,marginBottom:20}}>{current.icon}</div>
        )}

        {/* Title */}
        <h1 style={{
          fontFamily:"Cinzel,serif",
          fontSize: step === 0 ? 28 : 22,
          fontWeight:500,color:G.cream,
          marginBottom:20,lineHeight:1.4,
          whiteSpace:"pre-line",
        }}>
          {current.title}
        </h1>

        {/* Body text */}
        {current.body && (
          <p style={{
            fontSize:17,color:G.text,lineHeight:1.85,
            marginBottom:28,whiteSpace:"pre-line",maxWidth:340,margin:"0 auto 28px"
          }}>
            {current.body}
          </p>
        )}

        {/* Features list (step 3) */}
        {current.features && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:32}}>
            {current.features.map((f,i) => (
              <div key={i} style={{
                background:"linear-gradient(145deg,rgba(176,138,78,0.1),rgba(176,138,78,0.03))",
                border:"1px solid rgba(176,138,78,0.2)",
                borderRadius:14,padding:"18px 14px",textAlign:"center"
              }}>
                <div style={{fontSize:28,marginBottom:8}}>{f.icon}</div>
                <div style={{fontFamily:"Cinzel,serif",fontSize:12,color:G.gold,letterSpacing:"0.08em",marginBottom:4}}>{f.label}</div>
                <div style={{fontSize:13,color:G.muted,lineHeight:1.5}}>{f.desc}</div>
              </div>
            ))}
          </div>
        )}

        {/* Verse (step 4) */}
        {current.verse && (
          <div style={{
            background:"linear-gradient(145deg,rgba(176,138,78,0.1),rgba(176,138,78,0.03))",
            border:"1px solid rgba(176,138,78,0.25)",
            borderRadius:14,padding:"22px 20px",marginBottom:28,marginTop:8
          }}>
            <div style={{fontSize:28,color:G.gold,opacity:.3,marginBottom:6,fontFamily:"Georgia,serif"}}>&#8220;</div>
            <p style={{fontSize:17,color:G.cream,fontStyle:"italic",lineHeight:1.85,marginBottom:10}}>
              {current.verse.text}
            </p>
            <p style={{fontSize:11,color:G.gold,fontFamily:"Cinzel,serif",letterSpacing:"0.1em",margin:0,textTransform:"uppercase"}}>
              {current.verse.ref}
            </p>
          </div>
        )}

        {/* Button */}
        <button
          onClick={next}
          style={{
            width:"100%",
            background:"linear-gradient(135deg,rgba(176,138,78,0.35),rgba(176,138,78,0.15))",
            border:"1px solid rgba(176,138,78,0.45)",
            color:G.gold,padding:"15px",borderRadius:12,
            cursor:"pointer",fontSize:15,
            fontFamily:"Cinzel,serif",letterSpacing:"0.1em",
            boxShadow:"0 4px 20px rgba(0,0,0,0.2)",
            transition:"all .2s"
          }}
        >
          {current.btn}
        </button>

        {/* Skip */}
        {step < STEPS.length - 1 && (
          <button
            onClick={() => {
              localStorage.setItem("onboarding_complete","true");
              onComplete();
            }}
            style={{
              marginTop:16,background:"transparent",border:"none",
              color:G.dim,cursor:"pointer",fontSize:13,
              fontFamily:"EB Garamond,Georgia,serif"
            }}
          >
            Skip intro
          </button>
        )}
      </div>
    </div>
  );
}
