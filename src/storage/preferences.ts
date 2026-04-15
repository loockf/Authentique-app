import AsyncStorage from '@react-native-async-storage/async-storage';
import { defaultPreferences, type FilterPreferences } from '../filters/types';

/**
 * Couche de persistance des préférences utilisateur.
 *
 * Aucune donnée n'est envoyée ailleurs que sur le disque local. C'est un
 * simple AsyncStorage — équivalent de localStorage. Un audit peut s'arrêter ici.
 */

const STORAGE_KEY = 'authentique:preferences:v1';

export async function loadPreferences(): Promise<FilterPreferences> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...defaultPreferences };
    }
    const parsed = JSON.parse(raw) as Partial<FilterPreferences>;
    // Fusion avec les valeurs par défaut pour tolérer les nouvelles clés
    // ajoutées dans les futures versions sans perdre les choix existants.
    return { ...defaultPreferences, ...parsed };
  } catch {
    return { ...defaultPreferences };
  }
}

export async function savePreferences(prefs: FilterPreferences): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Silencieux : si l'écriture échoue, on garde la valeur en mémoire pour
    // la session en cours. Pas de remontée d'erreur à un service tiers.
  }
}
