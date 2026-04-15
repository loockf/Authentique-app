import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { FiltersProvider } from './src/context/FiltersContext';
import { RootTabs } from './src/navigation/RootTabs';

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
