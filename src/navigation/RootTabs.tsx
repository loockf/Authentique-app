import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { InstagramScreen } from '../screens/InstagramScreen';
import { FacebookScreen } from '../screens/FacebookScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { FloatingNav } from '../components/FloatingNav';

/**
 * Navigation principale — Authentique utilise un Tab.Navigator de
 * react-navigation comme moteur de navigation, mais SANS la tab bar
 * par defaut. A la place, on fournit notre propre composant custom
 * <FloatingNav /> via le prop `tabBar`, qui est un cercle flottant
 * draggable (voir src/components/FloatingNav.tsx).
 *
 * Ca permet de garder tous les benefices de react-navigation :
 *   - gestion du cycle de vie des ecrans (lazy: false, freezeOnBlur: false)
 *   - route state reactive
 *   - deep linking si un jour on en a besoin
 * tout en rendant zero chrome visible en bas de l'ecran. Les WebViews
 * Instagram et Facebook occupent ainsi 100% de la hauteur, sans etre
 * grignotees par une barre d'onglets qui denatuferait l'experience
 * de lecture.
 */

type TabParamList = {
  Instagram: undefined;
  Facebook: undefined;
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
      <Tab.Screen name="Facebook" component={FacebookScreen} />
      <Tab.Screen name="Paramètres" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
