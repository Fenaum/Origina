# Origina LOS — Data Dictionary

All tables, columns, enums, constraints, and relationships for the Origina Non-QM LOS platform.

**Database:** PostgreSQL  
**ORM:** SQLAlchemy (declarative base)  
**Migrations:** Raw SQL in `db/migrations/` — do not use `Base.metadata.create_all()`  
**Audit:** `log_audit_event()` trigger fires on INSERT/UPDATE/DELETE for major tables

---

## Table of Contents

1. [Enums](#enums)
2. [Core Tables](#core-tables)
   - [tenants](#tenants)
   - [users](#users)
   - [roles](#roles)
   - [user_roles](#user_roles)
3. [Loan Tables](#loan-tables)
   - [loans](#loans)
   - [loan_financials](#loan_financials)
   - [loan_terms](#loan_terms)
   - [loan_parties](#loan_parties)
4. [Borrower Tables](#borrower-tables)
   - [borrowers](#borrowers)
   - [addresses](#addresses)
5. [Party Tables](#party-tables)
   - [parties](#parties)
   - [user_parties](#user_parties)
6. [Condition Tables](#condition-tables)
   - [conditions](#conditions)
7. [Workflow Tables](#workflow-tables)
   - [loan_exceptions](#loan_exceptions)
   - [tasks](#tasks)
   - [notes](#notes)
   - [loan_status_events](#loan_status_events)
8. [Document Tables](#document-tables)
   - [documents](#documents)
9. [Intake Tables](#intake-tables)
   - [intake_sessions](#intake_sessions)
   - [intake_answers](#intake_answers)
   - [intake_handoffs](#intake_handoffs)
10. [Audit Table](#audit-table)
    - [audit_log](#audit_log)
11. [Relationships Diagram](#relationships-diagram)
12. [Base Model Conventions](#base-model-conventions)

---

## Enums

All enum types are created in `db/migrations/030_types.sql`. SQLAlchemy columns that reference these must use `create_type=False` to avoid conflicts.

### `loan_status`

Tracks the current stage of a loan in the origination pipeline.

| Value | Description |
|---|---|
| `new_draft` | Loan created but not yet submitted |
| `submitted` | Submitted by broker/officer, in review |
| `conditions_review` | Underwriting has issued conditions |
| `approved_pending` | Approved subject to outstanding conditions |
| `approved` | Fully approved, no blocking conditions |
| `funded` | Loan has been funded |
| `closed` | Loan closed successfully |
| `post_closing` | Post-closing review/QC phase |
| `archived` | Archived, read-only |
| `denied` | Application denied (terminal) |
| `withdrawn` | Withdrawn by borrower (terminal) |
| `cancelled` | Cancelled by lender/AE (terminal) |

**Note:** The live DB has `loans.status` as `text` (not the enum) due to a pending migration. Fix with: `ALTER TABLE loans ALTER COLUMN status TYPE loan_status USING status::loan_status`

### `loan_purpose`

| Value | Description |
|---|---|
| `purchase` | Property acquisition |
| `rate_term_refinance` | Refinance for better rate/term |
| `cash_out_refinance` | Refinance with cash extraction |
| `construction` | Construction loan |

### `loan_party_role`

Roles a party can play on a loan.

| Value | Description |
|---|---|
| `account_executive` | The AE managing the relationship |
| `loan_processor` | Processes the loan file |
| `underwriter` | Makes the credit decision |
| `account_manager` | Manages broker accounts |
| `broker` | Originating broker |
| `loan_officer` | Loan officer on the originating side |
| `title_agent` | Title/escrow company contact |
| `appraiser` | Property appraiser |
| `closing_agent` | Closing attorney or agent |

### `borrower_type`

| Value | Description |
|---|---|
| `primary` | Primary borrower on the application |
| `co_borrower` | Co-borrower (joint applicant) |
| `guarantor` | Non-occupying guarantor |
| `non_occupying_co_borrower` | Co-borrower who will not occupy the property |

### `borrower_relationship`

Relationship between co-borrower and primary borrower.

| Value | Description |
|---|---|
| `spouse` | Legally married spouse |
| `domestic_partner` | Domestic partner |
| `sibling` | Brother or sister |
| `parent` | Parent |
| `child` | Adult child |
| `business_partner` | Business partner |
| `other` | Other relationship |

### `borrower_income_type`

Intake question value — how the borrower earns income.

| Value | Description |
|---|---|
| `w2` | W-2 employee |
| `self_employed` | Self-employed (Schedule C/K-1) |
| `bank_statement` | Bank statement qualifier (Non-QM) |
| `1099` | 1099 independent contractor |
| `rental` | Rental income (DSCR) |
| `assets` | Asset depletion qualifier |
| `pension_retirement` | Pension or retirement income |
| `foreign` | Foreign income |
| `other` | Other income type |

### `condition_status`

Lifecycle of a loan condition.

| Value | Description |
|---|---|
| `open` | Condition issued, awaiting borrower/broker action |
| `submitted` | Borrower/broker submitted documents for review |
| `cleared` | Underwriter cleared the condition |
| `waived` | Condition was waived (with documented reason) |
| `rejected` | Submitted documents rejected, condition remains open |

### `exception_status`

| Value | Description |
|---|---|
| `pending` | Exception requested, awaiting decision |
| `approved` | Exception approved |
| `denied` | Exception denied |
| `expired` | Approval expired |

### `exception_severity`

| Value | Description |
|---|---|
| `low` | Minor deviation, informational |
| `medium` | Moderate exception, requires approval |
| `high` | Significant exception, requires senior approval |
| `critical` | Critical exception, requires committee |

### `task_status`

| Value | Description |
|---|---|
| `open` | Task created, not started |
| `in_progress` | Actively being worked |
| `completed` | Work is done |
| `cancelled` | Task cancelled |

### `task_priority`

| Value | Description |
|---|---|
| `low` | Low priority |
| `medium` | Normal priority |
| `high` | High priority, needs attention |
| `urgent` | Urgent, blocking |

### `party_type`

Whether a party record is a person or an organization.

| Value | Description |
|---|---|
| `person` | Individual (loan officer, title agent, appraiser) |
| `company` | Organization (brokerage, title company) |

---

## Core Tables

### `tenants`

Root table for multi-tenancy. Every row in the system belongs to a tenant.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, default `gen_random_uuid()` | Tenant identifier |
| `name` | VARCHAR(255) | NOT NULL | Display name of the lending organization |
| `slug` | VARCHAR(100) | UNIQUE, NOT NULL | URL-safe identifier (e.g., `origina-dev`) |
| `is_active` | BOOLEAN | default `true` | Whether the tenant is active |
| `created_at` | TIMESTAMPTZ | default `now()` | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | default `now()` | Last modification timestamp |

**SQLAlchemy model:** `Tenant` in `models/user.py`

---

### `users`

Platform users — AEs, processors, underwriters, brokers, admins.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, default `gen_random_uuid()` | User identifier |
| `tenant_id` | UUID | FK → `tenants.id`, NOT NULL | Owning tenant |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | Login email address |
| `password_hash` | TEXT | NOT NULL | bcrypt hash (passlib, bcrypt==4.0.1 pinned) |
| `full_name` | VARCHAR(255) | | Display name |
| `is_active` | BOOLEAN | default `true` | Whether the account is enabled |
| `role` | TEXT | | Role identifier (see note below) |
| `created_at` | TIMESTAMPTZ | default `now()` | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | default `now()` | Last modification timestamp |

**Note:** Role is currently inferred from email prefix in `get_current_user()`. The `role` column exists but is not yet the authoritative source — a P2 item is to read role from DB, not email.

**Bootstrap user:** `admin@origina.dev` / `TestPass123!` — created via `scripts/bootstrap_user.py`

**SQLAlchemy model:** `User` in `models/user.py`

---

### `roles`

Role definitions available in the system. Seeded from `030_types.sql`.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | Role identifier |
| `name` | VARCHAR(100) | UNIQUE, NOT NULL | Role name (e.g., `account_executive`) |
| `description` | TEXT | | Human-readable description |
| `created_at` | TIMESTAMPTZ | default `now()` | Creation timestamp |

**Defined role names:**

| Name | Label |
|---|---|
| `account_executive` | Account Executive |
| `broker` | Broker |
| `loan_officer` | Loan Officer |
| `loan_processor` | Loan Processor |
| `underwriter` | Underwriter |
| `account_manager` | Account Manager |
| `it_admin` | IT Admin |

**SQLAlchemy model:** `Role` in `models/user.py`

---

### `user_roles`

Junction table — many-to-many between `users` and `roles`.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `user_id` | UUID | FK → `users.id`, NOT NULL | User reference |
| `role_id` | UUID | FK → `roles.id`, NOT NULL | Role reference |
| `assigned_at` | TIMESTAMPTZ | default `now()` | When the role was assigned |

**Composite PK:** `(user_id, role_id)`

**SQLAlchemy model:** `UserRole` in `models/user.py`

---

## Loan Tables

### `loans`

Primary loan header table. Financial amounts and rate terms live in satellite tables.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, default `gen_random_uuid()` | Loan identifier |
| `tenant_id` | UUID | FK → `tenants.id`, NOT NULL | Owning tenant |
| `loan_number` | VARCHAR(50) | UNIQUE | Human-readable loan identifier (e.g., `ORG-2024-00042`) |
| `status` | TEXT | NOT NULL, default `new_draft` | Current loan status (`loan_status` enum in schema, `text` in live DB — pending migration) |
| `purpose` | TEXT | | Loan purpose (`loan_purpose` enum values, stored as text) |
| `program` | VARCHAR(100) | | Non-QM product type (dscr, bank_statement, asset_depletion, interest_only, jumbo_nonqm) |
| `channel` | VARCHAR(50) | | Origination channel (e.g., `wholesale`) |
| `property_state` | CHAR(2) | | Two-letter US state code |
| `property_type` | VARCHAR(100) | | Property type (single_family, condo, multi_family, etc.) |
| `occupancy` | VARCHAR(50) | | Occupancy type (primary, secondary, investment) |
| `submitted_at` | TIMESTAMPTZ | | When the loan was submitted |
| `closed_at` | TIMESTAMPTZ | | When the loan closed |
| `funded_at` | TIMESTAMPTZ | | When the loan was funded |
| `file_owner_id` | UUID | FK → `users.id` | AE responsible for the loan |
| `created_at` | TIMESTAMPTZ | default `now()` | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | default `now()` | Last modification timestamp |

**Audit trigger:** `log_audit_event()` fires AFTER INSERT/UPDATE/DELETE

**Indexes:** Partial indexes on `status`, `tenant_id`, `submitted_at` (see `107_indexes.sql`)

**Relationships:**
- `loan_financials` — 1:1, `loan_id` as PK
- `loan_terms` — 1:1, `loan_id` as PK
- `conditions` — 1:many
- `loan_parties` — 1:many (via junction)
- `documents` — 1:many
- `tasks` — 1:many
- `notes` — 1:many (append-only)
- `loan_status_events` — 1:many (append-only)
- `loan_exceptions` — 1:many

**SQLAlchemy model:** `Loan` in `models/loan.py`

---

### `loan_financials`

Satellite table — financial amounts. Uses `loan_id` as primary key to enforce 1:1 at DB level.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `loan_id` | UUID | PK, FK → `loans.id` | Loan reference (also the PK) |
| `loan_amount` | NUMERIC(15,2) | | Total loan amount in dollars |
| `purchase_price` | NUMERIC(15,2) | | Purchase price (purchase transactions) |
| `appraised_value` | NUMERIC(15,2) | | Appraised property value |
| `estimated_value` | NUMERIC(15,2) | | Estimated value before appraisal |
| `ltv` | NUMERIC(5,4) | | Loan-to-value ratio (e.g., 0.7500 = 75%) |
| `cltv` | NUMERIC(5,4) | | Combined LTV (including subordinate liens) |
| `dscr` | NUMERIC(6,4) | | Debt Service Coverage Ratio (DSCR loans only) |
| `monthly_income` | NUMERIC(12,2) | | Qualifying monthly income |
| `monthly_debt` | NUMERIC(12,2) | | Total monthly debt obligations |
| `liquid_assets` | NUMERIC(15,2) | | Liquid assets (bank statement / asset depletion) |
| `reserves_months` | NUMERIC(5,2) | | Months of PITI reserves |
| `created_at` | TIMESTAMPTZ | default `now()` | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | default `now()` | Last modification timestamp |

**Audit trigger:** Fires on this table (uses `loan_id` as PK — handled via `_LOAN_ID_PK` array in trigger function)

**SQLAlchemy model:** `LoanFinancials` in `models/loan.py`

---

### `loan_terms`

Satellite table — rate and term structure. Uses `loan_id` as primary key.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `loan_id` | UUID | PK, FK → `loans.id` | Loan reference (also the PK) |
| `interest_rate` | NUMERIC(6,4) | | Note rate (e.g., 0.0750 = 7.50%) |
| `apr` | NUMERIC(6,4) | | Annual Percentage Rate |
| `loan_term_months` | INTEGER | | Loan term in months (e.g., 360 = 30yr) |
| `amortization_type` | VARCHAR(50) | | Amortization type (fixed, arm, interest_only) |
| `arm_initial_period` | INTEGER | | Initial fixed period for ARM loans (years) |
| `arm_margin` | NUMERIC(5,4) | | ARM margin above index |
| `arm_index` | VARCHAR(50) | | ARM index (sofr, libor_replacement, etc.) |
| `rate_lock_days` | INTEGER | | Rate lock period in days |
| `rate_lock_expiry` | DATE | | Rate lock expiration date |
| `prepayment_penalty` | BOOLEAN | default `false` | Whether prepay penalty applies |
| `prepayment_penalty_months` | INTEGER | | Length of prepay penalty in months |
| `created_at` | TIMESTAMPTZ | default `now()` | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | default `now()` | Last modification timestamp |

**Audit trigger:** Fires on this table (uses `loan_id` as PK)

**SQLAlchemy model:** `LoanTerms` in `models/loan.py`

---

### `loan_parties`

Junction table linking parties to loans with a specific role.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | Junction record identifier |
| `loan_id` | UUID | FK → `loans.id`, NOT NULL | Loan reference |
| `party_id` | UUID | FK → `parties.id`, NOT NULL | Party reference |
| `role` | `loan_party_role` | NOT NULL | Role on this specific loan |
| `created_at` | TIMESTAMPTZ | default `now()` | When the party was assigned |

**SQLAlchemy model:** `LoanParty` in `models/loan.py`

---

## Borrower Tables

### `borrowers`

Borrowers on a loan application. SSN is encrypted at rest.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, default `gen_random_uuid()` | Borrower identifier |
| `tenant_id` | UUID | FK → `tenants.id`, NOT NULL | Owning tenant |
| `loan_id` | UUID | FK → `loans.id`, NOT NULL | Associated loan |
| `borrower_type` | `borrower_type` | NOT NULL | Primary, co-borrower, guarantor, etc. |
| `relationship` | `borrower_relationship` | | Relationship to primary borrower |
| `first_name` | VARCHAR(100) | NOT NULL | Legal first name |
| `middle_name` | VARCHAR(100) | | Legal middle name |
| `last_name` | VARCHAR(100) | NOT NULL | Legal last name |
| `suffix` | VARCHAR(20) | | Name suffix (Jr., III, etc.) |
| `email` | VARCHAR(255) | | Contact email |
| `phone` | VARCHAR(30) | | Contact phone number |
| `date_of_birth` | DATE | | Date of birth |
| `ssn_encrypted` | BYTEA | | SSN encrypted at rest (AES-256-GCM recommended) |
| `ssn_last4` | CHAR(4) | | Last 4 digits of SSN (plaintext for display) |
| `credit_score` | INTEGER | | Most recent credit score |
| `income_type` | `borrower_income_type` | | Primary income qualification method |
| `citizenship` | VARCHAR(50) | | Citizenship status (us_citizen, permanent_resident, etc.) |
| `marital_status` | VARCHAR(30) | | Marital status (HMDA field) |
| `ethnicity` | VARCHAR(100) | | HMDA ethnicity field |
| `race` | VARCHAR(100) | | HMDA race field |
| `sex` | VARCHAR(30) | | HMDA sex field |
| `created_at` | TIMESTAMPTZ | default `now()` | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | default `now()` | Last modification timestamp |

**Security invariant:** `ssn_encrypted` is never returned by any API endpoint. Only `ssn_last4` is exposed. On the frontend, SSN is never written to localStorage (enforced via `partialize` in submissionStore).

**Audit trigger:** `log_audit_event()` fires on this table

**SQLAlchemy model:** `Borrower` in `models/borrowers.py`

---

### `addresses`

Mailing and property addresses linked to borrowers or properties.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, default `gen_random_uuid()` | Address identifier |
| `tenant_id` | UUID | FK → `tenants.id`, NOT NULL | Owning tenant |
| `borrower_id` | UUID | FK → `borrowers.id` | Borrower this address belongs to |
| `address_type` | VARCHAR(50) | | Type: `current`, `mailing`, `previous`, `property` |
| `street_1` | VARCHAR(255) | | Street address line 1 |
| `street_2` | VARCHAR(255) | | Street address line 2 (apt, unit, etc.) |
| `city` | VARCHAR(100) | | City |
| `state` | CHAR(2) | | US state abbreviation |
| `zip` | VARCHAR(10) | | ZIP or ZIP+4 |
| `county` | VARCHAR(100) | | County name |
| `years_at_address` | NUMERIC(4,1) | | Years at this address (URLA field) |
| `months_at_address` | INTEGER | | Additional months at address |
| `created_at` | TIMESTAMPTZ | default `now()` | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | default `now()` | Last modification timestamp |

**SQLAlchemy model:** `Address` in `models/borrowers.py`

---

## Party Tables

### `parties`

External parties involved in transactions — brokers, title companies, appraisers, etc.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, default `gen_random_uuid()` | Party identifier |
| `tenant_id` | UUID | FK → `tenants.id`, NOT NULL | Owning tenant |
| `party_type` | `party_type` | NOT NULL | `person` or `company` |
| `display_name` | VARCHAR(255) | NOT NULL | Full display name (computed or stored) |
| `first_name` | VARCHAR(100) | | First name (person only) |
| `last_name` | VARCHAR(100) | | Last name (person only) |
| `legal_name` | VARCHAR(255) | | Legal entity name (company only) |
| `email` | VARCHAR(255) | | Contact email |
| `phone` | VARCHAR(30) | | Contact phone |
| `license_number` | VARCHAR(100) | | NMLS or state license number |
| `company_id` | UUID | FK → `parties.id` | Parent company (for person-at-company) |
| `created_at` | TIMESTAMPTZ | default `now()` | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | default `now()` | Last modification timestamp |

**SQLAlchemy model:** `Party` in `models/parties.py`

---

### `user_parties`

Links platform users to party records (e.g., a broker user → their broker party record).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `user_id` | UUID | FK → `users.id`, NOT NULL | Platform user |
| `party_id` | UUID | FK → `parties.id`, NOT NULL | Associated party record |

**Composite PK:** `(user_id, party_id)`

**SQLAlchemy model:** `UserParty` in `models/user.py`

---

## Condition Tables

### `conditions`

Underwriting conditions that must be satisfied for loan approval.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, default `gen_random_uuid()` | Condition identifier |
| `tenant_id` | UUID | FK → `tenants.id`, NOT NULL | Owning tenant |
| `loan_id` | UUID | FK → `loans.id`, NOT NULL | Associated loan |
| `name` | VARCHAR(500) | NOT NULL | Condition description / requirement text |
| `status` | `condition_status` | NOT NULL, default `open` | Current lifecycle state |
| `due_date` | DATE | | Date by which condition must be satisfied |
| `category` | VARCHAR(100) | | Condition category (credit, income, appraisal, title, insurance, etc.) |
| `created_by` | UUID | FK → `users.id` | User who issued the condition |
| `cleared_by` | UUID | FK → `users.id` | User who cleared the condition |
| `cleared_at` | TIMESTAMPTZ | | When the condition was cleared |
| `waived_by` | UUID | FK → `users.id` | User who waived the condition |
| `waived_at` | TIMESTAMPTZ | | When the condition was waived |
| `waive_reason` | TEXT | | Documented reason for waiver |
| `reject_reason` | TEXT | | Reason submitted documents were rejected |
| `created_at` | TIMESTAMPTZ | default `now()` | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | default `now()` | Last modification timestamp |

**Audit trigger:** `log_audit_event()` fires on this table

**Lifecycle transitions:**
```
open → submitted → cleared
                 → waived  (requires waive_reason)
                 → rejected → open (re-submitted)
```

**SQLAlchemy model:** `Condition` in `models/conditions.py`

---

## Workflow Tables

### `loan_exceptions`

Exception requests for guideline deviations that require approval.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, default `gen_random_uuid()` | Exception identifier |
| `tenant_id` | UUID | FK → `tenants.id`, NOT NULL | Owning tenant |
| `loan_id` | UUID | FK → `loans.id`, NOT NULL | Associated loan |
| `exception_type` | VARCHAR(200) | NOT NULL | Type of exception (e.g., "LTV > 80 on investment") |
| `description` | TEXT | | Detailed explanation |
| `severity` | `exception_severity` | NOT NULL | low / medium / high / critical |
| `status` | `exception_status` | NOT NULL, default `pending` | pending / approved / denied / expired |
| `requested_by` | UUID | FK → `users.id` | User who requested the exception |
| `decided_by` | UUID | FK → `users.id` | User who approved/denied |
| `decision_reason` | TEXT | | Reason for the approval or denial |
| `decided_at` | TIMESTAMPTZ | | When the decision was made |
| `expires_at` | TIMESTAMPTZ | | When the exception approval expires |
| `created_at` | TIMESTAMPTZ | default `now()` | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | default `now()` | Last modification timestamp |

**Note:** Backend table exists, API endpoints not yet built (P3 item).

**SQLAlchemy model:** `LoanException` in `models/workflow.py`

---

### `tasks`

Actionable tasks assigned to team members on a loan file.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, default `gen_random_uuid()` | Task identifier |
| `tenant_id` | UUID | FK → `tenants.id`, NOT NULL | Owning tenant |
| `loan_id` | UUID | FK → `loans.id`, NOT NULL | Associated loan |
| `title` | VARCHAR(500) | NOT NULL | Task title / description |
| `body` | TEXT | | Additional task details |
| `status` | `task_status` | NOT NULL, default `open` | open / in_progress / completed / cancelled |
| `priority` | `task_priority` | NOT NULL, default `medium` | low / medium / high / urgent |
| `assigned_to` | UUID | FK → `users.id` | User this task is assigned to |
| `due_at` | TIMESTAMPTZ | | Task due date/time |
| `completed_at` | TIMESTAMPTZ | | When the task was completed |
| `created_by` | UUID | FK → `users.id` | User who created the task |
| `created_at` | TIMESTAMPTZ | default `now()` | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | default `now()` | Last modification timestamp |

**Note:** Backend table exists, API endpoints not yet built (P3 item).

**SQLAlchemy model:** `Task` in `models/workflow.py`

---

### `notes`

Internal threaded notes on a loan file. **Append-only** — no `updated_at`.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, default `gen_random_uuid()` | Note identifier |
| `tenant_id` | UUID | FK → `tenants.id`, NOT NULL | Owning tenant |
| `loan_id` | UUID | FK → `loans.id`, NOT NULL | Associated loan |
| `body` | TEXT | NOT NULL | Note content (markdown supported) |
| `created_by` | UUID | FK → `users.id` | Author |
| `created_at` | TIMESTAMPTZ | default `now()` | Creation timestamp |

**Immutability:** `AppendOnlyModel` base — no `updated_at` column. Notes cannot be edited after creation; this preserves audit integrity.

**Note:** Backend table exists, API endpoints not yet built (P3 item).

**SQLAlchemy model:** `Note` in `models/workflow.py`

---

### `loan_status_events`

Append-only audit log of every loan status transition. **Event sourcing pattern.**

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, default `gen_random_uuid()` | Event identifier |
| `tenant_id` | UUID | FK → `tenants.id`, NOT NULL | Owning tenant |
| `loan_id` | UUID | FK → `loans.id`, NOT NULL | Associated loan |
| `from_status` | TEXT | | Previous status value |
| `to_status` | TEXT | NOT NULL | New status value |
| `reason` | TEXT | | Reason for the transition |
| `actor_user_id` | UUID | FK → `users.id` | User who triggered the transition |
| `created_at` | TIMESTAMPTZ | default `now()` | When the transition occurred |

**Immutability:** `AppendOnlyModel` base — no `updated_at` column. Every status change creates a new row; rows are never edited.

**Usage:** The `loans.status` column holds the current state for querying. Both `loans.status` and a new `loan_status_events` row must be updated atomically in the same transaction.

**SQLAlchemy model:** `LoanStatusEvent` in `models/workflow.py`

---

## Document Tables

### `documents`

Files uploaded to a loan file. Immutable after upload.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, default `gen_random_uuid()` | Document identifier |
| `tenant_id` | UUID | FK → `tenants.id`, NOT NULL | Owning tenant |
| `loan_id` | UUID | FK → `loans.id`, NOT NULL | Associated loan |
| `doc_type` | VARCHAR(100) | NOT NULL | Document category (bank_statement, tax_return, appraisal, title, etc.) |
| `file_name` | VARCHAR(500) | NOT NULL | Original filename as uploaded |
| `mime_type` | VARCHAR(100) | | MIME type (application/pdf, image/jpeg, etc.) |
| `file_size_bytes` | BIGINT | | File size in bytes |
| `storage_key` | TEXT | | S3 object key (bucket path) |
| `sha256` | CHAR(64) | | SHA-256 hash for integrity verification |
| `uploaded_by` | UUID | FK → `users.id` | User who uploaded the document |
| `uploaded_at` | TIMESTAMPTZ | default `now()` | Upload timestamp |
| `tags` | JSONB | | Flexible metadata tags (condition links, reviewer notes) |

**Immutability:** No `updated_at` column — documents are not edited after upload. A new version is a new row. The `sha256` hash enables integrity checking.

**S3 status:** `storage_key` is present in schema but S3 integration is out of scope until core loan flow is complete. Current uploads are simulated.

**Audit trigger:** `log_audit_event()` fires on this table

**SQLAlchemy model:** `Document` in `models/document.py`

---

## Intake Tables

### `intake_sessions`

Anonymous borrower intake sessions — no auth required. **Append-only.**

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, default `gen_random_uuid()` | Session identifier |
| `tenant_id` | UUID | FK → `tenants.id`, NOT NULL | Owning tenant (from subdomain or config) |
| `completed_at` | TIMESTAMPTZ | | When the borrower completed the intake flow |
| `ip_address` | INET | | Anonymized IP address |
| `user_agent` | TEXT | | Browser user agent string |
| `created_at` | TIMESTAMPTZ | default `now()` | Session creation timestamp |

**Privacy:** `ip_address` should be truncated to /24 (IPv4) or /48 (IPv6) before storage for GDPR compliance. `user_agent` is stored for fraud detection, not tracking.

**SQLAlchemy model:** `IntakeSession` in `models/intake.py`

---

### `intake_answers`

Individual question answers from a borrower's intake session.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, default `gen_random_uuid()` | Answer record identifier |
| `session_id` | UUID | FK → `intake_sessions.id`, NOT NULL | Parent session |
| `question_key` | VARCHAR(100) | NOT NULL | Question identifier (e.g., `property_type`, `loan_amount`) |
| `value` | TEXT | NOT NULL | Answer value as a string |
| `answered_at` | TIMESTAMPTZ | default `now()` | When the answer was recorded |

**Unique constraint:** `(session_id, question_key)` — one answer per question per session. Re-answering (back navigation) replaces the existing row via upsert.

**Question keys used by the intake flow:**

| Key | Description | Values |
|---|---|---|
| `property_type` | Property type | single_family, condo, multi_family, commercial, land |
| `occupancy` | Occupancy type | primary, secondary, investment |
| `loan_purpose` | Loan purpose | purchase, refinance, cash_out, construction |
| `loan_amount` | Requested amount | Numeric string (dollars) |
| `credit_score` | Credit score band | excellent (760+), good (700-759), fair (640-699), poor (<640) |
| `income_type` | Income qualification method | w2, self_employed, bank_statement, 1099, rental, assets |
| `employment_status` | Employment status | employed, self_employed, retired, investor |

**SQLAlchemy model:** `IntakeAnswer` in `models/intake.py`

---

### `intake_handoffs`

Lead capture at the end of the intake flow — borrower submits contact info for AE follow-up.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, default `gen_random_uuid()` | Handoff identifier |
| `session_id` | UUID | FK → `intake_sessions.id`, NOT NULL | Parent intake session |
| `name` | VARCHAR(255) | | Borrower's name as submitted |
| `email` | VARCHAR(255) | NOT NULL | Contact email address |
| `phone` | VARCHAR(30) | | Contact phone number |
| `contacted_at` | TIMESTAMPTZ | | When the AE first reached out |
| `outcome` | VARCHAR(100) | | Lead outcome (converted, not_qualified, no_response, etc.) |
| `created_at` | TIMESTAMPTZ | default `now()` | Submission timestamp |

**SQLAlchemy model:** `IntakeHandoff` in `models/intake.py`

---

## Audit Table

### `audit_log`

Immutable change history for all audited tables. Written by the `log_audit_event()` PostgreSQL trigger function.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, default `gen_random_uuid()` | Audit record identifier |
| `tenant_id` | UUID | | Owning tenant (from the changed row) |
| `table_name` | VARCHAR(100) | NOT NULL | Source table (e.g., `loans`, `conditions`) |
| `record_id` | UUID | NOT NULL | PK of the changed row |
| `action` | VARCHAR(10) | NOT NULL | `INSERT`, `UPDATE`, or `DELETE` |
| `old_values` | JSONB | | Column values before the change (null for INSERT) |
| `new_values` | JSONB | | Column values after the change (null for DELETE) |
| `changed_by` | UUID | | User ID from `app.current_user_id` session variable |
| `changed_at` | TIMESTAMPTZ | default `now()` | When the change occurred |

**Trigger setup:** The `log_audit_event()` function is attached to these tables: `loans`, `borrowers`, `conditions`, `documents`, `loan_financials`, `loan_terms`

Tables where the PK column is `loan_id` (not `id`) are handled separately via the `_LOAN_ID_PK` array inside the trigger function.

**Actor tracking:** The `changed_by` field reads `current_setting('app.current_user_id', true)`. This session variable is set by the `get_audited_db` FastAPI dependency before any DML executes.

**Note:** This table is append-only by convention. No UPDATE or DELETE should ever be issued against `audit_log`.

---

## Relationships Diagram

```
tenants
  │
  ├── users ──────────── user_roles ──── roles
  │     └─── user_parties ──── parties
  │
  └── loans ──────────── loan_financials (1:1)
            │           └── loan_terms     (1:1)
            │
            ├── loan_parties ─── parties
            ├── borrowers ──── addresses
            ├── conditions
            ├── loan_exceptions
            ├── tasks
            ├── notes              (append-only)
            ├── loan_status_events (append-only)
            └── documents

intake_sessions ─── intake_answers
               └─── intake_handoffs

audit_log (written by triggers — not a foreign key relationship)
```

---

## Base Model Conventions

### `BaseModel` (mutable tables)

Used by: `Tenant`, `User`, `Loan`, `LoanFinancials`, `LoanTerms`, `LoanParty`, `Borrower`, `Address`, `Party`, `Condition`, `LoanException`, `Task`, `Document`

| Column | Type | Default |
|---|---|---|
| `id` | UUID | `gen_random_uuid()` |
| `created_at` | TIMESTAMPTZ | `now()` |
| `updated_at` | TIMESTAMPTZ | `now()` |
| `tenant_id` | UUID | — |

### `AppendOnlyModel` (event / log tables)

Used by: `Note`, `LoanStatusEvent`, `IntakeSession`, `IntakeAnswer`, `IntakeHandoff`

| Column | Type | Default |
|---|---|---|
| `id` | UUID | `gen_random_uuid()` |
| `created_at` | TIMESTAMPTZ | `now()` |

No `updated_at` — these rows are never modified after insert.

### `SatelliteModel` (1:1 satellite tables)

Used by: `LoanFinancials`, `LoanTerms`

| Column | Type | Default |
|---|---|---|
| `loan_id` | UUID | FK → `loans.id`, PK |
| `created_at` | TIMESTAMPTZ | `now()` |
| `updated_at` | TIMESTAMPTZ | `now()` |

`loan_id` serves as both the primary key and the foreign key, enforcing a 1:1 relationship at the DB level without a separate `id` column.

### Multi-tenancy rule

`tenant_id` is **never** accepted from a request body. It is always derived from `current_user.tenant_id` in the FastAPI dependency and injected at the service layer. This ensures row-level isolation even if frontend code is compromised.
