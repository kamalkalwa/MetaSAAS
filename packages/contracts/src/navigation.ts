/**
 * Navigation Definition
 *
 * Defines sidebar menu items for the application.
 * The domain exports a navigation configuration, and
 * the platform's AppShell renders it.
 */

/**
 * A single navigation item in the sidebar.
 */
export interface NavigationItem {
  /** Display label (e.g., "Contacts") */
  label: string;

  /** URL path (e.g., "/contacts") */
  href: string;

  /** Icon name from the icon library */
  icon: string;

  /** Sort order in the sidebar (lower = higher) */
  order?: number;

  /** Optional badge count (e.g., unread items) */
  badge?: number;

  /** Child items for grouped navigation */
  children?: NavigationItem[];
}
