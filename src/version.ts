/**
 * Version de l'application Authentique.
 *
 * Convention : "Alpha X.Y" pendant la phase de developpement.
 * Bumper cette valeur a chaque commit qui modifie le comportement
 * visible de l'app (nouveau filtre, fix de bug, changement UI).
 * Les commits purement internes (refactor, commentaires, docs)
 * n'ont pas besoin de bump.
 *
 * Historique :
 *   Alpha 0.1 — base stable apres rollback a 76cec01 + glyphe,
 *               fix back-nav, reset position, suppression focus
 *               mode / hide likes, auto-snap, blocage pull-to-refresh
 *               explore, suppression tab swipe, ajout version.
 *   Alpha 0.6 — retour a Alpha 0.1 + long-press bouton flottant
 *               raccourci de 400ms a 200ms.
 */
export const APP_VERSION = 'Alpha 0.6';
