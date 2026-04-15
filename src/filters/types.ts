/**
 * Types partagés par les filtres d'injection (Instagram, Facebook).
 *
 * L'idée : chaque plateforme expose un `FilterBundle` contenant du CSS
 * statique et un script JavaScript qui masque les éléments non souhaités
 * et communique avec l'app via `window.ReactNativeWebView.postMessage`.
 */

/** Préférences utilisateur qui pilotent le comportement des filtres. */
export type FilterPreferences = {
  /** Masquer les publicités et posts sponsorisés. */
  hideAds: boolean;
  /** Masquer les suggestions algorithmiques (comptes, groupes, pages). */
  hideSuggestions: boolean;
  /** Masquer les Reels / vidéos de comptes non suivis. */
  hideReels: boolean;
  /** Le bouton flottant s'aimante au bord gauche/droit apres un drag. */
  navSnapToEdge: boolean;
};

export const defaultPreferences: FilterPreferences = {
  hideAds: true,
  hideSuggestions: true,
  hideReels: true,
  navSnapToEdge: true,
};

/** Messages remontés du WebView vers React Native. */
export type FilterMessage =
  | { type: 'hidden-count'; count: number }
  | { type: 'ready'; platform: 'instagram' | 'facebook' }
  /**
   * Signale à React Native que la route Instagram vient d'entrer ou
   * de sortir de `/explore/`. Utilisé côté RN pour toggler la prop
   * `pullToRefreshEnabled` du WebView : désactivée sur Explore (pour
   * empêcher un reload qui flasherait du contenu non filtré), activée
   * partout ailleurs.
   */
  | { type: 'route-explore-changed'; isOnExplore: boolean };

/** Bundle CSS + JS produit pour une plateforme donnée. */
export type FilterBundle = {
  /** CSS injecté en continu pour masquer des sélecteurs stables. */
  css: string;
  /** Script IIFE injecté dans la page pour le filtrage dynamique. */
  js: string;
};
