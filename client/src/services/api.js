import axios from 'axios';

// Create axios instance with base URL
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/aeo-audit-tool/api',
  timeout: 30000, // Audits run in the background and are polled, so every request is short
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
    const apiError = new Error(message);
    apiError.status = error.response?.status; // lets callers tell transient (network/5xx) from final (4xx) failures
    return Promise.reject(apiError);
  }
);

// --- Audit runs (asynchronous: start -> poll status -> fetch report) ---------------------------

// Start an audit; returns immediately with { run_id, status, reused, reused_active }.
export const startAuditRun = async ({ domain, brand, geo, siteTypes = [], mode = 'new' }) => {
  return api.post('/audit', {
    domain,
    brand,
    geo,
    site_types: siteTypes.map(type => type.toLowerCase()), // Pass array of site types to backend
    mode,
  });
};

// Real progress for a run (stage lanes, counters, elapsed time, warnings, events).
export const getRunStatus = (runId, sinceSeq = 0) => api.get(`/runs/${runId}/status`, { params: { since_seq: sinceSeq } });

// Finished report in the backend's AuditResponse shape.
export const getRunReport = (runId) => api.get(`/runs/${runId}`);

// Prompts Lab: every prompt with its web / AI-model answer and who was mentioned (no AI calls on the server).
export const getRunPrompts = (runId) => api.get(`/runs/${runId}/prompts`);

export const cancelRun = (runId) => api.post(`/runs/${runId}/cancel`);

export const deleteRun = (runId) => api.delete(`/runs/${runId}`);

// --- Competitor tab (server-side source of truth) ---------------------------------------------
export const getCompetitors = (runId) => api.get(`/runs/${runId}/competitors`);
export const addCompetitor = (runId, { name, domain, refresh = false }) =>
  api.post(`/runs/${runId}/competitors`, { name, domain, refresh });
export const carryOverCompetitors = (runId, fromRunId = null) =>
  api.post(`/runs/${runId}/competitors/carry-over`, { from_run_id: fromRunId });
export const removeCompetitor = (runId, comparisonId) => api.delete(`/runs/${runId}/competitors/${comparisonId}`);

// Stored audits are keyed by brand name, used exactly as typed (only trimmed).
// Resolves to [] or [{ brand_id, name, run_count, latest_run }].
export const findBrandByName = (name) => api.get('/brands', { params: { name: name.trim() } });

// Run history of a brand (newest first): domain, geo, site_types, scores, warnings, has_report.
export const listBrandRuns = (brandId) => api.get(`/brands/${brandId}/runs`);

// The brand's own AI visibility (SOV, citations, coverage) at each stored run, oldest first.
export const getVisibilityTrend = (brandId) => api.get(`/brands/${brandId}/visibility-trend`);

// Convert the backend report into the shape the dashboard components expect.
export const transformAuditReport = (response, { domain, brand, geo } = {}) => {
  // Check if scorecard is nested deeper in the signals
  const scorecard = response.signals?.scorecard || response.signals?.aeo_scorecard || response.scorecard;
  console.log('Extracted scorecard:', scorecard);
  console.log('Scorecard keys:', scorecard ? Object.keys(scorecard) : 'No scorecard');
  
  // The backend returns a different structure - we need to extract the scorecard from signals
  const transformedData = {
    audit_metadata: {
      run_id: response.task_id || null,
      domain: response.domain || domain,
      brand: response.brand || brand,
      location: response.geo || geo,
      timestamp: response.timestamp || new Date().toISOString(),
      version: '1.0.0',
      total_checks: scorecard?.total_checks || 0,
      total_score: scorecard?.total_score || 0,
      score_percentage: scorecard?.total_percentage || 0,
      percentage: scorecard?.percentage || 0
    },
    raw_scorecard: scorecard?.raw_scorecard || { scores: [] },
    path_scorecard: scorecard?.path_scorecard || {},
    scorecard: scorecard || null, // ✅ Add the actual scorecard object with max_possible_score
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

// Convenience for callers outside AuditContext (e.g. the /report route): start (or reuse the brand's
// latest stored run), poll until finished and return the transformed report.
export const getAuditResults = async (
  domain = 'https://www.aloyoga.com', brand = 'Alo Yoga', geo = 'United States', siteTypes = ['ecommerce'],
) => {
  const started = await startAuditRun({ domain, brand, geo, siteTypes, mode: 'reuse_latest' });
  for (;;) {
    const status = await getRunStatus(started.run_id);
    if (status.status === 'completed' || status.status === 'completed_with_warnings') {
      return transformAuditReport(await getRunReport(started.run_id), { domain, brand, geo });
    }
    if (status.status === 'failed' || status.status === 'cancelled') {
      throw new Error(status.error?.message || `Audit ${status.status}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
};

export default api;
