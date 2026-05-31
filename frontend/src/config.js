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
      generateContent: `${API_URL}/api/generate-content`,
      agent: `${API_URL}/api/run-agent`,
      stats: `${API_URL}/api/stats`,
    }
  },
  app: {
    name: 'Ratefluencer',
    version: '1.0.0',
  }
};

// Helper function to make API calls with proper error handling
export const fetchAPI = async (endpoint, options = {}) => {
  try {
    const response = await fetch(endpoint, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
      timeout: config.api.timeout,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
};

export default config;
