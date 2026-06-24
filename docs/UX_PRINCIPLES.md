# Origina LOS — UX Principles

This document defines the UX foundation for Origina. Use it when designing, reviewing, or implementing any screen, workflow, animation, navigation pattern, or role-specific workspace.

> **Cross-links:** [ARCHITECTURE.md](ARCHITECTURE.md) | [ROADMAP.md](ROADMAP.md) | [REQUIREMENTS.md](REQUIREMENTS.md)

---

## North Star

Origina is a **beautiful loan command center**, not a module directory.

The user should not feel like they are traveling through software. They should feel like they are working inside a loan file that brings the right information, people, blockers, and next actions to them.

Every experience in Origina should optimize for:

1. **Intuitiveness** — the user knows where they are, what matters, and what to do next.
2. **Efficiency** — common work happens with fewer clicks and less context switching.
3. **Collaboration** — teams communicate inside the work, not around it.
4. **Aesthetics** — the product feels modern, calm, premium, and trustworthy.

Beauty is required, but it must clarify the work. If a visual choice or animation does not improve understanding, confidence, speed, or feedback, it should be removed.

---

## Product Model

### Origina is workspace-first

A traditional LOS exposes modules. Origina should expose work.

The primary mental model is:

```text
Pipeline / Queue -> Loan Workspace -> Contextual Panels -> Action Completed
```

The loan workspace is the center of gravity. Conditions, documents, underwriting, processing, exceptions, funding, closing, conversation, and audit history are not separate destinations. They are contextual surfaces inside the file.

### Every screen must answer four questions

Without extra clicks, the user should be able to tell:

1. **What is the status?**
2. **What is blocking progress?**
3. **Who owns the next step?**
4. **What action moves this forward?**

If a screen cannot answer these questions, it is not ready.

### Navigation adapts to the user

Different users should not receive the same workspace just because they are looking at the same loan.

Origina should use the same underlying loan file, but present a different lens by role, loan stage, and active blockers.

---

## Role Lenses

Each role needs a tailored path through the same loan lifecycle.

### Broker / Seller

**Primary goal:** Submit loans, track status, and resolve required items quickly.

**Default workspace emphasis:**
- Loan status
- Required actions
- Conditions
- Documents
- Messages
- Timeline
- Approval and funding readiness

**UX tone:** Premium, transparent, simple, and confidence-building. Avoid internal LOS jargon.

### Account Executive

**Primary goal:** Manage broker relationships, submission quality, and files needing follow-up.

**Default workspace emphasis:**
- Partner activity
- Broker follow-ups
- New submissions
- Stuck files
- Exceptions
- Communication history
- Pipeline health

### Processor

**Primary goal:** Move files through documentation, milestones, conditions, and closing preparation.

**Default workspace emphasis:**
- Tasks
- Documents
- Conditions
- Processing checklist
- Title and appraisal
- Borrower/broker follow-up
- Milestone aging

### Underwriter

**Primary goal:** Review risk, make decisions, manage exceptions, and clear submitted conditions.

**Default workspace emphasis:**
- Ready-for-review queue
- Income and credit
- URLA
- Exceptions
- Conditions submitted for review
- Decision and risk notes
- Guideline blockers

### Funder

**Primary goal:** Confirm final readiness, wire accuracy, funding authorization, and funding blockers.

**Default workspace emphasis:**
- Clear-to-fund readiness
- Prior-to-funding conditions
- Wire verification
- Warehouse line
- Final documents
- Funding authorization
- Funding blockers

### Manager

**Primary goal:** See workload, bottlenecks, SLA risk, staffing needs, and production health.

**Default workspace emphasis:**
- Team queues
- Unassigned work
- Aging files
- Bottlenecks
- Exceptions
- Workload distribution
- Cycle time and pull-through

---

## Workspace Architecture

### The loan command bar

Every loan workspace should have a persistent command area that summarizes:

```text
Status | Blocker | Owner | Next Action
```

Examples:

```text
Status: Conditions Review
Blocker: 3 borrower documents missing
Owner: Broker
Next Action: Upload Documents
```

```text
Status: Approved Pending Conditions
Blocker: Final VOE outstanding
Owner: Processor
Next Action: Request VOE
```

This command area is more important than module navigation. It tells the user how to move the file forward.

### Role-aware workspace rail

The workspace rail should not expose every module equally to every user. It should prioritize sections by role and loan stage.

Broker / Seller:

```text
Overview
Required Actions
Conditions
Documents
Messages
Timeline
```

Processor:

```text
Overview
Tasks
Documents
Conditions
Processing
Title & Appraisal
Conversation
```

Underwriter:

