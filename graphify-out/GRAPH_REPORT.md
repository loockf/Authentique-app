# Graph Report - .  (2026-04-19)

## Corpus Check
- Corpus is ~16,540 words - fits in a single context window. You may not need a graph.

## Summary
- 86 nodes · 71 edges · 27 communities detected
- Extraction: 70% EXTRACTED · 30% INFERRED · 0% AMBIGUOUS · INFERRED: 21 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_App Principles & Privacy|App Principles & Privacy]]
- [[_COMMUNITY_WebView Filtering System|WebView Filtering System]]
- [[_COMMUNITY_App Icon Design|App Icon Design]]
- [[_COMMUNITY_Favicon Design|Favicon Design]]
- [[_COMMUNITY_Chronological Feed Routing|Chronological Feed Routing]]
- [[_COMMUNITY_Preferences & Context|Preferences & Context]]
- [[_COMMUNITY_Nav Position Persistence|Nav Position Persistence]]
- [[_COMMUNITY_Preferences Storage|Preferences Storage]]
- [[_COMMUNITY_Floating Nav Component|Floating Nav Component]]
- [[_COMMUNITY_FilteredWebView Implementation|FilteredWebView Implementation]]
- [[_COMMUNITY_App Entry|App Entry]]
- [[_COMMUNITY_Instagram Filter Builder|Instagram Filter Builder]]
- [[_COMMUNITY_Facebook Filter Builder|Facebook Filter Builder]]
- [[_COMMUNITY_Filters Context Provider|Filters Context Provider]]
- [[_COMMUNITY_Root Tabs Navigation|Root Tabs Navigation]]
- [[_COMMUNITY_Facebook Screen|Facebook Screen]]
- [[_COMMUNITY_Instagram Screen|Instagram Screen]]
- [[_COMMUNITY_Settings Screen|Settings Screen]]
- [[_COMMUNITY_Hidden Badge UI|Hidden Badge UI]]
- [[_COMMUNITY_Dev Setup|Dev Setup]]
- [[_COMMUNITY_Filters Index Module|Filters Index Module]]
- [[_COMMUNITY_Filter Types Module|Filter Types Module]]
- [[_COMMUNITY_Color Constants|Color Constants]]
- [[_COMMUNITY_Screens Directory|Screens Directory]]
- [[_COMMUNITY_Theme Colors File|Theme Colors File]]
- [[_COMMUNITY_Adaptive Icon|Adaptive Icon]]
- [[_COMMUNITY_Splash Icon|Splash Icon]]

## God Nodes (most connected - your core abstractions)
1. `Authentique` - 22 edges
2. `Principe: Chronologique` - 4 edges
3. `src/filters/instagram.ts` - 4 edges
4. `src/filters/facebook.ts` - 4 edges
5. `Authentique App Icon - Concentric Circles on Grid` - 4 edges
6. `Authentique Favicon - 3D Cube Stack` - 4 edges
7. `Principe: Pas de backend` - 3 edges
8. `FilteredWebView.tsx` - 3 edges
9. `Auditer le filtrage` - 3 edges
10. `Instagram (web)` - 2 edges

## Surprising Connections (you probably didn't know these)
- `Authentique` --filters--> `Instagram (web)`  [EXTRACTED]
  README.md → README.md  _Bridges community 0 → community 1_
- `Authentique` --provides--> `Sans algorithme`  [EXTRACTED]
  README.md → README.md  _Bridges community 0 → community 4_
- `Authentique` --uses--> `@react-native-async-storage/async-storage`  [EXTRACTED]
  README.md → README.md  _Bridges community 0 → community 5_

## Hyperedges (group relationships)
- **Filtering pipeline: WebView injects filters referencing shared types** — readme_filtered_webview, readme_filters_instagram, readme_filters_facebook, readme_filters_types [INFERRED 0.85]
- **Privacy stance: no backend, no tracking, no telemetry, no cloud sync** — readme_principle_no_backend, readme_no_tracking, readme_no_telemetry, readme_no_cloud_sync, readme_local_cookies [EXTRACTED 1.00]
- **Preferences flow: AsyncStorage persisted via storage module, exposed via FiltersContext** — readme_async_storage, readme_storage_preferences, readme_filters_context, readme_hidden_badge [INFERRED 0.85]

## Communities

### Community 0 - "App Principles & Privacy"
Cohesion: 0.11
Nodes (20): Authentique, @react-navigation/bottom-tabs, Expo SDK 54 + TypeScript, iOS App (React Native / Expo), Cookies locaux (rien envoyé sur serveur), Sans pub, Pas de synchronisation cloud, Pas de gamification (+12 more)

### Community 1 - "WebView Filtering System"
Cohesion: 0.28
Nodes (9): Auditer le filtrage, data-authentique-reason attribute, Facebook (web), FilteredWebView.tsx, src/filters/facebook.ts, src/filters/instagram.ts, src/filters/types.ts, Instagram (web) (+1 more)

### Community 2 - "App Icon Design"
Cohesion: 0.5
Nodes (5): Three Concentric Circles Motif, Light Gray Grid Background, Authentique App Icon - Concentric Circles on Grid, Minimalist Monochrome Design Style, Target/Focus Symbolism

### Community 3 - "Favicon Design"
Cohesion: 0.5
Nodes (5): Authentique App Brand Icon, Authentique Favicon - 3D Cube Stack, Small Circle Accent (Top-Right), Stacked Isometric Cubes Motif, Isometric Black-and-White Geometric Style

