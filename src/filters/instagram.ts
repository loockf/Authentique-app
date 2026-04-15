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

    /* Les stories suggérées (barre du haut) — on laisse les abonnements,
       les suggérées sont identifiées par le JS. */

    /* Masquer les notifications de "contenu tendance" */
    [aria-label*="tendance" i],
    [aria-label*="trending" i] {
      display: none !important;
    }

    ${prefs.hideLikeCounts
      ? `
    /* Compteurs de likes (masqués via classe appliquée par notre script) */
    .authentique-hide-likes { visibility: hidden !important; }
    `
      : ''}

    ${prefs.focusMode
      ? `
    /* Mode Focus : on supprime aussi les barres d'action (like/comment/save) */
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
      if (window.__authentiqueInstalled) { return; }
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

      /** Remonte du noeud jusqu'au conteneur "post/carte" le plus proche. */
      function findCardAncestor(node) {
        var el = node;
        while (el && el !== document.body) {
          if (el.tagName === 'ARTICLE') { return el; }
          var role = el.getAttribute && el.getAttribute('role');
          if (role === 'article' || role === 'presentation') { return el; }
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

      // --- Règles ----------------------------------------------------------

      var SPONSORED_NEEDLES = ['Sponsorisé', 'Sponsored', 'Sponsorisée', 'Partenariat rémunéré', 'Paid partnership'];
      var SUGGESTED_NEEDLES = ['Suggestions pour vous', 'Suggested for you', 'Suggested posts', 'Publications suggérées', 'Suggéré pour vous'];
      var REELS_NEEDLES = ['Reels et plus', 'Reels and more', 'Reels suggérés', 'Suggested reels'];

      function scan(root) {
        var scope = root && root.nodeType === 1 ? root : document.body;
        if (!scope) { return; }

        // 1) Articles marqués "Sponsorisé"
        if (prefs.hideAds) {
          var articles = scope.querySelectorAll('article');
          for (var i = 0; i < articles.length; i++) {
            var art = articles[i];
            if (art.classList.contains('authentique-hidden')) { continue; }
            if (containsText(art, SPONSORED_NEEDLES)) {
              hide(art, 'sponsored');
            }
          }
        }

        // 2) Sections "Suggestions pour vous" / "Suggested for you"
        if (prefs.hideSuggestions) {
          var headings = scope.querySelectorAll('h2, h3, h4, span');
          for (var j = 0; j < headings.length; j++) {
            var h = headings[j];
            var t = (h.textContent || '').trim();
            if (!t) { continue; }
            var matched = false;
            for (var k = 0; k < SUGGESTED_NEEDLES.length; k++) {
              if (t === SUGGESTED_NEEDLES[k] || t.indexOf(SUGGESTED_NEEDLES[k]) === 0) {
                matched = true; break;
              }
            }
            if (matched) {
              var card = findCardAncestor(h) || h.parentElement;
              if (card) { hide(card, 'suggestion'); }
            }
          }
        }

        // 3) Reels suggérés
        if (prefs.hideReels) {
          var reelSections = scope.querySelectorAll('section, div');
          for (var r = 0; r < reelSections.length; r++) {
            var sec = reelSections[r];
            if (sec.classList.contains('authentique-hidden')) { continue; }
            if (sec.children && sec.children.length > 0 && containsText(sec, REELS_NEEDLES)) {
              hide(sec, 'reels-suggested');
              break; // un seul conteneur à la fois pour ne pas cascader
            }
          }
        }

        // 4) Compteurs de likes — on marque, le CSS fait le masquage
        if (prefs.hideLikeCounts) {
          var likeButtons = scope.querySelectorAll('a[href$="/liked_by/"], a[href*="/liked_by/"] span');
          for (var l = 0; l < likeButtons.length; l++) {
            var btn = likeButtons[l];
            if (!btn.classList.contains('authentique-hide-likes')) {
              btn.classList.add('authentique-hide-likes');
            }
          }
        }
      }

      // --- Démarrage -------------------------------------------------------

      function start() {
        scan(document.body);

        var observer = new MutationObserver(function(mutations) {
          for (var m = 0; m < mutations.length; m++) {
            var mut = mutations[m];
            if (mut.addedNodes && mut.addedNodes.length) {
              for (var n = 0; n < mut.addedNodes.length; n++) {
                var node = mut.addedNodes[n];
                if (node.nodeType === 1) {
                  scan(node);
                }
              }
            }
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });

        // Redirige vers le fil "Abonnements" au premier chargement
        // (Instagram expose /?variant=following sur la home web)
        try {
          if (location.pathname === '/' && !location.search) {
            history.replaceState(null, '', '/?variant=following');
          }
        } catch (e) {}

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
