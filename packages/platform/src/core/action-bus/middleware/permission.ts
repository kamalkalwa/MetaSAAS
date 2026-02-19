/**
 * Permission Middleware
 *
 * Evaluates PermissionRule definitions against the authenticated Caller
 * to determine whether an action can be executed.
 *
 * Evaluation logic:
 *   1. Rules are evaluated in order — first matching rule wins
 *   2. A rule "matches" if ALL its conditions are met:
 *      - callerTypes (if specified): caller.type must be in the list
 *      - roles (if specified): caller must have at least one matching role
 *      - ownership (if specified): "any" always passes, "own" is a placeholder
 *   3. If the matching rule has effect "allow" → permitted
 *   4. If the matching rule has effect "deny" → denied
 *   5. If no rule matches → denied (default deny)
 *
 * The ALLOW_ALL rule (no conditions, effect: "allow") matches everything.
 */

import type { Caller, ActionDefinition, PermissionRule } from "@metasaas/contracts";

/**
 * Checks if a single permission rule matches the caller.
 * A rule matches if ALL specified conditions are satisfied.
 * Conditions that are undefined are treated as "any" (not restrictive).
 */
function ruleMatches(rule: PermissionRule, caller: Caller): boolean {
  // Check caller type restriction
  if (rule.callerTypes && rule.callerTypes.length > 0) {
    if (!rule.callerTypes.includes(caller.type)) {
      return false;
    }
  }

  // Check role restriction
  if (rule.roles && rule.roles.length > 0) {
    const hasMatchingRole = rule.roles.some((r) => caller.roles.includes(r));
    if (!hasMatchingRole) {
      return false;
    }
  }

  // Ownership check (simplified for v0)
  // "any" → always passes
  // "own" → would need the entity record to check, placeholder for now
  if (rule.ownership === "own") {
    // Future: compare caller.userId with record's owner field
    // For now, treat as "any" to avoid breaking existing actions
  }

  return true;
}

/**
 * Checks if the caller has permission to execute the action.
 *
 * Evaluates the action's permission rules in order.
 * First matching rule determines the result.
 * Default: denied if no rules match (secure by default).
 */
export function checkPermission(
  action: ActionDefinition,
  caller: Caller
): boolean {
  const rules = action.permissions;

  // If no permissions are defined, deny by default (secure)
  if (!rules || rules.length === 0) {
    return false;
  }

  // Evaluate rules in order — first match wins
  for (const rule of rules) {
    if (ruleMatches(rule, caller)) {
      return rule.effect === "allow";
    }
  }

  // No matching rule → denied
  return false;
}

/**
 * Permission denied error.
 */
export class PermissionError extends Error {
  constructor(actionId: string, userId: string) {
    super(
      `Permission denied: user "${userId}" cannot execute action "${actionId}"`
    );
    this.name = "PermissionError";
  }
}