```text
Overview
Income
Credit
URLA
Exceptions
Conditions
Decision
Conversation
```

Funder:

```text
Overview
Funding
Final Conditions
Wire
Closing
Audit
```

Manager:

```text
Overview
Team Activity
Aging
Exceptions
Workload
Audit
```

Secondary modules can remain available behind "More" or collapsed groups, but primary work should be obvious.

### Queues before dashboards

Dashboards should route users into work, not merely summarize metrics.

A dashboard card should generally click into a queue with the right filters already applied:

```text
Submitted Conditions -> Queue of conditions ready for review
Funding Blocked -> Loans blocked from funding
Broker Follow-up Due -> Files waiting on external response
Unassigned Files -> Manager assignment queue
```

---

## Collaboration Model

### Collaboration happens inside the work

Communication should not live only in a separate Messages module. Users should be able to comment, mention, and attach context directly on:

- Conditions
- Documents
- Exceptions
- Underwriting decisions
- Funding blockers
- Tasks
- Status transitions
- Important loan fields

### The activity rail

Every loan workspace should support a persistent activity rail or activity panel showing:

- Comments
- Mentions
- Document uploads
- Condition changes
- Status changes
- Assignment changes
- Funding blockers
- Decision events

Activity should be grouped by time and department where useful.

Example:

```text
Today
- Broker uploaded bank statements
- Processor linked document to Condition #4
- Underwriter mentioned @processor
- Funding blocked by final VOE
```

### Ownership must be visible

Origina should use visible ownership markers:

- Owner chips
- Department badges
- "Waiting on Broker"
- "Owned by Processor"
- "UW Review"
- "Funding Blocked"
- Due dates
- Aging indicators

The user should never need to inspect a hidden history trail to understand who owns the next step.

---

## Information Hierarchy

### Prioritize action over inventory

A module list tells users what exists. A command center tells them what matters.

The hierarchy for operational screens is:

1. Current status
2. Blockers
3. Owner
4. Next action
5. Supporting details
6. History and audit

### Progressive disclosure

Origina has many modules. Do not expose them all at the same level.

Use:

- Role-specific defaults
- Collapsed secondary groups
- Attention badges
- Contextual panels
- Inline expansion
- Slide-over details

Avoid:

- Long flat navigation lists
- Requiring users to remember which module owns a task
- Sending users to full pages for small actions

---

## Consistency Standards

Consistency in Origina means users can predict how work behaves across roles, files, and modules.

### Terminology

Use the same term for the same concept everywhere.

Examples:

- Use "condition" consistently, not a mix of condition, requirement, item, and stip.
- Use "blocker" only for something preventing progress.
- Use "owner" for the person, role, or department responsible for the next action.
- Use "status" for lifecycle state, not task priority or risk level.

### Visual consistency

Shared patterns should use consistent:

- Spacing
- Type scale
- Button hierarchy
- Icon style
- Status colors
- Empty states
- Table behavior
- Form validation
- Loading treatment

### Tone

Origina should sound calm, direct, and operational.

Use:

- Clear action language
- Human-readable explanations
- Minimal internal jargon for external users
- Specific recovery guidance in errors

Avoid:

- Marketing copy inside workflows
- Clever labels
- Ambiguous action text like "Submit" when a more specific verb is available

---

## Design System Standards

Origina should feel like one product, even as modules grow.

Use shared components and tokens for:

- Buttons
- Inputs
- Selects
- Tables
- Status pills
- Owner chips
- Cards
- Slide-overs
- Modals
- Empty states
- Error states
- Loading skeletons
- Toasts and save states

Do not create a new visual pattern when an existing shared component can express the same behavior.

### Component behavior must be consistent

A component should behave the same way wherever it appears.

Examples:

- Status pills always pair color with text.
- Owner chips always identify person, role, or department.
- Primary buttons always represent the next meaningful action.
- Destructive actions always require confirmation.
- Tables use the same sorting, filtering, loading, and empty-state patterns.

---

## Interaction Standards

### Animation must communicate

Animation is allowed when it improves:

1. **State change** — status advanced, condition cleared, document reviewed
2. **Progress** — upload, save, submit, import, processing
3. **Feedback** — hover, click, validation, success, failure
4. **Hierarchy** — drawing attention to the next action or active blocker

Good animation opportunities:

- Hover elevation on cards and action rows
- Subtle row hover previews
- Slide-in filters and detail panels
- Document upload progress
- Condition cleared transition
- Status pill morph or pulse after change
- Save confirmation
- Skeleton loading
- Unread mention pulse
- Workspace section fade/slide

Avoid:

