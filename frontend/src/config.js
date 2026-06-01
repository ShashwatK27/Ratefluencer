/**
 * Frontend Configuration
 * Centralized configuration for API endpoints and other settings
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const API_TIMEOUT = parseInt(import.meta.env.VITE_API_TIMEOUT || '30000');

export const config = {
  api: {
    baseURL: API_URL,
    timeout: API_TIMEOUT,
    endpoints: {
      // existing
      influencers:      `${API_URL}/api/influencers`,
      match:            `${API_URL}/api/match`,
      search:           `${API_URL}/api/search`,
      generateContent:  `${API_URL}/api/generate-content`,
      agent:            `${API_URL}/api/run-agent`,
      stats:            `${API_URL}/api/stats`,
      viralPredict:     `${API_URL}/api/viral-predict`,
      platformInsights: `${API_URL}/api/platform-insights`,
      realCreators:     `${API_URL}/api/real-creators`,
      scoreCaption:     `${API_URL}/api/score-caption`,
      voiceover:        `${API_URL}/api/voiceover`,
      creatorMatch:     `${API_URL}/api/creator-match`,
      generateLinkedin: `${API_URL}/api/generate-linkedin`,
      trendRanking:     `${API_URL}/api/trend-ranking`,
      // new
      groqStatus:        `${API_URL}/api/groq-status`,
      setGroqKey:        `${API_URL}/api/set-groq-key`,
      discoverTrends:    `${API_URL}/api/discover-trends`,
      generateScript:    `${API_URL}/api/generate-script`,
      influencerProfile: `${API_URL}/api/influencer-profile`,
      roiEstimate:       `${API_URL}/api/roi-estimate`,
      explain:           `${API_URL}/api/explain`,
      contentQuality:    `${API_URL}/api/content-quality`,
      feedback:          `${API_URL}/api/feedback`,
      feedbackHistory:   `${API_URL}/api/feedback/history`,
      agentLearn:        `${API_URL}/api/agent/learn`,
      agentPreferences:  `${API_URL}/api/agent/preferences`,
      generateVideo:     `${API_URL}/api/generate-video`,
    }
  },
  app: {
    name: 'Ratefluencer',
    version: '2.0.0',
  }
};

export default config;
