import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { defaultPreferences, type FilterPreferences } from '../filters/types';
import { loadPreferences, savePreferences } from '../storage/preferences';

/**
 * Contexte global exposant les préférences de filtrage + le compteur
 * d'éléments masqués pour la session en cours.
 *
 * Volontairement minimal : un seul provider, pas de state machine.
 */

type FiltersContextValue = {
  prefs: FilterPreferences;
  ready: boolean;
  hiddenCount: number;
  setPref: <K extends keyof FilterPreferences>(key: K, value: FilterPreferences[K]) => void;
  bumpHiddenCount: (count: number) => void;
  resetHiddenCount: () => void;
};

const FiltersContext = createContext<FiltersContextValue | undefined>(undefined);

export function FiltersProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<FilterPreferences>(defaultPreferences);
  const [ready, setReady] = useState(false);
  const [hiddenCount, setHiddenCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadPreferences().then((loaded) => {
      if (!cancelled) {
        setPrefs(loaded);
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setPref = useCallback<FiltersContextValue['setPref']>((key, value) => {
    setPrefs((previous) => {
      const next = { ...previous, [key]: value };
      // Persistance en tâche de fond, on ne bloque pas l'UI
      void savePreferences(next);
      return next;
    });
  }, []);

  const bumpHiddenCount = useCallback((count: number) => {
    // Le compteur est une valeur absolue envoyée par le WebView, on prend
    // toujours le maximum observé pour éviter qu'un rechargement de page
    // le fasse reculer visuellement pendant la session.
    setHiddenCount((previous) => (count > previous ? count : previous));
  }, []);

  const resetHiddenCount = useCallback(() => setHiddenCount(0), []);

  const value = useMemo<FiltersContextValue>(
    () => ({ prefs, ready, hiddenCount, setPref, bumpHiddenCount, resetHiddenCount }),
    [prefs, ready, hiddenCount, setPref, bumpHiddenCount, resetHiddenCount],
  );

  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function useFilters(): FiltersContextValue {
  const ctx = useContext(FiltersContext);
  if (!ctx) {
    throw new Error('useFilters doit être utilisé à l\'intérieur d\'un <FiltersProvider>');
  }
  return ctx;
}
