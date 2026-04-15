import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

/**
 * Badge discret indiquant le nombre d'éléments masqués depuis le début
 * de la session. Positionné en surimpression en bas à droite de l'écran,
 * sans jamais voler l'attention.
 *
 * Note Fabric : `pointerEvents` et `accessibilityElementsHidden` doivent
 * passer par `style` / des props explicitement booléens pour éviter les
 * erreurs de type côté New Architecture.
 */
export function HiddenBadge({ count }: { count: number }) {
  if (count <= 0) {
    return null;
  }

  return (
    <View
      style={styles.container}
      accessibilityElementsHidden={true}
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={styles.text}>{count} masqué{count > 1 ? 's' : ''}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(28,28,26,0.72)',
    // `pointerEvents` appartient au style sur la New Architecture
    pointerEvents: 'none',
  },
  text: {
    color: '#fafaf7',
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
});

// `colors` est importé volontairement pour garder la palette cohérente,
// même si on utilise des valeurs RGBA directes pour la transparence.
void colors;
