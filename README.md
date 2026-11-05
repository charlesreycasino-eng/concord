# Concord – Meet. Agree. Execute.

A mobile-first PWA for running department meetings: discussions with a status flow, a follow-up calendar, polls, and copy-ready Telegram prompts. React + TypeScript + Supabase, hosted free on GitHub Pages.

**Start here:** `docs/SETUP_GUIDE.md` (about 20 minutes, no coding).

| File | What it is |
|---|---|
| `docs/SETUP_GUIDE.md` | Step-by-step: Supabase, GitHub, Pages, install on phone, keep-alive |
| `docs/CONCORD_SPEC_AND_CONFIG.md` | Flow, roles, access tables, and where to change things |
| `docs/TELEGRAM_TEMPLATES.md` | Prompt templates and placeholders |
| `supabase/schema.sql` | Tables, security rules, triggers, seed data (run once) |
| `.github/workflows/deploy.yml` | Builds and publishes the app on every commit |
| `.github/workflows/keepalive.yml` | Pings Supabase every 5 days so it never pauses |

Local development (optional): `npm install`, then `npm run dev`.
