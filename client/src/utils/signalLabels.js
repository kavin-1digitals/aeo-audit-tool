import registry from '../data/signal_labels.json';

// Single place for how a signal is named for users. The identifier (e.g. "llms_txt_exists") stays the key
// everywhere else (weights, API, stored audits); this only controls what is displayed.
const SIGNALS = registry.signals;

const fallback = (name) => String(name || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

export const signalLabel = (name) => SIGNALS[name]?.label || fallback(name);
export const signalCheck = (name) => SIGNALS[name]?.check || '';
export const signalScope = (name) => SIGNALS[name]?.scope || '';
export const signalCategory = (name) => SIGNALS[name]?.category || null;
export const knownSignals = () => Object.keys(SIGNALS);
