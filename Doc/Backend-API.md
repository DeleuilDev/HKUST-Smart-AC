# Smart AC Backend API (Intermédiaire)

Base URL: `https://<your-backend>/` (dev: `http://localhost:3000`)

Auth: JWT Bearer signé côté serveur (`JWT_SECRET` ou `SUPABASE_JWT_SECRET`).

## Santé
- GET `/health` → `{ ok: true }`

## Authentification
- POST `/auth/session`
  - Body: `{ casPayload: any }` (JSON renvoyé par l'API CAS/NJGGT)
  - Effet: vérifie d'abord le token auprès de l'API école (appel `GET /prepaid/ac-status`)
    - Si erreur: renvoie l'erreur normalisée `{ errorMessage }` avec un code HTTP cohérent (ex: 401/403)
    - Si OK: upsert du profil utilisateur (hash du token CAS + token brut côté serveur), incrémente `sessionVersion` pour invalider les anciens JWT, puis retourne un nouveau JWT backend
  - Réponse:
    - `{ token: string, isNew: boolean, user: { id, firstName?, lastName?, surname?, lastname?, email?, studentId?, room?, ext?, hallInfo? } }`
      - `surname`: nom de famille (ex: `DELEUIL`)
      - `lastname`: prénoms (ex: `Marius Valentin Alexandre`)
      - `hallInfo`: snapshot des infos résidence, ex:
        - `{ bldg_cde, bldg_short_nam, bldg_apt_room_nbr, bldg_room_bed_nbr, bldg_floor_nbr, bldg_room_type_cde, bldg_room_res_type_ind }`
  - Option: `?debug=1` → ajoute `{ debug: { extracted: { field: { value, path } } } }`

Notes:
- Le backend tente d'extraire un `token` du `casPayload` (heuristique). Pour le dev, le `casPayload` brut est conservé et peut contenir le token; en prod, préférez stocker uniquement un hash et un refresh flow.
- Les champs `name/firstName/lastName/email/studentId/room/ext` sont détectés via une recherche profonde (synonymes: displayName, givenName, surname, sid, roomNumber, extension, etc.).
- Aucune requête externe n'est faite à l'école ici sauf pour les endpoints AC proxifiés.
- L'upsert identifie prioritairement l'utilisateur par `studentId` (s'il est présent). Si aucun `studentId` n'est extrait, on tombe en repli sur un match par `casTokenHash`. Un `studentId` nouvellement trouvé est enregistré pour éviter de créer de futurs doublons.

## Profil
- GET `/profile` (Bearer) → infos du profil
- PUT `/profile` (Bearer)
  - Body: `{ firstName?, lastName?, surname?, lastname?, email?, studentId?, room?, ext?, hallInfo? }`
  - Réponse: profil à jour (inclut `hallInfo`)

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
- Le token CAS est résolu en priorité depuis `user.acToken.value` (stocké côté serveur) puis, en repli, extrait du `casPayload` sauvegardé. Si absent, la requête renvoie `400`.
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

Nouveaux (avancés):
- POST `/schedule/range` (Bearer)
  - Body: `{ start: ISOString, end: ISOString }` → crée `power_on@start` et `power_off@end` dans un même groupe
  - Réponse: `{ groupId: string, items: ScheduledAction[] }`
- POST `/schedule/weekly` (Bearer)
  - Body: `{ daysOfWeek: number[], startTime: 'HH:mm', endTime: 'HH:mm', fromDate?: ISOString, toDate?: ISOString, weeksCount?: number }`
  - Si `toDate` absent, `weeksCount` par défaut à 8 semaines à partir de `fromDate|now`
  - Crée deux actions par jour sélectionné (ON/OFF), regroupées sous un `groupId`
  - Réponse: `{ groupId: string, items: ScheduledAction[] }`
- POST `/schedule/smart-cycle` (Bearer)
  - Body: `{ runMinutes: number, pauseMinutes: number, totalMinutes: number, startAt?: ISOString }`
  - Effet: planifie une séquence de `set_timer` (AC ON avec auto-off) qui s'enchaîne avec des pauses jusqu'à atteindre `totalMinutes`.
    - Exemple: `run=20`, `pause=10`, `total=180` → ~9 cycles ON 20m, OFF 10m (dernier cycle éventuellement tronqué pour ne pas dépasser `total`).
  - Contraintes: `runMinutes > 0`, `pauseMinutes >= 0`, `totalMinutes > 0`, garde-fou `<= 500` cycles.
  - Réponse: `{ groupId: string, items: ScheduledAction[] }` (chaque item est de type `set_timer` avec `payload.minutes`).

## Smart Mode (persistant)
- GET `/smart-mode` (Bearer)
  - Réponse: `{ config: { userId, runMinutes, pauseMinutes, totalMinutes?, startAt?, active, remainingMinutes?, phase?, nextAt?, startedAt?, endsAt? } | null }`
- POST `/smart-mode` (Bearer)
  - Body: `{ runMinutes: number, pauseMinutes: number, totalMinutes?: number, startAt?: ISOString, active?: boolean }`
  - Effet: enregistre la configuration (1 ligne par utilisateur) et démarre/relance Smart Mode. `totalMinutes` est optionnel (fonctionne en continu sinon).
  - Réponse: `{ config }`
- DELETE `/smart-mode` (Bearer)
  - Effet: arrête Smart Mode (désactive et annule les redémarrages futurs), et coupe la clim (OFF) immédiatement.
  - Réponse: `{ ok: true, turnedOff: boolean }`

Notes:
- Un orchestrateur en mémoire exécute Smart Mode sans créer de multiples actions planifiées; il ne garde qu’un prochain déclenchement.
- Un OFF manuel via `POST /ac/power { action: 'off' }` stoppe aussi Smart Mode pour l’utilisateur.
- GET `/schedule/groups` (Bearer)
  - Regroupe les actions par `payload.groupId` → `{ items: { id, count, pending, first, last }[] }`
- DELETE `/schedule/groups/:id` (Bearer)
  - Annule toutes les actions `pending` du groupe

### Plan hebdomadaire (persistant)
- GET `/schedule/weekly-plan` (Bearer)
  - Réponse: `{ plan: { id, userId, mode: 'on'|'off', slots: boolean[168], hours?: { mon:number[], tue:number[], wed:number[], thu:number[], fri:number[], sat:number[], sun:number[] } } | null }`
- PUT `/schedule/weekly-plan` (Bearer)
  - Body: `{ mode: 'on'|'off', slots: boolean[168] }`
  - Réponse: `{ plan }` (inclut `slots` et le champ dérivé `hours` pour lecture humaine)

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
 - Smart Mode: `scheduler/smartMode.ts` pilote les cycles ON/pause et gère `remainingMinutes` si `totalMinutes` est défini.

## Sécurité / Config
- `JWT_SECRET` ou `SUPABASE_JWT_SECRET` doit être défini côté serveur.
- Les données sont persistées dans `apps/api/data/db.json` (JSON simple) pour le dev. Remplacer par une base (SQLite/Postgres) en prod.
