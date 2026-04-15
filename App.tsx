import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { enableFreeze } from 'react-native-screens';
import { FiltersProvider } from './src/context/FiltersContext';
import { RootTabs } from './src/navigation/RootTabs';

// Coupe la fonctionnalité Freeze de react-native-screens (qui utilise
// react-freeze + Suspense pour geler les écrans inactifs). Sur la New
// Architecture React Native 0.81, Freeze ré-entre dans le cycle de
// rendu d'un Animated.View et déclenche une erreur "expected dynamic
// type 'boolean', but had type 'string'" dans createNode au moment où
// Fabric crée le node natif du tab bar. On reviendra dessus quand la
// stack sera stabilisée.
enableFreeze(false);

/**
 * Racine de l'application Authentique.
 *
 * Hiérarchie :
 *  SafeAreaProvider
 *    └── FiltersProvider (préférences + compteur masqués)
 *         └── NavigationContainer
 *              └── RootTabs (Instagram · Facebook · Paramètres)
 */
export default function App() {
  return (
    <SafeAreaProvider>
      <FiltersProvider>
        <NavigationContainer>
          <RootTabs />
          <StatusBar style="dark" />
        </NavigationContainer>
      </FiltersProvider>
    </SafeAreaProvider>
  );
}
