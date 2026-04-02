import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { auditApi, getAuditResults } from '../services/api';

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

  // Start audit - more comprehensive call
  const startAudit = useCallback(async (domain, brand, geo, siteType) => {
    try {
      dispatch({ type: AUDIT_ACTIONS.START_AUDIT });
      
      // Add timeout wrapper to catch any unexpected timeouts
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Request timeout - server may be unavailable'));
        }, 600000); // 10 minute timeout
      });
      
      const response = await Promise.race([
        getAuditResults(domain, brand, geo, siteType),
        timeoutPromise
      ]);
      
      dispatch({ type: AUDIT_ACTIONS.AUDIT_SUCCESS, payload: response });
      return response;
    } catch (error) {
      console.error('Audit Error Details:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        request: error.request
      });
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
