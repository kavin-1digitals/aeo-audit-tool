import { useEffect, useState } from 'react';
import { getRunPrompts } from '../../../services/api';

// Loads the Prompts Lab data of a run (stored answers + mentions) once per mount.
export function usePromptMatrix(runId) {
  const [matrix, setMatrix] = useState(null);
  const [loading, setLoading] = useState(Boolean(runId));
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!runId) return undefined;
    setLoading(true);
    getRunPrompts(runId)
      .then((data) => { if (!cancelled) { setMatrix(data); setError(''); } })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [runId]);

  return { matrix, loading, error };
}
