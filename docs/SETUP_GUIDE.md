# Concord setup guide

You need: a GitHub account, your Supabase project (already created), and this folder.

## Part A – Supabase (5 min)

1. Open your project at supabase.com → **SQL Editor** → **New query**.
2. Open `supabase/schema.sql`, copy everything, paste, click **Run**. You should see "Success. No rows returned". It is safe to run again later.
3. **Authentication → Providers → Email**: make sure Email is enabled and switch **Confirm email OFF**. (Concord uses names, not real emails, so nothing can be confirmed. If this stays ON, sign-up will say so.)
4. **Authentication → Sign In / Providers**: make sure "Allow new users to sign up" is ON.
5. **Project Settings → API Keys**: check that the Project URL and **Publishable key** match `src/config.ts`. The app uses only these two. Never put the **secret** or **service_role** key in this project or in GitHub.

## Part B – GitHub (10 min)

1. github.com → **New repository**. Name it e.g. `concord`. Choose **Public** (GitHub Pages is free for public repos; the app contains no secrets, only the publishable key that every browser app exposes).
2. Unzip `concord-pwa.zip`. Open the inner `concord-pwa` folder.
3. In the new repo click **uploading an existing file**, then drag in **everything inside** `concord-pwa` (not the folder itself). Commit to `main`.
4. **Check the hidden folder:** the repo must show `.github/workflows/deploy.yml` and `keepalive.yml`. Windows/Mac often hide `.github` when dragging. If it is missing: **Add file → Create new file**, type `.github/workflows/deploy.yml`, paste the contents from the zip, commit. Repeat for `keepalive.yml`.
5. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
6. **Actions** tab → **Deploy to GitHub Pages** → **Run workflow** (it also runs on every commit). Wait for the green tick (about 2 min).
7. Your app: `https://YOUR-USERNAME.github.io/concord/`

Optional: **Settings → Secrets and variables → Actions → Variables** lets you override the connection with `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY`. You do not need this for now.

## Part C – First run

1. Open the app URL. Type **your name** and tap **Request access**. Leaving the password empty makes your name the password.
2. **The very first account becomes Admin and is approved automatically.** Do this before anyone else.
3. Everyone else taps Request access and sees "waiting for approval". You approve them in **⚙ Settings → Accounts** (Accept / Block).
4. Set each person's role, department and Telegram username there. For a Department Head, tick **Elevated** to give them head permissions.
5. Adjust Yes/No access in **Settings → Roles and access**.

## Part D – Install on phones

- Android (Chrome): ⋮ menu → **Install app**.
- iPhone (Safari): Share → **Add to Home Screen**.

## Part E – Keep Supabase awake (5-day tick)

Free Supabase projects pause after about 1 week without activity. `keepalive.yml` calls the database function `ping()` every 5 days (days 1, 6, 11, 16, 21, 26 and 31 of the month).

- **Test now:** Actions → **Supabase keep-alive** → **Run workflow**. A green tick means it worked. In Supabase → Table Editor → `heartbeat` you will see a new row.
- GitHub switches off scheduled workflows after 60 days with no commits in the repo. If that happens, open the Actions tab and click **Enable workflow**, or commit any small change.
- Using the app at least weekly also counts as activity.

## Part F – Changing the app later

Edit a file in GitHub (pencil icon) → **Commit**. The app redeploys by itself in about 2 minutes. Phones update the next time the app opens.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Red banner "Could not load data" | `schema.sql` was not run, or failed. Run it again and read any error |
| "Account created, but Supabase still requires email confirmation" | Turn Confirm email OFF (Part A step 3) |
| Sign-up says email invalid | In `src/config.ts` change `EMAIL_DOMAIN` to another domain, commit |
| Blank page on GitHub Pages | Pages source must be **GitHub Actions**; check the Actions run is green |
| Keep-alive run is red | Make sure `schema.sql` ran (it creates `ping()`); open the run log for the message |
| Someone is locked out of Admin | Supabase SQL Editor: `update profiles set role='admin', account_status='accepted' where username='theirname';` |
| Forgot a password | Supabase → Authentication → Users → delete that user. They tap Request access again and you re-approve them |
