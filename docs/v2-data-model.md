# CollabHub v2 Data Model Draft

This is the first database draft. Names can still change before implementation.

## Main Tables

### users

Authentication identity.

- `id`
- `login`
- `email`
- `password_hash`
- `role_key`
- `status`
- `created_at`
- `updated_at`

`role_key` is the user's primary role key for quick reads. Full permissions are resolved through `user_roles`, `access_roles`, `role_permissions`, and `permissions`.

### access_roles

Configurable roles. System roles are seeded, but Master can add new roles later.

- `id`
- `key`
- `name`
- `description`
- `is_system`
- `is_master_managed`
- `created_at`
- `updated_at`

Seed roles:

- `master`
- `head_admin`
- `admin`
- `manager`
- `teamlead`
- `member`
- `viewer`

Only Master can create, edit, delete, or assign role permissions.

### permissions

Atomic access flags.

- `id`
- `key`
- `description`
- `created_at`

Important first-version permissions:

- `dashboard:view`
- `schedule:view:self`
- `schedule:view:team`
- `schedule:view:all`
- `schedule:edit:self`
- `schedule:edit:team`
- `schedule:edit:all`
- `event:view:all`
- `event:respond:all`
- `event:create`
- `event:edit:own`
- `event:delete:own`
- `event:manage:team`
- `event:edit:all`
- `event:delete:all`
- `team:view`
- `team:manage`
- `user:manage`
- `role:manage`
- `import:legacy`
- `system:manage`

### user_roles

Role assignments for users.

- `user_id`
- `role_id`
- `created_at`

### role_permissions

Permission assignments for roles.

- `role_id`
- `permission_id`
- `created_at`

### participant_profiles

Public participant profile connected to a user.

- `id`
- `user_id`
- `display_name`
- `color`
- `avatar_url`
- `interests`
- `created_at`
- `updated_at`

### user_preferences

Personal cabinet settings.

- `user_id`
- `theme`
- `density`
- `timezone`
- `week_starts_on`
- `default_view`
- `show_events`
- `created_at`
- `updated_at`

### teams

- `id`
- `name`
- `color`
- `lead_profile_id`
- `created_at`
- `updated_at`

### team_members

- `team_id`
- `profile_id`
- `created_at`

### availability_slots

One participant status for one exact date/hour.

- `id`
- `profile_id`
- `date`
- `hour`
- `status`
- `created_at`
- `updated_at`

Unique key:

```text
profile_id + date + hour
```

### availability_comments

Comment attached to one cell.

- `id`
- `profile_id`
- `date`
- `hour`
- `body`
- `created_at`
- `updated_at`

Unique key:

```text
profile_id + date + hour
```

### availability_presets

Personal fill presets.

- `id`
- `profile_id`
- `name`
- `start_hour`
- `end_hour`
- `status`
- `created_at`
- `updated_at`

### events

Event overlay.

- `id`
- `title`
- `activity`
- `description`
- `date`
- `start_hour`
- `end_hour`
- `created_by_user_id`
- `team_id`
- `visibility`
- `created_at`
- `updated_at`

Events can overlap. The UI decides how to stack them.

### event_participants

Status of every participant in an event.

- `event_id`
- `profile_id`
- `status`
- `updated_at`

Statuses:

- `going`
- `maybe`
- `no`
- `invited`

### connected_accounts

Future external login providers.

- `id`
- `user_id`
- `provider`
- `provider_account_id`
- `display_name`
- `created_at`
- `updated_at`

Providers later:

- `google`
- `twitch`

### import_jobs

Legacy JSON import tracking.

- `id`
- `created_by_user_id`
- `status`
- `source_format`
- `summary`
- `error`
- `created_at`
- `finished_at`

### audit_logs

Important mutations.

- `id`
- `actor_user_id`
- `action`
- `entity_type`
- `entity_id`
- `metadata`
- `created_at`

## Permission Rules

### View

- authenticated users can view participant profiles and availability;
- future public pages can expose only selected public data.

### Edit Availability

- member: own profile only;
- teamlead: own profile, plus future team-specific actions;
- admin/master: all profiles.

### Edit Events

- member: can view all community events, respond to any event, create events, edit/delete only own events;
- teamlead: member permissions plus team event management;
- manager: can use dashboard, create events, and manage events for coordination;
- admin/head_admin/master: manage all events depending on role permissions.

Event visibility and event editing are separate:

- seeing an event does not grant editing;
- responding to an event does not grant editing;
- participants can respond to other people's events;
- only creator or elevated roles can edit/delete the event itself.

### Manage Roles

- Master only.
- Admins can manage users only if granted `user:manage`.
- Role and permission management requires `role:manage` and must still be limited to Master account.

### Manage Users

- master: all;
- admin: non-master accounts, depending on final policy;
- teamlead/member: no user management.

## Legacy JSON Import Mapping

Legacy data must be migrated once into normalized tables:

- `accounts` -> `users`
- `participants` -> `participant_profiles`
- `schedules` and `dateSchedules` -> `availability_slots`
- `comments` -> `availability_comments`
- `events` -> `events` + `event_participants`
- `memberPresets` -> `availability_presets`
- `teams` -> `teams` + `team_members`

After import, JSON is no longer used as storage.

