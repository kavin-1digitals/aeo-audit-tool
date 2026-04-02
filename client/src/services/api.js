import axios from 'axios';

// Create axios instance with base URL
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/aeo-audit-tool/api',
  timeout: 600000, // Increased timeout to 10 minutes for LLM processing
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    let message = 'An error occurred';
    
    if (error.code === 'ECONNABORTED') {
      message = 'Request timeout - server may be unavailable';
    } else if (error.code === 'ERR_NETWORK') {
      message = 'Network error - unable to connect to server';
    } else if (error.response) {
      message = error.response.data?.detail || error.response.statusText || 'Server error';
    } else if (error.request) {
      message = 'No response from server - please check if the server is running';
    }
    
    console.error('API Error:', message);
    return Promise.reject(new Error(message));
  }
);

// Audit API methods
export const auditApi = {
  // Start a new audit
  startAudit: async (domain, includeRawSignals = false) => {
    const response = await api.post('audit', {
      domain,
      include_raw_signals: includeRawSignals,
    });
    return response;
  },

  // Get audit results
  getAuditResults: async (taskId) => {
    const response = await api.get(`audit/${taskId}`);
    return response;
  },

  // Get all recent runs
  getRecentRuns: async () => {
    const response = await api.get('audit');
    return response;
  },

  // Clear all runs
  clearAllRuns: async () => {
    const response = await api.delete('audit');
    return response;
  },

  // Delete specific run
  deleteRun: async (taskId) => {
    const response = await api.delete(`audit/${taskId}`);
    return response;
  },
};

// New API method for getting comprehensive audit results
export const getAuditResults = async (domain = 'https://www.aloyoga.com', brand = 'Alo Yoga', geo = 'United States', siteType = 'ecommerce') => {
  console.log('Calling API with domain:', domain, 'brand:', brand, 'geo:', geo, 'siteType:', siteType);
  const response = await api.post('/audit', {
    domain: domain,
    brand: brand,
    geo: geo,
    site_type: siteType.toLowerCase() // Pass site type to backend
  });
  
  console.log('Raw backend response:', response);
  console.log('Response keys:', Object.keys(response));
  console.log('Signals keys:', response.signals ? Object.keys(response.signals) : 'No signals');
  
  // Check if scorecard is nested deeper in the signals
  const scorecard = response.signals?.scorecard || response.signals?.aeo_scorecard || response.scorecard;
  console.log('Extracted scorecard:', scorecard);
  console.log('Scorecard keys:', scorecard ? Object.keys(scorecard) : 'No scorecard');
  
  // The backend returns a different structure - we need to extract the scorecard from signals
  const transformedData = {
    audit_metadata: {
      domain: response.domain || domain,
      brand: response.brand || brand,
      location: response.geo || geo,
      timestamp: response.timestamp || new Date().toISOString(),
      version: '1.0.0',
      total_checks: scorecard?.total_checks || 0,
      total_score: scorecard?.total_score || 0,
      score_percentage: scorecard?.total_percentage || 0
    },
    raw_scorecard: scorecard?.raw_scorecard || { scores: [] },
    path_scorecard: scorecard?.path_scorecard || {},
    signals: response.signals || null,
    quick_remediations: response.quick_remediations || null,
    summary: response.summary || {
      performance_highlights: [],
      improvement_areas: []
    },
    problemcard: response.problemcard || null
  };
  
  console.log('Transformed data for frontend:', transformedData);
  console.log('Final quick_remediations:', transformedData.quick_remediations);
  
  return transformedData;
};

// Clear audit cache
export const clearAuditCache = async () => {
  try {
    const response = await api.post('/cache/clear');
    return response.data;
  } catch (error) {
    console.error('Error clearing cache:', error);
    throw error;
  }
};

// Get cache statistics
export const getCacheStats = async () => {
  try {
    const response = await api.get('/cache/stats');
    return response.data;
  } catch (error) {
    console.error('Error getting cache stats:', error);
    throw error;
  }
};

export default api;
