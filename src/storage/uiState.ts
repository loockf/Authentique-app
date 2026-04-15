import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Persistance d'etat UI local — SEPARE de preferences.ts pour ne pas
 * polluer la politique stricte de ce dernier.
 *
 * =============================================================================
 * POLITIQUE DE STOCKAGE — COORDONNEES DE LAYOUT UNIQUEMENT
 * =============================================================================
 *
 * Ce module stocke des donnees qui pilotent la presentation de l'interface
 * Authentique elle-meme, et jamais des donnees d'utilisateur au sens social.
 *
 * AUTORISE :
 *  - position (x, y) en pixels logiques du bouton flottant de navigation
 *  - etats UI ephemeres qui ameliorent l'ergonomie sans decrire l'utilisateur
 *
 * INTERDIT (comme dans preferences.ts) :
 *  - listes d'amis, de followers, de comptes suivis
 *  - metadonnees du compte Instagram/Facebook (pseudo, email, bio, photo)
 *  - historique d'activite (pages visitees, temps passe, clicks)
 *  - contenu scrappe depuis les pages Meta
 *  - cookies, tokens d'auth, identifiants de session
 *
 * Les coordonnees du bouton flottant ne sont PAS identifiantes : elles
 * decrivent une preference de placement comparable au theme clair/sombre
 * d'une app. Aucun risque de fuite sociale.
 * =============================================================================
 */

const NAV_POSITION_KEY = 'authentique:ui:nav-position:v1';

export type NavPosition = { x: number; y: number };

export async function loadNavPosition(): Promise<NavPosition | null> {
  try {
    const raw = await AsyncStorage.getItem(NAV_POSITION_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as { x: unknown }).x !== 'number' ||
      typeof (parsed as { y: unknown }).y !== 'number'
    ) {
      return null;
    }
    return parsed as NavPosition;
  } catch {
    return null;
  }
}

export async function saveNavPosition(position: NavPosition): Promise<void> {
  try {
    await AsyncStorage.setItem(NAV_POSITION_KEY, JSON.stringify(position));
  } catch {
    // Silencieux — si l'ecriture echoue, la position reste en memoire
    // pour la session et reviendra a sa valeur par defaut au prochain
    // lancement. Comportement acceptable.
  }
}
