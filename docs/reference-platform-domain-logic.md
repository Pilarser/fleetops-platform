# Reference platform domain logic

Audit date: 2026-09-24

This document records product behaviour observed in an authenticated reference workspace. It intentionally excludes customer data and credentials. It is a reference for product design and implementation, not a request to reproduce proprietary styling or copy.

## Product boundaries

The reference platform behaves as a configurable fleet operating system with several domains:

1. Fleet core: companies, vehicles, drivers, assignments, cost centres and lifecycle states.
2. Operations: documents, expirations, tasks, mileage requests, replacement vehicles, plate changes and renewals.
3. Mobility ledger: provider movements, tax amounts, validation, invoice state and audit history.
4. Service entitlements: licences and devices assigned to vehicles or drivers.
5. Finance: invoices, payment configuration, cost reports and payroll deductions.
6. Specialist products: fines, booking, car configuration, ordering, rental campaigns, fuel analysis, parking, emissions and maps.

For our first demo, domains 1–4 matter most. Finance can be represented at reporting level. Specialist products should remain separate bounded modules.

## Tenant and organisation scope

Observed hierarchy:

- Holding
- Region and country filters
- Legal entity
- Organisational unit
- Cost centre and profit centre

Logic:

- Every operational record belongs to a holding and normally a legal entity.
- Global fleet managers can view aggregated data; narrower profiles should see only their assigned scope.
- Dashboard totals and all registry filters inherit the active organisational scope.
- Changing scope is not simply a visual filter: it changes the records, services and actions available to the user.
- Organisational units can form a hierarchy and carry accounting identifiers.

Our current `Company` model represents one tenant but has no holding/legal-entity hierarchy.

## Vehicles

Observed registry modes:

- active/current vehicles;
- closed vehicles;
- replacement history.

Observed vehicle data and behaviour:

- lifecycle state such as ordered, installed and closed;
- plate, make, model and trim;
- acquisition formula, including rental;
- usage type, such as mixed/personal-business or service use;
- current driver or an explicit available/to-be-reassigned state;
- location and position timestamps when telematics is active;
- configurable table columns, filters, selection and export;
- bulk and row-level actions.

Observed actions after selecting a vehicle:

- assign a driver;
- request a mileage reading;
- request a replacement vehicle;
- change plate;
- add a renewal;
- transfer ownership/contract;
- send an installation email.

Core rule:

A vehicle assignment must be a dated record, not only `driver.vehicleId`. Reassignment closes the previous assignment and opens a new one. This enables replacement history, payroll calculations, fine attribution and reliable audit.

Recommended lifecycle:

`ordered -> installed/active -> temporarily_unavailable -> closed`

Additional processes such as plate change, renewal and replacement should be workflow records linked to the vehicle rather than extra vehicle statuses.

## Drivers

Observed registry modes:

- current drivers;
- archived drivers.

Observed driver data and behaviour:

- identity and contact information;
- fiscal identifier and primary phone;
- profile/role;
- fleet band or eligibility band;
- one or more current vehicle references in exceptional cases;
- service/access state distinct from archival state;
- personal-use management;
- external registry check;
- configurable columns, filters and export.

Observed actions:

- manage the driver record;
- send communications;
- assign a vehicle;
- manage personal use;
- query an external transport registry.

Core rules:

- Account status and driver employment/fleet status are separate concepts.
- Archiving a driver must end active assignments and may generate tasks.
- A driver may have assignment history even if the usual policy allows only one active primary vehicle.
- Personally attributable expenses depend on the driver assignment that was active on the event date, not merely the current driver.

## Documents and expirations

Observed capabilities:

- company-, driver- and vehicle-related documents;
- custom document types;
- file upload and download;
- expiry date, status, legal entity, location and optional amounts;
- modify, archive and delete actions;
- expiry reminders;
- bulk document imports where filenames map to vehicle plates or driver identifiers.

Core rules:

- A document type defines subject type, required metadata, whether expiry is required, and reminder policy.
- A document instance belongs to exactly one subject: company, vehicle or driver.
- Expiration status should be derived from expiry date and policy: valid, expiring, expired, archived.
- Reminder jobs should be idempotent and recorded, so the same reminder window does not generate duplicates.
- Replacing a file must preserve document history or at least an audit event.

## Movements and expenses

The reference platform calls provider-originated mobility events “movements”. They are broader than our manually submitted expenses.

Observed data:

- provider identifier and provider name;
- category and service;
- usage mode;
- provider description and event timestamp;
- gross, discounted, taxable and VAT amounts;
- plate and attributed driver;
- operational status;
- invoice state;
- detail panel and movement history.

Observed filters and analytics:

- date/period;
- service;
- movement state;
- invoice state;
- provider, category, usage mode, plate and driver;
- total fleet cost, fuel/electric overview, focused fuel/electric analysis and anomaly detection.

Core rules:

