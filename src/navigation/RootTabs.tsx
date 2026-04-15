import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { InstagramScreen } from '../screens/InstagramScreen';
import { FacebookScreen } from '../screens/FacebookScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { colors } from '../theme/colors';

/**
 * Navigation principale : 3 onglets en bas d'écran.
 *
 * Version simplifiée : on laisse react-navigation utiliser son tab bar par
 * défaut pour éviter les erreurs de codegen côté New Architecture qui
 * surviennent dès qu'on customise trop le `tabBarStyle` ou qu'on passe
 * un `tabBarIcon` personnalisé. Le style minimaliste voulu sera réappliqué
 * une fois que l'app tournera de façon stable.
 *
 * `freezeOnBlur: false` désactive l'enveloppe `<Freeze>` de
 * react-native-screens pour les onglets inactifs, ce qui évite un bug
 * connu "expected dynamic type 'boolean', but had type 'string'" lorsque
 * Freeze + Animated.View se rencontrent sur la New Architecture.
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
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
      }}
    >
      <Tab.Screen name="Instagram" component={InstagramScreen} />
      <Tab.Screen name="Facebook" component={FacebookScreen} />
      <Tab.Screen name="Paramètres" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
