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
 * Nouveautés :
 *  - `window.__authentiqueUpdatePrefs(newPrefs)` pour propager les toggles
 *    des Paramètres vers la WebView à chaud, sans recharger la page.
 *  - Recherche de "Sponsorisé" dans les attributs `aria-label`/`alt` en plus
 *    du texte visible, pour capturer les posts dont le marqueur est caché.
 *  - Suppression du remonté vers `role="presentation"` qui masquait des
 *    conteneurs trop gros et causait des blancs en bas de feed.
 *  - Fermeture agressive du bandeau "Ouvrir dans l'application" par matching
 *    textuel sur toutes ses variantes FR+EN.
 *  - Basculement automatique "Pour vous" → "Abonnements" au premier scan.
 */
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

    /* Classe universelle utilisée par notre JS pour masquer un élément */
    .authentique-hidden {
      display: none !important;
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
      var followingEnforced = false;

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

      var SPONSORED_NEEDLES = [
        'Sponsorisé',
        'Sponsorisée',
        'Sponsored',
        'Partenariat rémunéré',
        'Paid partnership',
      ];
      var SUGGESTED_NEEDLES = [
        'Suggestions pour vous',
        'Suggested for you',
        'Suggested posts',
        'Publications suggérées',
        'Suggéré pour vous',
      ];
      var REELS_NEEDLES = [
        'Reels et plus',
        'Reels and more',
        'Reels suggérés',
        'Suggested reels',
      ];
      var OPEN_APP_NEEDLES = [
        "Ouvrir dans l'application",
        "Ouvrir l'application",
        "Ouvrir Instagram",
        "Voir dans l'application",
        "Continuer dans l'application",
        "Utiliser l'application",
        "Open in app",
        "Open Instagram app",
        "Open Instagram",
        "See in app",
        "Continue in app",
        "Use the app",
        "Get the app",
      ];

      /**
       * Scan global — on cherche à chaque fois dans tout le document, pas
       * seulement dans le noeud muté. C'est légèrement plus coûteux mais
       * évite de rater des éléments ajoutés dans des emplacements imbriqués.
       */
      function scanSponsored() {
        if (!prefs.hideAds) { return; }
        var articles = document.querySelectorAll('article:not(.authentique-hidden), [role="article"]:not(.authentique-hidden)');
        for (var i = 0; i < articles.length; i++) {
          var art = articles[i];
          if (containsText(art, SPONSORED_NEEDLES) || containsAttributeText(art, SPONSORED_NEEDLES)) {
            hide(art, 'sponsored');
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
            if (card) { hide(card, 'suggestion'); }
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
       * Tente de basculer de "Pour vous" vers "Abonnements" au premier chargement.
       * On ne le fait qu'une seule fois pour ne pas interférer si l'utilisateur
       * choisit manuellement "Pour vous".
       */
      function enforceFollowingFeed() {
        if (followingEnforced) { return; }
        var allSpans = document.querySelectorAll('h1, h2, span, div[role="button"]');
        for (var i = 0; i < allSpans.length; i++) {
          var el = allSpans[i];
          var t = (el.textContent || '').trim();
          if (t === 'Pour vous' || t === 'For you' || t === 'Suggestions') {
            followingEnforced = true;
            var clickable = el.closest('[role="button"]') || el.parentElement;
            if (!clickable) { return; }
            try {
              clickable.click();
              setTimeout(function() {
                var options = document.querySelectorAll('[role="menuitem"] span, [role="option"] span, div[role="dialog"] span');
                for (var j = 0; j < options.length; j++) {
                  var ot = (options[j].textContent || '').trim();
                  if (ot === 'Abonnements' || ot === 'Following') {
                    var target = options[j].closest('[role="menuitem"]') || options[j].closest('[role="option"]') || options[j].closest('[role="button"]') || options[j];
                    if (target) { target.click(); }
                    break;
                  }
                }
              }, 350);
            } catch (e) {}
            return;
          }
        }
      }

      function fullScan() {
        if (!document.body) { return; }
        scanSponsored();
        scanSuggestions();
        scanReels();
        scanLikeCounts();
        closeOpenInAppBanners();
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
        fullScan();
        enforceFollowingFeed();

        var observer = new MutationObserver(function(mutations) {
          // On déclenche un fullScan debounce au lieu de scanner chaque mutation
          // individuellement — plus robuste contre les ajouts hors-scope.
          scheduleScan();
        });
        observer.observe(document.body, { childList: true, subtree: true });

        // Check périodique pour les bandeaux qui apparaissent en différé.
        setInterval(closeOpenInAppBanners, 1500);

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
