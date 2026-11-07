import { useCallback, useEffect, useRef, useState } from 'react';
import { addCompetitor, carryOverCompetitors, getCompetitors, removeCompetitor } from '../../../services/api';

const POLL_MS = 3000;

// Server is the source of truth: load the comparison, poll while any competitor audit is running.
export function useCompetitorComparison(runId) {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(Boolean(runId));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);

  const load = useCallback(async () => {
    if (!runId) return null;
    try {
      const data = await getCompetitors(runId);
      if (alive.current) { setOverview(data); setError(''); }
      return data;
    } catch (e) {
      if (alive.current) setError(e.message);
      return null;
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    alive.current = true;
    load();
    return () => { alive.current = false; };
  }, [load]);

  const hasActive = (overview?.entries || []).some(e => e.status === 'pending' || e.status === 'running');
  useEffect(() => {
    if (!hasActive) return undefined;
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [hasActive, load]);

  const add = useCallback(async (payload) => {
    setBusy(true);
    setError('');
    try {
      await addCompetitor(runId, payload);
      await load();
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }, [runId, load]);

  const remove = useCallback(async (comparisonId) => {
    setError('');
    try {
      await removeCompetitor(runId, comparisonId);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }, [runId, load]);

  const carryOver = useCallback(async (fromRunId) => {
    setBusy(true);
    setError('');
    try {
      const result = await carryOverCompetitors(runId, fromRunId);
      await load();
      return result;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  }, [runId, load]);

  return { overview, loading, error, busy, add, remove, carryOver, reload: load, hasActive };
}
