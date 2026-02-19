/**
 * Permission Definitions
 *
 * Declares who can execute an action. The platform's permission middleware
 * evaluates these rules before every action execution.
 *
 * In v0, permissions are simplified (allow-all).
 * Future versions will support role-based and attribute-based rules.
 */

/** The type of caller invoking an action */
export type CallerType = "human" | "ai-agent" | "system" | "webhook";

/**
 * A single permission rule.
 * Rules are evaluated in order — first matching rule wins.
 */
export interface PermissionRule {
  /** Which caller types this rule applies to */
  callerTypes?: CallerType[];

  /** Which roles are allowed (e.g., ["admin", "manager"]) */
  roles?: string[];

  /**
   * Whether the caller must own the resource.
   * "own" = caller.userId must match the entity's owner field.
   */
  ownership?: "any" | "own";

  /** Whether this rule allows or denies access */
  effect: "allow" | "deny";
}

/**
 * Default permission: allow all callers.
 * Used in v0 where we don't have auth yet.
 */
export const ALLOW_ALL: PermissionRule = {
  effect: "allow",
};
