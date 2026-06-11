# MISMO XML Test Fixtures

This folder stores sample MISMO-style XML files for Origina parser, import, and workflow testing.

## Structure

- `sources/` contains the original sample XML files provided for testing.
- `generated/` contains synthetic variants derived from those source samples.
- `manifest.json` lists each generated scenario and the fields intentionally varied.
- `generate_mismo_variants.py` regenerates the synthetic fixture set.

## Current Fixture Set

- 3 source XML files:
  - `CommercialTest5.xml`
  - `ConsumerTest3.xml`
  - `ConsumerTest7.xml`
- 15 generated XML variants:
  - 5 commercial / investment scenarios
  - 5 consumer primary residence scenarios
  - 5 high-balance / second home / investment scenarios

## Data Notes

Generated fixtures use synthetic borrower names, fake tax ID values, synthetic addresses, and varied loan amounts. They preserve the source document shape and common MISMO tags, but they are not guaranteed to be complete underwriting-valid loan files.

Use these files for parser resilience, frontend import flows, mapping previews, and smoke tests. Treat the real backend MISMO parser and compliance validation as separate integration work.

## Regenerate

From the repository root:

```bash
python3 test-fixtures/mismo/generate_mismo_variants.py
```