- Decorative background motion
- Heavy page transitions on dense workflows
- Animations that delay table scanning
- Parallax in operational screens
- Constant looping motion

All animations must respect `prefers-reduced-motion`.

### Performance-first motion

Animation should be CSS-first and lightweight.

Rules:

- Use transform and opacity where possible.
- Keep common transitions between 150ms and 300ms.
- Do not animate layout-heavy properties on large tables.
- Do not use JavaScript-driven animation unless the interaction requires it.
- Never block primary actions behind animation timing.

### Status language and color

Status indicators are functional, not decorative.

- **Green** — complete, approved, funded, cleared
- **Orange** — action needed, pending, conditions outstanding
- **Red** — denied, cancelled, rejected, overdue, blocked
- **Gray** — archived, withdrawn, inactive, neutral

Color must always be paired with text or iconography.

### Forms do not surprise

- Communicate required fields before submit.
- Preserve progress on refresh where appropriate.
- Validate at natural interaction points, not aggressively on every keystroke.
- Confirm destructive actions.
- Show save state clearly.
- Keep users in context after saving.

### Empty states have next actions

Every empty state should explain:

- What is empty
- Why it may be empty
- What the user can do next

Empty states should not be decorative dead ends.

### Error states have recovery

Every data-fetching error state needs:

- Human-readable explanation
- Retry action
- No stack traces for non-admin users
- Clear indication of whether entered data was preserved

---

## Broker / Seller Experience

External users should experience Origina as polished, transparent, and easy to trust.

Their experience should focus on:

- My pipeline
- Loan status
- Required actions
- Open conditions
- Missing documents
- Messages from the lender team
- Timeline and next milestone
- Approval and funding readiness

Preferred visual patterns:

- Polished progress timeline
- Clear condition cards
- Elegant document drop zones
- Upload progress states
- Friendly completion states
- Simple message threads
- Calm, professional color palette
- Minimal internal jargon

Broker and seller users should never have to understand Origina's internal department structure to complete their work.

---

## Onboarding and Time to Value

Origina should help each user reach useful work quickly.

### First session

A new user should immediately understand:

- Their role
- Their assigned queue or pipeline
- Which loans need attention
- What action they are expected to take first
- Where to get help if they are blocked

### Progressive guidance

Do not explain the whole system upfront. Introduce guidance at the point of action.

Use:

- Role-specific default views
- Helpful empty states
- Inline hints for unfamiliar workflows
- Checklists for setup-heavy flows
- Guided first actions for brokers and sellers
- Secondary onboarding when advanced features become relevant

Avoid:

- Long tours before the user can work
- Generic help text detached from the current task
- Exposing advanced configuration before basic use is clear

---

## Operational Experience

Internal users need speed, density, and clarity.

Operational screens should be:

- Dense but scannable
- Queue-oriented
- Keyboard-friendly where practical
- Ownership-forward
- Aging-aware
- Optimized for repeated action

Visual polish should support scanning, not compete with it.

Use animation sparingly in operational views. Prioritize hover states, transitions, loading states, and clear feedback over expressive motion.

---

## Layout Standards

### Workspace layout

The loan workspace uses a dedicated workspace layout. The loan's sticky top area should always show:

- Breadcrumb back to the relevant queue or pipeline
- Borrower or entity name
- Loan number
- Current status
- Amount and product
- Key property/location signal
- Current blocker and owner when available
- Primary next action

### Pipeline and queue layout

Pipelines and queues should support:

- Saved views
- Role-specific defaults
- Fast search
- Filter chips
- Column customization
- Aging and SLA indicators
- Ownership columns
- Bulk actions where useful
- One-click entry into the loan workspace

### Slide-overs before full-page travel

Use slide-overs for secondary work that benefits from preserving context:

- Filters
- Add/edit condition
- Document metadata
- Exception request
- Assignment change
- Task creation
- Comment thread

Reserve modals for short confirmations and destructive actions.

---

## Scalability Principles

Origina must scale by adding workflow depth without making the interface feel heavier.

### Design for extension

New features should attach to the existing loan workspace model instead of creating isolated destinations by default.

Prefer:

- New contextual panels inside the loan file
- Queue filters over new dashboards
- Reusable status, blocker, owner, and action patterns
- Shared timeline and activity events
- Role-aware visibility rules

Avoid:

- One-off modules with their own navigation model
- Duplicate status concepts
- Feature-specific layouts that cannot be reused
- Adding new top-level navigation for secondary workflows

### Large data must remain scannable

As loan volume grows, operational views must preserve speed and clarity.

Pipelines and queues should support:

- Saved views
- Fast filtering
- Sortable columns
- Column customization
- Bulk actions
- Pagination or virtualization where needed
- Stable empty, loading, and error states

