import type { FilterBundle, FilterPreferences } from './types';

/**
 * Construit le bundle CSS + JS d'injection pour Facebook.
 *
 * Comme Instagram, Facebook utilise des classes obfusquées. On s'appuie sur :
 *  - `aria-label` et `role` quand ils sont stables
 *  - des detections textuelles via TreeWalker
 *
 * Ce fichier est volontairement structuré comme `instagram.ts` pour
 * permettre un diff côte à côte facile lors d'un audit.
 */
export function buildFacebookFilters(prefs: FilterPreferences): FilterBundle {
  const css = `
    /* Pop-ups "Ouvrir dans l'application" */
    div[role="dialog"][aria-label*="app" i] {
      display: none !important;
    }

    /* Bandeau d'installation */
    [data-pagelet="AppInstall"],
    [data-pagelet*="Install"] {
      display: none !important;
    }

    /* Colonne latérale avec pubs sur mbasic/m (au cas où) */
    [data-pagelet="RightRail"] {
      display: none !important;
    }

    /* Classe universelle de masquage */
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
      if (window.__authentiqueInstalled) { return; }
      window.__authentiqueInstalled = true;

      var prefs = ${serializedPrefs};
      var hiddenCount = 0;

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

      function findFeedAncestor(node) {
        var el = node;
        while (el && el !== document.body) {
          var role = el.getAttribute && el.getAttribute('role');
          if (role === 'article' || role === 'feed') { return el; }
          // Facebook utilise souvent des conteneurs <div data-pagelet="FeedUnit_..."
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

      var SPONSORED_NEEDLES = ['Sponsorisé', 'Sponsored', 'Sponsorisée', 'Partenariat rémunéré'];
      var SUGGESTED_PEOPLE_NEEDLES = ['Personnes que vous connaissez', 'People you may know', 'Suggestions d\\'amis'];
      var SUGGESTED_GROUPS_NEEDLES = ['Groupes suggérés', 'Suggested groups', 'Groupes à découvrir'];
      var SUGGESTED_VIDEOS_NEEDLES = ['Reels suggérés', 'Suggested reels', 'Vidéos suggérées', 'Suggested videos', 'Reels and short videos'];
      var LOCAL_TRENDING_NEEDLES = ['Populaires près de chez vous', 'Popular near you', 'Tendances près de chez vous'];
      var MARKETPLACE_NEEDLES = ['Marketplace'];

      function scan(root) {
        var scope = root && root.nodeType === 1 ? root : document.body;
        if (!scope) { return; }

        // 1) Posts marqués sponsorisés
        if (prefs.hideAds) {
          var feedUnits = scope.querySelectorAll('[role="article"], [data-pagelet^="FeedUnit"]');
          for (var i = 0; i < feedUnits.length; i++) {
            var unit = feedUnits[i];
            if (unit.classList.contains('authentique-hidden')) { continue; }
            if (containsText(unit, SPONSORED_NEEDLES)) {
              hide(unit, 'sponsored');
            }
          }
        }

        // 2) Suggestions (personnes, groupes, vidéos, marketplace) + "près de chez vous"
        var headings = scope.querySelectorAll('h2, h3, h4, span[dir="auto"]');
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
            var card = findFeedAncestor(h) || h.parentElement;
            if (card) { hide(card, matchedReason); }
          }
        }
      }

      function start() {
        scan(document.body);

        var observer = new MutationObserver(function(mutations) {
          for (var m = 0; m < mutations.length; m++) {
            var mut = mutations[m];
            if (mut.addedNodes && mut.addedNodes.length) {
              for (var n = 0; n < mut.addedNodes.length; n++) {
                var node = mut.addedNodes[n];
                if (node.nodeType === 1) { scan(node); }
              }
            }
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });

        post({ type: 'ready', platform: 'facebook' });
      }

      if (document.body) { start(); }
      else { document.addEventListener('DOMContentLoaded', start); }
    })();
    true;
  `;

  return { css, js };
}
