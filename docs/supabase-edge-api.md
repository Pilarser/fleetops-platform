# Supabase Edge API

The production frontend uses one Supabase Edge Function as its API. Supabase Postgres remains the source of truth, and the service-role database connection is available only inside the function.

## One-time setup

Log the Supabase CLI into your account and link this repository to the existing project:

```bash
supabase login
supabase link --project-ref nzodcewdwgonzbrjrxyl
```

Create a random session-signing secret. Keep the generated value private:

```bash
supabase secrets set FLEET_SESSION_SECRET="$(openssl rand -hex 32)"
```

Apply the assignment constraint, then deploy the function:

```bash
pnpm db:migrate
supabase functions deploy fleet-api
```

The `verify_jwt = false` setting in `supabase/config.toml` is intentional. Login is public, while every protected route verifies the app's own signed session token.

## Verify the deployment

```bash
curl https://nzodcewdwgonzbrjrxyl.supabase.co/functions/v1/fleet-api/health
```

Expected response:

```json
{"ok":true,"service":"fleet-api"}
```

## Connect GitHub Pages

In GitHub, open **Settings > Secrets and variables > Actions > Variables** and create:

```text
VITE_API_URL=https://nzodcewdwgonzbrjrxyl.supabase.co/functions/v1/fleet-api
```

The Pages workflow passes this variable to Vite during the build. Push a commit or rerun the workflow after changing it.