---

## Accessibility Requirements

These are non-negotiable:

- `aria-label` on navigation landmarks and icon-only controls
- `aria-current="step"` on multi-step progress indicators
- `aria-current="page"` on active navigation links
- `aria-live="polite"` on async content updates
- `aria-sort` on sortable table headers
- `role="menu"` and `role="menuitem"` on dropdown menus
- `:focus-visible` rings on interactive elements
- Semantic heading hierarchy
- Color is never the only state indicator
- All animations respect `prefers-reduced-motion`
- Touch targets are at least 44px where touch use is expected

### Readability and contrast

- Text must meet WCAG AA contrast expectations.
- Body text should remain readable at common browser zoom levels.
- Do not rely on color alone to communicate risk, status, or completion.
- Use plain, task-oriented language where possible.

### Forms and controls

- Every input must have a visible label or an accessible label.
- Error messages must identify the field and explain how to recover.
- Required fields must be communicated before submit.
- Focus order must follow the visual workflow.
- Keyboard users must be able to complete core workflows.

### Non-text content

- Informational images need meaningful alt text.
- Decorative images should be hidden from assistive technology.
- Icons that trigger actions need accessible names.
- Charts must expose the key value or summary outside color alone.

### Screen reader behavior

- Async updates must use appropriate live regions.
- Loading, success, and failure states must be announced where relevant.
- Dialogs and slide-overs must manage focus correctly.

---

## Mobile Position

Origina is desktop-first for internal operations.

However:

- Broker and seller status views must work well on mobile.
- Borrower-facing intake must be fully mobile capable.
- Messages, required actions, document upload, and status tracking should be readable and usable on phones.
- Complex internal workspaces may be reduced or read-only on mobile, but they must not break.

---

## Implementation Checklist

Use this before implementing or approving any feature.

### Clarity

- [ ] Does the screen show status, blocker, owner, and next action?
- [ ] Is the most important action visually obvious?
- [ ] Are labels written in the user's language rather than internal jargon?

### Workflow fit

- [ ] Is the experience tailored to the user's role?
- [ ] Does it reduce or maintain the number of clicks?
- [ ] Can the task happen inside the current workspace?
- [ ] Is full-page navigation truly necessary?

### Collaboration

- [ ] Can users communicate in context?
- [ ] Is ownership visible?
- [ ] Are mentions, comments, documents, or decisions linked to the relevant object?
- [ ] Does activity appear in the loan history or activity rail?

### Performance and motion

- [ ] Does the animation communicate state, progress, feedback, or hierarchy?
- [ ] Is it CSS-first where possible?
- [ ] Does it respect `prefers-reduced-motion`?
- [ ] Does it avoid delaying the primary task?

### Accessibility

- [ ] Are controls keyboard reachable?
- [ ] Are icon-only controls labeled?
- [ ] Is color paired with text or iconography?
- [ ] Is heading structure correct?
- [ ] Do form fields have visible or accessible labels?
- [ ] Do errors explain what happened and how to recover?
- [ ] Are chart values understandable without color alone?

### Resilience

- [ ] Does the loading state preserve layout?
- [ ] Does the empty state provide a next action?
- [ ] Does the error state provide a retry?
- [ ] Is entered data preserved when an operation fails?

### Scalability and consistency

- [ ] Does this reuse an existing component or pattern?
- [ ] Does this introduce a new term for an existing concept?
- [ ] Will this layout still work with more loans, more conditions, or more roles?
- [ ] Can this feature scale without adding a new top-level module?

### Onboarding

- [ ] Does a new user know what to do first?
- [ ] Is guidance shown at the point of action?
- [ ] Does the empty state help the user reach value?

---

## Build Priorities

The recommended UX implementation order is:

1. Add first-class role support for Processor, Funder, Manager, and any missing internal roles.
2. Make the loan workspace rail role-aware and stage-aware.
3. Add the loan command bar: status, blocker, owner, next action.
4. Create queue-based dashboard cards that route directly into filtered work.
5. Add a unified blocker/readiness model across conditions, documents, closing, funding, and underwriting.
6. Add activity rail and object-level comments.
7. Simplify and polish the Broker / Seller portal.
8. Add lightweight animation standards through shared CSS utilities.
9. Build manager workload and bottleneck dashboards after ownership/activity data exists.

---

## Documentation Maintenance

- Update this document when a UX principle becomes enforceable in code or design review.
- Add new patterns after they appear in multiple screens and should become reusable.
- Keep animation timing guidance aligned with `globals.css`.
- Do not add decorative UI rules unless they support clarity, speed, confidence, or trust.
