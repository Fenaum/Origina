-- ============================================================
-- 125_remaining_enums_text.sql
-- Convert the last 6 PostgreSQL ENUM columns to TEXT + CHECK.
--
-- WHY: Same as 122/123 — TEXT + CHECK lets us add values or rename
-- labels in a single transactional migration instead of requiring
-- out-of-transaction ALTER TYPE DDL. It also lets tenant rows in
-- controlled_values shadow system defaults without schema changes.
--
-- Columns converted:
--   loans.purpose              (loan_purpose ENUM)
--   borrowers.type             (borrower_type ENUM)
--   borrowers.income_type      (borrower_income_type ENUM, nullable)
--   borrowers.borrower_relationship (borrower_relationship ENUM, nullable)
--   parties.party_type         (party_type ENUM)
--   loan_parties.role          (loan_party_role ENUM — composite PK, needs
--                               DROP CONSTRAINT + ALTER + re-add PK)
-- ============================================================
BEGIN;

-- ── 1. loans.purpose ─────────────────────────────────────────────────────────

ALTER TABLE loans
  ALTER COLUMN purpose TYPE text USING purpose::text;

ALTER TABLE loans
  ALTER COLUMN purpose SET DEFAULT 'purchase';

ALTER TABLE loans
  ADD CONSTRAINT ck_loan_purpose CHECK (
    purpose IN ('purchase','refinance','cash_out','other')
  );


-- ── 2. borrowers.type ────────────────────────────────────────────────────────

ALTER TABLE borrowers
  ALTER COLUMN type TYPE text USING type::text;

ALTER TABLE borrowers
  ALTER COLUMN type SET DEFAULT 'primary_borrower';

ALTER TABLE borrowers
  ADD CONSTRAINT ck_borrower_type CHECK (
    type IN ('primary_borrower','co_borrower','guarantor','other')
  );


-- ── 3. borrowers.income_type (nullable) ──────────────────────────────────────

ALTER TABLE borrowers
  ALTER COLUMN income_type TYPE text USING income_type::text;

ALTER TABLE borrowers
  ADD CONSTRAINT ck_borrower_income_type CHECK (
    income_type IS NULL OR income_type IN (
      'salary','hourly_wage','commission','bonus','self_employment',
      'rental_income','investment_income','retirement_income','other'
    )
  );


-- ── 4. borrowers.borrower_relationship (nullable) ────────────────────────────

ALTER TABLE borrowers
  ALTER COLUMN borrower_relationship TYPE text USING borrower_relationship::text;

ALTER TABLE borrowers
  ADD CONSTRAINT ck_borrower_relationship CHECK (
    borrower_relationship IS NULL OR borrower_relationship IN (
      'spouse','parent','sibling','child','friend','business_partner','other'
    )
  );


-- ── 5. parties.party_type ────────────────────────────────────────────────────

ALTER TABLE parties
  ALTER COLUMN party_type TYPE text USING party_type::text;

ALTER TABLE parties
  ALTER COLUMN party_type SET DEFAULT 'person';

ALTER TABLE parties
  ADD CONSTRAINT ck_party_type CHECK (
    party_type IN ('person','company')
  );


-- ── 6. loan_parties.role (composite PK — must drop and re-add PK) ────────────
-- The composite PK is (tenant_id, loan_id, party_id, role).
-- PostgreSQL requires dropping the PK constraint before altering a column
-- that participates in it.

ALTER TABLE loan_parties
  DROP CONSTRAINT loan_parties_pkey;

ALTER TABLE loan_parties
  ALTER COLUMN role TYPE text USING role::text;

ALTER TABLE loan_parties
  ADD CONSTRAINT loan_parties_pkey
    PRIMARY KEY (tenant_id, loan_id, party_id, role);

ALTER TABLE loan_parties
  ADD CONSTRAINT ck_loan_party_role CHECK (
    role IN (
      'borrower','co_borrower','broker','seller','realtor',
      'loan_officer','processor','underwriter','other'
    )
  );

COMMIT;
