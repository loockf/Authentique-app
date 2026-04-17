import type { FilterBundle, FilterPreferences } from './types';

/**
 * Construit le bundle CSS + JS d'injection pour Instagram.
 *
 * Instagram change ses noms de classes en permanence : on ne peut donc pas se
 * reposer sur des sélecteurs stables. Notre stratégie :
 *
 *  1. CSS : masquer le plus agressivement possible ce qui est identifiable par
 *     attribut/role (pop-ups d'install app, bandeau "ouvrir dans l'app", etc.).
 *  2. JS : un MutationObserver scanne le DOM en continu et masque par contenu
 *     textuel les éléments marqués "Sponsorisé", "Suggestions pour vous",
 *     "Suggested for you", "Reels"... Chaque élément masqué incrémente un
 *     compteur transmis à l'app via postMessage.
 *
 * Le script est volontairement verbeux et lisible — il doit pouvoir être audité
 * par n'importe qui qui lit le repo.
 *
 * -----------------------------------------------------------------------------
 * REFACTOR EN 3 COMMITS EN COURS
 * -----------------------------------------------------------------------------
 * Ce fichier est en train d'etre refondu en 3 commits successifs pour ajouter
 * plusieurs features lourdes (fix feed blanc, filtre Explore, Reels option B,
 * lock Reels DMs, masquage canaux suggeres DMs) sans risquer un timeout sur
 * une reecriture unique.
 *
 *   Commit 1 (celui-ci) — Structure : extraction des listes de "needles"
 *   (textes a matcher) hors du JS inline vers des constantes TypeScript
 *   typees au niveau module. Pas de changement comportemental, mais les
 *   commits 2 et 3 pourront augmenter ces tableaux proprement au lieu de
 *   fouiller dans un string JS.
 *
 *   Commit 2 — Filtres CSS : nouvelles classes .authentique-hidden-flow
 *   (pour preserver le lazy-load), repositionnement de l'overlay Reels,
 *   styles du filtre Explore et du lock Reels DMs.
 *
 *   Commit 3 — Filtres JS + logique Reels : helper hideInFlow(), route
 *   detection enrichie (Explore, DMs, reel individuel), scans explore,
 *   lock swipe vertical sur reel individuel, et filtre des canaux
 *   suggeres dans la messagerie.
 * -----------------------------------------------------------------------------
 */

/**
 * Listes de textes a matcher dans le DOM pour identifier les elements a
 * masquer. On les pose ici, au niveau module et typees en TypeScript, pour
 * deux raisons :
 *
 *  - Elles sont lisibles et auditables d'un coup d'oeil, sans plonger dans
 *    le corps du script JS inline.
 *  - Les prochains commits pourront en ajouter / retirer en editant une
 *    seule liste sans toucher a la logique de scan.
 *
 * Les tableaux sont serialises en JSON avant d'etre interpoles dans le
 * template literal du script JS : aucune fuite d'echappement ou de
 * caractere special a gerer a la main.
 */
const SPONSORED_NEEDLES = [
  'Sponsorisé',
  'Sponsorisée',
  'Sponsored',
  'Partenariat rémunéré',
  'Paid partnership',
] as const;

const SUGGESTED_NEEDLES = [
  'Suggestions pour vous',
  'Suggested for you',
  'Suggested posts',
  'Publications suggérées',
  'Suggéré pour vous',
] as const;

const REELS_NEEDLES = [
  'Reels et plus',
  'Reels and more',
  'Reels suggérés',
  'Suggested reels',
] as const;

const OPEN_APP_NEEDLES = [
  "Ouvrir dans l'application",
  "Ouvrir l'application",
  "Ouvrir Instagram",
  "Voir dans l'application",
  "Continuer dans l'application",
  "Utiliser l'application",
  'Open in app',
  'Open Instagram app',
  'Open Instagram',
  'See in app',
  'Continue in app',
  'Use the app',
  'Get the app',
] as const;

const FOLLOW_NEEDLES = ['Suivre', 'Follow'] as const;

