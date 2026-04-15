/**
 * Palette neutre et calme pour Authentique.
 *
 * Pas de couleurs vives, pas d'urgence visuelle. L'app doit s'effacer
 * pour laisser toute la place au contenu choisi par l'utilisateur.
 */
export const colors = {
  background: '#fafaf7',
  surface: '#ffffff',
  border: '#e8e6df',
  textPrimary: '#1c1c1a',
  textSecondary: '#6b6a65',
  textMuted: '#9c9a93',
  accent: '#2e2c28',
  tabActive: '#1c1c1a',
  tabInactive: '#9c9a93',
} as const;

export type ThemeColors = typeof colors;
