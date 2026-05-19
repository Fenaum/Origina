# Origina
**Non-QM Loan Origination System (LOS) + TPO Platform**

## Overview

Origina is a modern, web-based platform designed for the **Non-QM mortgage industry**, combining both:

- A **Loan Origination System (LOS)** for internal operations
- A **Third Party Origination (TPO) platform** for brokers and direct borrowers

The goal of Origina is to replace legacy, desktop-based systems with a unified platform that supports the full loan lifecycle across both broker-driven and direct-to-consumer channels.

Origina is being designed to support:

- Brokers submitting and managing loans through a TPO portal
- Direct borrowers applying and tracking progress through a borrower-facing experience
- Internal operations teams managing setup, processing, underwriting, closing, funding, and post-closing workflows

This project serves as both:

- A functional system prototype
- A technical case study demonstrating system design, workflow modeling, and scalable application architecture in the mortgage domain

## Objectives

- Build a unified **LOS + TPO platform** for the Non-QM mortgage space
- Support both **broker-driven** and **direct borrower** loan intake flows
- Replace outdated workflows with a **modern web-based application**
- Improve loan pipeline visibility, reporting, and operational control
- Provide configurable business rules and validations through the platform
- Create a scalable technical foundation for future workflow automation and integrations

## Core Features

### Dual Intake Channels
- Broker-facing TPO portal for loan submission and pipeline management
- Direct borrower application flow for self-service loan intake
- Shared backend architecture supporting both channels

### Loan Lifecycle Management
- Loan intake and submission
- Pipeline tracking from application through funding
- Role-based workflow transitions across internal teams
- Foundation for processing, underwriting, closing, and post-closing workflows

### Pipeline Management and Reporting
- Smart grid for viewing and managing pipeline data
- Ability to filter pipeline views dynamically
- Reporting capabilities based on filtered pipeline results
- Pivot-table-style views directly within the pipeline interface for operational analysis

### Configurable Validation Rules
- Admin console for managing validation rules inside the application
- UI-driven rule configuration instead of hardcoding all validation logic
- Foundation for future product, workflow, and compliance rule management

### Multi-Tenant Architecture
- Tenant-based data isolation
- Broker and lender separation
- Scalable support for multiple organizations and channels

### API-First Design
- RESTful APIs using FastAPI
- Clear separation between schemas, models, and business logic
- Designed for future integrations with external services and internal tooling

## Frontend and Backend Stack

### Frontend
- React
- Web-based UI for brokers, borrowers, and internal users
- Planned support for configurable admin experiences and rich pipeline interaction

### Backend
- Python
- FastAPI
- SQLAlchemy
- Alembic
- Pydantic
- python-dotenv

### Database
- PostgreSQL
- Dockerized local database environment for development

## User Types

### Brokers
- Submit loan applications
- Upload documents
- Manage pipeline
- Track loan progress

### Direct Borrowers
- Submit applications directly
- Upload required documents
- View limited loan progress updates

### Internal Users
- Loan setup
- Processing
- Underwriting
- Closing
- Funding
- Post-closing
- Administrative users managing rules and platform settings

## Planned Functional Areas

- Loan intake and submission
- Borrower and broker workflows
- Pipeline management
- Reporting and pivot-style analysis
- Validation rule management
- Document and condition management
- Admin configuration tools

## Out of Scope

The following items are intentionally out of scope for the current phase:

- AI integration
- AI assistant features
- AI-driven analysis of missing loan items or next actions

These may be considered in a future phase, but they are not part of the current implementation target.

## System Architecture

```text
Client Applications (React Frontend)
        ↓
FastAPI (Routes / Controllers)
        ↓
Schemas (Validation / API Contracts)
        ↓
Services (Business Logic)
        ↓
Models (SQLAlchemy ORM)
        ↓
PostgreSQL
```

## Project Structure

```text (to be expanded)
backend/
  app/
    core/        # config, db, logging
    models/      # ORM models
    schemas/     # API validation and contracts
    api/         # routes/controllers
    services/    # business logic

frontend/
  src/          # React application source

docs/
  Business Requirements
  Use Cases
  Technical Design
  Data Models
```

## Data Design Principles

- Shared base model for common audit and tenant fields
- Strong separation between database models and API schemas
- Designed for auditability, maintainability, and future extensibility
- Structured for multi-tenant support from the beginning

## Development Approach

- Build by domain verticals such as Loan, Borrower, Property, Conditions, and Validation Rules
- Implement each vertical end-to-end from model to schema to route to UI
- Keep business logic separate from transport and persistence layers
- Build the admin experience as part of the product, not as an afterthought

## Purpose of This Project

Origina is intended to demonstrate:

- End-to-end system design in the mortgage industry
- A unified LOS + TPO product vision
- Scalable backend architecture and structured frontend design
- Product thinking around workflow, rules, reporting, and user experience

## Status

🚧 In active development

Current focus:
- Core backend structure
- Initial data models and schemas
- Foundational React frontend structure
- Pipeline and validation rule concepts

## Author

Raymond Nguyen
Business Integration Analyst focused on evolving into technical product, systems, and platform design