### Community 4 - "Chronological Feed Routing"
Cohesion: 0.5
Nodes (4): Facebook /friends route, Instagram feed 'Abonnements', Sans algorithme, Principe: Chronologique

### Community 5 - "Preferences & Context"
Cohesion: 0.5
Nodes (4): @react-native-async-storage/async-storage, src/context/FiltersContext.tsx, HiddenBadge.tsx, src/storage/preferences.ts

### Community 6 - "Nav Position Persistence"
Cohesion: 0.67
Nodes (0): 

### Community 7 - "Preferences Storage"
Cohesion: 0.67
Nodes (0): 

### Community 8 - "Floating Nav Component"
Cohesion: 0.67
Nodes (0): 

### Community 9 - "FilteredWebView Implementation"
Cohesion: 0.67
Nodes (0): 

### Community 10 - "App Entry"
Cohesion: 1.0
Nodes (0): 

### Community 11 - "Instagram Filter Builder"
Cohesion: 1.0
Nodes (0): 

### Community 12 - "Facebook Filter Builder"
Cohesion: 1.0
Nodes (0): 

### Community 13 - "Filters Context Provider"
Cohesion: 1.0
Nodes (0): 

### Community 14 - "Root Tabs Navigation"
Cohesion: 1.0
Nodes (0): 

### Community 15 - "Facebook Screen"
Cohesion: 1.0
Nodes (0): 

### Community 16 - "Instagram Screen"
Cohesion: 1.0
Nodes (0): 

### Community 17 - "Settings Screen"
Cohesion: 1.0
Nodes (0): 

### Community 18 - "Hidden Badge UI"
Cohesion: 1.0
Nodes (0): 

### Community 19 - "Dev Setup"
Cohesion: 1.0
Nodes (2): npm install; npx expo start --ios, Expo Go on iPhone

### Community 20 - "Filters Index Module"
Cohesion: 1.0
Nodes (0): 

### Community 21 - "Filter Types Module"
Cohesion: 1.0
Nodes (0): 

### Community 22 - "Color Constants"
Cohesion: 1.0
Nodes (0): 

### Community 23 - "Screens Directory"
Cohesion: 1.0
Nodes (1): src/screens/

### Community 24 - "Theme Colors File"
Cohesion: 1.0
Nodes (1): src/theme/colors.ts

### Community 25 - "Adaptive Icon"
Cohesion: 1.0
Nodes (1): Adaptive Icon: concentric rings on grid background (placeholder/template design)

### Community 26 - "Splash Icon"
Cohesion: 1.0
Nodes (1): Splash Icon - Concentric Circles on Grid

## Knowledge Gaps
- **27 isolated node(s):** `Juste tes amis. Rien d'autre.`, `iOS App (React Native / Expo)`, `Sans pub`, `Sans suggestions`, `Cookies locaux (rien envoyé sur serveur)` (+22 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `App Entry`** (2 nodes): `App()`, `App.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Instagram Filter Builder`** (2 nodes): `buildInstagramFilters()`, `instagram.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Facebook Filter Builder`** (2 nodes): `buildFacebookFilters()`, `facebook.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Filters Context Provider`** (2 nodes): `FiltersProvider()`, `FiltersContext.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Root Tabs Navigation`** (2 nodes): `RootTabs()`, `RootTabs.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Facebook Screen`** (2 nodes): `FacebookScreen()`, `FacebookScreen.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Instagram Screen`** (2 nodes): `InstagramScreen()`, `InstagramScreen.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Settings Screen`** (2 nodes): `handleResetPosition()`, `SettingsScreen.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Hidden Badge UI`** (2 nodes): `HiddenBadge()`, `HiddenBadge.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dev Setup`** (2 nodes): `npm install; npx expo start --ios`, `Expo Go on iPhone`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Filters Index Module`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Filter Types Module`** (1 nodes): `types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Color Constants`** (1 nodes): `colors.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Screens Directory`** (1 nodes): `src/screens/`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Theme Colors File`** (1 nodes): `src/theme/colors.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Adaptive Icon`** (1 nodes): `Adaptive Icon: concentric rings on grid background (placeholder/template design)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Splash Icon`** (1 nodes): `Splash Icon - Concentric Circles on Grid`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Authentique` connect `App Principles & Privacy` to `WebView Filtering System`, `Chronological Feed Routing`, `Preferences & Context`?**
  _High betweenness centrality (0.162) - this node is a cross-community bridge._
- **Why does `@react-native-async-storage/async-storage` connect `Preferences & Context` to `App Principles & Privacy`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Why does `Instagram (web)` connect `WebView Filtering System` to `App Principles & Privacy`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `src/filters/instagram.ts` (e.g. with `FilteredWebView.tsx` and `src/filters/types.ts`) actually correct?**
  _`src/filters/instagram.ts` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `src/filters/facebook.ts` (e.g. with `FilteredWebView.tsx` and `src/filters/types.ts`) actually correct?**
  _`src/filters/facebook.ts` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `Authentique App Icon - Concentric Circles on Grid` (e.g. with `Three Concentric Circles Motif` and `Light Gray Grid Background`) actually correct?**
  _`Authentique App Icon - Concentric Circles on Grid` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Juste tes amis. Rien d'autre.`, `iOS App (React Native / Expo)`, `Sans pub` to the rest of the system?**
  _27 weakly-connected nodes found - possible documentation gaps or missing edges._