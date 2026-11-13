// Words and colors for this app's welcome, sign-in and unlock screens (components/EntryScreens.jsx).
export const BRAND = {
  name: 'Anchored Steps',
  shortName: 'Anchored Steps',
  icon: '/icon.png',
  tagline: '52 Weeks of Faith in Action',
  verse: {
    text: 'But as for you, continue in what you have learned and have firmly believed, knowing from whom you learned it.',
    ref: '2 Timothy 3:14 · ESV',
  },
  features: [
    { icon: '📖', text: '52 weeks, each with a theme and a key passage' },
    { icon: '🗓️', text: 'Seven daily steps: study, reflect, apply, pray and journal' },
    { icon: '🗺️', text: 'Verse Maps and Greek & Hebrew word studies' },
    { icon: '🧠', text: 'Scripture memorization in three modes' },
    { icon: '📝', text: 'Your journal, saved to your account on every device' },
  ],
  cta: '⚓ Get Lifetime Access',
  fine: 'One-time $39 · No subscription · All 52 weeks, yours forever',
  signInPrompt: 'Already have access?',
  colors: {
    bg: '#0F1A24',
    glow: 'radial-gradient(ellipse at 50% 0%, rgba(176,138,78,0.16) 0%, transparent 55%), radial-gradient(ellipse at 80% 100%, rgba(176,138,78,0.08) 0%, transparent 50%)',
    eyebrow: '#CFA968', title: '#F5F1E8', text: '#E6DED0', muted: '#C0CDD8', accent: '#CFA968', link: '#DDC28C',
    card: 'linear-gradient(145deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015))', cardBorder: 'rgba(176,138,78,0.32)',
    divider: 'rgba(255,255,255,0.09)',
    ctaBg: 'linear-gradient(135deg, rgba(176,138,78,0.52), rgba(176,138,78,0.26))', ctaBorder: 'rgba(207,169,104,0.6)', ctaText: '#F5F1E8',
    panel: 'rgba(20,33,46,0.97)', panelBorder: 'rgba(176,138,78,0.28)',
    inputBg: 'rgba(255,255,255,0.05)', inputBorder: 'rgba(176,138,78,0.34)', inputText: '#F5F1E8',
    tabBg: 'rgba(255,255,255,0.03)', tabActiveBg: 'rgba(176,138,78,0.24)', tabActiveText: '#F5F1E8',
    errorBg: 'rgba(232,144,144,0.10)', errorBorder: 'rgba(232,144,144,0.38)', errorText: '#F2B0B0',
    okBg: 'rgba(124,146,132,0.14)', okBorder: 'rgba(157,181,166,0.42)', okText: '#BFD6C7',
  },
}
