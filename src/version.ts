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
 *   Alpha 1.1 — reactivation du filtre Reels : masque les Reels de
 *               comptes non suivis (bouton Suivre/Follow detecte).
 *               Overlay "En attente d'un Reel de tes amis" apparait
 *               quand aucun Reel d'ami n'est visible.
 *   Alpha 1.2 — fix faux positifs Reels (contre-signal, echec).
 *   Alpha 1.3 — approche overlay dynamique pour Reels.
 *   Alpha 1.4 — fix flash blanc entre Reels (logique inversee).
 *   Alpha 1.5 — delai de confirmation ami (3 ticks ~1.5s).
 *   Alpha 1.6 — auto-skip (abandonne).
 *   Alpha 2.0 — onglet Reels bloque avec message philosophique.
 *   Alpha 2.1 — fix ecran noir sur Reel DM : retrait de span du
 *               selecteur scanReelOverlaySuggestions, walk-up limite
 *               a 2 niveaux, refus de cacher un conteneur > 70%
 *               viewport. Ce fix existait dans 548dea9 mais avait
 *               ete perdu au rollback vers 76cec01.
 */
export const APP_VERSION = 'Alpha 2.1';
