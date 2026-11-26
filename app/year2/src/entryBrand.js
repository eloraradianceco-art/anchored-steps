// Words and colors for this app's welcome, sign-in and unlock screens (EntryScreens.jsx).
export const BRAND = {
  name: 'Anchored Steps · Year 2',
  shortName: 'Year 2',
  icon: '/icon2.png',
  tagline: '52 Deeper Weeks of Scripture Study',
  verse: {
    text: 'Not that I have already obtained all this, or have already been made perfect, but I press on to take hold of that for which Christ Jesus took hold of me.',
    ref: 'Philippians 3:12 · BSB',
  },
  features: [
    { icon: '📖', text: '52 deeper weeks, with longer passages and their context' },
    { icon: '⚠️', text: '“Don’t Miss This”: the line most readers walk past' },
    { icon: '🗓️', text: 'Seven daily steps through study, reflection, application and prayer' },
    { icon: '📚', text: 'Greek & Hebrew word studies you can hear aloud' },
    { icon: '📝', text: 'Your journal and weekly tracker, saved to your account' },
  ],
  cta: '⚓ Get Lifetime Access',
  fine: 'One-time $39.99 · No subscription · All 52 weeks, yours forever',
  // Giving line on the purchase page (EntryScreens.jsx, GivingLine). This is the plain sentence; the running total, and
  // whether the main recipient is named, come from eloraradiance.com/giving.json.
  giving: '10% of net sales is given to ministry.',
  signInPrompt: 'Already have access?',
  colors: {
    bg: '#0D1820',
    glow: 'radial-gradient(ellipse at 50% 0%, rgba(160,120,64,0.18) 0%, transparent 55%), radial-gradient(ellipse at 80% 100%, rgba(160,120,64,0.08) 0%, transparent 50%)',
    eyebrow: '#C9A15F', title: '#F0ECE3', text: '#E0D8CA', muted: '#BAC4CC', accent: '#C9A15F', link: '#D6B97A',
    card: 'linear-gradient(145deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015))', cardBorder: 'rgba(160,120,64,0.34)',
    divider: 'rgba(255,255,255,0.09)',
    ctaBg: 'linear-gradient(135deg, rgba(160,120,64,0.55), rgba(160,120,64,0.26))', ctaBorder: 'rgba(201,161,95,0.6)', ctaText: '#F0ECE3',
    panel: 'rgba(19,32,44,0.97)', panelBorder: 'rgba(160,120,64,0.3)',
    inputBg: 'rgba(255,255,255,0.05)', inputBorder: 'rgba(160,120,64,0.36)', inputText: '#F0ECE3',
    tabBg: 'rgba(255,255,255,0.03)', tabActiveBg: 'rgba(160,120,64,0.26)', tabActiveText: '#F0ECE3',
    errorBg: 'rgba(232,144,144,0.10)', errorBorder: 'rgba(232,144,144,0.38)', errorText: '#F2B0B0',
    okBg: 'rgba(124,146,132,0.14)', okBorder: 'rgba(157,181,166,0.42)', okText: '#BFD6C7',
  },
}
