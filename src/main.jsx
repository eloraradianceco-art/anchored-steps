import React from 'react'
import ReactDOM from 'react-dom/client'
import AnchoredSteps from './App.jsx'
import ResetPassword from './ResetPassword.jsx'

// Error boundary so runtime crashes show a message instead of blank screen
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) { console.error('AS1 crashed:', error, info) }
  render() {
    if (this.state.error) {
      return (
        <div style={{minHeight:'100vh',background:'#0F1A24',color:'#E6DED0',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',padding:'24px',fontFamily:'Georgia,serif',gap:16,textAlign:'center'}}>
          <img src="/icon.png" alt="⚓" style={{width:56,height:56,borderRadius:12,opacity:0.85}}/>
          <h2 style={{fontFamily:"'Cinzel',serif",color:'#F5F1E8',fontSize:18,letterSpacing:'0.04em',margin:0}}>Something went wrong</h2>
          <p style={{color:'#A8B3BC',fontSize:14,maxWidth:340,lineHeight:1.6,margin:0}}>{String(this.state.error?.message || this.state.error)}</p>
          <button onClick={() => { try { localStorage.clear() } catch {} ; window.location.reload() }}
            style={{marginTop:8,background:'linear-gradient(135deg,rgba(176,138,78,0.35),rgba(176,138,78,0.18))',border:'1px solid rgba(176,138,78,0.4)',color:'#F5F1E8',padding:'10px 22px',borderRadius:10,cursor:'pointer',fontFamily:"'Cinzel',serif",fontSize:12,letterSpacing:'0.08em'}}>
            Reset & Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// Detect reset password route — Supabase sends to /reset-password#access_token=...
const path = window.location.pathname;
const hash = window.location.hash;
const isReset = path === '/reset-password' || hash.includes('type=recovery');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      {isReset ? <ResetPassword /> : <AnchoredSteps />}
    </ErrorBoundary>
  </React.StrictMode>
)
