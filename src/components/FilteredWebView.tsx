import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { useFilters } from '../context/FiltersContext';
import type { FilterBundle, FilterMessage } from '../filters/types';

/**
 * WebView mutualisé pour Instagram et Facebook.
 *
 * Responsabilités :
 *  - Charger la version web mobile avec un User-Agent Safari iOS
 *    (évite les détections "WebView" et les forçages d'install native)
 *  - Conserver les cookies entre les sessions (`sharedCookiesEnabled`)
 *  - Injecter le CSS de filtrage au plus tôt
 *  - Injecter le script de filtrage quand la page est prête
 *  - Recevoir les messages `hidden-count` et les remonter au contexte global
 *  - Pull-to-refresh natif iOS
 *  - Propagation "à chaud" des changements de préférences (via l'API
 *    `window.__authentiqueUpdatePrefs` exposée par le script injecté)
 *
 * Le composant ne sait rien du contenu des filtres : il reçoit un
 * `FilterBundle` déjà construit par l'écran appelant, qui est responsable
 * de l'adaptation aux préférences utilisateur. Cela garde une séparation
 * nette entre "moteur d'injection" et "règles d'injection".
 */

export type FilteredWebViewProps = {
  /** URL à charger, p.ex. https://www.instagram.com/ */
  uri: string;
  /** Bundle CSS + JS à injecter. */
  filters: FilterBundle;
};

/**
 * User-Agent d'un Safari iOS réel et relativement récent. On évite
 * d'y mettre "wv" ou "AuthentiqueApp" pour que la plateforme serve la
 * version web mobile complète plutôt qu'une variante dégradée.
 */
const IOS_SAFARI_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) ' +
  'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

function buildInstallScript(bundle: FilterBundle): string {
  // On enveloppe le CSS dans un <style> injecté une seule fois, puis
  // on lance le script JS. L'IIFE JS gère elle-même sa ré-entrance.
  const escapedCss = bundle.css
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');

  return `
    (function() {
      try {
        if (!document.getElementById('authentique-style')) {
          var style = document.createElement('style');
          style.id = 'authentique-style';
          style.textContent = \`${escapedCss}\`;
          (document.head || document.documentElement).appendChild(style);
        }
      } catch (e) {}
    })();
    ${bundle.js}
  `;
}

export function FilteredWebView({ uri, filters }: FilteredWebViewProps) {
  const { bumpHiddenCount, prefs } = useFilters();
  const webviewRef = useRef<WebView>(null);

  // Etat "on est sur /explore/" alimente par le script injecte via
  // un message 'route-explore-changed'. Utilise pour toggler la prop
  // pullToRefreshEnabled du WebView en dessous.
  const [isOnExplore, setIsOnExplore] = useState(false);

  const installScript = useMemo(() => buildInstallScript(filters), [filters]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const raw = event.nativeEvent.data;
      if (!raw) return;
      try {
        const message = JSON.parse(raw) as FilterMessage;
        if (message.type === 'hidden-count') {
          bumpHiddenCount(message.count);
        } else if (message.type === 'route-explore-changed') {
          setIsOnExplore(message.isOnExplore);
        }
        // Les messages 'ready' sont ignorés côté RN pour l'instant.
      } catch {
        // Message non-JSON : on l'ignore silencieusement.
      }
    },
    [bumpHiddenCount],
  );

  const handleLoadStart = useCallback(() => {
    // Re-injection défensive à chaque navigation interne. Le script
    // IIFE est idempotent (`window.__authentiqueInstalled`), donc sans effet
    // de bord s'il tourne déjà.
    webviewRef.current?.injectJavaScript(installScript);
  }, [installScript]);

  // Propagation "hot reload" des préférences : à chaque fois que `prefs`
  // change (l'utilisateur toggle un switch dans l'écran Paramètres), on
  // appelle l'API `window.__authentiqueUpdatePrefs(newPrefs)` exposée par
  // notre script injecté, qui re-scan le DOM avec les nouvelles règles.
  // Ça évite de devoir recharger la WebView complète.
  useEffect(() => {
    const serialized = JSON.stringify(prefs);
    const updateScript = `
      try {
        if (typeof window.__authentiqueUpdatePrefs === 'function') {
          window.__authentiqueUpdatePrefs(${serialized});
        }
      } catch (e) {}
      true;
    `;
    webviewRef.current?.injectJavaScript(updateScript);
  }, [prefs]);

  return (
    <View style={styles.container}>
      <WebView
        ref={webviewRef}
        source={{ uri }}
        userAgent={IOS_SAFARI_UA}
        // --- Session persistante -----------------------------------------
        sharedCookiesEnabled={true}
        thirdPartyCookiesEnabled={true}
        cacheEnabled={true}
        incognito={false}
        // Active Safari Web Inspector sur le WebView (iOS 16.4+).
        // Necessaire pour debugger le DOM d'Instagram depuis Safari
        // sur Mac. A desactiver avant un build production.
        webviewDebuggingEnabled={true}
        // --- Injection ---------------------------------------------------
        injectedJavaScriptBeforeContentLoaded={installScript}
        injectedJavaScript={installScript}
        onLoadStart={handleLoadStart}
        onMessage={handleMessage}
        // --- UX ----------------------------------------------------------
        // allowsBackForwardNavigationGestures: false parce que notre script
        // injecte (installTabSwipeNav) prend en charge le swipe horizontal
        // pour naviguer entre les onglets Instagram (home, search, reels,
        // direct). Si on laisse iOS faire son swipe-back natif en meme
        // temps, les deux rentrent en conflit et aucun des deux ne marche
        // correctement.
        allowsBackForwardNavigationGestures={false}
        // Pull-to-refresh natif iOS desactive UNIQUEMENT quand on est
        // sur /explore/. Le UIRefreshControl du UIScrollView de
        // WKWebView est totalement retire a la volee, donc aucun
        // geste de pull ne peut declencher un reload de la page. Sur
        // les autres routes (home, reels, DMs), il reste actif. La
        // valeur isOnExplore est alimentee par le script injecte via
        // le message 'route-explore-changed' dans handleMessage.
        pullToRefreshEnabled={!isOnExplore}
        // Masque la barre iOS ⬆️⬇️✅ qui apparait au-dessus du clavier
        // quand un input HTML est focus. Elle est utile pour naviguer
        // entre les inputs d'un formulaire classique, mais totalement
        // inutile dans Instagram (un seul input visible a la fois) et
        // elle denature l'experience en ajoutant une ligne visuelle
        // supplementaire au-dessus du clavier.
        hideKeyboardAccessoryView={true}
        // --- Autoplay éventuel (stories, reels) --------------------------
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
