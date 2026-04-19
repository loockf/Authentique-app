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
 *   Alpha 3.7 — HiddenBadge en absolute (a casse la nav dans les
 *               autres onglets, et n'a pas fix le header DM).
 *   Alpha 3.8 — revert HiddenBadge + min-height au lieu de height.
 *   Alpha 3.9 — fix scroll bypass + scrollTop=0.
 *   Alpha 4.0 — retire le forcing de taille sur la video.
 *   Alpha 4.1 — retire tout forcing (header OK mais bande droite
 *               cache les boutons d'action).
 *   Alpha 4.2 — forcing UNIQUEMENT sur la largeur des ancetres.
 *   Alpha 4.3 — placeholder fix (sans effet).
 *   Alpha 4.4 — broader color forcing (sans effet).
 *   Alpha 4.5 — FINAL DM Reels.
 *   Alpha 4.6 — 5 ameliorations UX.
 *   Alpha 4.7 — fix flash Reels lors du changement d'onglet.
 *   Alpha 4.8 — ameliorations scroll (abandonnees).
 *   Alpha 4.9 — revert de tout le code de fluidite scroll (touch
 *               listeners, scrollActiveUntil, skip pendant inertie).
 *               Philosophie Authentique : on ne gere que ce qu'on
 *               veut pas voir, le scroll reste sous le controle
 *               d'Instagram. Long-press 100ms conserve.
 *   Alpha 4.10 — fix suggestions inline : Instagram a change en
 *                nov 2024 et met "Suggestions pour vous" en texte
 *                inline dans l'article (plus un heading separe).
 *                scanSuggestions itere maintenant aussi les
 *                articles et detecte le texte via containsText.
 *                L'ancien scan de headings reste (filet de
 *                securite si Instagram reverse le changement).
 *                Note : les commits story 5.0-5.4 sont archives
 *                dans la branche claude/story-attempts-backup.
 *   Alpha 4.11 — ajout MutationObserver cible sur les insertions
 *                d'articles : scan instantane au lieu d'attendre
 *                le prochain tick du poll (500ms). Elimine le
 *                flash de sponso/suggestion visible une fraction
 *                de seconde avant d'etre cache. Filtre strict
 *                pour ne reagir qu'aux ajouts d'articles.
 *   Alpha 4.12 — optimisation MutationObserver : scan UNIQUEMENT
 *                les nouveaux articles inseres (pas tous les
 *                articles du feed). Evite de bloquer le thread
 *                principal pendant qu'Instagram charge le batch
 *                suivant. Cible le probleme d'affichage "1 post
 *                a la fois" apres Alpha 4.11.
 *   Alpha 4.13 — fix crash WebView :
 *                1) auto-reload quand iOS tue le process (via
 *                   onContentProcessDidTerminate). Evite l'ecran
 *                   blanc permanent.
 *                2) liberation memoire : quand hideInFlow cache un
 *                   article, on detache aussi ses medias (video,
 *                   img, source) pour liberer la memoire. Le DOM
 *                   reste, les pixels sont relaches. Critique pour
 *                   eviter le crash quand beaucoup d'articles sont
 *                   caches (user a vu un crash a 93 elements masques).
 *   Alpha 4.14 — fix compteur bloque apres reload. bumpHiddenCount
 *                prend Math.max(previous, count), donc apres un
 *                auto-reload (ou un crash WebView), le JS repartait
 *                de 0 et envoyait 1, 2, 3... toujours inferieur a
 *                la derniere valeur pre-reload (ex : 199), et RN
 *                restait fige. Correction : resetHiddenCount() est
 *                appele avant webview.reload() dans le handler
 *                onContentProcessDidTerminate.
 *   Alpha 4.15 — liberation memoire aggressive : toutes les 5s, les
 *                articles (amis inclus) a plus de 3000px au-dessus du
 *                viewport se font retirer leurs medias (video, img,
 *                source). Avant, seuls les articles caches par nos
 *                filtres etaient nettoyes. Mais les posts d'amis
 *                deja scrolles gardaient images+videos en RAM. Avec
 *                ~50 posts amis charges, ca representait assez de
 *                memoire pour qu'iOS tue le process. Maintenant la
 *                RAM reste quasi-constante peu importe la longueur
 *                du scroll. Si l'utilisateur remonte, Instagram
 *                re-lazy-load les images.
 *   Alpha 4.16 — (REVERT) innerHTML='' causait un cycle infini :
 *                Instagram re-injectait du contenu dans les articles
 *                vides, declenchant un re-scan permanent. Resultat :
 *                lenteur extreme + flash de sponsos/suggestions de
 *                plusieurs secondes. Revert complet du innerHTML, on
 *                garde uniquement le detachement des medias (src) qui
 *                est safe. Seuil offscreen remis a 3000px. Fix label
 *                toggle pubs conserve.
 */
export const APP_VERSION = 'Alpha 4.16';
