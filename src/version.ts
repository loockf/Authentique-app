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
 *   Alpha 0.7 — blocage scroll sur /explore/ idle (overflow:hidden).
 *   Alpha 0.8 — position:fixed sur body (echec).
 *   Alpha 0.9 — touchmove preventDefault pour bloquer le scroll,
 *               rAF loop pour detection route a chaque frame (~16ms),
 *               visibility:hidden sur img/video/canvas/article dans
 *               main pour eliminer le flash au switch rapide.
 *   Alpha 1.0 — overlay explore opaque plein cadre (#fafafa) entre
 *               barre de recherche (top 52px) et bottom nav (bottom
 *               50px), z-index 999, flexbox centering. Recouvre la
 *               structure de la grille (bordures, icones).
 */
export const APP_VERSION = 'Alpha 1.0';
