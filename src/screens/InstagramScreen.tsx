import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FilteredWebView } from '../components/FilteredWebView';
import { HiddenBadge } from '../components/HiddenBadge';
import { useFilters } from '../context/FiltersContext';
import { buildInstagramFilters } from '../filters/instagram';
import { colors } from '../theme/colors';

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
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
