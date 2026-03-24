import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { auditApi } from '../services/api';

// Initial state
const initialState = {
  isLoading: false,
  error: null,
  currentResult: null,
};

// Action types
const AUDIT_ACTIONS = {
  START_AUDIT: 'START_AUDIT',
  AUDIT_SUCCESS: 'AUDIT_SUCCESS',
  AUDIT_ERROR: 'AUDIT_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
};

// Reducer
const auditReducer = (state, action) => {
  switch (action.type) {
    case AUDIT_ACTIONS.START_AUDIT:
      return {
        ...state,
        isLoading: true,
        error: null,
      };
    
    case AUDIT_ACTIONS.AUDIT_SUCCESS:
      return {
        ...state,
        currentResult: action.payload,
        isLoading: false,
      };
    
    case AUDIT_ACTIONS.AUDIT_ERROR:
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };
    
    case AUDIT_ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        error: null,
      };
    
    default:
      return state;
  }
};

// Create context
const AuditContext = createContext();

// Provider component
export const AuditProvider = ({ children }) => {
  const [state, dispatch] = useReducer(auditReducer, initialState);

  // Clear error
  const clearError = useCallback(() => {
    dispatch({ type: AUDIT_ACTIONS.CLEAR_ERROR });
  }, []);

  // Start audit - simple synchronous call
  const startAudit = useCallback(async (domain, includeRawSignals = false) => {
    try {
      dispatch({ type: AUDIT_ACTIONS.START_AUDIT });
      
      const response = await auditApi.startAudit(domain, includeRawSignals);
      
      if (response.status === 'completed') {
        dispatch({ type: AUDIT_ACTIONS.AUDIT_SUCCESS, payload: response });
        return response;
      } else {
        dispatch({ type: AUDIT_ACTIONS.AUDIT_ERROR, payload: response.error || 'Audit failed' });
        throw new Error(response.error || 'Audit failed');
      }
    } catch (error) {
      dispatch({ type: AUDIT_ACTIONS.AUDIT_ERROR, payload: error.message });
      throw error;
    }
  }, []);

  const value = {
    ...state,
    startAudit,
    clearError,
  };

  return (
    <AuditContext.Provider value={value}>
      {children}
    </AuditContext.Provider>
  );
};

// Hook to use the context
export const useAudit = () => {
  const context = useContext(AuditContext);
  if (!context) {
    throw new Error('useAudit must be used within an AuditProvider');
  }
  return context;
};

export { AUDIT_ACTIONS };
