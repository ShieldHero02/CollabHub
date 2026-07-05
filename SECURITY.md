# Security

CollabHub is currently a static local-first prototype.

## Current model

- Data is stored in `localStorage`.
- Passwords are hashed in the browser with Web Crypto before being saved.
- Roles and access checks run in client-side JavaScript.
- There is no backend session, server-side account store, or server-side permission layer.

## Before real production use

Move authentication, password reset, account management, schedule permissions, event permissions, audit logs, and imports/exports to a backend.

Do not treat the current client-side role system as protection against a motivated attacker. It is suitable for a trusted community prototype and UI testing.

