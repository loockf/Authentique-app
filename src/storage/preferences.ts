import AsyncStorage from '@react-native-async-storage/async-storage';
import { defaultPreferences, type FilterPreferences } from '../filters/types';

/**
 * Couche de persistance des preferences utilisateur.
 *
 * =============================================================================
 * POLITIQUE DE STOCKAGE STRICTE — A LIRE AVANT TOUTE MODIFICATION
 * =============================================================================
 *
 * Ce module est le SEUL endroit ou Authentique ecrit des donnees sur le disque
 * local de l'utilisateur. La regle est simple et non-negociable :
 *
 * ON STOCKE UNIQUEMENT :
 *   - les 5 toggles booleens de l'ecran Parametres :
 *       hideAds, hideSuggestions, hideReels, hideLikeCounts, focusMode
 *
 * ON NE STOCKE JAMAIS :
 *   - de liste d'abonnements, d'amis, de followers, ni aucune donnee sur
 *     ton graphe social (ni directement, ni par hash, ni chiffre)
 *   - de metadonnees sur ton compte Instagram/Facebook (pseudo, bio, email,
 *     photo de profil...)
 *   - de compteurs ou de statistiques liees a ton activite (nombre de posts
 *     vus, historique de navigation, temps passe, etc.)
 *   - de donnees scrapees depuis les pages visitees (textes, images, posts)
 *   - de cookies, tokens d'auth ou identifiants de session — c'est le
 *     WebView qui gere les cookies, et ils restent dans le conteneur
 *     systeme iOS, pas dans AsyncStorage
 *   - quoi que ce soit qui permette de reconstruire un profil social de
 *     l'utilisateur
 *
 * POURQUOI C'EST IMPORTANT
 * ------------------------
 * Authentique est une fenetre filtree sur les plateformes. Ce n'est PAS un
 * outil qui apprend sur toi. Des qu'on se met a stocker des donnees autres
 * que des preferences simples, on change de nature : on devient une base
 * de donnees potentiellement exfiltrable, et le code qui scrape/store
 * devient une bibliotheque d'attaque reutilisable par quiconque fork le
 * projet avec des intentions malveillantes.
 *
 * POUR LES CONTRIBUTEURS
 * ----------------------
 * Si tu envisages d'ajouter une nouvelle cle a AsyncStorage, demande-toi
 * honnetement : "est-ce que ca tombe dans la liste des choses qu'on ne
 * stocke JAMAIS ci-dessus ?". Si la reponse est oui, n'ajoute pas la cle.
 * Si tu penses que c'est vraiment necessaire, ouvre une issue publique
 * pour en debattre AVANT de coder.
 *
 * Quand il faut enrichir une feature avec de l'information contextuelle
 * (comme savoir si un compte est suivi), privilegie TOUJOURS l'observation
 * passive du DOM au scraping actif. Tout ce qu'Instagram ou Facebook
 * affiche deja dans la page peut etre utilise sans etre persiste.
 * =============================================================================
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
