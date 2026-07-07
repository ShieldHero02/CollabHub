# CollabHub v2 API Core

This is the first backend core contract. It is intentionally small.

## Auth

### `GET /api/auth/setup-status`

Returns whether the database needs the first Master account.

### `POST /api/auth/bootstrap`

Creates the first Master account only when there are no users.

Body:

```json
{
  "login": "master",
  "password": "secret-password",
  "displayName": "Master",
  "email": "optional@example.com"
}
```

Side effects:

- seeds system roles;
- seeds permissions;
- creates Master user;
- creates participant profile;
- creates preferences;
- creates server session.

### `POST /api/auth/login`

Logs in with login/password and creates a server session.

### `POST /api/auth/logout`

Deletes the current session.

### `GET /api/me`

Returns the current authenticated user and permissions.

## Users

### `GET /api/users`

Requires `user:manage`.

Returns users, profiles, and role assignments.

### `POST /api/users`

Requires `user:manage`.

Creates a user, participant profile, preferences, and role assignment.

## Participants

### `GET /api/participants`

Requires authentication.

Returns public participant profiles for the community.

## Roles

### `GET /api/roles`

Requires authentication.

Returns roles and permissions. This is read-only for now.

### `GET /api/permissions`

Requires Master-level role management.

Returns available permission keys.

## Legacy Import

### `POST /api/imports/legacy/preview`

Requires `import:legacy`.

Accepts the old static-site JSON export and returns an import summary without writing data.

Summary includes:

- accounts;
- participants;
- teams;
- weekly template slots;
- exact dated slots;
- comments;
- presets;
- events;
- event participant responses;
- warnings.

### `POST /api/imports/legacy`

Requires `import:legacy`.

Imports the old static-site JSON into PostgreSQL.

Mapping:

- `accounts` -> `users`;
- `participants` -> `participant_profiles`;
- `schedules` -> `availability_template_slots`;
- `dateSchedules` -> `availability_slots`;
- `comments` -> `availability_comments`;
- `memberPresets` -> `availability_presets`;
- `teams` -> `teams` + `team_members`;
- `events` -> `events` + `event_participants`.

Old static-site `pinHash` values are imported as legacy SHA-256 hashes. On first successful login, the password is upgraded to argon2.

## Session Model

The browser can use either:

- `Authorization: Bearer <token>`;
- or the httpOnly `collabhub_session` cookie set by the API.

Only session token hashes are stored in PostgreSQL.
