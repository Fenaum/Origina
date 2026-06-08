-- =========================================================
-- db/migrations/106_data_constraints.sql
--
-- Tightens data types and adds missing constraints that were
-- identified as gaps in the initial schema.
-- =========================================================

-- ── borrowers.income_amount ───────────────────────────────────────────────────
-- WHY: The column was defined as bare numeric (unlimited precision). Every
-- other money column in the system uses numeric(14,2). Inconsistent precision
-- causes subtle rounding differences at the application layer. ROUND(..., 2)
-- preserves existing values to two decimal places during migration.
alter table borrowers
  alter column income_amount type numeric(14,2)
  using round(income_amount::numeric, 2);

-- ── addresses: require street1 ────────────────────────────────────────────────
-- WHY: All six columns in addresses were nullable, allowing a row that is
-- entirely NULL — a valid row with no usable data. A street address with no
-- street line is meaningless in a mortgage LOS context and would silently pass
-- any API validation that only checks for address_id presence.
-- The constraint blocks empty-string values as well as NULL.
alter table addresses
  add constraint chk_addresses_street1_required
  check (street1 is not null and trim(street1) <> '');