export function buildInstagramFilters(prefs: FilterPreferences): FilterBundle {
  const css = `
    /* -----------------------------------------------------------------
       Fond du document — masque le flash blanc pendant un swipe entre
       tabs internes Instagram
       -----------------------------------------------------------------
       Quand on swipe horizontalement entre les tabs Instagram (home ->
       search -> reels...) depuis le bord de l'ecran, Instagram anime le
       contenu actuel qui glisse et charge le contenu suivant en parallele.
       Pendant cette transition, la zone "vide" derriere les ecrans est
       rendue dans la couleur de fond du document, qui est blanche par
       defaut. Resultat : un flash blanc bien visible. En forcant le fond
       a la couleur de l'app Instagram en mode sombre (#000), on rend le
       flash invisible, la transition semble parfaitement fluide.
       Cette regle n'affecte rien d'autre : les contenus du feed ont
       leurs propres fonds. */
    html, body {
      background-color: #000000 !important;
    }

    /* Pop-ups "Ouvrir dans l'application" / "Installer l'app" */
    div[role="dialog"][aria-label*="app" i],
    div[role="dialog"][aria-label*="application" i],
    div[data-appinstall],
    [aria-label="Open Instagram app"],
    [aria-label="Ouvrir l'application Instagram"] {
      display: none !important;
    }

    /* Bandeau en haut "Voir dans l'application" */
    [data-visualcompletion="ignore-dynamic"] a[href*="apps.apple.com"],
    [data-visualcompletion="ignore-dynamic"] a[href*="play.google.com"] {
      display: none !important;
    }

    /* Bouton d'installation flottant */
    div[role="button"][tabindex="0"][aria-label*="install" i] {
      display: none !important;
    }

    /* Notifications de "contenu tendance" */
    [aria-label*="tendance" i],
    [aria-label*="trending" i] {
      display: none !important;
    }

    /* -----------------------------------------------------------------
       Classes universelles de masquage
       -----------------------------------------------------------------
       On a DEUX classes de masquage, et il faut bien comprendre la
       difference pour ne pas recasser l'infinite scroll d'Instagram :

       .authentique-hidden — masquage STRICT (display: none).
         A utiliser pour les elements qu'il faut sortir completement
         du flow : pop-ups, bandeaux "Ouvrir dans l'app", cards Reels
         en fullscreen quand on veut que le swipe avance au Reel
         suivant, dialogues modaux, etc.

       .authentique-hidden-flow — masquage PRESERVANT LE FLOW.
         A utiliser pour les posts du fil et les cards de suggestion
         *a l'interieur* du feed. Instagram attache un IntersectionObserver
         sur les items du feed pour declencher le chargement paresseux
         des posts suivants. Si on les marque display:none, l'observer
         ne les voit jamais entrer dans le viewport et l'infinite scroll
         se bloque avec un grand blanc apres quelques posts. En les
         reduisant a height: 0 + opacity: 0 on les rend visuellement
         invisibles tout en gardant l'element dans le layout, l'observer
         continue a firer, et le feed continue a charger normalement.
       ----------------------------------------------------------------- */
    .authentique-hidden {
      display: none !important;
    }

    .authentique-hidden-flow {
      opacity: 0 !important;
      height: 0 !important;
      min-height: 0 !important;
      max-height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      border-width: 0 !important;
      overflow: hidden !important;
      pointer-events: none !important;
    }

    /* -----------------------------------------------------------------
       Overlay "En attente d'un Reel de tes amis" sur /reels/
       -----------------------------------------------------------------
       L'overlay est injecte une seule fois au demarrage dans le body
       et reste dans le DOM en permanence. Il est cache par defaut et
       ne devient visible que via la classe body.authentique-on-reels
       posee par notre JS quand on est sur la route Reels feed.

       Historique : cet overlay etait auparavant fullscreen avec un
       fond noir opaque. Probleme : il recouvrait aussi la barre de
       navigation interne d'Instagram (home, search, reels, notifs,
       profile) et bloquait la navigation quand aucun Reel d'ami
       n'etait disponible. On l'a donc retransforme en une petite
       pastille centree avec fond translucide, pour qu'Instagram garde
       le controle de son chrome (top bar + bottom nav).
       ----------------------------------------------------------------- */
    .authentique-reels-waiting {
      display: none;
      position: fixed;
      left: 0;
      right: 0;
      top: 0;
      bottom: 50px;
      background: #000000;
      color: rgba(255, 255, 255, 0.92);
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 14px;
      line-height: 1.4;
      text-align: center;
      padding: 0 32px;
      /* pointer-events: none pour que la bottom nav reste accessible
         en dessous (meme si elle est hors du bottom:50px, certains
         gestes iOS propagent vers la zone adjacente). */
      pointer-events: none;
      z-index: 999;
      letter-spacing: 0.2px;
    }
    body.authentique-on-reels .authentique-reels-waiting {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    /* -----------------------------------------------------------------
       Lock vertical swipe sur un Reel individuel OU modal DM
       -----------------------------------------------------------------
       Approche minimaliste : ZERO CSS sur body.authentique-reel-locked.
       Le seul mecanisme de blocage est le touchmove handler en JS
       (syncReelLockTouchHandler). La vidéo est forcee a 100vh via
       inline style dans updateRouteMarker. On ne touche pas au layout
       d'Instagram (pas d'overflow, pas de clip-path, pas de max-width)
       pour eviter les effets de bord (bande noire, boutons coupes,
       barre de reponse qui disparait).
       ----------------------------------------------------------------- */

    /* Note : l'effet "bande noire" sur la barre de reponse dans
       certaines conversations DM Reels n'est pas un bug Authentique.
       Instagram mobile web lui-meme rend la barre invisible dans ces
       cas (confirme en chargeant instagram.com directement dans
       Arc/Safari — meme bug). On ne peut pas fixer ce qu'on ne cause
       pas. Les tentatives de color forcing (Alpha 4.3 et 4.4) n'ont
       eu aucun effet. */

    /* -----------------------------------------------------------------
       Etat vide de la page Explore (loupe) en mode idle
       -----------------------------------------------------------------
       Quand l'utilisateur ouvre la loupe sans recherche active, on
       masque toute la grille "decouvrir" via JS. Instagram detecte le
       vide et tente de re-fetcher en boucle, affichant un spinner qui
       tourne pour rien. On masque donc aussi ses spinners ET on
       injecte un petit message calme a la place, en clin d'oeil a la
       philosophie d'Authentique.

       La classe authentique-on-explore-idle est posee par le JS quand
       isExploreRoute() && !isExploreSearchActive(). Elle agit a la
       fois pour masquer le spinner natif et pour reveler le message.
       ----------------------------------------------------------------- */
    /* Masquage du contenu explore en idle : rend les images et
       videos invisibles pour eliminer le flash de contenu suggere
       lors du switch rapide entre onglets. Le blocage du scroll
       est gere cote JS via touchmove preventDefault. */
    body.authentique-on-explore-idle main img,
    body.authentique-on-explore-idle main video,
    body.authentique-on-explore-idle main canvas,
    body.authentique-on-explore-idle main article {
      visibility: hidden !important;
    }

    body.authentique-on-explore-idle [role="progressbar"],
    body.authentique-on-explore-idle [aria-label*="Chargement" i],
    body.authentique-on-explore-idle [aria-label*="Loading" i],
    body.authentique-on-explore-idle [data-visualcompletion="loading-state"],
    body.authentique-on-explore-idle svg[aria-label*="Chargement" i],
    body.authentique-on-explore-idle svg[aria-label*="Loading" i] {
      display: none !important;
    }

    .authentique-explore-empty {
      display: none;
      position: fixed;
      left: 0;
      right: 0;
      /* Positionne entre la barre de recherche en haut et la bottom
         nav en bas. Les valeurs sont generiques : 52px laisse la
         barre de recherche visible, 50px laisse la bottom nav. */
      top: 52px;
      bottom: 50px;
      /* Fond opaque identique au fond Instagram clair. Recouvre
         entierement la grille (structure, icones, bordures) pour
         qu'aucun element ne soit visible derriere le message. */
      background-color: #fafafa;
      padding: 0 24px;
      text-align: center;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      pointer-events: none;
      z-index: 999;
    }
    .authentique-explore-empty .authentique-explore-empty-title {
      display: block;
      font-size: 18px;
      font-weight: 600;
      color: #1c1c1a;
      margin-bottom: 8px;
      letter-spacing: -0.2px;
    }
    .authentique-explore-empty .authentique-explore-empty-body {
      display: block;
      font-size: 13px;
      font-weight: 400;
      color: #6b6a65;
      line-height: 1.5;
    }
    body.authentique-on-explore-idle .authentique-explore-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
  `;

  // Les préférences sont sérialisées dans le script pour qu'il puisse décider
  // quels éléments masquer sans avoir à refaire un aller-retour avec l'app.
  const serializedPrefs = JSON.stringify(prefs);

  const js = `
    (function() {
      if (window.__authentiqueInstalled) {
        // Si le script est ré-injecté (hot reload des prefs), on met simplement
        // à jour les préférences et on relance un scan complet.
        if (typeof window.__authentiqueUpdatePrefs === 'function') {
          try { window.__authentiqueUpdatePrefs(${serializedPrefs}); } catch (e) {}
        }
        return;
      }
      window.__authentiqueInstalled = true;

      var prefs = ${serializedPrefs};
      var hiddenCount = 0;
      // Dernier etat d'appartenance a /explore/ envoye a React Native.
      // Initialise a null pour qu'on emette systematiquement un
      // premier message au tout premier updateRouteMarker, peu
      // importe la valeur initiale. Ensuite on ne ré-emet que sur
      // changement d'etat.
      var lastReportedOnExplore = null;
      // Flag pour ne reset le scrollTop qu'une seule fois par ouverture
      // de DM Reel (pas a chaque tick de poll).
      var reelScrollReset = false;
      // Timer pour retarder le retrait de l'overlay Reels quand on
      // quitte /reels/ — evite le flash de contenu pendant la
      // transition vers un autre onglet.
      var reelsOverlayRemoveTimer = null;
      // Compteur de ticks consecutifs ou le Reel courant ressemble
      // a celui d'un ami (video visible + pas de "Suivre"). On exige
      // 3 ticks avant de retirer l'overlay pour eviter les faux
      // positifs lies au chargement asynchrone du bouton "Suivre".

      // --- Helpers ---------------------------------------------------------

      function post(message) {
        try {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify(message));
          }
        } catch (e) {}
      }

      function isHomeFeedRoute() {
        var p = location.pathname || '';
        return p === '' || p === '/';
      }

      function hide(el, reason) {
        if (!el || el.classList.contains('authentique-hidden')) { return false; }
        el.classList.add('authentique-hidden');
        el.setAttribute('data-authentique-reason', reason);
        // Le compteur "elements masques" ne reflete que le fil
        // d'actualite. Sur les autres routes (explore, reels, DM),
        // on masque quand meme l'element mais on ne l'incremente
        // pas — la loupe par exemple est bloquee par default et
        // n'est pas censee generer du contenu utile a compter.
        if (isHomeFeedRoute()) {
          hiddenCount++;
          post({ type: 'hidden-count', count: hiddenCount });
        }
        return true;
      }

      /**
       * Masquage preservant le flow — a utiliser pour les items du feed.
       * Contrairement a hide() qui utilise display:none, cette variante
       * pose la classe .authentique-hidden-flow qui reduit l'element a
       * height:0 + opacity:0 tout en le laissant dans le layout. Ca permet
       * a l'IntersectionObserver d'Instagram de continuer a tirer sur les
       * items du feed et au lazy-load de fonctionner. Sans ca, le feed
       * tombe sur un grand blanc apres quelques posts masques.
       */
      function hideInFlow(el, reason) {
        if (!el) { return false; }
        if (el.classList.contains('authentique-hidden')) { return false; }
        if (el.classList.contains('authentique-hidden-flow')) { return false; }
        el.classList.add('authentique-hidden-flow');
        el.setAttribute('data-authentique-reason', reason);
        if (isHomeFeedRoute()) {
          hiddenCount++;
          post({ type: 'hidden-count', count: hiddenCount });
        }
        return true;
      }

      /**
       * Remonte du noeud jusqu'au post le plus proche.
       *
       * On ne remonte QUE jusqu'à une balise <article> ou un élément avec
       * role="article" — JAMAIS vers role="presentation" ou d'autres
       * conteneurs génériques, qui enveloppent souvent toute la suite du
       * feed et causent des "blancs" en bas d'écran quand on les masque.
       */
      function findPostAncestor(node) {
        var el = node;
        while (el && el !== document.body) {
          if (el.tagName === 'ARTICLE') { return el; }
          if (el.getAttribute && el.getAttribute('role') === 'article') { return el; }
          el = el.parentElement;
        }
        return null;
      }

      /** Cherche dans le sous-arbre un noeud texte qui contient l'une des needles. */
      function containsText(root, needles) {
        if (!root) { return false; }
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
        var node;
        while ((node = walker.nextNode())) {
          var text = (node.nodeValue || '').trim();
          if (!text) { continue; }
          for (var i = 0; i < needles.length; i++) {
            if (text.indexOf(needles[i]) !== -1) { return true; }
          }
        }
        return false;
      }

      /** Cherche dans les attributs aria-label/alt d'un sous-arbre. */
      function containsAttributeText(root, needles) {
        if (!root) { return false; }
        var attributed = root.querySelectorAll('[aria-label], [alt], [title]');
        for (var i = 0; i < attributed.length; i++) {
          var el = attributed[i];
          var combined = (el.getAttribute('aria-label') || '') + ' ' +
                         (el.getAttribute('alt') || '') + ' ' +
                         (el.getAttribute('title') || '');
          for (var j = 0; j < needles.length; j++) {
            if (combined.indexOf(needles[j]) !== -1) { return true; }
          }
        }
        return false;
      }

      // --- Règles ----------------------------------------------------------
      // Les needles viennent des constantes typees au niveau module de
      // instagram.ts, serialisees en JSON avant injection. C'est la que se
      // passe le pont entre le code TypeScript et le script JS qui tourne
      // dans le WebView : modifier une needle = editer le tableau TS en
      // haut du fichier, pas ce bloc.
      var SPONSORED_NEEDLES = ${JSON.stringify(SPONSORED_NEEDLES)};
      var SUGGESTED_NEEDLES = ${JSON.stringify(SUGGESTED_NEEDLES)};
      var REELS_NEEDLES = ${JSON.stringify(REELS_NEEDLES)};
      var OPEN_APP_NEEDLES = ${JSON.stringify(OPEN_APP_NEEDLES)};
      var FOLLOW_NEEDLES = ${JSON.stringify(FOLLOW_NEEDLES)};

      /**
       * Scan global — on cherche à chaque fois dans tout le document, pas
       * seulement dans le noeud muté. C'est légèrement plus coûteux mais
       * évite de rater des éléments ajoutés dans des emplacements imbriqués.
       */
      // Attribut pose sur les elements qu'on a deja scannes et juges
      // non-pertinents, pour ne pas les re-evaluer a chaque tick du
      // poll setInterval. L'attribut seul (pas de classe) garantit
      // qu'il n'interfere avec rien cote Instagram.
      // Gagne beaucoup sur les longues pages de feed : une fois qu'un
      // article / heading / span a ete verifie, on le skip.
      var SCANNED_ATTR = 'data-authentique-scanned';

      function scanSponsored() {
        if (!prefs.hideAds) { return; }
        // Les posts du fil sont masques avec hideInFlow() pour que
        // l'IntersectionObserver d'Instagram continue a declencher le
        // lazy-load des posts suivants. display:none casserait l'infinite
        // scroll et creerait un grand blanc en bas de feed.
        //
        // Caching : on ne scanne QUE les articles qui n'ont pas encore
        // ete vus (pas d'attribut data-authentique-scanned). Une fois
        // marque, on ne revient plus dessus meme si son contenu change.
        var articles = document.querySelectorAll(
          'article:not(.authentique-hidden):not(.authentique-hidden-flow):not([' + SCANNED_ATTR + ']), ' +
          '[role="article"]:not(.authentique-hidden):not(.authentique-hidden-flow):not([' + SCANNED_ATTR + '])'
        );
        for (var i = 0; i < articles.length; i++) {
          var art = articles[i];
          art.setAttribute(SCANNED_ATTR, '1');
          if (containsText(art, SPONSORED_NEEDLES) || containsAttributeText(art, SPONSORED_NEEDLES)) {
            hideInFlow(art, 'sponsored');
          }
        }
      }

      function scanSuggestions() {
        if (!prefs.hideSuggestions) { return; }
        // Caching : mêmes raisons que scanSponsored. Les headings sont
        // stables, une fois checke on ne revient pas dessus.
        var headings = document.querySelectorAll(
          'h2:not([' + SCANNED_ATTR + ']), ' +
          'h3:not([' + SCANNED_ATTR + ']), ' +
          'h4:not([' + SCANNED_ATTR + '])'
        );
        for (var j = 0; j < headings.length; j++) {
          var h = headings[j];
          h.setAttribute(SCANNED_ATTR, '1');
          var t = (h.textContent || '').trim();
          if (!t || t.length > 80) { continue; }
          var matched = false;
          for (var k = 0; k < SUGGESTED_NEEDLES.length; k++) {
            if (t === SUGGESTED_NEEDLES[k] || t.indexOf(SUGGESTED_NEEDLES[k]) === 0) {
              matched = true; break;
            }
          }
          if (matched) {
            var card = findPostAncestor(h);
            // Meme raison que scanSponsored : on garde l'element dans le
            // flow pour ne pas casser l'IntersectionObserver.
            if (card) { hideInFlow(card, 'suggestion'); }
          }
        }
      }

      function scanReels() {
        if (!prefs.hideReels) { return; }
        var sections = document.querySelectorAll('section:not(.authentique-hidden), div:not(.authentique-hidden)');
        for (var r = 0; r < sections.length; r++) {
          var sec = sections[r];
          if (!sec.children || sec.children.length === 0) { continue; }
          if (containsText(sec, REELS_NEEDLES)) {
            // On vérifie qu'on ne masque pas tout le document
            if (sec === document.body || sec.contains(document.querySelector('main'))) { continue; }
            hide(sec, 'reels-suggested');
            break;
          }
        }
      }

      /**
       * Bandeau "Ouvrir dans l'application".
       * Instagram l'injecte en <div role="dialog"> ou en bannière top-fixed.
       * On scan tout élément visible qui contient un des textes cibles.
       */
      /**
       * Filtrage contextuel des Reels en fullscreen (option B de l'utilisateur).
       *
       * Philosophie : Authentique ne stocke et ne scrape AUCUNE liste
       * d'abonnements. On se contente de regarder ce qu'Instagram affiche
       * deja a cote de chaque Reel :
       *
       *   - Si Instagram montre un bouton "Suivre" / "Follow" pres du
       *     pseudo, alors ce n'est pas un compte qu'on suit, donc on
       *     masque le Reel.
       *   - Si le bouton n'y est pas, c'est que le compte est deja suivi
       *     (ou qu'Instagram ne nous le propose plus) et on le garde.
       *
       * Aucune donnee stockee, aucune requete reseau declenchee par nous,
       * aucun code reutilisable pour exfiltrer une liste d'amis.
       *
       * Fail-safe : si Instagram change son DOM et n'expose plus le bouton
       * "Suivre" au meme endroit, on echoue en douceur -> tous les Reels
       * restent visibles (comportement par defaut avant la feature).
       */
      // --- Route detection granulaire ------------------------------------
      // Instagram distingue plusieurs routes que notre filtre traite
      // differemment. On les expose via des helpers separes pour eviter
      // qu'une logique soit appliquee a la mauvaise page (p.ex. le lock
      // vertical ne doit PAS s'appliquer a /reels/ qui est le fil
      // algorithmique que l'utilisateur a choisi d'ouvrir).
      function isReelsFeedRoute() {
        // /reels/ (plural) = fil algorithmique swipable entre Reels
        var p = location.pathname || '';
        return p.indexOf('/reels') === 0;
      }
      function isIndividualReelRoute() {
        // /reel/<id>/ (singulier) = un Reel isole, typiquement ouvert
        // depuis un partage (DM, lien), qu'on veut pouvoir regarder
        // sans glisser dans le fil algorithmique qui suit.
        var p = location.pathname || '';
        return p.indexOf('/reel/') === 0;
      }
      function isExploreRoute() {
        // /explore/ = loupe Instagram (grille "decouvrir" + recherche)
        var p = location.pathname || '';
        return p.indexOf('/explore') === 0;
      }
      function isExploreSearchActive() {
        // Une recherche est active UNIQUEMENT quand l'URL le dit :
        //   - pathname contient /search, OU
        //   - query string contient q=
        // Avant, on checkait aussi input.value, mais Instagram ne
        // vide pas l'input quand l'utilisateur revient sur la home
        // de la loupe depuis un ecran de resultats — donc l'input
        // gardait "xyz" alors que l'user etait deja revenu sur la
        // page de base, et notre etat vide n'apparaissait plus.
        if (!isExploreRoute()) { return false; }
        var p = location.pathname || '';
        if (p.indexOf('/search') !== -1) { return true; }
        var q = location.search || '';
        if (q.indexOf('q=') !== -1) { return true; }
        return false;
      }
      function isDirectRoute() {
        // /direct/... = messagerie (inbox ou thread)
        var p = location.pathname || '';
        return p.indexOf('/direct') === 0;
      }

      function findExploreSearchInput() {
        return document.querySelector('input[type="search"]') ||
               document.querySelector('input[type="text"][aria-label*="Rech" i]') ||
               document.querySelector('input[type="text"][aria-label*="Search" i]') ||
               document.querySelector('input[type="text"][placeholder*="Rech" i]') ||
               document.querySelector('input[type="text"][placeholder*="Search" i]');
      }

      function updateRouteMarker() {
        if (!document.body) { return; }

        // L'onglet Reels est le territoire de Meta. Authentique n'a pas
        // a le conquerir. On pose simplement l'overlay informatif quand
        // on est sur /reels/.
        //
        // Quand on QUITTE /reels/, on retarde la suppression de
        // l'overlay de 500ms pour que la page de destination ait le
        // temps de se charger. Sans ce delai, le contenu Reels flash
        // visiblement pendant la transition entre onglets.
        var showReelsOverlay = isReelsFeedRoute();
        if (showReelsOverlay) {
          if (reelsOverlayRemoveTimer) {
            clearTimeout(reelsOverlayRemoveTimer);
            reelsOverlayRemoveTimer = null;
          }
          document.body.classList.add('authentique-on-reels');
        } else if (document.body.classList.contains('authentique-on-reels')) {
          if (!reelsOverlayRemoveTimer) {
            reelsOverlayRemoveTimer = setTimeout(function() {
              document.body.classList.remove('authentique-on-reels');
              reelsOverlayRemoveTimer = null;
            }, 500);
          }
        }

        // Le lock du swipe vertical s'applique dans deux cas :
        //  1. /reel/<id>/ — Reel ouvert via URL singleton (lien partage)
        //  2. /direct/... + un Reel-modal visible dans l'overlay
        // Dans les deux cas on tue la snap-pagination pour empecher
        // l'utilisateur de glisser dans le fil algorithmique Reels.
        var shouldLock = isIndividualReelRoute() || isDMReelOverlayOpen();
        // La body class est gardee pour que d'autres parties du code
        // puissent tester si on est en reel-lock. Aucun CSS ne l'utilise
        // dans cette version table-rase — tout est gere par JS inline.
        document.body.classList.toggle('authentique-reel-locked', shouldLock);
        // Attache/detache dynamiquement le touchmove handler qui
        // bloque les swipes verticaux.
        syncReelLockTouchHandler(shouldLock);

        // --- Force le Reel DM a rester full-viewport ---------------------
        //
        // Diagnostic via Safari Web Inspector :
        //
        //   Parent 5 (position:absolute) a h=665 au lieu de ~740
        //   (viewport). La video et ses parents 0-4 font h=735, mais
        //   parent 5 les clippe → bande noire en bas.
        //
        //   Variable CSS --x-width: calc(90vh * 9/16) donne ~374px
        //   au lieu de 393px (viewport width) → bande noire a droite.
        //
        // Fix cible :
        //   1. Override --x-width a 100vw sur la video
        //   2. Remonter du video jusqu'au premier ancetre position:
        //      absolute et forcer ses dimensions a 100vw x 100vh
        //   3. Forcer les conteneurs intermediaires aussi
        // Forcing UNIQUEMENT sur la largeur des ancetres. Sans ca,
        // Instagram utilise --x-width: calc(90vh * 9/16) qui donne un
        // conteneur plus etroit que le viewport (ex: 374 vs 393px),
        // ce qui colle les boutons d'action au bord du conteneur et
        // les rend partiellement caches derriere la bande noire.
        //
        // On ne touche PAS a la hauteur (sinon on re-casse l'affichage
        // du header ami au-dessus du Reel, fix trouve en Alpha 4.1).
        if (shouldLock) {
          var vids = document.querySelectorAll('video');
          for (var vi = 0; vi < vids.length; vi++) {
            if (vids[vi].offsetHeight >= 200) {
              var ancestor = vids[vi].parentElement;
              var ad = 0;
              while (ancestor && ancestor !== document.body && ad < 12) {
                ancestor.style.setProperty('min-width', '100vw', 'important');
                ancestor.style.setProperty('max-width', 'none', 'important');
                ancestor.style.setProperty('--x-width', '100vw');
                ancestor.style.setProperty('--x-maxWidth', '100vw');
                ancestor = ancestor.parentElement;
                ad++;
              }
              break;
            }
          }
        }

        // --- Fix scroll position sur DM Reel ----------------------------
        //
        // Instagram ouvre les DM Reels avec un scrollTop > 0, ce qui
        // pousse le header (photo + nom de l'ami) au-dessus de la zone
        // visible. On force scrollTop = 0 sur le document et tous les
        // scrollable parents pour ramener le contenu au tout début.
        // On ne le fait qu'UNE FOIS par activation (flag reelScrollReset).
        if (shouldLock && !reelScrollReset) {
          reelScrollReset = true;
          try {
            window.scrollTo(0, 0);
            if (document.scrollingElement) {
              document.scrollingElement.scrollTop = 0;
            }
            // Cherche aussi le premier parent scrollable et reset
            var vids2 = document.querySelectorAll('video');
            for (var vs = 0; vs < vids2.length; vs++) {
              if (vids2[vs].offsetHeight >= 200) {
                var scrollParent = vids2[vs].parentElement;
                var sp = 0;
                while (scrollParent && scrollParent !== document.body && sp < 12) {
                  if (scrollParent.scrollTop > 0) {
                    scrollParent.scrollTop = 0;
                  }
                  scrollParent = scrollParent.parentElement;
                  sp++;
                }
                break;
              }
            }
          } catch (e) {}
        }
        if (!shouldLock) {
          reelScrollReset = false;
        }

        // Etat vide de la loupe Instagram : pose uniquement quand on
        // est sur /explore/ sans recherche active. La classe est lue
        // par le CSS pour masquer les spinners et reveler le message.
        var showExploreEmpty = isExploreRoute() && !isExploreSearchActive();
        document.body.classList.toggle('authentique-on-explore-idle', showExploreEmpty);
        // Synchronise le flag de blocage tactile du scroll sur /explore/.
        exploreScrollBlocked = showExploreEmpty;

        // --- Signalement du flag "on explore" vers React Native ------
        //
        // On informe la couche RN quand on ENTRE ou SORT de la route
        // /explore/ pour qu'elle puisse toggler la prop
        // pullToRefreshEnabled du WebView en consequence. Le but : le
        // natif iOS UIRefreshControl est totalement retire quand on
        // est sur Explore (donc pas de reload possible qui flashait
        // du contenu non filtre), et reactive des qu'on en sort.
        //
        // On n'emet un message QUE quand l'etat change, pas a chaque
        // tick de poll, pour limiter le bruit sur le pont JS<->RN.
        var nowOnExplore = isExploreRoute();
        if (nowOnExplore !== lastReportedOnExplore) {
          lastReportedOnExplore = nowOnExplore;
          post({ type: 'route-explore-changed', isOnExplore: nowOnExplore });
        }
      }

      // --- Reels card detection (filtre contextuel "Suivre") -------------
      //
      // Nouvelle heuristique, version 2 : on passe par les elements
      // <video> de la page. Instagram Reels mobile web n'utilise PAS de
      // balise <article>, donc toute detection basee sur article/role
      // tombait sur zero resultat en production et le filtre etait
      // invisible. A la place :
      //
      //   1. Pour chaque <video> presente dans le DOM,
      //   2. On remonte l'arbre des ancetres jusqu'a trouver le plus
      //      petit conteneur qui contient exactement une <video> ET
      //      qui ressemble a une reel card (hauteur substantielle).
      //   3. Si cette card expose un vrai bouton <button>/role=button
      //      avec textContent === "Suivre"/"Follow", on la masque
      //      (display: none pour que le swipe avance au Reel suivant).
      //
      // Fail-safe : si on trouve aucune <video>, on ne masque rien.
      // Si on trouve une card mais pas de bouton Suivre dedans, c'est
      // soit un ami soit un compte qu'Instagram ne nous propose pas
      // comme nouveau follow -> on la laisse visible. Meilleur a se
      // tromper en faveur de l'affichage qu'en faveur du masquage.
      function findReelCardFromVideo(video) {
        if (!video) { return null; }
        var el = video.parentElement;
        var minHeight = Math.max(200, window.innerHeight * 0.4);
        // Une card ne doit pas depasser 1.3 viewport — sinon elle
        // englobe probablement deja le reel suivant ou une sidebar de
        // suggestions, ce qui fait capter par erreur un bouton Suivre
        // qui n'appartient pas a la video de depart.
        var maxHeight = window.innerHeight * 1.3;

        while (el && el !== document.body) {
          // Jamais au-dessus de main / role=main : c'est le conteneur
          // racine du feed et son bouton Suivre (s'il y en a un) viendrait
          // forcement d'un autre reel.
          if (el.tagName === 'MAIN') { return null; }
          if (el.getAttribute && el.getAttribute('role') === 'main') { return null; }

          // La card doit contenir exactement 1 video (celle de depart).
          // Si elle en contient 2+, on est deja trop haut et on arrete.
          var videoCount = 0;
          if (el.querySelectorAll) {
            videoCount = el.querySelectorAll('video').length;
          }
          if (videoCount > 1) { return null; }

          // Double borne sur la hauteur : la card doit etre substantielle
          // (pour ne pas capter une mini-thumbnail) ET raisonnable (pas
          // un conteneur de plusieurs viewports empiles).
          var h = el.offsetHeight;
          if (h >= minHeight && h <= maxHeight) {
            return el;
          }

          el = el.parentElement;
        }
        return null;
      }

      /**
       * Est-ce que la card expose un bouton "Suivre" legitime ?
       *
       * Version stricte pour reduire les faux positifs :
       *  - Seuls les vrais elements interactifs (<button> ou role=button)
       *    sont consideres — un simple <span>Suivre</span> ne suffit pas.
       *  - Le bouton doit etre visible : offsetWidth > 0, offsetHeight > 0,
       *    pas d'attribut hidden. Ca elimine les templates caches par
       *    Instagram qui contiennent le mot "Suivre" mais ne sont pas
       *    affiches.
       *
       * Note historique : un commit precedent ajoutait une borne
       * positionnelle "le bouton doit etre dans la moitie superieure de
       * la card" en partant du principe que le Follow button est toujours
       * colle au username, qui est en haut. C'est FAUX sur Instagram
       * Reels web mobile : le username (et donc le Follow button) flotte
       * en BAS-GAUCHE du video, pas en haut. La borne rejetait donc les
       * seuls matches legitimes et aucun Reel non-ami n'etait masque.
       * On s'appuie desormais uniquement sur la visibilite et le match
       * textuel strict. findReelCardFromVideo garde la contrainte de
       * "exactement 1 video par card", ce qui suffit a isoler le bouton
       * au reel courant.
       */
      function cardHasFollowButton(card) {
        if (!card) { return false; }
        var buttons = card.querySelectorAll('button, [role="button"]');
        for (var i = 0; i < buttons.length; i++) {
          var btn = buttons[i];
          if (btn.offsetWidth === 0 || btn.offsetHeight === 0) { continue; }
          if (btn.hasAttribute && btn.hasAttribute('hidden')) { continue; }

          var t = (btn.textContent || '').trim();
          var label = btn.getAttribute && btn.getAttribute('aria-label');
          for (var j = 0; j < FOLLOW_NEEDLES.length; j++) {
            if (t === FOLLOW_NEEDLES[j]) { return true; }
            if (label && label === FOLLOW_NEEDLES[j]) { return true; }
          }
        }
        return false;
      }

      /**
       * Est-ce qu'il y a au moins un Reel visible a l'ecran ?
       * Parcourt toutes les <video>, pour chacune verifie qu'aucun
       * ancetre n'est marque .authentique-hidden / .authentique-hidden-flow
       * et que la video a une taille substantielle. Utilise par
       * updateRouteMarker pour decider si on affiche l'overlay
       * "En attente d'un Reel de tes amis...".
       */
      function hasVisibleReelInPage() {
        var videos = document.querySelectorAll('video');
        for (var i = 0; i < videos.length; i++) {
          var v = videos[i];
          if (v.offsetHeight < 200) { continue; }
          var hidden = false;
          var el = v;
          while (el && el !== document.body) {
            if (el.classList && (
                el.classList.contains('authentique-hidden') ||
                el.classList.contains('authentique-hidden-flow'))) {
              hidden = true;
              break;
            }
            el = el.parentElement;
          }
          if (!hidden) { return true; }
        }
        return false;
      }

      /**
       * Est-ce qu'un Reel-modal est actuellement ouvert dans la
       * messagerie ? Instagram n'ouvre PAS un Reel partage en DM via
       * /reel/<id>/ ; il garde la route /direct/... et affiche le Reel
       * dans un overlay fullscreen. On detecte cet etat par la
       * presence d'une <video> qui couvre la majorite du viewport
       * combinee a la route /direct/.
       */
      function isDMReelOverlayOpen() {
        if (!isDirectRoute()) { return false; }
        var videos = document.querySelectorAll('video');
        for (var i = 0; i < videos.length; i++) {
          var rect = videos[i].getBoundingClientRect ? videos[i].getBoundingClientRect() : null;
          if (!rect) { continue; }
          if (rect.width >= window.innerWidth * 0.5 && rect.height >= window.innerHeight * 0.4) {
            return true;
          }
        }
        return false;
      }

      /**
       * Detection simplifiee : est-ce que le Reel ACTUELLEMENT
       * visible a l'ecran est d'un non-ami ?
       *
       * Au lieu de chercher des conteneurs DOM (findReelCardFromVideo)
       * qui causaient des faux positifs, on regarde simplement si un
       * bouton "Suivre"/"Follow" est VISIBLE dans le viewport. Sur
       * la page Reels, le Reel courant remplit l'ecran, et son bouton
       * "Suivre" (s'il y en a un) est affiche en bas pres du pseudo.
       *
       * Si un tel bouton est trouve -> non-ami -> overlay opaque.
       * Si pas trouve -> ami (ou rien de charge) -> pas d'overlay.
       */
      function isCurrentReelNonFriend() {
        var buttons = document.querySelectorAll('button, [role="button"]');
        for (var i = 0; i < buttons.length; i++) {
          var btn = buttons[i];
          if (btn.offsetWidth === 0 || btn.offsetHeight === 0) { continue; }
          // Le bouton doit etre dans le viewport visible
          var rect = btn.getBoundingClientRect ? btn.getBoundingClientRect() : null;
          if (!rect) { continue; }
          if (rect.bottom < 0 || rect.top > window.innerHeight) { continue; }
          if (rect.right < 0 || rect.left > window.innerWidth) { continue; }

          var t = (btn.textContent || '').trim();
          for (var j = 0; j < FOLLOW_NEEDLES.length; j++) {
            if (t === FOLLOW_NEEDLES[j]) { return true; }
          }
        }
        return false;
      }

      function scanReelsFullscreen() {
        // Le filtrage des Reels non-amis est gere par l'overlay
        // dynamique dans updateRouteMarker via isCurrentReelNonFriend.
        // Plus de manipulation DOM (display:none) sur les cards.
        return;
      }

      // --- Filtre Explore (loupe Instagram) ------------------------------
      //
      // Idle (pas de recherche en cours) : on masque tout le grid de
      // contenu suggere pour ne garder visible que la barre de recherche.
      // Search (recherche en cours) : on masque uniquement les liens
      // /reel/ dans les resultats, on garde les comptes et les posts.
      function scanExplore() {
        if (!isExploreRoute()) { return; }
        var searchActive = isExploreSearchActive();
        if (!searchActive) {
          hideExploreIdleGrid();
        } else {
          hideReelsInSearchResults();
        }
      }

      function hideExploreIdleGrid() {
        // On identifie la grille en trouvant tous les liens vers /p/ ou
        // /reel/ dans le main, puis en remontant vers leur ancetre
        // commun raisonnable (qui n'est pas main lui-meme).
        var main = document.querySelector('main') || document.querySelector('[role="main"]');
        if (!main) { return; }
        var links = main.querySelectorAll('a[href^="/p/"], a[href^="/reel/"]');
        if (links.length === 0) { return; }
        // On se contente de masquer individuellement chaque lien : pas
        // besoin de chercher un gros conteneur (risque de false positive).
        for (var i = 0; i < links.length; i++) {
          var link = links[i];
          if (link.classList.contains('authentique-hidden')) { continue; }
          // On remonte de 2 niveaux pour masquer la cellule de grille
          // plutot que juste le lien, ce qui evite les cases vides.
          var cell = link.parentElement && link.parentElement.parentElement ?
                     link.parentElement.parentElement : link;
          // Safety : ne jamais masquer main lui-meme.
          if (cell === main || (cell.contains && cell.contains(main))) {
            hide(link, 'explore-idle');
          } else {
            hide(cell, 'explore-idle');
          }
        }
      }

      function hideReelsInSearchResults() {
        var reelLinks = document.querySelectorAll('a[href^="/reel/"]:not(.authentique-hidden), a[href*="/reel/"]:not(.authentique-hidden)');
        for (var i = 0; i < reelLinks.length; i++) {
          var link = reelLinks[i];
          // Masquer la cellule de resultat, pas juste le lien
          var cell = link.parentElement && link.parentElement.parentElement ?
                     link.parentElement.parentElement : link;
          hide(cell, 'reel-in-search');
        }
      }

      // --- Filtre messagerie ---------------------------------------------
      // Dans la messagerie Instagram, on masque les blocs de canaux
      // suggeres et de contenu suggere, qui polluent l'inbox mais aussi
      // les Reel-modals (quand un ami partage un Reel en DM, Instagram
      // lazy-load des Reels algorithmiques supplementaires sous la
      // vignette sous un header "Suggestions").
      //
      // On a ajoute "Suggestions" seul a la liste parce que c'est
      // exactement le header qu'Instagram utilise dans ce cas. Risque
      // de false positive faible parce qu'on ne matche que sur route
      // /direct/..., ou "Suggestions" en tant que tel n'a aucune place
      // legitime.
      var DM_SUGGESTED_NEEDLES = [
        'Suggestions',
        'Canaux suggérés',
        'Suggested channels',
        'Canaux',
        'Channels',
        'Contenus suggérés',
        'Suggested content',
        'Suggestions de messages',
        'Messages suggérés',
        'Suggestions pour vous',
        'Suggested for you',
      ];

      function scanDirectSuggestions() {
        if (!isDirectRoute()) { return; }
        if (!prefs.hideSuggestions) { return; }

        // On NE scanne PAS quand on est dans un thread de conversation
        // (/direct/t/<thread_id>/). A l'interieur d'un thread, il n'y
        // a aucun canal suggere a masquer, et scanner les messages est
        // une mauvaise idee pour deux raisons : (1) ca ralentit Instagram
        // a chaque mutation (typing indicator, nouveau message), et (2)
        // un match accidentel peut hide le contenu d'un message et
        // laisser des bulles vides (on l'a vu en production avec le
        // pattern span-based).
        var p = location.pathname || '';
        if (p.indexOf('/direct/t/') === 0) { return; }

        // Selecteur restreint aux vrais headings. L'ancienne version
        // incluait 'span' ce qui faisait matcher n'importe quel span
        // avec un texte court, y compris le contenu de certains
        // messages — bug qui laissait les bulles vides.
        var headings = document.querySelectorAll('h2, h3, h4, [role="heading"]');
        for (var i = 0; i < headings.length; i++) {
          var h = headings[i];
          if (h.children && h.children.length > 1) { continue; }
          var t = (h.textContent || '').trim();
          if (!t || t.length > 40) { continue; }
          var matched = false;
          for (var j = 0; j < DM_SUGGESTED_NEEDLES.length; j++) {
            if (t === DM_SUGGESTED_NEEDLES[j]) { matched = true; break; }
          }
          if (matched) {
            // Walk-up plus agressif : on remonte jusqu'a un conteneur
            // substantiel (hauteur > 150px) ou jusqu'a 6 parents, sans
            // jamais toucher a main / document.body.
            var container = h.parentElement;
            var mainEl = document.querySelector('main') || document.querySelector('[role="main"]');
            var depth = 0;
            while (container && container !== document.body && depth < 6) {
              if (container === mainEl) { container = null; break; }
              if (mainEl && container.contains(mainEl)) { container = null; break; }
              if (container.offsetHeight >= 150) { break; }
              container = container.parentElement;
              depth++;
            }
            if (container && container !== document.body) {
              hide(container, 'dm-suggestion');
            }
          }
        }
      }

      function closeOpenInAppBanners() {
        var candidates = document.querySelectorAll(
          'div[role="dialog"]:not(.authentique-hidden), ' +
          'div[role="banner"]:not(.authentique-hidden), ' +
          'div[data-visualcompletion="ignore-dynamic"]:not(.authentique-hidden)'
        );
        for (var i = 0; i < candidates.length; i++) {
          var el = candidates[i];
          var text = (el.textContent || '');
          for (var j = 0; j < OPEN_APP_NEEDLES.length; j++) {
            if (text.indexOf(OPEN_APP_NEEDLES[j]) !== -1) {
              hide(el, 'open-in-app');
              break;
            }
          }
        }
      }

      // Note : une version precedente basculait automatiquement le fil
      // home d'Instagram de "Pour vous" vers "Suivi(e)" via une
      // simulation de click sur le dropdown. Retire en concertation
      // avec l'utilisateur : "Pour vous" est bien filtree par nos
      // scanners (pubs, suggestions, reels, etc.) et garde des
      // avantages legitimes (la story personnelle reste visible en
      // haut pour voir les reactions). Aucun benefice a forcer la
      // bascule. Le code est supprime pour ne pas laisser une
      // dependance fragile sur des labels Instagram qui changent
      // regulierement ("Abonnements" -> "Suivi(e)" en 2024).

      function fullScan() {
        if (!document.body) { return; }
        updateRouteMarker();
        scanSponsored();
        scanSuggestions();
        scanReels();
        scanReelsFullscreen();
        scanExplore();
        scanDirectSuggestions();
        // scanReelOverlaySuggestions retire — approche table rase.
        closeOpenInAppBanners();
      }

      // --- Scanner "Suggestions" sous un Reel DM -----------------------
      // Quand un ami nous partage un Reel en DM et qu'on l'ouvre, Instagram
      // charge aussi les reels suivants en-dessous sous un header
      // "Suggestions" ou "Plus de Reels". On les masque pour que
      /**
       * Injecte l'overlay "En attente d'un Reel de tes amis..." dans
       * le body. Le div existe en permanence mais reste cache par defaut
       * via CSS. La classe body.authentique-on-reels (posee par
       * updateRouteMarker) le rend visible seulement quand on est sur
       * /reels/ et qu'aucune card Reel n'est affichee au-dessus.
       */
      function injectReelsWaitingOverlay() {
        if (document.getElementById('authentique-reels-waiting')) { return; }
        var overlay = document.createElement('div');
        overlay.id = 'authentique-reels-waiting';
        overlay.className = 'authentique-reels-waiting';

        var title = document.createElement('span');
        title.style.cssText = 'display:block; font-size:16px; font-weight:600; margin-bottom:12px;';
        title.textContent = "L'onglet Reels, c'est le territoire de Meta.";

        var body1 = document.createElement('span');
        body1.style.cssText = 'display:block; font-size:13px; color:rgba(255,255,255,0.7); line-height:1.5; margin-bottom:8px;';
        body1.textContent = "Cet onglet ne propose quasiment que du contenu algorithmique. Authentique n'a pas à le conquérir.";

        var body2 = document.createElement('span');
        body2.style.cssText = 'display:block; font-size:13px; color:rgba(255,255,255,0.7); line-height:1.5;';
        body2.textContent = "Les Reels de tes amis apparaissent dans ton fil d'actualité.";

        overlay.appendChild(title);
        overlay.appendChild(body1);
        overlay.appendChild(body2);
        (document.body || document.documentElement).appendChild(overlay);
      }

      /**
       * Injecte le message "etat vide" de la loupe Instagram. Meme
       * principe que l'overlay Reels : un div injecte une seule fois
       * dans body, cache par defaut, rendu visible par la classe
       * body.authentique-on-explore-idle posee par updateRouteMarker.
       *
       * Le texte est volontairement calme et un peu poetique : clin
       * d'oeil a la philosophie d'Authentique qui prefere le vide au
       * contenu impose par l'algo.
       */
      function injectExploreEmptyState() {
        if (document.getElementById('authentique-explore-empty')) { return; }
        var wrapper = document.createElement('div');
        wrapper.id = 'authentique-explore-empty';
        wrapper.className = 'authentique-explore-empty';

        var title = document.createElement('span');
        title.className = 'authentique-explore-empty-title';
        title.textContent = 'Rien à voir.';

        var body = document.createElement('span');
        body.className = 'authentique-explore-empty-body';
        body.textContent = "Et c'est exactement ce qu'on voulait. Tape ce que tu cherches dans la barre ci-dessus.";

        wrapper.appendChild(title);
        wrapper.appendChild(body);
        (document.body || document.documentElement).appendChild(wrapper);
      }

      // --- Hot reload des préférences --------------------------------------

      window.__authentiqueUpdatePrefs = function(newPrefs) {
        prefs = newPrefs;
        // Un nouveau scan suffit a repercuter les preferences car les
        // fonctions de scan lisent toujours la variable prefs courante.
        fullScan();
      };

      // --- Démarrage -------------------------------------------------------

      /**
       * Handler touchmove pose une fois au demarrage. Quand
       * body.authentique-reel-locked est actif, on intercepte les
       * swipes verticaux et on fait preventDefault() pour empecher le
       * scroll — quel que soit le scroll container utilise par
       * Instagram. Ca complete les regles CSS (overflow:hidden,
       * touch-action:pan-x) pour les cas ou Instagram a son propre
       * scroll container qui bypass les ancetres.
       *
       * On mesure la distance depuis le touchstart : si le mouvement
       * est principalement vertical (delta Y > delta X), on bloque.
       * Les taps purs (delta < 6) passent toujours pour que le
       * play/pause du video fonctionne.
       */
      //
      // Handler touchmove attache DYNAMIQUEMENT via syncReelLockTouchHandler.
      //
      // Historique : on l'attachait en permanence au demarrage, avec un
      // check .contains('authentique-reel-locked') a chaque event. Ca
      // marche, mais touchmove est un event tres bruyant (60+ par seconde
      // pendant un scroll). Meme un check trivial qui ne fait rien,
      // multiplie par 60+ events/s, contribue au jank du scroll principal.
      //
      // La version attachee dynamiquement retire completement le listener
      // quand on n'est pas dans un contexte reel-locked — zero overhead
      // sur le scroll normal. On le reattache quand updateRouteMarker()
      // detecte qu'on vient d'entrer dans /reel/:id ou dans un DM reel
      // modal.
      var _touchStartX = 0;
      var _touchStartY = 0;
      var _reelLockHandlerAttached = false;

      function _onReelTouchStart(e) {
        if (e.touches && e.touches.length === 1) {
          _touchStartX = e.touches[0].clientX;
          _touchStartY = e.touches[0].clientY;
        }
      }

      function _onReelTouchMove(e) {
        if (!e.touches || e.touches.length !== 1) { return; }
        var dx = e.touches[0].clientX - _touchStartX;
        var dy = e.touches[0].clientY - _touchStartY;
        // On bloque TOUT mouvement qui depasse un seuil minimal (6px).
        // L'ancienne version ne bloquait que les gestes principalement
        // verticaux (dy > dx), mais un swipe horizontal suivi d'un
        // changement de direction vertical contournait la protection
        // et permettait de scroller vers les Reels algorithmiques.
        // En DM Reel, il n'y a aucune raison de laisser passer un
        // swipe horizontal non plus (pas de stories, pas de carousel).
        if (Math.abs(dy) > 6 || Math.abs(dx) > 6) {
          try { e.preventDefault(); } catch (err) {}
        }
      }

      function syncReelLockTouchHandler(shouldBeAttached) {
        if (shouldBeAttached && !_reelLockHandlerAttached) {
          document.addEventListener('touchstart', _onReelTouchStart, { passive: true });
          document.addEventListener('touchmove', _onReelTouchMove, { passive: false });
          _reelLockHandlerAttached = true;
        } else if (!shouldBeAttached && _reelLockHandlerAttached) {
          document.removeEventListener('touchstart', _onReelTouchStart);
          document.removeEventListener('touchmove', _onReelTouchMove);
          _reelLockHandlerAttached = false;
        }
      }

      // --- Swipe horizontal pour naviguer entre onglets Instagram -----
      //
      // L'app native Instagram supporte le swipe horizontal pour passer
      // d'un onglet a l'autre (home -> search -> reels -> direct -> profil).
      // Mobile web ne l'a qu'en edge-swipe via la nav "back/forward" iOS.
      // On implemente une version centrale : si l'utilisateur swipe
      // horizontalement > 80px sur une page "root" (pas un post detail,
      // pas une story, pas un reel fullscreen), on clique programmatiquement
      // le lien de l'onglet cible dans la bottom nav d'Instagram.
      //
      // --- Blocage tactile du scroll sur /explore/ idle ----------------
      //
      // Ni overflow:hidden ni position:fixed sur body ne bloquent le
      // scroll sur Instagram mobile web parce qu'Instagram fait defiler
      // un conteneur interne (pas body). La seule methode fiable sur
      // iOS WKWebView : intercepter touchmove en capture phase avec
      // passive:false et appeler preventDefault().
      //
      // Le flag est synchronise par updateRouteMarker a chaque tick
      // (et par la boucle rAF ci-dessous pour la detection instantanee).
      var exploreScrollBlocked = false;

      function installExploreScrollBlock() {
        document.addEventListener('touchmove', function(e) {
          if (exploreScrollBlocked) {
            try { e.preventDefault(); } catch (err) {}
          }
        }, { passive: false, capture: true });
      }

      function start() {
        injectReelsWaitingOverlay();
        injectExploreEmptyState();
        installExploreScrollBlock();
        // Premier full scan : updateRouteMarker + tous les scanners
        // (sponsored, suggestions, reels, explore, DM, etc.).
        fullScan();

        // ------------------------------------------------------------------
        // STRATEGIE DE SCAN — POLLING + SKIP PENDANT SCROLL ACTIF
        // ------------------------------------------------------------------
        // Historique : setInterval(fullScan, 500) tournait en permanence.
        // Ca scannait 2 fois par seconde meme en plein scroll utilisateur,
        // ce qui causait un jank perceptible (querySelectorAll sur tous les
        // articles/headings/videos a chaque tick).
        //
        // Version actuelle : on detecte le scroll actif (evenement 'scroll'
        // sur window ou sur tout element). Tant que scrollActiveUntil est
        // dans le futur, fullScan skip completement. Apres 150ms sans
        // nouvel evenement scroll, on reprend le polling normal.
        //
        // Trade-off : un nouveau post charge par Instagram pendant que tu
        // scrolles n'est filtre qu'apres l'arret du scroll (+ 150ms + 500ms).
        // Mais le scroll lui-meme est aussi fluide que sur Instagram web.
        // ------------------------------------------------------------------
        var scrollActiveUntil = 0;
        var SCROLL_QUIET_MS = 150;
        // Un handler scroll passif, pose en capture pour attraper tous
        // les scroll containers, y compris ceux qu'Instagram utilise
        // (certains posts ou sections ont leur propre scroll interne).
        document.addEventListener('scroll', function() {
          scrollActiveUntil = Date.now() + SCROLL_QUIET_MS;
        }, { passive: true, capture: true });

        setInterval(function() {
          if (Date.now() < scrollActiveUntil) { return; }
          fullScan();
        }, 500);

        // Check périodique separement pour les bandeaux qui apparaissent
        // en différé (install app) et le marqueur de route sur navigations
        // SPA. Frequence plus basse car ces operations sont plus legeres.
        setInterval(function() {
          closeOpenInAppBanners();
          updateRouteMarker();
        }, 1500);

        // Re-scan immediat sur navigation (popstate) pour ne pas attendre
        // le prochain tick du poll.
        window.addEventListener('popstate', function() {
          fullScan();
        });

        // --- Detection instantanee des navigations SPA ---------------
        //
        // Instagram utilise history.pushState / replaceState pour ses
        // navigations internes (changement d'onglet, ouverture d'un
        // post, etc.). popstate ne fire PAS sur pushState — il ne fire
        // que sur back/forward du navigateur. Resultat : quand
        // l'utilisateur tape sur l'onglet Explore, notre poll met
        // jusqu'a 500ms a detecter la nouvelle route, et pendant ce
        // delai le contenu explore est visible en flash.
        //
        // Fix : on monkey-patch pushState et replaceState pour lancer
        // un fullScan synchrone juste apres chaque navigation. Le
        // body class authentique-on-explore-idle est pose dans les
        // microsecondes qui suivent la navigation, avant meme que le
        // paint suivant ne se produise. Zero flash.
        var origPushState = history.pushState;
        var origReplaceState = history.replaceState;
        history.pushState = function() {
          origPushState.apply(this, arguments);
          try { fullScan(); } catch (e) {}
        };
        history.replaceState = function() {
          origReplaceState.apply(this, arguments);
          try { fullScan(); } catch (e) {}
        };

        // --- Detection de route par requestAnimationFrame -------------
        //
        // Filet de securite en plus du monkey-patch pushState : on
        // verifie le pathname a chaque frame (~16ms = 60fps). Si le
        // path a change (par un mecanisme qu'on n'aurait pas intercepte),
        // on lance updateRouteMarker immediatement. Le cout est negligeable
        // (une comparaison de string par frame).
        var rAFLastPath = location.pathname || '';
        function rAFRouteCheck() {
          var p = location.pathname || '';
          if (p !== rAFLastPath) {
            rAFLastPath = p;
            try { updateRouteMarker(); } catch (e) {}
          }
          requestAnimationFrame(rAFRouteCheck);
        }
        requestAnimationFrame(rAFRouteCheck);

        post({ type: 'ready', platform: 'instagram' });
      }

      if (document.body) {
        start();
      } else {
        document.addEventListener('DOMContentLoaded', start);
      }
    })();
    true; // noqa: requis par WebView pour éviter un warning sur iOS
  `;

  return { css, js };
}
