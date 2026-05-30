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
    }
  },
  app: {
    name: 'Ratefluencer',
    version: '1.0.0',
  }
};

export default config;
