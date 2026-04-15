# Authentique

> Juste tes amis. Rien d'autre.

Authentique est une app iOS (React Native / Expo) qui te laisse consulter
Instagram et Facebook **sans algorithme, sans pub, sans suggestions, sans
tracking**. L'app n'est qu'une fenêtre filtrée sur les versions web de ces
plateformes — les cookies restent locaux, rien n'est envoyé sur un serveur.

## Principes

- **Pas de backend** — aucune collecte de données, aucune analytics
- **Pas de compte** — l'app n'a pas de notion d'utilisateur
- **Open source** — tout ce qui est masqué est auditable dans
  [`src/filters/`](src/filters/)
- **Chronologique** — on redirige Instagram vers le fil « Abonnements » et
  Facebook vers `/friends`
- **Session persistante** — tu te connectes une fois, comme dans Safari

## Stack

- [Expo](https://expo.dev) SDK 54 + TypeScript
- [`react-native-webview`](https://github.com/react-native-webview/react-native-webview)
  pour afficher Instagram et Facebook
- [`@react-native-async-storage/async-storage`](https://github.com/react-native-async-storage/async-storage)
  pour les préférences (uniquement en local)
- [`@react-navigation/bottom-tabs`](https://github.com/react-navigation/react-navigation)
  pour les onglets

## Structure

```
src/
  navigation/RootTabs.tsx       # Onglets Instagram · Facebook · Paramètres
  screens/                      # Un écran par onglet
  components/
    FilteredWebView.tsx         # WebView avec UA Safari, cookies, injection
    HiddenBadge.tsx             # Badge « N éléments masqués »
  filters/
    instagram.ts                # CSS + JS d'injection Instagram
    facebook.ts                 # CSS + JS d'injection Facebook
    types.ts                    # Types partagés (préférences, messages)
  storage/preferences.ts        # Persistance AsyncStorage
  context/FiltersContext.tsx    # État global (prefs + compteur)
  theme/colors.ts               # Palette neutre
```

## Lancer en dev

```sh
npm install
npx expo start --ios
```

Scanner le QR code avec Expo Go sur un iPhone.

## Auditer le filtrage

Tout ce qui est masqué est décrit en clair dans `src/filters/instagram.ts`
et `src/filters/facebook.ts`. Chaque élément masqué reçoit un attribut
`data-authentique-reason` pour pouvoir inspecter la raison du masquage
depuis l'inspecteur Safari.

## Ce que l'app ne fait pas

- Pas de push notifications
- Pas de télémétrie (`EXPO_NO_TELEMETRY=1` par défaut)
- Pas de synchronisation cloud
- Pas de gamification
