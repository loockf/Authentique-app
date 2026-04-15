import type { FilterBundle, FilterPreferences } from './types';

/**
 * Construit le bundle CSS + JS d'injection pour Facebook.
 *
 * Depuis 2022, Facebook expose une section "Feeds" → "Friends" accessible
 * à l'URL `/feeds/friends/` qui est **chronologique et limitée aux amis**.
 * C'est l'URL que notre écran Facebook utilise désormais. Ce fichier ne sert
 * donc plus à reconstruire le fil — Facebook le fait pour nous — mais à :
 *
 *   - Fermer les pop-ups d'install d'app
 *   - Capturer les derniers résidus de sponsorisé (rares mais existent)
 *   - Masquer les blocs "Personnes que vous connaissez", "Groupes suggérés",
 *     "Vidéos suggérées", "Marketplace" qui peuvent encore apparaître dans
 *     certaines sections
 *   - Forcer une redirection vers `/feeds/friends/` si Facebook nous renvoie
 *     ailleurs (home algorithmique)
 *
 * Nouveautés :
 *  - `window.__authentiqueUpdatePrefs(newPrefs)` pour hot-reload des prefs
 *  - Recherche dans aria-label en plus du texte
 *  - Redirection automatique vers `/feeds/friends/` si on n'y est pas
 */