- A provider movement is an immutable source event. Corrections create versions or audit events.
- Provider ingestion, manual expense submission and invoice reconciliation are separate processes that can feed one reporting ledger.
- Amounts require currency, gross, net/taxable, VAT and discount fields.
- Movement state and invoice state are independent.
- Attribution uses the vehicle/driver assignment active at the event timestamp.
- Duplicate detection should use provider plus provider event ID, with a fallback fingerprint for manual imports.
- Driver correction must be a configurable permission and fully audited.

Suggested movement states:

`received -> validated -> closed` with exception states such as `needs_review`, `rejected` or `reversed`.

Suggested invoice states:

`not_billable | to_invoice | invoicing | invoiced | disputed`.

Our current `Expense` approval flow is useful for manual submissions but must not become the provider-ingestion model.

## Service entitlements and devices

Observed concepts:

- a service catalogue;
- licences attached to either a vehicle or a driver;
- a licence can enable several services;
- active services may be a subset of contracted services;
- an optional physical device or card;
- activation, association, disassociation and contract dates;
- recurring licence fee, PIN and expiry;
- active/inactive contract state;
- plate change and licence transfer processes.

Examples include telepedaggio, fuel cards, parking, restricted-area access, charging and washing.

Core rules:

- A service definition is not an integration and not a licence.
- A provider connector supplies data or performs actions.
- A contract/offer determines commercial availability.
- A licence grants an entitlement to a subject.
- A device/card may implement that entitlement and has its own lifecycle.
- Plate changes and vehicle reassignment must not silently lose device/licence history.

This separation is especially important for future Telepass work.

## Operational tasks

Observed task-trigger catalogue:

- vehicle installation, closure, archival, renewal and plate change;
- driver creation, reassignment and archival;
- cost-centre reassignment;
- rental-invoice import;
- fine creation;
- refund;
- replacement-vehicle request and return;
- restricted-zone access request.

Observed task states include at least to-do, completed and cancelled.

Core rules:

- A task is generated by a domain event according to tenant configuration.
- A task stores subject, event type, status, assignee/queue, due date and resolution.
- Replaying an event must not duplicate the same task.
- Cancelling a source process should cancel its unresolved task.
- Completing a task may advance the source workflow, but should not directly mutate unrelated aggregates.

## Roles and permissions

Observed behaviour:

- standard and custom profiles;
- landing page per profile;
- menu visibility by profile;
- quick-action visibility;
- section-level access;
- fine-grained action permissions within vehicles, drivers and specialist products;
- global and lighter fleet-manager variants.

Core rule:

Permissions should be capabilities such as `vehicle.assign`, `document.archive`, or `movement.correct`, not only broad role checks. Roles are tenant-configurable bundles of capabilities plus organisational scope.

## Data management

Observed capabilities:

- CSV/Excel imports for users and vehicles;
- bulk updates separate from creates;
- ZIP document imports with filename matching rules;
- bulk licence assignments;
- downloadable templates;
- exports for vehicles, work, costs, communications, orders, assignments and payroll deductions.

Core rules:

- Imports require dry-run validation, row-level errors, idempotency and an import job history.
- Import mapping must use stable business keys such as plate, email or external ID.
- Export permissions should follow the same scope as interactive screens.
- Large jobs should run asynchronously and expose progress/result files.

## Dashboard and analytics

Observed dashboard characteristics:

- user-configurable widgets;
- global scope filters;
- quick actions;
- vehicle and driver summaries;
- current cost by service with YTD and monthly values;
- document/expiration totals;
- service licence/device counts;
- recent tasks and booking summaries;
- links from every summary to the corresponding operational list.

The analytics catalogue is separate from the operational dashboard. Reports cover cost, fleet composition, fuel, charging, anomaly detection and fines.

Core rules:

- Dashboard values are read models derived from domain data.
- Aggregates must be period-, currency- and scope-aware.
- Widgets should not own business logic; they consume reporting queries.

## Specialist modules kept outside the fleet core

### Fines

Observed fields include fine status/type, notice and event dates, vehicle, driver, reduced-payment deadline and amount, points deduction, final deadline and accounting attribution. The workflow includes management, payment and dispute states.

### Booking

Observed products include pool vehicles, washing pickup, vehicle work and parking. Bookings support agenda/table views and states such as requested/needs approval, approved, in progress, completed, rejected and cancelled.

### Finance and invoicing

Observed company billing terms, currency, guarantees, recurring fee totals and invoices with due dates, types and payment states. This must stay separate from operational movements even though reconciliation connects them.

## Recommended bounded modules

```text
identity-and-scope
fleet-registry
assignments
documents
workflow-tasks
mobility-ledger
service-entitlements
reporting
imports-exports

future:
fines
bookings
billing
provider-connectors
orders-and-rental
```

Web and future mobile clients should call these modules through APIs. Neither client should contain domain transitions or permission rules.
