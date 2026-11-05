# Concord – flow, access and configuration

## 1. App flow

| Step | What happens | Who | Result |
|---|---|---|---|
| Sign in | Name + password (empty = name). New accounts wait for Admin to Accept or Block | Anyone | Access only once accepted |
| Create discussion | Title, remarks, checklist. D-date auto-sets to creation + 7 days unless Admin/Head picks one | Any approved user | Card in **Gathering** |
| Participants | Admin adds people. Auto-add rules add people on creation. The creator is always a participant | Admin | Participants can tick items and add checklist items |
| Gathering | Tick items, add remarks and notes | Participants | Progress on the card |
| Gathering prompt | From D-date − 2 days | Admin (copy text) | Telegram message |
| Decision | Move to Agreed or Approved. Simple items can go straight to Resolved | Admin / Head | Decision date stored |
| Implementation check | From decision + 7 days | Admin (copy text) | Telegram message |
| Confirm | Mark Resolved after implementation | Admin / Head | **Resolved** |
| Problem found | Move to **Unresolved**: "Review on" date = +7 days | Admin / Head | Later back to Gathering, Agreed/Approved or Resolved |
| Follow-ups | Week/month calendar with D-date tiles and follow-up tiles, plus timestamped notes | Everyone | Shared view |
| Polls | Yes / Some / No, to All staff or chosen people, optionally linked to a discussion | Everyone | Counts and per-person answers |
| Old | Items moved to Old are hidden, never deleted; use the Old filter | Admin / Head | Recoverable |

Allowed status moves (enforced in the database): Gathering → Agreed, Approved, Resolved, Unresolved · Agreed/Approved → Resolved, Unresolved · Resolved → Unresolved · Unresolved → Gathering, Agreed, Approved, Resolved. There are no direct backward moves.

## 2. Roles and access

Stored in the `permission_matrix` table and editable in **Settings → Roles and access**. Admin is always Yes. A Department Head uses the Head column only while **Elevated** is ON; otherwise they use the Staff column.

| Capability | Admin | Head (elevated) | Staff |
|---|---|---|---|
| View all discussions, polls, calendar | Yes | Yes | Yes |
| Create discussions | Yes | Yes | Yes |
| Add/remove participants | Yes | No | No |
| Add checklist items | Yes | Yes | Only on topics they belong to |
| Tick items, add remarks and notes | Yes | Yes | On topics they belong to |
| Set or change D-date | Yes | Yes | No |
| Change status, move to Old | Yes | Yes | No |
| Edit a discussion after Agreed/Approved | Yes | Yes | No |
| Add follow-ups | Yes | Yes | Yes |
| Create polls / answer polls | Yes | Yes | Yes |
| Close or delete polls | Yes | Yes | No |
| Open Settings page | Yes | **Toggle** | No |
| See Telegram prompts | Yes | Toggle | No |
| See audit log | Yes | Toggle | No |
| Accounts, roles, matrix, auto-add, app settings, logins | Yes | No | No |

Everything above is enforced by database rules (RLS), not only hidden in the screen.

## 3. Settings page

| Section | Purpose | Function |
|---|---|---|
| Telegram prompts | Know who to chase today | Copy-ready messages per owner and unfinished item |
| Accounts | Control who gets in | Accept / Block, role, department, Telegram username, Elevated switch |
| Roles and access | Role/access table | Yes/No per capability for Head and Staff |
| Auto-add rules | Fast participant setup | "Every discussion", "title contains…", "never when title contains…" |
| App settings and templates | Tune the rhythm | Timezone, day counts, Telegram texts |
| Audit log | Accountability | Who changed what and when, including poll answer edits. **Copy for AI** puts a ready prompt plus the log on your clipboard |
| Logins | See access | Every sign-in with time and device |

## 4. Where to change things

| I want to… | Change |
|---|---|
| Day counts, timezone, Telegram wording | In the app: Settings → App settings and templates |
| Who can do what | In the app: Settings → Roles and access |
| App name, tagline, hidden email domain | `src/config.ts` |
| Connect a different Supabase project | `src/config.ts` (or GitHub Actions variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY`) |
| Colours and spacing | top of `src/styles.css` (`:root` variables) |
| Add a new permission | Add a row to `permission_matrix` in `schema.sql`, then use `can('your_key')` in the screen and `has_cap('your_key')` in a policy |
| Status names or flow | `src/config.ts` (`STATUS_*`, `NEXT`) **and** `discussions_guard()` plus the status check constraint in `schema.sql` |
| Keep-alive frequency | `cron` line in `.github/workflows/keepalive.yml` |

## 5. Notes and limits

- **Logins:** blocking is per account and takes effect at once. Every sign-in is logged for Admin; there is no per-device approval.
- **Passwords:** a short password such as a first name is accepted. A hidden suffix (`PASSWORD_SUFFIX`) is added so Supabase's minimum length is met. This is convenient, not strong security: anyone who knows a colleague's name can try it, so keep Admin's password strong.
- **Poll answers** are visible to every approved user.
- **Prompts** are calculated live; there is no "sent" record, because messages are copied by hand.
- The app loads up to 1,000 rows per table. That is far above a department's needs.
