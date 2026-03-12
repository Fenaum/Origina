flowchart TD
  A[Create Loan] --> B[Assign Roles: Broker/Processor/UW]
  B --> C[Collect Data: Borrower/Property/Assets/Income]
  C --> D[Upload Documents]
  D --> E[Run Validations]
  E -->|Pass| F[Generate Conditions & Tasks]
  E -->|Fail| E2[Create Exceptions] --> F

  F --> G[Bank Statement Ingestion]
  G -->|Plaid Pull or PDF Parse| H[Normalize Transactions]
  H --> I[Snapshot: bank_input + bank_output]
  I --> J[Compute Metrics: DSCR / DTI / LTV]
  J --> K[Snapshot: calc_output]

  K --> L[Pricing Run]
  L --> M[Snapshot: pricing_input + pricing_output]
  M --> N{UW Decision}
  N -->|Approve| O[Clear Conditions]
  N -->|Suspend| P[Request More Docs] --> D
  N -->|Deny| Q[Denial Reason Logged] --> Z[Close File]

  O --> R[Disclosures]
  R --> S[Closing]
  S --> T[Funding]
  T --> Z[Close File]

  %% Audit trail always
  A --> AA[Audit Log]
  B --> AA
  C --> AA
  D --> AA
  E --> AA
  F --> AA
  G --> AA
  J --> AA
  L --> AA
  N --> AA
  R --> AA
  S --> AA
  T --> AA
