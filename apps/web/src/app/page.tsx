import Link from "next/link";

/**
 * Landing Page
 *
 * Public marketing page at the root route.
 * Server Component — zero client-side JS, instant load.
 */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-lg font-semibold tracking-tight">MetaSAAS</span>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="text-sm px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
            Stop rebuilding the same SaaS{" "}
            <span className="text-primary">infrastructure</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Database, auth, CRUD, billing, multi-tenancy, permissions — you've
            built it all before. MetaSAAS handles the 80% that's identical
            so you ship in hours, not weeks.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/signup"
              className="px-6 py-3 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
            >
              Start Building
            </Link>
            <a
              href="https://github.com/kamalkalwa/MetaSAAS"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 rounded-md border border-border font-medium hover:bg-muted transition-colors inline-flex items-center gap-2"
              aria-label="View source on GitHub (opens in new tab)"
            >
              GitHub
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Full TypeScript stack. 520+ tests. 5 production domains. MIT licensed.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-semibold text-center mb-4">
            Everything you used to build by hand
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">
            Every SaaS needs the same foundation. MetaSAAS generates it from a
            single source of truth so you never build it twice.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={ICONS.entities}
              title="No More Schema Busywork"
              description="Describe your data model once. Database schemas, REST APIs, validation, and UI are generated automatically. Stop writing the same CRUD for the hundredth time."
            />
            <FeatureCard
              icon={ICONS.ai}
              title="AI That Understands Your Domain"
              description="Describe a feature in plain English and watch it materialize. Generate entities, explore data by chatting, evolve your schema — no migrations needed."
            />
            <FeatureCard
              icon={ICONS.views}
              title="Every View, Already Built"
              description="Tables, kanban boards, calendar grids — generated from your data model. Stop rebuilding the same UI patterns for every new entity."
            />
            <FeatureCard
              icon={ICONS.tenants}
              title="Multi-Tenancy From Day One"
              description="Row-level tenant isolation, scoped queries, and role-based permissions out of the box. The infrastructure that takes teams weeks is already done."
            />
            <FeatureCard
              icon={ICONS.stack}
              title="Complete Stack, Zero Glue Code"
              description="TypeScript end-to-end. Next.js 15, Fastify, PostgreSQL, Supabase Auth. Email, file storage, webhooks — integrated and working together."
            />
            <FeatureCard
              icon={ICONS.production}
              title="Ship Today, Not Next Month"
              description="Rate limiting, security headers, audit logging, error boundaries, dark mode, Docker. The production checklist is already done."
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-semibold text-center mb-12">
            How it works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <StepCard
              step="1"
              title="Describe"
              description="Tell the platform what your SaaS does — your data, relationships, and business rules. Use TypeScript or just describe it to the AI."
            />
            <StepCard
              step="2"
              title="Generate"
              description="Database, API, validation, and a full working UI appear automatically. No boilerplate. No glue code."
            />
            <StepCard
              step="3"
              title="Ship"
              description="Deploy a production-ready SaaS with Docker. Auth, billing, multi-tenancy, and monitoring already wired up."
            />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="max-w-lg mx-auto text-center">
          <h2 className="text-2xl font-semibold mb-4">Early Access</h2>
          <p className="text-muted-foreground mb-8">
            Get the complete platform. Ship your next SaaS in hours, not weeks.
          </p>
          <div className="bg-card border border-border rounded-lg p-8 shadow-sm">
            <div className="text-4xl font-bold">$149</div>
            <div className="text-sm text-muted-foreground mt-1 mb-6">
              one-time payment
            </div>
            <ul className="text-left text-sm space-y-3 mb-8">
              {[
                "Full source code — own it forever (MIT)",
                "5 example domains (CRM, PM, Inventory, Healthcare, Gym)",
                "AI chat, commands, entity generation",
                "Unlimited entities, all views",
                "Email, file storage, webhooks",
                "Multi-tenancy, auth, audit logging",
                "Docker deployment ready",
                "Future updates included",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-success mt-0.5 shrink-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/signup"
              className="block w-full px-6 py-3 rounded-md bg-primary text-primary-foreground font-medium text-center hover:bg-primary/90 transition-colors"
            >
              Get Early Access →
            </Link>
            <p className="text-xs text-muted-foreground mt-3">
              Instant access. 30-day money-back guarantee.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <span>MetaSAAS v0.0.2</span>
          <div className="flex items-center gap-6">
            <a
              href="https://github.com/kamalkalwa/MetaSAAS"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              GitHub
            </a>
            <Link href="/login" className="hover:text-foreground transition-colors">
              Log in
            </Link>
            <Link href="/signup" className="hover:text-foreground transition-colors">
              Sign Up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
      <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center mb-4">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-primary"
          aria-hidden="true"
        >
          <path d={icon} />
        </svg>
      </div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
    </div>
  );
}

function StepCard({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold mx-auto mb-4">
        {step}
      </div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
    </div>
  );
}

const ICONS = {
  entities:
    "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z",
  ai: "M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1.27A7 7 0 0 1 14 23h-4a7 7 0 0 1-6.73-4H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z",
  views:
    "M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z",
  tenants:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  stack:
    "M12 2 2 7l10 5 10-5-10-5ZM2 17l10 5 10-5M2 12l10 5 10-5",
  production:
    "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
};
