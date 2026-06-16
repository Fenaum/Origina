-- 113_property_details.sql
-- Extend properties table with additional fields needed for Subject Property module.
-- Also adds county, census_tract, apn, year_built, sqft, lot_size and flags.

ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS county           TEXT,
    ADD COLUMN IF NOT EXISTS census_tract     TEXT,
    ADD COLUMN IF NOT EXISTS msa              TEXT,
    ADD COLUMN IF NOT EXISTS apn              TEXT,
    ADD COLUMN IF NOT EXISTS year_built       INTEGER,
    ADD COLUMN IF NOT EXISTS square_footage   INTEGER,
    ADD COLUMN IF NOT EXISTS lot_size_sqft    INTEGER,
    ADD COLUMN IF NOT EXISTS units            INTEGER,
    ADD COLUMN IF NOT EXISTS is_mixed_use     BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_rural         BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_condo_pud     BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS flood_zone       TEXT,
    ADD COLUMN IF NOT EXISTS flood_insurance_required BOOLEAN,
    ADD COLUMN IF NOT EXISTS annual_taxes     NUMERIC(14, 2),
    ADD COLUMN IF NOT EXISTS hazard_insurance NUMERIC(14, 2),
    ADD COLUMN IF NOT EXISTS hoa_dues         NUMERIC(14, 2),
    ADD COLUMN IF NOT EXISTS value_source     TEXT,
    ADD COLUMN IF NOT EXISTS estimated_value  NUMERIC(14, 2);

CREATE INDEX IF NOT EXISTS idx_properties_loan_subject
    ON properties (tenant_id, loan_id, is_subject);
