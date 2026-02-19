/**
 * Action Registry
 *
 * Central registry of all actions in the system.
 * Both auto-generated CRUD actions and custom domain actions
 * register here. The REST adapter reads this to generate routes.
 */

import type { ActionDefinition } from "@metasaas/contracts";

/** All registered actions, keyed by action ID */
const actions = new Map<string, ActionDefinition>();

/**
 * Registers an action. Throws if an action with the same ID already exists.
 */
export function registerAction(action: ActionDefinition) {
  if (actions.has(action.id)) {
    throw new Error(
      `Action "${action.id}" is already registered. Action IDs must be unique.`
    );
  }
  actions.set(action.id, action);
}

/**
 * Registers multiple actions at once.
 */
export function registerActions(actionList: ActionDefinition[]) {
  for (const action of actionList) {
    registerAction(action);
  }
}

/**
 * Retrieves an action by ID.
 */
export function getAction(id: string): ActionDefinition | undefined {
  return actions.get(id);
}

/**
 * Returns all registered actions.
 */
export function getAllActions(): ActionDefinition[] {
  return Array.from(actions.values());
}

/**
 * Returns all actions for a given entity.
 * Matches on the "entity." prefix convention.
 */
export function getActionsForEntity(entityName: string): ActionDefinition[] {
  const prefix = entityName.toLowerCase() + ".";
  return Array.from(actions.values()).filter((a) =>
    a.id.toLowerCase().startsWith(prefix)
  );
}

/**
 * Clears all registered actions. Used for testing.
 */
export function clearActionRegistry() {
  actions.clear();
}
