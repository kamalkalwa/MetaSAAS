# Company

## Purpose

A Company represents an organization the business has a relationship with.
Companies are the container for Contacts — multiple people can work at the
same Company.

## Relationships

- A Company has many Contacts
- A Company can exist independently (no required parent)
- Deleting a Company should NOT delete its Contacts (unlink them instead)

## Edge Cases

- Company names are not unique (multiple "Acme Corp" entries are allowed)
- Industry and size are optional — not always known at creation time
- Website should be validated as a URL when provided
