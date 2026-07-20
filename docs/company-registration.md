# Company Registration

FleetOS allows one verified user to create a company workspace as its first `fleet_admin`. Additional users will join through invitations in the next phase.

## Supabase Auth configuration

In the Supabase dashboard, open **Authentication > URL Configuration**.

Set the Site URL to:

```text
https://pilarser.github.io/fleetops-platform/
```

Add these Redirect URLs:

```text
https://pilarser.github.io/fleetops-platform/
http://localhost:5174/**
```

In the Email provider settings, keep email confirmation enabled. If the confirmation email template has been customized, ensure its confirmation link uses `{{ .RedirectTo }}` so the `emailRedirectTo` value supplied by the app is honored.

## Deploy

Apply the company-scoped service migration and deploy the Edge API before deploying the frontend:

```bash
pnpm db:migrate
supabase functions deploy fleet-api
```

Then commit and push the application changes. The existing GitHub repository variables for the API URL, Supabase URL, and publishable key are reused.

## Manual verification

1. Open the deployed site and select **Create an account**.
2. Register with a new email address that you can access.
3. Confirm that no new row exists in the public `Company` table before email verification.
4. Open the confirmation email in the same browser and follow the link.
5. Confirm that the app opens the new, empty workspace without asking for another login.
6. In Supabase, verify one new `Company`, one `User` with role `fleet_admin`, and eight company-scoped `MobilityService` rows.
7. Log out and back in with the new credentials.

