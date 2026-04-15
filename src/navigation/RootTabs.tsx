import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { InstagramScreen } from '../screens/InstagramScreen';
import { FacebookScreen } from '../screens/FacebookScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { colors } from '../theme/colors';

/**
 * Navigation principale : 3 onglets en bas d'écran.
 *
 * Les icônes sont volontairement textuelles pour ne pas embarquer de
 * dépendance supplémentaire (pas de react-native-vector-icons). On reste
 * sur des libellés courts et explicites, dans l'esprit minimaliste.
 */

type TabParamList = {
  Instagram: undefined;
  Facebook: undefined;
  Paramètres: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

function makeTabLabel(label: string) {
  return ({ color }: { color: string }) => (
    <Text style={{ color, fontSize: 11, fontWeight: '500', letterSpacing: 0.3 }}>
      {label}
    </Text>
  );
}

export function RootTabs() {
  return (
    <Tab.Navigator
      initialRouteName="Instagram"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet_hairline,
          height: 58,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="Instagram"
        component={InstagramScreen}
        options={{ tabBarIcon: makeTabLabel('Instagram') }}
      />
      <Tab.Screen
        name="Facebook"
        component={FacebookScreen}
        options={{ tabBarIcon: makeTabLabel('Facebook') }}
      />
      <Tab.Screen
        name="Paramètres"
        component={SettingsScreen}
        options={{ tabBarIcon: makeTabLabel('Paramètres') }}
      />
    </Tab.Navigator>
  );
}

// Hairline constante — importer StyleSheet uniquement pour ça serait
// surdimensionné, on utilise la valeur directement.
const StyleSheet_hairline = 0.5;
