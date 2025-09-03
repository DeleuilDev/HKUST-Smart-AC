# Authentification CAS (WebView)

Objectif: reproduire le login CAS (SSO + Duo) dans l'app, récupérer le JSON du token renvoyé par `POST /njggt/api/app/auth/cas/auth`, le stocker de façon sécurisée, et l'utiliser pour les appels API.

## Flux

1. L'app ouvre la page d'entrée `https://w5.ab.ust.hk/njggt/app/home` dans une WebView. Si l'utilisateur n'est pas authentifié, cette page redirige vers CAS (Shibboleth) et enchaîne les étapes SSO/MFA.
2. Après succès, le frontend de `njggt` appelle `POST /njggt/api/app/auth/cas/auth` et reçoit un JSON contenant un jeton d'accès.
3. L'app injecte un script dans la WebView pour intercepter les réponses `fetch/XMLHttpRequest` vers cet endpoint et envoie le JSON à React Native via `window.ReactNativeWebView.postMessage`.
4. Le JSON est parsé côté natif, un éventuel champ `token` est extrait, et l'ensemble du payload est stocké dans `Expo SecureStore`.
5. Les appels API suivants ajoutent `Authorization: Bearer <token>`.

## Endpoints

- POST `https://w5.ab.ust.hk/njggt/api/app/auth/cas/auth` → JSON avec les infos utilisateur et le token.

## Sécurité

- Le token est stocké avec `expo-secure-store` (chiffrage OS). Aucun secret n'est commité.
- En cas de 401/403, l'app invalide le token et redirige l'utilisateur vers la page de connexion.

## Personnalisation

- Les URLs par défaut peuvent être surchargées par variables `EXPO_PUBLIC_AC_BASE_URL` et `EXPO_PUBLIC_AC_APP_ENTRY_URL`.

