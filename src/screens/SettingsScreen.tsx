import React from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFilters } from '../context/FiltersContext';
import type { FilterPreferences } from '../filters/types';
import { colors } from '../theme/colors';

/**
 * Écran Paramètres : toggles des filtres + quelques mots sur la philosophie.
 * Aucune télémétrie, aucune collecte, pas de login — juste des switches.
 */

type Toggle = {
  key: keyof FilterPreferences;
  label: string;
  description: string;
};

const TOGGLES: Toggle[] = [
  {
    key: 'hideAds',
    label: 'Masquer les publicités',
    description: 'Posts, stories et bannières sponsorisés',
  },
  {
    key: 'hideSuggestions',
    label: 'Masquer les suggestions',
    description: '« Suggestions pour vous », « Personnes que vous connaissez »',
  },
  {
    key: 'hideReels',
    label: 'Masquer les Reels suggérés',
    description: 'Vidéos courtes de comptes que vous ne suivez pas',
  },
  {
    key: 'hideLikeCounts',
    label: 'Masquer les compteurs de likes',
    description: 'Pour une lecture plus calme, sans scores',
  },
  {
    key: 'focusMode',
    label: 'Mode Focus',
    description: 'Atténue les boutons d\'action pour ne laisser que le contenu',
  },
];

export function SettingsScreen() {
  const { prefs, setPref, hiddenCount } = useFilters();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Authentique</Text>
        <Text style={styles.tagline}>Juste tes amis. Rien d'autre.</Text>

        <View style={styles.section}>
          {TOGGLES.map((toggle) => (
            <View key={toggle.key} style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{toggle.label}</Text>
                <Text style={styles.rowDescription}>{toggle.description}</Text>
              </View>
              <Switch
                value={Boolean(prefs[toggle.key])}
                onValueChange={(value) => setPref(toggle.key, value)}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor={colors.surface}
                ios_backgroundColor={colors.border}
              />
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerHeading}>Session en cours</Text>
          <Text style={styles.footerBody}>
            {hiddenCount === 0
              ? 'Aucun élément masqué pour l\'instant.'
              : `${hiddenCount} élément${hiddenCount > 1 ? 's' : ''} masqué${
                  hiddenCount > 1 ? 's' : ''
                } depuis le lancement.`}
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerHeading}>Notre promesse</Text>
          <Text style={styles.footerBody}>
            Authentique ne collecte aucune donnée. Pas de compte, pas d'analytics,
            pas de backend. L'app n'est qu'une fenêtre filtrée sur Instagram et
            Facebook, qui te rend le contrôle de ce que tu vois.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  title: {
    fontSize: 26,
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  tagline: {
    marginTop: 4,
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 28,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowText: {
    flex: 1,
    marginRight: 12,
  },
  rowLabel: {
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  rowDescription: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textSecondary,
  },
  footer: {
    marginTop: 24,
  },
  footerHeading: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  footerBody: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
});
