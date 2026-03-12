flowchart LR
  %% CLIENTS
  U["User (UW / Processor / Broker / Admin)"] --> FE["Frontend - NextJS"]
  FE --> API["Backend API - FastAPI"]

  %% CORE BACKEND
  API --> AUTH["Auth - JWT + RBAC"]
  API --> CFG["Config Loader"]
  API --> LOG["Logging"]
  API --> SVC["Domain Services"]

  %% DATA STORES
  SVC --> DB[(Postgres)]
  SVC --> REDIS[(Redis)]
  SVC --> OBJ["Object Storage (S3)"]

  %% AUDIT + SNAPSHOT
  SVC --> AUD["Audit Logger"]
  AUD --> DB
  SVC --> SNAP["Snapshot Engine"]
  SNAP --> DB

  %% INTEGRATIONS
  SVC --> PLAID["Bank Integration"]
  PLAID --> SNAP
  SVC --> DOC["Document Parsing"]
  DOC --> SNAP
  SVC --> PRICING["Pricing Engine"]
  PRICING --> SNAP

  %% REPORTING
  DB --> BI["Analytics / BI"]
  SNAP --> BI

  %% FILE FLOW
  FE --> API
  API --> OBJ
  API --> DB
