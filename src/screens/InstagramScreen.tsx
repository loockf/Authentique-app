import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FilteredWebView } from '../components/FilteredWebView';
import { HiddenBadge } from '../components/HiddenBadge';
import { useFilters } from '../context/FiltersContext';
import { buildInstagramFilters } from '../filters/instagram';

/**
 * Écran Instagram : WebView plein écran + badge discret.
 * Les préférences viennent du contexte global et régénèrent les filtres
 * automatiquement quand elles changent.
 */
export function InstagramScreen() {
  const { prefs, hiddenCount } = useFilters();

  const filters = useMemo(() => buildInstagramFilters(prefs), [prefs]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <FilteredWebView
          uri="https://www.instagram.com/"
          filters={filters}
        />
        <HiddenBadge count={hiddenCount} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Fond noir pour matcher le theme sombre d'Instagram mobile web.
  // Evite le flash blanc au lancement/reload : Instagram affiche
  // toujours un fond noir, on se cale dessus pour une transition
  // visuelle invisible.
  safe: {
    flex: 1,
    backgroundColor: '#000000',
  },
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
});
