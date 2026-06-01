// -- Influencer Table Data --------------------------------------------------
export const influencers = [
];

// -- KPI Data --------------------------------------------------------------
export const kpis = [
  { label: 'Total Influencers',   value: '33,935', delta: 'Live dataset',       deltaType: 'neutral',   icon: '👥' },
  { label: 'Avg Engagement',      value: '4.8%',  delta: '^ 0.3% vs last month',  deltaType: 'up',   icon: '💬' },
  { label: 'Campaign Success Rate', value: '76.2%', delta: 'v 1.4% vs last month', deltaType: 'down', icon: '🎯' },
  { label: 'Top Ratefluencer™',   value: '94',    delta: '@aria_ventures',         deltaType: 'neutral', icon: '⭐' },
];

// -- Recommendation Data ----------------------------------------------------
export const recommendations = [
  {
    rank: 1,
    name: 'vanessaaalfaro',
    handle: '@vanessaaalfaro',
    meta: 'Wellness . 450K followers . Instagram',
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
    meta: 'Beauty . 320K followers . Instagram',
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
    meta: 'Fashion . 280K followers . Instagram',
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

// -- AI Insights ------------------------------------------------------------
export const aiInsights = [
  {
    icon: '🎯',
    title: 'Budget Allocation',
    text: 'With ₹10L, allocate 60% to the top match for reach, 30% to the second for category alignment, and 10% to a micro-creator for community engagement. This split maximises predicted ROI.',
  },
  {
    icon: '⚠️',
    title: 'Risk Flag',
    text: 'Supplement mega-influencers with niche micro-creators whose audience demographics better align with your target segment for stronger purchase intent.',
  },
  {
    icon: '💡',
    title: 'Nano Opportunity',
    text: 'Our model identified micro-creators (50K-200K) in Indian wellness with Ratefluencer™ scores above 80. Combining 2-3 of them may outperform a single mega-influencer at 40% lower cost.',
  },
];

// -- Campaign Categories ----------------------------------------------------
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

// -- Sidebar Navigation Items -----------------------------------------------
export const sidebarNav = {
  main: [
    { icon: '📊', label: 'Dashboard',  route: '/dashboard',       iconBg: 'var(--accent-dim)' },
    { icon: '🎯', label: 'Campaigns',  route: '/campaign',        iconBg: 'var(--blue-dim)'   },
    { icon: '⭐', label: 'Results',    route: '/recommendations', iconBg: 'var(--gold-dim)'   },
  ],
  analytics: [
    { icon: '🛡️', label: 'Authenticity',  route: '/authenticity',  iconBg: 'var(--coral-dim)'  },
    { icon: '📈', label: 'Growth Engine', route: '/growth-engine', iconBg: 'var(--purple-dim)' },
    { icon: '🏷️', label: 'Brand Match',   route: '/brand-match',   iconBg: 'var(--accent-dim)' },
    { icon: '📊', label: 'Real Insights', route: '/insights',      iconBg: 'var(--gold-dim)'   },
    { icon: '🌍', label: 'Real Creators', route: '/real-creators', iconBg: 'var(--blue-dim)'   },
    { icon: '🔥', label: 'Trend Ranking', route: '/trend-ranking', iconBg: 'var(--coral-dim)'  },
    { icon: '🎬', label: 'Content Studio',route: '/content-studio',iconBg: 'var(--purple-dim)' },
  ],
  settings: [
    { icon: '📋', label: 'Shortlist',        route: '/shortlist',         iconBg: 'rgba(255,255,255,0.05)' },
    { icon: '⚙️', label: 'Preferences',      route: '/preferences',       iconBg: 'rgba(255,255,255,0.05)' },
    { icon: '✨', label: 'My Score',          route: '/influencer-portal', iconBg: 'rgba(200,240,104,0.08)' },
  ],
};
