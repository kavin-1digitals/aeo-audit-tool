import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import { startAuditRun, getRunStatus, getRunReport, cancelRun, transformAuditReport } from '../services/api';

// Audits run in the background on the server: we start one, poll its real status and fetch the
// report when it finishes. No request is ever held open, so proxy/CDN timeouts cannot break an audit.

const ACTIVE_RUN_KEY = 'aeo.activeRun';
const POLL_FAST_MS = 3000;
const POLL_SLOW_MS = 8000;
const POLL_HIDDEN_MS = 15000;
const MAX_CONSECUTIVE_POLL_ERRORS = 6;

const initialState = {
  isLoading: false,
  error: null,
  currentResult: null,
  runStatus: null, // latest real status payload from GET /runs/{id}/status
};

const AUDIT_ACTIONS = {
  START_AUDIT: 'START_AUDIT',
  RUN_STATUS: 'RUN_STATUS',
  AUDIT_SUCCESS: 'AUDIT_SUCCESS',
  AUDIT_ERROR: 'AUDIT_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  RESET: 'RESET',
};

const auditReducer = (state, action) => {
  switch (action.type) {
    case AUDIT_ACTIONS.START_AUDIT:
      return { ...state, isLoading: true, error: null, runStatus: null, currentResult: null };
    case AUDIT_ACTIONS.RUN_STATUS:
      return { ...state, runStatus: { ...action.payload, receivedAt: Date.now() } };
    case AUDIT_ACTIONS.AUDIT_SUCCESS:
      return { ...state, currentResult: action.payload, isLoading: false, runStatus: null };
    case AUDIT_ACTIONS.AUDIT_ERROR:
      return { ...state, error: action.payload, isLoading: false, runStatus: null };
    case AUDIT_ACTIONS.CLEAR_ERROR:
      return { ...state, error: null };
    case AUDIT_ACTIONS.RESET:
      return { ...initialState };
    default:
      return state;
  }
};

const AuditContext = createContext();

const storage = {
  get() {
    try { return JSON.parse(localStorage.getItem(ACTIVE_RUN_KEY) || 'null'); } catch { return null; }
  },
  set(value) {
    try { localStorage.setItem(ACTIVE_RUN_KEY, JSON.stringify(value)); } catch { /* storage unavailable */ }
  },
  clear() {
    try { localStorage.removeItem(ACTIVE_RUN_KEY); } catch { /* storage unavailable */ }
  },
};

class RunEndedError extends Error {}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const AuditProvider = ({ children }) => {
  const [state, dispatch] = useReducer(auditReducer, initialState);
  const pollToken = useRef(0); // incremented to stop any running poll loop

  const clearError = useCallback(() => dispatch({ type: AUDIT_ACTIONS.CLEAR_ERROR }), []);

  // Poll one run until it reaches a terminal state; resolves with the transformed report.
  const pollRun = useCallback(async (runId, meta) => {
    const token = ++pollToken.current;
    let consecutiveErrors = 0;
    let polls = 0;

    while (token === pollToken.current) {
      try {
        const status = await getRunStatus(runId);
        if (token !== pollToken.current) return null;
        consecutiveErrors = 0;
        dispatch({ type: AUDIT_ACTIONS.RUN_STATUS, payload: status });

        if (status.status === 'completed' || status.status === 'completed_with_warnings') {
          const report = await getRunReport(runId);
          const result = transformAuditReport(report, meta);
          result.run_status = { status: status.status, warnings: status.warnings || [] };
          storage.clear();
          dispatch({ type: AUDIT_ACTIONS.AUDIT_SUCCESS, payload: result });
          return result;
        }
        if (status.status === 'failed' || status.status === 'cancelled') {
          storage.clear();
          throw new RunEndedError(status.error?.message || `Audit ${status.status}`);
        }
      } catch (error) {
        if (token !== pollToken.current) return null;
        // A dropped connection or a 5xx does not affect the audit (it runs on the server): retry a few
        // times. The run ending (failed/cancelled) or a 4xx answer (e.g. unknown run) is final.
        const isFinal = error instanceof RunEndedError || (error.status >= 400 && error.status < 500);
        consecutiveErrors += 1;
        if (isFinal || consecutiveErrors >= MAX_CONSECUTIVE_POLL_ERRORS) {
          storage.clear();
          dispatch({ type: AUDIT_ACTIONS.AUDIT_ERROR, payload: error.message });
          throw error;
        }
      }
      polls += 1;
      const hidden = typeof document !== 'undefined' && document.hidden;
      await sleep(hidden ? POLL_HIDDEN_MS : polls < 10 ? POLL_FAST_MS : POLL_SLOW_MS);
    }
    return null;
  }, []);

  // Start an audit (or reuse a stored one with mode="reuse_latest") and resolve with the report.
  const startAudit = useCallback(async (domain, brand, geo, siteTypes, mode = 'new') => {
    try {
      dispatch({ type: AUDIT_ACTIONS.START_AUDIT });
      const started = await startAuditRun({ domain, brand, geo, siteTypes, mode });
      const meta = { domain, brand, geo };
      storage.set({ runId: started.run_id, ...meta });
      return await pollRun(started.run_id, meta);
    } catch (error) {
      console.error('Audit Error Details:', { message: error.message, code: error.code });
      dispatch({ type: AUDIT_ACTIONS.AUDIT_ERROR, payload: error.message });
      throw error;
    }
  }, [pollRun]);

  // Open a stored report (no new audit) - the report is read from the server's store.
  const loadStoredRun = useCallback(async (runId, meta = {}) => {
    try {
      const result = transformAuditReport(await getRunReport(runId), meta);
      dispatch({ type: AUDIT_ACTIONS.AUDIT_SUCCESS, payload: result });
      return result;
    } catch (error) {
      dispatch({ type: AUDIT_ACTIONS.AUDIT_ERROR, payload: error.message });
      throw error;
    }
  }, []);

  // Ask the server to stop the current run.
  const cancelAudit = useCallback(async () => {
    const active = storage.get();
    pollToken.current += 1;
    storage.clear();
    dispatch({ type: AUDIT_ACTIONS.RESET });
    if (active?.runId) {
      try { await cancelRun(active.runId); } catch (e) { console.error('Cancel failed:', e.message); }
    }
  }, []);

  // Forget the current result/run (used by "New Audit").
  const resetAudit = useCallback(() => {
    pollToken.current += 1;
    storage.clear();
    dispatch({ type: AUDIT_ACTIONS.RESET });
  }, []);

  // Resume an audit that was running when the page was refreshed / reopened.
  useEffect(() => {
    const active = storage.get();
    if (!active?.runId) return undefined;
    dispatch({ type: AUDIT_ACTIONS.START_AUDIT });
    pollRun(active.runId, { domain: active.domain, brand: active.brand, geo: active.geo }).catch(() => {
      storage.clear();
    });
    return () => { pollToken.current += 1; };
  }, [pollRun]);

  const value = { ...state, startAudit, loadStoredRun, cancelAudit, resetAudit, clearError };

  return <AuditContext.Provider value={value}>{children}</AuditContext.Provider>;
};

export const useAudit = () => {
  const context = useContext(AuditContext);
  if (!context) {
    throw new Error('useAudit must be used within an AuditProvider');
  }
  return context;
};

export { AUDIT_ACTIONS };
