# Security Model

## Role Policy

| Capability | Fleet admin | Manager | Finance | Support | Driver |
| --- | --- | --- | --- | --- | --- |
| Read company workspace | Yes | Yes | Yes | Yes | No |
| Manage vehicles, drivers, and services | Yes | Yes | No | No | No |
| Create and review transactions | Yes | Yes | Yes | No | No |
| View financial reports | Yes | Yes | Yes | No | No |
| Manage team invitations | Yes | Driver accounts only | No | No | No |
| Submit driver expenses | No | No | No | No | Own account |

Invited accounts may access only the identity and account-completion flow. Disabled accounts cannot create an API session.

## Company Isolation

- The authenticated profile supplies the trusted `companyId`; request payloads never choose it.
- Every production workspace, mutation, notification, event, receipt, and account query filters by that `companyId`.
- Driver transaction and receipt queries additionally match the authenticated user's linked driver record.
- Receipt objects are private and stored beneath `companyId/driverId/transactionId`.
- Public tables use row-level security with no direct `anon` or `authenticated` table grants. The Edge Function is the application data boundary.

## Regression Coverage

- API tests cover authentication, the role matrix, invitation state, notification ownership, and driver ownership.
- Playwright covers driver submission, admin notification/review, and the resulting driver notification.