export function buildFacebookFilters(prefs: FilterPreferences): FilterBundle {
  const css = `
    /* Pop-ups "Ouvrir dans l'application" */
    div[role="dialog"][aria-label*="app" i] {
      display: none !important;
    }

    /* Bandeaux d'installation */
    [data-pagelet="AppInstall"],
    [data-pagelet*="Install"] {
      display: none !important;
    }

    /* Colonne latérale avec pubs (desktop) */
    [data-pagelet="RightRail"] {
      display: none !important;
    }

    /* Classe universelle */
    .authentique-hidden {
      display: none !important;
    }

    ${prefs.focusMode
      ? `
    /* Mode Focus : on atténue les actions sociales */
    [aria-label="J'aime"], [aria-label="Like"],
    [aria-label="Commenter"], [aria-label="Comment"],
    [aria-label="Partager"], [aria-label="Share"] {
      opacity: 0.3 !important;
    }
    `
      : ''}
  `;

  const serializedPrefs = JSON.stringify(prefs);

  const js = `
    (function() {
      if (window.__authentiqueInstalled) {
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
       * Remonte jusqu'au conteneur de feed (article, feed, FeedUnit).
       * Comme sur Instagram, on ne remonte jamais vers role="presentation".
       */
      function findFeedAncestor(node) {
        var el = node;
        while (el && el !== document.body) {
          var role = el.getAttribute && el.getAttribute('role');
          if (role === 'article' || role === 'feed') { return el; }
          var pagelet = el.getAttribute && el.getAttribute('data-pagelet');
          if (pagelet && pagelet.indexOf('FeedUnit') === 0) { return el; }
          el = el.parentElement;
        }
        return null;
      }

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

      // --- Needles ---------------------------------------------------------

      var SPONSORED_NEEDLES = [
        'Sponsorisé',
        'Sponsorisée',
        'Sponsored',
        'Partenariat rémunéré',
        'Paid partnership',
      ];
      var SUGGESTED_PEOPLE_NEEDLES = [
        'Personnes que vous connaissez',
        'People you may know',
        "Suggestions d'amis",
        'Suggestions damis',
      ];
      var SUGGESTED_GROUPS_NEEDLES = [
        'Groupes suggérés',
        'Suggested groups',
        'Groupes à découvrir',
        'Suggested for you',
      ];
      var SUGGESTED_VIDEOS_NEEDLES = [
        'Reels suggérés',
        'Suggested reels',
        'Vidéos suggérées',
        'Suggested videos',
        'Reels and short videos',
      ];
      var LOCAL_TRENDING_NEEDLES = [
        'Populaires près de chez vous',
        'Popular near you',
        'Tendances près de chez vous',
      ];
      var MARKETPLACE_NEEDLES = ['Marketplace'];
      var OPEN_APP_NEEDLES = [
        "Ouvrir dans l'application",
        "Utiliser l'application",
        'Open in app',
        'Use the app',
        'Get the app',
      ];

      // --- Scans -----------------------------------------------------------

      function scanSponsored() {
        if (!prefs.hideAds) { return; }
        var units = document.querySelectorAll('[role="article"]:not(.authentique-hidden), [data-pagelet^="FeedUnit"]:not(.authentique-hidden)');
        for (var i = 0; i < units.length; i++) {
          var unit = units[i];
          if (containsText(unit, SPONSORED_NEEDLES) || containsAttributeText(unit, SPONSORED_NEEDLES)) {
            hide(unit, 'sponsored');
          }
        }
      }

      function scanHeadingBlocks() {
        var headings = document.querySelectorAll('h2, h3, h4, span[dir="auto"]');
        for (var j = 0; j < headings.length; j++) {
          var h = headings[j];
          var t = (h.textContent || '').trim();
          if (!t || t.length > 80) { continue; }

          var matchedReason = null;

          if (prefs.hideSuggestions) {
            for (var a = 0; a < SUGGESTED_PEOPLE_NEEDLES.length; a++) {
              if (t.indexOf(SUGGESTED_PEOPLE_NEEDLES[a]) !== -1) { matchedReason = 'suggested-people'; break; }
            }
            if (!matchedReason) {
              for (var b = 0; b < SUGGESTED_GROUPS_NEEDLES.length; b++) {
                if (t.indexOf(SUGGESTED_GROUPS_NEEDLES[b]) !== -1) { matchedReason = 'suggested-groups'; break; }
              }
            }
            if (!matchedReason) {
              for (var c = 0; c < LOCAL_TRENDING_NEEDLES.length; c++) {
                if (t.indexOf(LOCAL_TRENDING_NEEDLES[c]) !== -1) { matchedReason = 'local-trending'; break; }
              }
            }
            if (!matchedReason) {
              for (var d = 0; d < MARKETPLACE_NEEDLES.length; d++) {
                if (t === MARKETPLACE_NEEDLES[d]) { matchedReason = 'marketplace'; break; }
              }
            }
          }

          if (!matchedReason && prefs.hideReels) {
            for (var e = 0; e < SUGGESTED_VIDEOS_NEEDLES.length; e++) {
              if (t.indexOf(SUGGESTED_VIDEOS_NEEDLES[e]) !== -1) { matchedReason = 'suggested-videos'; break; }
            }
          }

          if (matchedReason) {
            var card = findFeedAncestor(h);
            if (card) { hide(card, matchedReason); }
          }
        }
      }

      function closeOpenInAppBanners() {
        var candidates = document.querySelectorAll(
          'div[role="dialog"]:not(.authentique-hidden), ' +
          'div[role="banner"]:not(.authentique-hidden)'
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
       * Si Facebook nous renvoie sur la home algorithmique (/, /home.php,
       * /?filter_id=...), on force la navigation vers /feeds/friends/.
       * On ne le fait qu'une fois pour ne pas créer une boucle si
       * l'utilisateur veut aller voir autre chose.
       */
      var feedsRedirectAttempted = false;
      function enforceFeedsFriends() {
        if (feedsRedirectAttempted) { return; }
        var path = location.pathname || '';
        var isFeedsFriends = path.indexOf('/feeds/friends') === 0 || path.indexOf('/feeds/friends') !== -1;
        if (!isFeedsFriends && (path === '/' || path === '/home.php' || path.indexOf('/home') === 0)) {
          feedsRedirectAttempted = true;
          try {
            location.replace('/feeds/friends/');
          } catch (e) {}
        }
      }

      function fullScan() {
        if (!document.body) { return; }
        scanSponsored();
        scanHeadingBlocks();
        closeOpenInAppBanners();
      }

      // --- Hot reload des préférences --------------------------------------

      window.__authentiqueUpdatePrefs = function(newPrefs) {
        prefs = newPrefs;
        fullScan();
      };

      // --- Démarrage -------------------------------------------------------

      var scanScheduled = false;
      function scheduleScan() {
        if (scanScheduled) { return; }
        scanScheduled = true;
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

      function start() {
        enforceFeedsFriends();
        fullScan();

        var observer = new MutationObserver(function() { scheduleScan(); });
        observer.observe(document.body, { childList: true, subtree: true });

        setInterval(closeOpenInAppBanners, 1500);

        post({ type: 'ready', platform: 'facebook' });
      }

      if (document.body) { start(); }
      else { document.addEventListener('DOMContentLoaded', start); }
    })();
    true;
  `;

  return { css, js };
}
