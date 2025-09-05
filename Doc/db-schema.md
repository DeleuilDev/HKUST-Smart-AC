# Smart AC – Schéma de données (Supabase/Postgres)

Objectif: remplacer `apps/api/data/db.json` par un schéma SQL normalisé, compatible Supabase (Postgres + RLS). Ce design couvre: utilisateurs, Halls/Chambres/Lits, unités AC, comptes prépayés, timers, sessions d'usage, historique de recharges, et jetons CAS.

## Vue d’ensemble (entités principales)

- Users: profil étudiant + mapping CAS, version de session.
- Spaces (simplifié): une table unique avec `hall_code`, `hall_name`, `room`, `bed`.
- AC Units: unités par chambre, état, mode urgence, télémétrie minimale.
- AC Accounts (prépayé par chambre): solde en minutes, cycle de facturation.
- Memberships: lien utilisateur → chambre (résident/RA/admin), dates.
- Timers & Usage: programmations et sessions réelles (ON→OFF) avec minutes déduites.
- Top-ups: historique des recharges (min).
- CAS Tokens: jetons CAS hachés et expirables; accès serveur uniquement.

## Notes Supabase

- `public.users.id` référence `auth.users(id)` pour aligner l’Auth Supabase et les profils applicatifs.
- RLS activé sur toutes les tables orientées client; politiques basées sur `auth.uid()` et l’appartenance à la chambre.
- Les jetons CAS sont inaccessibles aux clients (politiques serveur seulement).

## Tables et champs clés

1) users
- id (uuid, PK, FK → auth.users.id)
- email (text, unique), student_id (text, unique)
- surname (text), given_names (text), full_name (text)
- session_version (int, default 1)
- created_at, updated_at, last_login_at (timestamptz)

2) spaces (remplace halls/rooms/beds)
- id (bigserial, PK), hall_code (text), hall_name (text)
- room (text), bed (text), campus (text), active (bool)

5) room_memberships (simple)
- id (bigserial, PK), user_id (uuid, FK → users), space_id (FK → spaces)
- role (enum: resident | ra | admin)
- start_date (date), end_date (date, nullable)
  (pas de contrainte forte d’unicité/chevauchement ici pour garder simple)

6) ac_units
- id (bigserial, PK), room_id (FK → rooms)
- device_id (text, unique par déploiement), unique(room_id, device_id)
- power_state (bool, default false)
- emergency_mode (bool, default false), emergency_reason (text)
- last_seen_at (timestamptz), firmware_version (text)

7) ac_accounts (prépayé, 1:1 avec room ou 1:N si besoin)
- id (bigserial, PK), room_id (FK → rooms, unique si 1:1)
- charge_type (text, check in ['prepaid','postpaid'])
- minutes_balance (int >= 0, default 0)
- billing_cycle_day (int 1..28, default 1) – calcul rolling mensuel
- updated_at (timestamptz)

8) ac_timers
- id (bigserial, PK), account_id (FK → ac_accounts), ac_unit_id (FK → ac_units)
- created_by (uuid, FK → users)
- start_at, end_at (timestamptz)
- status (enum: scheduled | running | canceled | completed)
- created_at (timestamptz)

9) ac_usage_sessions
- id (bigserial, PK), account_id (FK → ac_accounts), ac_unit_id (FK → ac_units)
- started_by (uuid, FK → users), ended_by (uuid, FK → users, nullable)
- started_at, ended_at (timestamptz)
- duration_minutes (int), minutes_deducted (int)
- created_at (timestamptz)

10) top_ups
- id (bigserial, PK), account_id (FK → ac_accounts)
- user_id (uuid, FK → users, nullable si crédit système)
- amount_minutes (int > 0), source (text), reference (text)
- created_at (timestamptz)

11) cas_tokens (accès serveur uniquement)
- id (bigserial, PK), user_id (uuid, FK → users, unique)
- token_hash (text unique, non nul), issued_at, expires_at (timestamptz)
- consumed_at (timestamptz, nullable)
- payload (jsonb, optionnel)
- Règle: 1 token actif par utilisateur (l’API remplace l’ancien à chaque upsert)

## RLS (principes)

- users: SELECT/UPDATE restreint à `auth.uid() = users.id` (sauf admin).
- halls: SELECT pour tout utilisateur authentifié.
- spaces/ac_units/ac_accounts: SELECT si `EXISTS` d’un membership actif sur le `space_id`; UPDATE limité (ex: power toggle, timer) au membre.
- room_memberships: SELECT limité au propriétaire; INSERT/UPDATE par rôle serveur/admin.
- ac_timers, ac_usage_sessions, top_ups: SELECT si accès au compte; INSERT selon règles (utilisateur créateur ou serveur).
- cas_tokens: aucune policy client → non lisible/écrivable par les rôles `anon/authenticated`.

## Mapping avec les données actuelles (`db.json`)

- user.surname / lastname / email / studentId → `users`.
- hallInfo.{bldg_cde, bldg_short_nam} → `halls` (code, short_name).
- hallInfo.{bldg_cde, bldg_short_nam} → `spaces.{hall_code,hall_name}`
- hallInfo.{bldg_apt_room_nbr, bldg_room_bed_nbr} → `spaces.{room,bed}`
- casTokenHash → `cas_tokens.token_hash`; casPayload.data.student → réparti entre `users`/`halls`/`rooms`.
- charge_type (prepaid) → `ac_accounts.charge_type` + solde `minutes_balance`.

## Fichier SQL

Un brouillon SQL prêt pour Supabase est fourni dans `Doc/db-schema.sql` (création des tables, index et RLS de base).
