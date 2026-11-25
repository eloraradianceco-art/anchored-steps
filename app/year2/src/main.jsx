import React from 'react'
import ReactDOM from 'react-dom/client'
import AnchoredStepsY2 from './App_Y2.jsx'
import ResetPassword from './ResetPassword.jsx'
import { setNativeSpeaker } from './speech.js'

// Phone app: read aloud with the phone's own voice (heard with the Silent switch on). No-op on the website.
if (window.ERApp?.speaker) setNativeSpeaker(window.ERApp.speaker)

const isReset = window.location.pathname === '/reset-password'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isReset ? <ResetPassword /> : <AnchoredStepsY2 />}
  </React.StrictMode>
)
