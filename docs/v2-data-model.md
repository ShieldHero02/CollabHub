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

Users are login accounts. A user can have one participant profile in the first version. The system may later allow service accounts or viewer accounts without a participant profile.

### sessions

Server-side session records.

- `id`
- `user_id`
- `token_hash`
- `expires_at`
- `created_at`
- `last_seen_at`

Only token hashes are stored. Raw session tokens are never stored in the database.

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

This is the person visible in schedules, teams, events, and availability aggregation.

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

Team membership does not replace roles. Roles answer "what can this account do"; teams answer "which people are grouped together".

### availability_template_slots

Default weekly schedule for one participant.

- `id`
- `profile_id`
- `day_of_week`
- `hour`
- `status`
- `created_at`
- `updated_at`

Unique key:

```text
profile_id + day_of_week + hour
```

Rules:

- `day_of_week` uses 0-6, Monday first;
- `hour` uses 0-23;
- this table stores the recurring weekly baseline;
- exact dated slots override the template.

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

Rules:

- this table stores concrete planning for exact dates;
- it supports planning weeks or months ahead;
- if a concrete date/hour is absent, the weekly template is used;
- if both are absent, status is `unknown`.

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

Comments are tied to exact dates, not to the recurring weekly template. This keeps notes like "late stream today" from repeating forever by accident.

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

Presets describe reusable fill actions. In v2 first version a preset is a single time range and status. More complex multi-block presets can be added later without changing schedule storage.

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

Events are not availability. They are a separate overlay on top of availability data.

Rules:

- an event belongs to the user who created it;
- the creator can edit/delete it if their role grants own-event permissions;
- elevated roles can manage broader event scopes;
- multiple events can exist at the same date/time;
- event participants are responses, not schedule replacements.

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

## Availability Resolution

For any `profile_id + date + hour`, backend resolves availability in this order:

1. `availability_slots` exact date/hour.
2. `availability_template_slots` for matching weekday/hour.
3. `unknown`.

Events are fetched separately and rendered as an overlay. They must not overwrite availability slots.

This keeps the product centered around people:

- weekly defaults make common availability fast to fill;
- dated slots allow planning specific weeks/months ahead;
- comments explain exceptional cells;
- events show collaboration opportunities without becoming the source of truth for availability.

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
- `schedules` -> `availability_template_slots`
- `dateSchedules` -> `availability_slots`
- `comments` -> `availability_comments`
- `events` -> `events` + `event_participants`
- `memberPresets` -> `availability_presets`
- `teams` -> `teams` + `team_members`

After import, JSON is no longer used as storage.

