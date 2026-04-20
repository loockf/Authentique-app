import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFilters } from '../context/FiltersContext';
import type { FilterPreferences } from '../filters/types';
import { resetNavPositionToDefault } from '../components/FloatingNav';
import { colors } from '../theme/colors';
import { APP_VERSION } from '../version';

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
    description: 'Blocs « Reels et plus » parfois insérés dans le fil d\'actualité',
  },
  {
    key: 'navSnapToEdge',
    label: 'Aimanter le bouton',
    description: 'Le bouton flottant glisse vers le bord le plus proche après un drag',
  },
];

export function SettingsScreen() {
  const { prefs, setPref, hiddenCount } = useFilters();
  const { width, height } = useWindowDimensions();
  const [resetFeedback, setResetFeedback] = React.useState(false);

  const handleResetPosition = async () => {
    await resetNavPositionToDefault(width, height);
    setResetFeedback(true);
    setTimeout(() => setResetFeedback(false), 1800);
  };

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

          <Pressable
            onPress={handleResetPosition}
            style={({ pressed }) => [
              styles.row,
              styles.rowAction,
              pressed && styles.rowPressed,
            ]}
          >
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>
                Réinitialiser la position du bouton
              </Text>
              <Text style={styles.rowDescription}>
                {resetFeedback
                  ? 'Position réinitialisée ✓ (relancez l\'app pour la voir appliquée)'
                  : 'Remet le bouton flottant à sa position par défaut (milieu-droite)'}
              </Text>
            </View>
          </Pressable>
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

        <View style={styles.footer}>
          <Text style={styles.footerHeading}>À propos</Text>
          <Text style={styles.footerBody}>
            Authentique — Version {APP_VERSION}
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
  rowAction: {
    borderBottomWidth: 0,
  },
  rowPressed: {
    backgroundColor: colors.background,
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
