# Utilities

Contains helper functions used across services:
- S3 presigned URL creation
- File validation
- Calculators (DSCR, LTV)
- Formatting helpers

Rules:
- Keep helpers pure (no DB access)
- Utility logic should not depend on API or services
