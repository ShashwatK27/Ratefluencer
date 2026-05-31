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
      influencers: `${API_URL}/api/influencers`,
      match: `${API_URL}/api/match`,
      search: `${API_URL}/api/search`,
      generateContent: `${API_URL}/api/generate-content`,
      agent: `${API_URL}/api/run-agent`,
      stats: `${API_URL}/api/stats`,
      viralPredict: `${API_URL}/api/viral-predict`,
      platformInsights: `${API_URL}/api/platform-insights`,
      realCreators: `${API_URL}/api/real-creators`,
      generateLinkedin: `${API_URL}/api/generate-linkedin`,
      trendRanking: `${API_URL}/api/trend-ranking`,
    }
  },
  app: {
    name: 'Ratefluencer',
    version: '1.0.0',
  }
};

export default config;
