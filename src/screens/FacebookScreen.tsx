import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FilteredWebView } from '../components/FilteredWebView';
import { HiddenBadge } from '../components/HiddenBadge';
import { useFilters } from '../context/FiltersContext';
import { buildFacebookFilters } from '../filters/facebook';
import { colors } from '../theme/colors';

/**
 * Écran Facebook : WebView plein écran + badge discret.
 * On vise directement `/friends` pour charger en priorité le fil des amis.
 */
export function FacebookScreen() {
  const { prefs, hiddenCount } = useFilters();

  const filters = useMemo(() => buildFacebookFilters(prefs), [prefs]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <FilteredWebView
          uri="https://m.facebook.com/friends"
          filters={filters}
          platform="facebook"
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
