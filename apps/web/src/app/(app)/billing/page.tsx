"use client";

/**
 * Billing Page
 *
 * Shows current subscription status, plan selection pricing table,
 * and invoice history. Integrates with Stripe via the billing API.
 */

import { useState } from "react";
import { useBilling } from "@/lib/use-billing";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@metasaas/ui";
import type { PlanData } from "@/lib/api-client";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  trialing: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  past_due: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  canceled: "bg-red-500/10 text-red-600 dark:text-red-400",
  unpaid: "bg-red-500/10 text-red-600 dark:text-red-400",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrency(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

function formatInterval(interval: string): string {
  switch (interval) {
    case "month": return "/mo";
    case "year": return "/yr";
    default: return "";
  }
}

function PlanCard({
  plan,
  isRecommended,
  onSelect,
  disabled,
}: {
  plan: PlanData;
  isRecommended: boolean;
  onSelect: () => void;
  disabled: boolean;
}) {
  const isFree = plan.priceCents === 0;

  return (
    <div
      className={cn(
        "relative rounded-lg border p-6 flex flex-col",
        isRecommended
          ? "border-primary shadow-sm"
          : "border-border"
      )}
    >
      {isRecommended && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-medium px-3 py-0.5 rounded-full">
          Recommended
        </div>
      )}

      <div className="mb-4">
        <h3 className="text-lg font-semibold">{plan.name}</h3>
        {plan.description && (
          <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
        )}
      </div>

      <div className="mb-6">
        <span className="text-3xl font-bold">
          {isFree ? "Free" : formatCurrency(plan.priceCents, plan.currency)}
        </span>
        {!isFree && (
          <span className="text-sm text-muted-foreground">
            {formatInterval(plan.interval)}
          </span>
        )}
      </div>

      <ul className="space-y-2.5 mb-6 flex-1">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-primary mt-0.5 shrink-0"
            aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {isFree ? (
        <div className="text-center text-sm text-muted-foreground py-2.5">
          Current plan
        </div>
      ) : (
        <button
          type="button"
          onClick={onSelect}
          disabled={disabled}
          className={cn(
            "w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50",
            isRecommended
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "border border-input hover:bg-accent/50"
          )}
        >
          {disabled && (
            <svg className="animate-spin h-3.5 w-3.5 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {disabled ? "Redirecting..." : `Choose ${plan.name}`}
        </button>
      )}
    </div>
  );
}

export default function BillingPage() {
  const {
    subscription,
    invoices,
    plans,
    loading,
    error,
    actionLoading,
    startCheckout,
    cancel,
    openPortal,
  } = useBilling();

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-8">
        <div>
          <div className="h-7 w-32 bg-muted rounded animate-pulse" />
          <div className="h-4 w-56 bg-muted rounded mt-2 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border border-border p-6 animate-pulse">
              <div className="h-5 w-20 bg-muted rounded mb-3" />
              <div className="h-8 w-24 bg-muted rounded mb-4" />
              <div className="space-y-2">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="h-3 w-full bg-muted rounded" />
                ))}
              </div>
              <div className="h-10 w-full bg-muted rounded mt-6" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold tracking-tight mb-6">Billing</h1>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center space-y-3">
          <p className="text-sm text-destructive">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="text-sm px-4 py-2 rounded-md border border-input hover:bg-accent/50 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your subscription and view invoices
        </p>
      </div>

      {/* Active Subscription */}
      {subscription ? (
        <div className="rounded-lg border border-border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">{subscription.planName}</h2>
              <span
                className={cn(
                  "inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full",
                  STATUS_STYLES[subscription.status] ?? "bg-muted text-muted-foreground"
                )}
              >
                {subscription.status}
              </span>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <p>Current period</p>
              <p className="font-medium text-foreground">
                {formatDate(subscription.currentPeriodStart)} — {formatDate(subscription.currentPeriodEnd)}
              </p>
            </div>
          </div>

          {subscription.cancelAtPeriodEnd && (
            <div className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
              Your subscription will cancel at the end of the current period.
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={openPortal}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-md border border-input hover:bg-accent/50 transition-colors disabled:opacity-50"
            >
              {actionLoading && (
                <svg className="animate-spin h-3.5 w-3.5 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              Manage Subscription
            </button>
            {subscription.status === "active" && !subscription.cancelAtPeriodEnd && (
              <button
                type="button"
                onClick={() => setShowCancelConfirm(true)}
                disabled={actionLoading}
                className="text-sm px-4 py-2 rounded-md text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
              >
                Cancel Subscription
              </button>
            )}
          </div>
        </div>
      ) : (
        /* No subscription — show pricing table */
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-lg font-semibold">Choose a Plan</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Select the plan that best fits your needs
            </p>
          </div>

          {plans.length > 0 ? (
            <div className={cn(
              "grid gap-6",
              plans.length === 1 && "grid-cols-1 max-w-md mx-auto",
              plans.length === 2 && "grid-cols-1 md:grid-cols-2 max-w-2xl mx-auto",
              plans.length >= 3 && "grid-cols-1 md:grid-cols-3",
            )}>
              {plans.map((plan, idx) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  isRecommended={plans.length >= 3 ? idx === 1 : false}
                  onSelect={() => startCheckout(plan.id)}
                  disabled={actionLoading}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-border p-8 text-center">
              <h2 className="text-lg font-semibold">Free Plan</h2>
              <p className="text-sm text-muted-foreground mt-1">
                You&apos;re on the free plan. Contact your admin for upgrade options.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Invoice History */}
      {invoices.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Invoice History</h2>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Amount</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground"></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-t border-border">
                    <td className="px-4 py-2.5">{formatDate(inv.createdAt)}</td>
                    <td className="px-4 py-2.5 font-medium">
                      {formatCurrency(inv.amountPaid, inv.currency)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          "text-xs font-medium px-2 py-0.5 rounded-full",
                          inv.status === "paid"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {inv.invoiceUrl && (
                        <a
                          href={inv.invoiceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1"
                          aria-label="View invoice (opens in new tab)"
                        >
                          View
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cancel Subscription Confirmation */}
      <ConfirmDialog
        open={showCancelConfirm}
        title="Cancel Subscription"
        message="Are you sure you want to cancel? Your subscription will remain active until the end of the current billing period."
        confirmLabel="Cancel Subscription"
        cancelLabel="Keep Subscription"
        variant="danger"
        onConfirm={() => {
          setShowCancelConfirm(false);
          cancel();
        }}
        onCancel={() => setShowCancelConfirm(false)}
      />
    </div>
  );
}
