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
 *   Alpha 2.1 — fix ecran noir sur Reel DM.
 *   Alpha 2.2 — cache le label "Suggestions" en bas des Reels DM.
 *   Alpha 2.3 — simplification CSS (abandonne, icones coupees).
 *   Alpha 2.4 — clipping vertical (echec partiel : bande noire
 *               toujours la, barre reponse disparait).
 *   Alpha 2.5 — scanReelOverlaySuggestions etape 2 remplacee :
 *               plus de walk-up depuis le heading "Suggestions"
 *               (qui cachait par erreur la barre de reponse).
 *               Nouvelle approche : identifier la video "courante"
 *               et cacher les conteneurs des videos additionnelles
 *               (les Reels suivants rendus en dessous par Instagram).
 *   Alpha 2.6 — position:relative (echec, meme resultat que 2.4).
 *   Alpha 2.7 — gap cover dynamique (echoue : barre reponse cachee).
 *   Alpha 2.8 — video full-viewport (echec, aucun effet visible).
 *   Alpha 2.9 — hack viewport : viewport-fit=cover. La video est
 *               full-screen au chargement mais retrecit apres.
 *   Alpha 3.0 — force brute (echec partiel).
 *   Alpha 3.1 — TABLE RASE DM Reels. Scroll block + video sizing.
 *   Alpha 3.2 — fix bande noire droite + bas (echec).
 *   Alpha 3.3 — webviewDebuggingEnabled pour Safari Web Inspector.
 *   Alpha 3.4 — fix cible via Safari Inspector (partiel : parent 5 OK
 *               mais parents 6-8 toujours contraignants).
 *   Alpha 3.5 — extend walk-up a tous les ancetres (video full-screen
 *               fonctionne, mais header coupe en haut).
 *   Alpha 3.6 — retrait viewport-fit:cover (sans effet sur le
 *               header coupe).
 *   Alpha 3.7 — HiddenBadge passe en position:absolute bottom:0.
 *               La bande n'occupe plus d'espace en flex donc le
 *               WebView recupere sa hauteur complete. Instagram a
 *               plus de place pour rendre son header DM sans le
 *               couper.
 */
export const APP_VERSION = 'Alpha 3.7';
