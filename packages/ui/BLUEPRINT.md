# UI Components

## Purpose

Shared UI components used by the web frontend. This package contains
field-level input components and utility functions that are reused across
entity forms, detail views, and dynamic pages.

## Architecture

```
src/
  FieldInput.tsx  → Renders the correct input control for a given FieldType
  utils.ts        → Shared UI utility functions (cn class merger, etc.)
  index.ts        → Public exports
```

## FieldInput

The `FieldInput` component is the bridge between entity field definitions and
rendered form controls. Given a `FieldType` (text, email, number, enum, date,
boolean, etc.), it renders the matching HTML input with proper validation
attributes, labels, and styling.

```typescript
<FieldInput
  field={{ name: "status", type: "enum", options: ["active", "inactive"] }}
  value={value}
  onChange={setValue}
/>
```

## Rules

- Components must be generic — NEVER reference specific entities by name
- All components must work with the `FieldType` enum from `@metasaas/contracts`
- Styling uses Tailwind CSS classes
- No business logic — only presentation and input handling
- Components must be accessible (proper labels, ARIA attributes, keyboard nav)
