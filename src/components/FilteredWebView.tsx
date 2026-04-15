import React, { useCallback, useMemo, useRef } from 'react';
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
  const { bumpHiddenCount } = useFilters();
  const webviewRef = useRef<WebView>(null);

  const installScript = useMemo(() => buildInstallScript(filters), [filters]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const raw = event.nativeEvent.data;
      if (!raw) return;
      try {
        const message = JSON.parse(raw) as FilterMessage;
        if (message.type === 'hidden-count') {
          bumpHiddenCount(message.count);
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
        // --- Injection ---------------------------------------------------
        injectedJavaScriptBeforeContentLoaded={installScript}
        injectedJavaScript={installScript}
        onLoadStart={handleLoadStart}
        onMessage={handleMessage}
        // --- UX ----------------------------------------------------------
        allowsBackForwardNavigationGestures={true}
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
