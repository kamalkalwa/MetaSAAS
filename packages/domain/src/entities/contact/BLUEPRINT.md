# Contact

## Purpose

A Contact represents a person the business has a relationship with.
Contacts are the core entity of the CRM — everything (deals, activities,
emails) connects back to a Contact.

## Relationships

- A Contact optionally belongs to a Company
- Contacts are unique by email within a tenant
- Deleting a Contact should preserve related data (soft-delete in future)

## AI Capabilities (planned for v1)

- Enrichment: On creation, enrich with public data (role, LinkedIn, company info)
- Follow-up suggestions: After notes are added, suggest next actions

## Edge Cases

- A Contact can exist without a Company (freelancers, independent consultants)
- Email must be unique per tenant but the same email can exist in different tenants
- Status transitions: lead → active → inactive (can return to active from inactive)
- Phone is PII — marked as sensitive
