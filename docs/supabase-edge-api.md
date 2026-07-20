# Supabase Edge API

The production frontend uses one Supabase Edge Function as its API. Supabase Postgres remains the source of truth, and the service-role database connection is available only inside the function.

## One-time setup

Log the Supabase CLI into your account and link this repository to the existing project:

```bash
supabase login
supabase link --project-ref nzodcewdwgonzbrjrxyl
```

Apply pending database migrations, then deploy the function:

```bash
pnpm db:migrate
supabase functions deploy fleet-api
```

The `verify_jwt = false` setting in `supabase/config.toml` is intentional. Login is public, while every protected route validates the Supabase access token and loads its company profile.

## Verify the deployment

```bash
curl https://nzodcewdwgonzbrjrxyl.supabase.co/functions/v1/fleet-api/health
```

Expected response:

```json
{"ok":true,"service":"fleet-api"}
```

## Connect GitHub Pages

In Supabase, open **Project Settings > API Keys** and copy the publishable key. The legacy `anon` key also works during the key transition.

In GitHub, open **Settings > Secrets and variables > Actions > Variables** and create these repository variables:

```text
VITE_API_URL=https://nzodcewdwgonzbrjrxyl.supabase.co/functions/v1/fleet-api
VITE_SUPABASE_URL=https://nzodcewdwgonzbrjrxyl.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=PASTE_THE_PUBLISHABLE_KEY
```

The Pages workflow passes these variables to Vite during the build. Push a commit or rerun the workflow after changing them.

## Demo account migration

The first successful login for each existing demo account creates or links a Supabase Auth identity and removes that account's legacy password hash from the public `User` row. Subsequent logins, session restoration, and token refresh use Supabase Auth.

After logging in, verify both locations in the Supabase dashboard:

- **Authentication > Users** contains the email.
- **Table Editor > User** has an `authUserId` and a null `password` for the same email.
