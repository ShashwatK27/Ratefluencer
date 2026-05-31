// ── Influencer Table Data ──────────────────────────────────────────────────
export const influencers = [
];

// ── KPI Data ──────────────────────────────────────────────────────────────
export const kpis = [
  { label: 'Total Influencers',   value: '33,935', delta: 'Live dataset',       deltaType: 'neutral',   icon: '👥' },
  { label: 'Avg Engagement',      value: '4.8%',  delta: '↑ 0.3% vs last month',  deltaType: 'up',   icon: '💬' },
  { label: 'Campaign Success Rate', value: '76.2%', delta: '↓ 1.4% vs last month', deltaType: 'down', icon: '🎯' },
  { label: 'Top Ratefluencer™',   value: '94',    delta: '@aria_ventures',         deltaType: 'neutral', icon: '⭐' },
];

// ── Recommendation Data ────────────────────────────────────────────────────
export const recommendations = [
  {
    rank: 1,
    name: 'vanessaaalfaro',
    handle: '@vanessaaalfaro',
    meta: 'Wellness · 450K followers · Instagram',
    badge: '👑 #1 Match',
    ratefluencer: 94,
    growth: 91,
    authenticity: 98,
    brandMatch: 95,
    successProb: '88%',
    why: '✦ Category similarity of 95% with verified low fraud risk.',
    ringColor: '#C8F068',
    ringOffset: 12,
    rankClass: 'rank-1',
  },
  {
    rank: 2,
    name: 'confessionsofdoctordream',
    handle: '@confessionsofdoctordream',
    meta: 'Beauty · 320K followers · Instagram',
    badge: null,
    ratefluencer: 82,
    growth: 85,
    authenticity: 90,
    brandMatch: 88,
    successProb: '82%',
    why: '✦ Category similarity of 88% with verified low fraud risk.',
    ringColor: '#68B8F0',
    ringOffset: 36,
    rankClass: 'rank-2',
  },
  {
    rank: 3,
    name: 'mykoreanplate',
    handle: '@mykoreanplate',
    meta: 'Fashion · 280K followers · Instagram',
    badge: null,
    ratefluencer: 68,
    growth: 77,
    authenticity: 84,
    brandMatch: 92,
    successProb: '76%',
    why: '✦ Category similarity of 92% with verified low fraud risk.',
    ringColor: '#F0C96A',
    ringOffset: 64,
    rankClass: 'rank-3',
  },
];

// ── AI Insights ────────────────────────────────────────────────────────────
export const aiInsights = [
  {
    icon: '🎯',
    title: 'Budget Allocation',
    text: 'With ₹10L, allocate 60% to Ronaldo for reach, 30% to Gomez for category alignment, and 10% to a micro-creator for community engagement. This split maximizes predicted ROI.',
  },
  {
    icon: '⚠️',
    title: 'Risk Flag',
    text: "Ronaldo's audience skews 65% male. For a skincare brand, supplement with Selena Gomez whose 72% female audience drives 3× more purchase intent for beauty products.",
  },
  {
    icon: '💡',
    title: 'Nano Opportunity',
    text: 'Our model identified 14 micro-creators (50K–200K) in Indian wellness with Ratefluencer™ scores above 80. Combining 2–3 of them may outperform a single mega-influencer at 40% lower cost.',
  },
];

// ── Campaign Categories ────────────────────────────────────────────────────
export const campaignCategories = [
  { icon: '💄', label: 'Beauty' },
  { icon: '🌿', label: 'Wellness' },
  { icon: '👗', label: 'Fashion' },
  { icon: '💪', label: 'Fitness' },
  { icon: '🍕', label: 'Food' },
  { icon: '🖥️', label: 'Tech' },
  { icon: '✈️', label: 'Travel' },
  { icon: '📚', label: 'Education' },
  { icon: '🎮', label: 'Gaming' },
  { icon: '💰', label: 'Finance' },
  { icon: '🎭', label: 'Entertainment' },
  { icon: '🐾', label: 'Pets' },
];

// ── Sidebar Navigation Items ───────────────────────────────────────────────
export const sidebarNav = {
  main: [
    { icon: '📊', label: 'Dashboard',  page: 'dashboard',       iconBg: 'var(--accent-dim)' },
    { icon: '🎯', label: 'Campaigns',  page: 'campaign',        iconBg: 'var(--blue-dim)'   },
    { icon: '⭐', label: 'Results',    page: 'recommendations', iconBg: 'var(--gold-dim)'   },
  ],
  analytics: [
    { icon: '🛡️', label: 'Authenticity',  page: null, iconBg: 'var(--coral-dim)'  },
    { icon: '📈', label: 'Growth Engine', page: null, iconBg: 'var(--purple-dim)' },
    { icon: '🏷️', label: 'Brand Match',   page: null, iconBg: 'var(--accent-dim)' },
  ],
  settings: [
    { icon: '⚙️', label: 'Preferences',  page: null, iconBg: 'rgba(255,255,255,0.05)' },
    { icon: '🔗', label: 'Integrations', page: null, iconBg: 'rgba(255,255,255,0.05)' },
  ],
};
