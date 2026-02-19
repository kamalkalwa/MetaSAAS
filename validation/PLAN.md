# Thesis Validation Plan

## Hypothesis

An AI agent (or developer) can create a completely new business domain by
following only the BLUEPRINT.md files in the MetaSAAS codebase.

## Test Domain

**Project Management** — Projects and Tasks.

Chosen because it exercises:
- Parent/child relationships (Project has many Tasks)
- Multiple enum fields (status, priority)
- Date fields
- Numeric fields (estimatedHours)
- A domain entirely different from the existing CRM

## Process

1. Read ONLY the BLUEPRINT.md files (root, domain, entities, example entities)
2. Create entity definitions following the documented patterns
3. Wire into domain/src/index.ts
4. Add seed data and navigation
5. Restart the server
6. Verify all 8 success criteria

## Success Criteria

1. Both entities appear in the sidebar automatically
2. CRUD works for both (create, read, update, delete)
3. List views show correct data
4. Detail views show all fields correctly (camelCase)
5. Create/edit forms work with all field types (text, enum, date, number, rich_text)
6. Foreign key relationship (Task belongs to Project) is enforced at DB level
7. Seed data loads correctly
8. Filter by status works (e.g., ?status=active on Projects)

## Friction Log Format

Every friction point is logged in REPORT.md with:
- **Severity**: blocks / slows / cosmetic
- **Where**: which BLUEPRINT or step was insufficient
- **What happened**: description of the problem
- **What was needed**: what the BLUEPRINT should have said
