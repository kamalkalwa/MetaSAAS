"use client";

/**
 * Billing Hook
 *
 * Manages subscription status, plans, and billing actions.
 * Fetches subscription + plans on mount, provides checkout/cancel/portal helpers.
 */

import { useCallback, useEffect, useState } from "react";
import {
  fetchSubscription,
  fetchInvoices,
  fetchPlans,
  createCheckout,
  cancelSubscription,
  createPortalSession,
  type SubscriptionData,
  type InvoiceData,
  type PlanData,
} from "@/lib/api-client";

export function useBilling() {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [plans, setPlans] = useState<PlanData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sub, invs, pls] = await Promise.all([
        fetchSubscription(),
        fetchInvoices(),
        fetchPlans(),
      ]);
      setSubscription(sub);
      setInvoices(invs);
      setPlans(pls);
    } catch (err) {
      console.error("Failed to load billing data:", err);
      setError("Failed to load billing data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const startCheckout = useCallback(async (planId: string) => {
    setActionLoading(true);
    try {
      const result = await createCheckout({ planId });
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (err) {
      console.error("Checkout failed:", err);
    } finally {
      setActionLoading(false);
    }
  }, []);

  const cancel = useCallback(async () => {
    setActionLoading(true);
    try {
      await cancelSubscription();
      await loadData();
    } catch (err) {
      console.error("Cancel failed:", err);
    } finally {
      setActionLoading(false);
    }
  }, [loadData]);

  const openPortal = useCallback(async () => {
    setActionLoading(true);
    try {
      const result = await createPortalSession();
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (err) {
      console.error("Portal session failed:", err);
    } finally {
      setActionLoading(false);
    }
  }, []);

  return {
    subscription,
    invoices,
    plans,
    loading,
    error,
    actionLoading,
    startCheckout,
    cancel,
    openPortal,
    refresh: loadData,
  };
}
