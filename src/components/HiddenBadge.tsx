import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

/**
 * Badge discret indiquant le nombre d'éléments masqués depuis le début
 * de la session.
 *
 * Evolution : ce composant etait a l'origine un overlay absolu en
 * bottom-right du WebView. Probleme : sur les onglets Instagram et
 * Facebook, cette position recouvrait systematiquement un bouton de
 * navigation interne (profil a droite sur IG, menu a droite sur FB),
 * et bloquait les taps de l'utilisateur.
 *
 * Nouvelle implementation : une bande fine, non-flottante, qui prend
 * sa propre place dans le layout au-dessus de la tab bar RN. Elle
 * partage l'espace avec le WebView via flex, donc le WebView est
 * raccourci de ~22px mais Instagram/Facebook garde le controle total
 * de leur propre chrome. Aucun recouvrement possible.
 *
 * Le composant retourne `null` quand count <= 0 pour ne pas afficher
 * une bande vide quand rien n'a encore ete masque.
 */
export function HiddenBadge({ count }: { count: number }) {
  if (count <= 0) {
    return null;
  }

  return (
    <View
      style={styles.strip}
      accessibilityElementsHidden={true}
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={styles.text}>
        {count} élément{count > 1 ? 's' : ''} masqué{count > 1 ? 's' : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    // Bande fine, pleine largeur, absolue au bas du conteneur parent.
    // position: absolute pour qu'elle n'influence pas la hauteur du
    // WebView — le WebView occupe 100% de la hauteur disponible et la
    // bande flotte par-dessus ses ~22px inferieurs. pointer-events:
    // none garantit qu'elle ne bloque pas les taps sur l'UI Instagram
    // qui pourrait etre dans cette zone.
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  text: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
});
