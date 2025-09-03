# Smart AC Backend API (Intermédiaire)

Base URL: `https://<your-backend>/` (dev: `http://localhost:3000`)

Auth: JWT Bearer signé côté serveur (`JWT_SECRET` ou `SUPABASE_JWT_SECRET`).

## Santé
- GET `/health` → `{ ok: true }`

## Authentification
- POST `/auth/session`
  - Body: `{ casPayload: any }` (JSON renvoyé par l'API CAS/NJGGT)
  - Effet: upsert du profil utilisateur (hash du token CAS si présent), retourne un JWT pour ce backend
  - Réponse: `{ token: string, isNew: boolean, user: { id, name?, email?, studentId?, room?, ext? } }`
  - Option: `?debug=1` → ajoute `{ debug: { extracted: { field: { value, path } } } }`

Notes:
- Le backend tente d'extraire un `token` du `casPayload` (heuristique). Pour le dev, le `casPayload` brut est conservé et peut contenir le token; en prod, préférez stocker uniquement un hash et un refresh flow.
- Les champs `name/firstName/lastName/email/studentId/room/ext` sont détectés via une recherche profonde (synonymes: displayName, givenName, surname, sid, roomNumber, extension, etc.).
- Aucune requête externe n'est faite à l'école ici sauf pour les endpoints AC proxifiés.
- L'upsert identifie prioritairement l'utilisateur par `studentId` (s'il est présent). Si aucun `studentId` n'est extrait, on tombe en repli sur un match par `casTokenHash`. Un `studentId` nouvellement trouvé est enregistré pour éviter de créer de futurs doublons.

## Profil
- GET `/profile` (Bearer) → infos du profil
- PUT `/profile` (Bearer)
  - Body: `{ name?, firstName?, lastName?, email?, studentId?, room?, ext? }`
  - Réponse: profil à jour

## Contrôle AC (via votre API uniquement)
- GET `/ac/balance` (Bearer)
  - Proxy de `GET /prepaid/ac-balance` côté école avec le token CAS de l'utilisateur
  - Réponse (succès): objet aplati
    - `{ totalPaidInMinute, balance, chargeUnit, freeMode, billingStartDate, billingEndDate }`
  - Erreur: `{ errorMessage }` (HTTP code cohérent)
- GET `/ac/status` (Bearer)
  - Proxy de `GET /prepaid/ac-status`
  - Réponse: succès → `data`, erreur → `{ errorMessage }`
- GET `/ac/billing-detail` (Bearer)
  - Proxy de `GET /prepaid/billing-cycle-details`
  - Réponse: succès → `data`, erreur → `{ errorMessage }`
- GET `/ac/billing-cycles` (Bearer)
  - Proxy de `GET /prepaid/billing-cycles`
  - Réponse: succès → `data`, erreur → `{ errorMessage }`
- GET `/ac/topup-history` (Bearer)
  - Proxy de `GET /prepaid/topup-history`
  - Réponse: succès → `data`, erreur → `{ errorMessage }`
- POST `/ac/power` (Bearer)
  - Body (strict de base): `{ action: 'on'|'off' }`
  - Durée intégrée (auto-off):
    - Par date de fin: `endDate: ISOString`, ex: `{ action: 'on', endDate: '2024-01-15T12:30:00.000Z' }`
    - Par durée en minutes uniquement: `minutes: number` (entier > 0)
      - Ex: `{ action: 'on', minutes: 30 }`
  - Si `action: 'off'`, la durée est ignorée.
  - Proxy de `POST /prepaid/toggle-status`
  - Réponse: succès → `{ message: 'AirConditioner turned on.'|'AirConditioner turned off.' }`, erreur → `{ errorMessage }`
  - Compat: l'ancien endpoint `/ac/toggle` est supprimé
Supprimés (consolidés dans `/ac/power`): `/ac/power-for`, `/ac/run-for`, `/ac/toggle`

Notes:
- Le token CAS est extrait du `casPayload` stocké pour l'utilisateur. Si absent, la requête renvoie `400`.
- L'URL de base de l'API école peut être configurée via `EXTERNAL_AC_API_BASE` (défaut: `https://w5.ab.ust.hk/njggt/api/app`).
- L'API école peut renvoyer HTTP 200 avec `meta.code` non-200 (ex. 403). Notre API remappe le code HTTP de la réponse sur `meta.code` quand présent, puis retourne soit des données utiles en succès (ou un message pour `/ac/power`), soit `{ errorMessage }` en erreur.
- Si `meta.code` est un code à 4 chiffres (ex. 4033), il est ramené à 3 chiffres en supprimant le dernier (ex. 4033 → 403) avant d'être utilisé comme code HTTP.
 - Cas particulier auth: si le message contient "Invalid Bearer Token." (ou similaire), la réponse est renvoyée en **401** avec `{ errorMessage }`, même si l'amont renvoie 200/meta.code=4032.
 - Cas "déjà dans l'état": si l'amont renvoie un message du type "AirCon already turned-off/on ...", l'API renvoie **409 Conflict** avec `{ errorMessage: 'AirCon already turned-off'|'AirCon already turned-on' }`.

## Programmation d'actions
- GET `/schedule` (Bearer)
  - Réponse: `{ items: ScheduledAction[] }`
- POST `/schedule` (Bearer)
  - Body: `{ type: 'power_on'|'power_off'|'set_timer', payload?: object, scheduledAt: ISOString }`
  - Réponse: `{ action: ScheduledAction }`
- DELETE `/schedule/:id` (Bearer)
  - Annule une action en `pending`

`ScheduledAction`:
```
{
  id: string,
  userId: string,
  type: 'power_on'|'power_off'|'set_timer',
  payload?: object,
  scheduledAt: ISOString,
  status: 'pending'|'running'|'completed'|'failed'|'canceled',
  createdAt: ISOString,
  updatedAt: ISOString,
  executedAt?: ISOString,
  lastError?: string
}
```

## Exécution
- Un ordonnanceur en mémoire (in-process) charge les actions `pending` et les exécute à l'heure prévue.
- Le module `scheduler/executor.ts` est un stub: à remplacer par des appels réels à l'API de l'école avec le token CAS.

## Sécurité / Config
- `JWT_SECRET` ou `SUPABASE_JWT_SECRET` doit être défini côté serveur.
- Les données sont persistées dans `apps/api/data/db.json` (JSON simple) pour le dev. Remplacer par une base (SQLite/Postgres) en prod.
