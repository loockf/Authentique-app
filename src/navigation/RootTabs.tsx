import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { InstagramScreen } from '../screens/InstagramScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { FloatingNav } from '../components/FloatingNav';

/**
 * Navigation principale — simplifiee a deux ecrans : Instagram et
 * Parametres. Facebook a ete retire volontairement dans un
 * refactoring de concentration (commit du 15 avril) — le code
 * (FacebookScreen.tsx, facebook.ts) est conserve dans le repo pour
 * etre rebranche facilement plus tard, mais aucune UI n'y mene
 * actuellement.
 *
 * La tab bar native est remplacee par notre <FloatingNav /> : un
 * bouton rond flottant qu'on peut tapoter pour basculer entre
 * Instagram et Parametres, ou drag pour deplacer. Quand on est sur
 * Instagram, le bouton affiche "⚙" (tap -> Parametres). Quand on
 * est sur Parametres, il affiche "←" (tap -> retour Instagram).
 */

type TabParamList = {
  Instagram: undefined;
  Paramètres: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

export function RootTabs() {
  return (
    <Tab.Navigator
      initialRouteName="Instagram"
      screenOptions={{
        headerShown: false,
        freezeOnBlur: false,
        lazy: false,
      }}
      tabBar={(props) => <FloatingNav {...props} />}
    >
      <Tab.Screen name="Instagram" component={InstagramScreen} />
      <Tab.Screen name="Paramètres" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
