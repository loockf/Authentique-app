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

    ${prefs.hideLikeCounts
      ? `
    /* Compteurs de likes — on masque via classe appliquée par notre script */
    .authentique-hide-likes { visibility: hidden !important; }
    `
      : ''}

    ${prefs.focusMode
      ? `
    /* Mode Focus : on atténue les icônes d'action */
    section[role="group"] > div > div > svg {
      opacity: 0.25 !important;
    }
    `
      : ''}

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
      left: 50%;
      top: 45%;
      transform: translate(-50%, -50%);
      padding: 12px 20px;
      background: rgba(0, 0, 0, 0.65);
      color: rgba(255, 255, 255, 0.92);
      border-radius: 10px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 14px;
      line-height: 1.4;
      text-align: center;
      pointer-events: none;
      z-index: 0;
      letter-spacing: 0.2px;
      max-width: 80%;
    }
    body.authentique-on-reels .authentique-reels-waiting {
      display: block;
    }

    /* -----------------------------------------------------------------
       Lock vertical swipe sur un Reel individuel
       -----------------------------------------------------------------
       Quand un Reel est ouvert depuis la messagerie ou depuis un lien
       partage, Instagram le sert sur /reel/<id>/ (URL singulier, sans
       le "s"), et un swipe vertical fait basculer dans le fil
       algorithmique /reels/ juste apres. C'est exactement ce qu'on
       veut eviter : l'utilisateur doit pouvoir regarder le Reel
       partage et le fermer, pas tomber dans l'algo.

       La classe body.authentique-reel-locked est posee par le JS du
       commit 3 sur le pathname /reel/:id uniquement. Elle bloque
       l'overflow vertical du body et du <main>, ce qui tue le scroll
       qu'Instagram utilise pour sa snap-pagination entre Reels
       successifs. Les taps (play/pause, like) et les gestes
       horizontaux (swipe-right pour revenir) restent actifs.
       ----------------------------------------------------------------- */
    body.authentique-reel-locked,
    body.authentique-reel-locked main,
    body.authentique-reel-locked [role="main"] {
      overflow: hidden !important;
      overscroll-behavior: none !important;
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

      // --- Helpers ---------------------------------------------------------

      function post(message) {
        try {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify(message));
          }
        } catch (e) {}
      }

      function hide(el, reason) {
        if (!el || el.classList.contains('authentique-hidden')) { return false; }
        el.classList.add('authentique-hidden');
        el.setAttribute('data-authentique-reason', reason);
        hiddenCount++;
        post({ type: 'hidden-count', count: hiddenCount });
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
        hiddenCount++;
        post({ type: 'hidden-count', count: hiddenCount });
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
      function scanSponsored() {
        if (!prefs.hideAds) { return; }
        // Les posts du fil sont masques avec hideInFlow() pour que
        // l'IntersectionObserver d'Instagram continue a declencher le
        // lazy-load des posts suivants. display:none casserait l'infinite
        // scroll et creerait un grand blanc en bas de feed.
        var articles = document.querySelectorAll(
          'article:not(.authentique-hidden):not(.authentique-hidden-flow), ' +
          '[role="article"]:not(.authentique-hidden):not(.authentique-hidden-flow)'
        );
        for (var i = 0; i < articles.length; i++) {
          var art = articles[i];
          if (containsText(art, SPONSORED_NEEDLES) || containsAttributeText(art, SPONSORED_NEEDLES)) {
            hideInFlow(art, 'sponsored');
          }
        }
      }

      function scanSuggestions() {
        if (!prefs.hideSuggestions) { return; }
        var headings = document.querySelectorAll('h2, h3, h4, span');
        for (var j = 0; j < headings.length; j++) {
          var h = headings[j];
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

      function scanLikeCounts() {
        if (!prefs.hideLikeCounts) { return; }
        var likeLinks = document.querySelectorAll('a[href$="/liked_by/"], a[href*="/liked_by/"] span');
        for (var l = 0; l < likeLinks.length; l++) {
          var btn = likeLinks[l];
          if (!btn.classList.contains('authentique-hide-likes')) {
            btn.classList.add('authentique-hide-likes');
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
        // Une recherche est active quand l'URL contient /search/ ou q=,
        // ou quand l'input de recherche a une valeur non vide.
        if (!isExploreRoute()) { return false; }
        var p = location.pathname || '';
        if (p.indexOf('/search') !== -1) { return true; }
        var q = location.search || '';
        if (q.indexOf('q=') !== -1) { return true; }
        var input = findExploreSearchInput();
        return !!(input && input.value && input.value.length > 0);
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
        // L'overlay "En attente d'un Reel de tes amis..." n'est pertinent
        // que sur le fil /reels/ (plural). Sur /reel/:id on laisse l'UI
        // normale et on se contente de lock le swipe vertical.
        document.body.classList.toggle('authentique-on-reels', isReelsFeedRoute());
        // Le lock du swipe vertical est applique UNIQUEMENT sur la route
        // Reel individuel pour ne pas casser le fil algorithmique de
        // /reels/ qui reste swipable par choix de l'utilisateur.
        document.body.classList.toggle('authentique-reel-locked', isIndividualReelRoute());
      }

      // --- Reels card detection (filtre contextuel "Suivre") -------------
      //
      // Version stricte : on ne cherche plus un bouton "Suivre" dans tout
      // le document et on ne remonte plus vers un ancetre "gros". On
      // commence par lister les cards via selecteurs strictes, puis on
      // verifie, dans le sous-arbre de chaque card, si elle contient un
      // vrai bouton (tagName BUTTON ou role="button") avec textContent
      // strictement egal a "Suivre"/"Follow". C'est le fail-safe critique :
      // si Instagram change de structure, on trouve zero card et on ne
      // masque rien au lieu de tout masquer (comportement precedent).
      function findReelCards() {
        // Selecteurs stricts, dans l'ordre de preference.
        var strict = document.querySelectorAll(
          'main article:not(.authentique-hidden), ' +
          '[role="main"] article:not(.authentique-hidden), ' +
          'main [role="article"]:not(.authentique-hidden), ' +
          '[role="main"] [role="article"]:not(.authentique-hidden)'
        );
        if (strict.length > 0) { return strict; }
        // Fallback tres conservateur : on accepte tous les <article>
        // visibles dans le body, sans jamais remonter vers un div
        // generique parent. Si pas d'article du tout, on rend null
        // et scanReelsFullscreen ne hide rien.
        var fallback = document.querySelectorAll('article:not(.authentique-hidden), [role="article"]:not(.authentique-hidden)');
        return fallback;
      }

      function cardHasFollowButton(card) {
        if (!card) { return false; }
        // Seuls les vrais elements interactifs sont consideres : un
        // simple <span>Suivre</span> ne suffit plus. Meta utilise
        // typiquement <div role="button"> ou <button> pour ce bouton.
        var buttons = card.querySelectorAll('button, [role="button"]');
        for (var i = 0; i < buttons.length; i++) {
          var btn = buttons[i];
          var t = (btn.textContent || '').trim();
          for (var j = 0; j < FOLLOW_NEEDLES.length; j++) {
            if (t === FOLLOW_NEEDLES[j]) { return true; }
          }
          var label = btn.getAttribute && btn.getAttribute('aria-label');
          if (label) {
            for (var k = 0; k < FOLLOW_NEEDLES.length; k++) {
              if (label === FOLLOW_NEEDLES[k]) { return true; }
            }
          }
        }
        return false;
      }

      function scanReelsFullscreen() {
        // Seulement sur le fil /reels/ (algorithmique), pas sur /reel/:id
        // (un Reel individuel qu'on traite via le lock swipe vertical).
        if (!isReelsFeedRoute()) { return; }
        var cards = findReelCards();
        for (var i = 0; i < cards.length; i++) {
          var card = cards[i];
          if (cardHasFollowButton(card)) {
            // Pour les Reels on veut que le swipe avance au suivant, donc
            // on utilise hide() (display:none) et pas hideInFlow().
            hide(card, 'reel-non-ami');
          }
        }
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
      // Dans l'inbox Instagram, on masque les blocs de canaux suggeres
      // et de contenu suggere, qui polluent l'espace entre les vrais
      // threads de messages. On utilise du matching textuel sur les
      // en-tetes typiques.
      var DM_SUGGESTED_NEEDLES = [
        'Canaux suggérés',
        'Suggested channels',
        'Canaux',
        'Channels',
        'Contenus suggérés',
        'Suggested content',
        'Suggestions de messages',
        'Messages suggérés',
      ];

      function scanDirectSuggestions() {
        if (!isDirectRoute()) { return; }
        if (!prefs.hideSuggestions) { return; }
        var headings = document.querySelectorAll('h2, h3, h4, span');
        for (var i = 0; i < headings.length; i++) {
          var h = headings[i];
          var t = (h.textContent || '').trim();
          if (!t || t.length > 60) { continue; }
          var matched = false;
          for (var j = 0; j < DM_SUGGESTED_NEEDLES.length; j++) {
            if (t === DM_SUGGESTED_NEEDLES[j]) { matched = true; break; }
          }
          if (matched) {
            // On remonte jusqu'a un conteneur de section : grand-parent
            // ou arriere-grand-parent du heading. Pas de fallback vers
            // main pour eviter de tout masquer.
            var container = h.parentElement;
            if (container && container.parentElement) { container = container.parentElement; }
            if (container && container.parentElement) { container = container.parentElement; }
            if (container && container !== document.body) {
              var main = document.querySelector('main');
              if (container !== main && !container.contains(main || document.body)) {
                hide(container, 'dm-suggestion');
              }
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

      /**
       * Tente de basculer de "Pour vous" vers "Abonnements".
       *
       * Version renforcee : on retente au MAXIMUM 3 fois par route visitee
       * (pour ne pas spammer des clics si l'utilisateur a deliberement
       * choisi "Pour vous"), avec un cooldown de 2 secondes entre deux
       * tentatives pour laisser le dropdown apparaitre. Si on est sur une
       * autre route, on reset le compteur pour pouvoir re-tenter quand
       * l'utilisateur revient sur le fil.
       */
      var enforceAttempts = 0;
      var enforceLastAttempt = 0;
      var enforceLastRoute = '';
      function enforceFollowingFeed() {
        var route = location.pathname || '';
        if (route !== enforceLastRoute) {
          enforceLastRoute = route;
          enforceAttempts = 0;
          enforceLastAttempt = 0;
        }
        if (enforceAttempts >= 3) { return; }
        var now = Date.now();
        if (now - enforceLastAttempt < 2000) { return; }

        // On ne tente que sur la home du feed.
        if (route !== '/' && route !== '') { return; }

        var allSpans = document.querySelectorAll('h1, h2, span, div[role="button"]');
        for (var i = 0; i < allSpans.length; i++) {
          var el = allSpans[i];
          var t = (el.textContent || '').trim();
          if (t === 'Pour vous' || t === 'For you' || t === 'Suggestions') {
            enforceAttempts++;
            enforceLastAttempt = now;
            var clickable = el.closest('[role="button"]') || el.parentElement;
            if (!clickable) { return; }
            try {
              clickable.click();
              setTimeout(function() {
                var options = document.querySelectorAll('[role="menuitem"] span, [role="option"] span, div[role="dialog"] span');
                for (var j = 0; j < options.length; j++) {
                  var ot = (options[j].textContent || '').trim();
                  if (ot === 'Abonnements' || ot === 'Following') {
                    var target = options[j].closest('[role="menuitem"]') ||
                                 options[j].closest('[role="option"]') ||
                                 options[j].closest('[role="button"]') ||
                                 options[j];
                    if (target) { target.click(); }
                    break;
                  }
                }
              }, 400);
            } catch (e) {}
            return;
          }
        }
      }

      function fullScan() {
        if (!document.body) { return; }
        updateRouteMarker();
        scanSponsored();
        scanSuggestions();
        scanReels();
        scanLikeCounts();
        scanReelsFullscreen();
        scanExplore();
        scanDirectSuggestions();
        closeOpenInAppBanners();
        enforceFollowingFeed();
      }

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
        overlay.textContent = "En attente d'un Reel de tes amis...";
        (document.body || document.documentElement).appendChild(overlay);
      }

      // --- Hot reload des préférences --------------------------------------

      window.__authentiqueUpdatePrefs = function(newPrefs) {
        prefs = newPrefs;
        // Un nouveau scan suffit a repercuter les preferences car les
        // fonctions de scan lisent toujours la variable prefs courante.
        fullScan();
      };

      // --- Démarrage -------------------------------------------------------

      function start() {
        injectReelsWaitingOverlay();
        // Premier full scan : appelle aussi enforceFollowingFeed() et
        // tous les scanners (sponsored, suggestions, explore, DM, etc.).
        fullScan();

        var observer = new MutationObserver(function(mutations) {
          // On déclenche un fullScan debounce au lieu de scanner chaque mutation
          // individuellement — plus robuste contre les ajouts hors-scope.
          scheduleScan();
        });
        observer.observe(document.body, { childList: true, subtree: true });

        // Check périodique pour les bandeaux qui apparaissent en différé
        // et pour rafraichir le marqueur de route sur navigations SPA.
        setInterval(function() {
          closeOpenInAppBanners();
          updateRouteMarker();
        }, 1500);

        post({ type: 'ready', platform: 'instagram' });
      }

      var scanScheduled = false;
      function scheduleScan() {
        if (scanScheduled) { return; }
        scanScheduled = true;
        // requestAnimationFrame pour batcher les mutations d'un même frame
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(function() {
            scanScheduled = false;
            fullScan();
          });
        } else {
          setTimeout(function() {
            scanScheduled = false;
            fullScan();
          }, 16);
        }
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
