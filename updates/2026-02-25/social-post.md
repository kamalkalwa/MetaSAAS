# Social Media Post — Feb 25, 2026

## LinkedIn Version

---

**I found a sneaky Tailwind CSS v4 bug that broke dark mode — here's the architectural fix.**

Building MetaSAAS (an AI-native SaaS framework), I discovered that Tailwind v4's `@theme inline` silently **hardcodes hex values** into utility classes:

```
.bg-card { background-color: #ffffff; }  // literal, not var()
```

Your `:root.dark` CSS variable overrides? Completely ignored. The page background changed (because `body` was manually set), but every card, text, border, and input stayed frozen in light mode.

The fix: switch from `@theme inline` to `@theme` with var() self-references. Now Tailwind generates utilities that resolve CSS variables at runtime — and dark mode just works.

Also shipped this week:
- 10 new UI components (DataTable, Pagination, Toast, ImportModal...)
- Webhook system with retry, circuit breaker, and HMAC signatures
- 5 new test suites

The lesson: when something "should work" but doesn't, read the compiled output. The bug wasn't in my code — it was in my understanding of the build tool.

#TailwindCSS #DarkMode #CSS #WebDev #React #NextJS #OpenSource #SaaS

---

## X (Twitter) Version — Thread

---

**Tweet 1:**

Found a sneaky Tailwind v4 bug that breaks dark mode for everyone using @theme inline.

The fix is 1 keyword change.

Thread:

**Tweet 2:**

Tailwind v4's `@theme inline` does 2 things:
1. Emits CSS variables on :root
2. Hardcodes those values into utilities

`.bg-card { background-color: #ffffff; }` — literal hex, NOT var().

Your :root.dark overrides? Nobody reads them.

**Tweet 3:**

The fix: use `@theme` (without "inline") + var() self-references:

```
@theme {
  --color-card: var(--color-card);
}
:root      { --color-card: #fff; }
:root.dark { --color-card: #1a1d27; }
```

Now utilities resolve at runtime. Dark mode just works.

**Tweet 4:**

Before / After:

[attach dashboard-light.png and dashboard-dark.png side by side]

Also shipped 10 new UI components, a webhook system with circuit breakers, and 5 test suites.

Building in public: github.com/kamalkalwa/MetaSAAS

**Tweet 5:**

The lesson: when your CSS "should work" but doesn't — read the compiled output.

The bug wasn't in my code. It was in my understanding of the build tool.

#TailwindCSS #DarkMode #WebDev
