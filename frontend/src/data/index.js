// ── Influencer Table Data ──────────────────────────────────────────────────
export const influencers = [
  { id: 1, name: 'Aria Patel',    handle: '@aria_ventures', cat: 'Tech',    followers: '2.4M', er: '6.8%', auth: 91, growth: 88, score: 94, tier: 'S', av: 'AP', c1: '#E1F5EE', c2: '#085041' },
  { id: 2, name: 'Maya Chen',     handle: '@devmaya',       cat: 'Tech',    followers: '1.1M', er: '5.1%', auth: 88, growth: 82, score: 82, tier: 'S', av: 'MC', c1: '#E6F1FB', c2: '#0C447C' },
  { id: 3, name: 'Zara Nguyen',   handle: '@zaraeats',      cat: 'Food',    followers: '890K', er: '4.3%', auth: 79, growth: 76, score: 68, tier: 'B', av: 'ZN', c1: '#FAEEDA', c2: '#633806' },
  { id: 4, name: 'Marcus Osei',   handle: '@marcus_lifts',  cat: 'Fitness', followers: '3.2M', er: '3.9%', auth: 85, growth: 71, score: 77, tier: 'A', av: 'MO', c1: '#FAECE7', c2: '#4A1B0C' },
  { id: 5, name: 'Lena Schmidt',  handle: '@lenatech',      cat: 'Tech',    followers: '620K', er: '7.2%', auth: 93, growth: 79, score: 84, tier: 'A', av: 'LS', c1: '#EEEDFE', c2: '#26215C' },
  { id: 6, name: 'Priya Sharma',  handle: '@priyastyle',    cat: 'Fashion', followers: '1.7M', er: '3.4%', auth: 72, growth: 65, score: 71, tier: 'B', av: 'PS', c1: '#FBEAF0', c2: '#4B1528' },
  { id: 7, name: 'Rohan Verma',   handle: '@rohanfitlife',  cat: 'Fitness', followers: '480K', er: '8.1%', auth: 90, growth: 85, score: 88, tier: 'S', av: 'RV', c1: '#E8FEF0', c2: '#0A4A24' },
  { id: 8, name: 'Mia Williams',  handle: '@mia.eats',      cat: 'Food',    followers: '310K', er: '5.6%', auth: 83, growth: 72, score: 75, tier: 'A', av: 'MW', c1: '#FEF3E8', c2: '#4A2A0A' },
];

// ── KPI Data ──────────────────────────────────────────────────────────────
export const kpis = [
  { label: 'Total Influencers',   value: '50,000', delta: '↑ 5,000 this quarter',       deltaType: 'up',   icon: '👥' },
  { label: 'Avg Engagement',      value: '4.8%',  delta: '↑ 0.3% vs last month',  deltaType: 'up',   icon: '💬' },
  { label: 'Campaign Success Rate', value: '76.2%', delta: '↓ 1.4% vs last month', deltaType: 'down', icon: '🎯' },
  { label: 'Top Ratefluencer™',   value: '94',    delta: '@aria_ventures',         deltaType: 'neutral', icon: '⭐' },
];

// ── Recommendation Data ────────────────────────────────────────────────────
export const recommendations = [
  {
    rank: 1,
    name: 'Aarav Mehta',
    handle: '@aarav_mehta',
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
    name: 'Ananya Sharma',
    handle: '@ananya_sharma',
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
    name: 'Pooja Malhotra',
    handle: '@pooja_malhotra',
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
    { icon: '🛡️', label: 'Authenticity',  page: 'authenticity',  iconBg: 'var(--coral-dim)'  },
    { icon: '📈', label: 'Growth Engine', page: 'growthEngine',  iconBg: 'var(--purple-dim)' },
    { icon: '🏷️', label: 'Brand Match',   page: 'brandMatch',    iconBg: 'var(--accent-dim)' },
  ],
  settings: [
    { icon: '📋', label: 'Shortlist',    page: 'shortlist',    iconBg: 'rgba(255,255,255,0.05)' },
    { icon: '⚙️', label: 'Preferences', page: 'preferences',  iconBg: 'rgba(255,255,255,0.05)' },
  ],
};
