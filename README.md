# CollabHub

CollabHub is a static local-first web app for quickly understanding who is free, busy, streaming, or ready to join a shared activity.

The project is intentionally not a corporate calendar, task manager, Trello clone, or CRM. The first screen must answer one question fast: who can be invited right now or for a nearby time slot?

## What is included

- week availability heatmap
- month calendar with event previews
- participant schedules with comments per cell
- events as a separate layer over availability
- roles: master, admin, team lead, participant
- teams and team leads
- generated passwords
- JSON export and import
- local persistence through `localStorage`
- static deployment config for GitHub Pages, Netlify, and Vercel

## Run locally

Open `login.html` or `index.html` in a browser.

On the first launch there are no users. The login page creates the first master account.

## Deploy to GitHub Pages

1. Create a new repository on GitHub.
2. Upload all project files to the repository root.
3. Push to the `main` branch.
4. Open repository settings.
5. Go to **Pages**.
6. Select **GitHub Actions** as the source.
7. The included workflow `.github/workflows/pages.yml` will publish the static site.

No build step is required.

## Deploy to Netlify or Vercel

The project can also be deployed as a static site:

- publish directory: `.`
- build command: empty
- entry point: `index.html`

Headers are configured in `netlify.toml` and `vercel.json`.

## Security note

The current version is a trusted-community prototype. Passwords are hashed in the browser, but authentication and roles are still enforced client-side.

Before real production use, move authentication, accounts, permissions, password reset, audit logs, and imports/exports to a backend.
