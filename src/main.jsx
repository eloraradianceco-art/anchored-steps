import React from 'react'
import ReactDOM from 'react-dom/client'
import AnchoredSteps from './App.jsx'
import ResetPassword from './ResetPassword.jsx'

// Detect reset password route — Supabase sends to /reset-password#access_token=...
const path = window.location.pathname;
const hash = window.location.hash;
const isReset = path === '/reset-password' || hash.includes('type=recovery');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isReset ? <ResetPassword /> : <AnchoredSteps />}
  </React.StrictMode>
)
