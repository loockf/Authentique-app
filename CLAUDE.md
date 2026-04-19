# CLAUDE.md — Authentique

## Projet
React Native + Expo + TypeScript. Social media alternatif : privacy, flux chronologique, filtrage WebView Instagram/Facebook. AsyncStorage. Pas encore en production.

## Qui je suis
Luca. Non-développeur. Je valide les changements. Réponds en français, concis, avec analogies plutôt que jargon.

## RÈGLES D'ÉDITION (CRITIQUE)

**OBLIGATOIRE** : lire `graphify-out/GRAPH_REPORT.md` AVANT d'explorer le code.

**INTERDIT** : réécrire un fichier entier quand seules quelques lignes changent. Utilise Edit/str_replace pour cibler les modifications exactes.

**INTERDIT** : lire le projet en entier pour "comprendre". `graphify-out/GRAPH_REPORT.md` existe pour ça — consulte-le d'abord.

**OBLIGATOIRE** : Grep avant Read. Cherche le symbole précis (fonction, variable), ne lis jamais un fichier complet si tu n'as besoin que d'une section. Utilise offset/limit si le fichier dépasse 200 lignes.

## Workflow obligatoire

Pour toute modif de code :
1. **Plan en 3-5 lignes** : fichiers concernés, ce qui change, impact ailleurs
2. **Attendre mon OK** avant d'éditer
3. Exécuter de façon ciblée
4. **Résumé en 2 phrases max** : ce qui a changé + comment tester

Exception : question ou debug simple → réponse directe, pas de plan.

## Style

- Français, concis.
- **Pas de préambule** ("Je vais maintenant...", "Bien sûr, voici...")
- **Pas de récap** de ce que j'ai dit juste avant
- **Une seule question** si ambiguïté, pas trois

## Ne jamais modifier sans confirmation explicite

`package.json`, `package-lock.json`, `app.json`, `tsconfig.json`, `.env*`, dossier `assets/`, `.gitignore`

## Changements sensibles (demander confirmation AVANT de commencer)

- Modifs qui touchent plus de 3 fichiers
- Toute modif dans `src/filters/` ou `FilteredWebView.tsx` (composants centraux du projet)
- Refactors
→ Proposer d'abord une alternative plus petite. Suggérer un commit git préalable pour rollback facile.

## Fin de feature

Me suggérer `/compact` quand une feature est terminée. Pour un sujet totalement nouveau, suggérer `/clear`.
