import { redirect } from "next/navigation";

/**
 * Dashboard route — for now redirects here from root.
 * Future: show entity counts, recent items, charts.
 */
export default function DashboardRedirect() {
  redirect("/dashboard");
}
