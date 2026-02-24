/**
 * CRUD Generator
 *
 * Reads an EntityDefinition and auto-generates the five standard
 * CRUD actions: create, findAll, findById, update, delete.
 *
 * These are full ActionDefinitions — typed, described, permissioned —
 * and register on the Action Bus like any other action.
 *
 * Domain code can override these by registering actions with the
 * same ID before the CRUD generator runs.
 */

import { z } from "zod";
import type { EntityDefinition, ActionDefinition } from "@metasaas/contracts";
import { ALLOW_ALL, zodSchemaForFieldType } from "@metasaas/contracts";
import { validateWorkflowTransitions, WorkflowError } from "../action-bus/middleware/workflow.js";

/**
 * Generates CRUD actions for an entity definition.
 * Returns an array of ActionDefinitions ready to register.
 */
export function generateCRUDActions(
  entity: EntityDefinition
): ActionDefinition[] {
  const entityLower = entity.name.toLowerCase();

  // Build the input schema from field definitions
  const fieldSchemas: Record<string, z.ZodTypeAny> = {};
  const fieldSchemasOptional: Record<string, z.ZodTypeAny> = {};

  for (const field of entity.fields) {
    const schema = zodSchemaForFieldType(field.type, {
      required: field.required,
      enumValues: field.options,
    });

    // If a required field declares a defaultValue, make it optional in the
    // create schema and let Zod fill in the default when the field is omitted.
    // Without this, defaultValue is dead code — callers would have to send
    // the default explicitly, defeating its purpose.
    if (field.required && field.defaultValue !== undefined) {
      fieldSchemas[field.name] = schema.optional().default(field.defaultValue);
    } else {
      fieldSchemas[field.name] = schema;
    }

    // For update, all fields are optional
    fieldSchemasOptional[field.name] = schema.optional();
  }

  // Add foreign key fields for belongsTo relationships.
  // The API contract is always camelCase, so we derive the camelCase
  // field name regardless of how foreignKey is specified in the entity.
  // e.g., foreignKey: "project_id" → input field: "projectId"
  if (entity.relationships) {
    for (const rel of entity.relationships) {
      if (rel.type === "belongsTo") {
        // Derive camelCase FK field name for the API contract
        const baseName = rel.as ?? rel.entity;
        const fkField = baseName.charAt(0).toLowerCase() + baseName.slice(1) + "Id";
        fieldSchemas[fkField] = z.string().uuid().optional().nullable();
        fieldSchemasOptional[fkField] = z.string().uuid().optional().nullable();
      }
    }
  }

  const createSchema = z.object(fieldSchemas);
  const updateSchema = z.object(fieldSchemasOptional);
  const recordSchema = z.record(z.unknown());
  const listSchema = z.array(recordSchema);

  // ---------------------------------------------------------------
  // Build a representative example input from the entity's fields so
  // AI models see the exact field names (e.g. "title", not "name").
  // Required fields without defaults are shown; optional fields are omitted.
  // ---------------------------------------------------------------
  const exampleInput: Record<string, unknown> = {};
  for (const field of entity.fields) {
    if (!field.required) continue;
    if (field.defaultValue !== undefined) continue; // AI can safely omit these

    // Use a short, realistic placeholder that hints at the field type
    switch (field.type) {
      case "number":
      case "currency":
      case "percentage":
        exampleInput[field.name] = 0;
        break;
      case "boolean":
        exampleInput[field.name] = true;
        break;
      case "enum":
        exampleInput[field.name] = field.options?.[0] ?? "value";
        break;
      default:
        exampleInput[field.name] = `example ${field.name}`;
    }
  }

  // Build a human-readable field list for the action description so
  // the AI model knows exactly which fields exist and which are optional.
  const fieldHints = entity.fields.map((f) => {
    const parts = [f.name, `(${f.type}`];
    if (f.required && f.defaultValue === undefined) parts.push(", required");
    if (f.defaultValue !== undefined) parts.push(`, default: ${JSON.stringify(f.defaultValue)}`);
    if (f.options?.length) parts.push(`, values: ${f.options.join("|")}`);
    parts.push(")");
    return parts.join("");
  }).join(", ");

  // ---------------------------------------------------------------
  // CREATE
  // ---------------------------------------------------------------
  const createAction: ActionDefinition = {
    id: `${entityLower}.create`,
    name: `Create ${entity.name}`,
    description: `Creates a new ${entity.name} record. Fields: ${fieldHints}. ${entity.description}`,
    inputSchema: createSchema,
    outputSchema: recordSchema,
    permissions: [ALLOW_ALL],
    idempotent: false,
    affectsEntities: [entity.name],
    examples: [
      {
        description: `Create a new ${entity.name}`,
        input: exampleInput,
        naturalLanguage: `Create a new ${entity.name.toLowerCase()}`,
      },
    ],
    beforeExecute: entity.hooks?.beforeCreate as ActionDefinition["beforeExecute"],
    afterExecute: entity.hooks?.afterCreate as ActionDefinition["afterExecute"],
    async execute(input, ctx) {
      const record = input as Record<string, unknown>;

      // Workflow: validate initial state on create.
      // For each workflow, if the record includes the workflow field,
      // ensure it's a valid "from" state (an entry point to the workflow).
      if (entity.workflows?.length) {
        for (const wf of entity.workflows) {
          const value = record[wf.field] as string | undefined;
          if (value) {
            const validStarts = [...new Set(wf.transitions.map((t) => t.from))];
            if (!validStarts.includes(value)) {
              throw new WorkflowError(
                wf.field,
                "(none)",
                value,
                validStarts
              );
            }
          }
        }
      }

      const result = await ctx.db.create(entity.name, record);
      await ctx.emit({
        type: `${entityLower}.created`,
        payload: { id: result.id, ...result },
      });
      return result;
    },
  };

  // ---------------------------------------------------------------
  // FIND ALL (list)
  // ---------------------------------------------------------------
  const findAllAction: ActionDefinition = {
    id: `${entityLower}.findAll`,
    name: `List ${entity.pluralName}`,
    description: `Retrieves a list of ${entity.pluralName} with optional filtering and sorting.`,
    inputSchema: z.object({
      where: z.record(z.unknown()).optional(),
      search: z.object({
        term: z.string(),
        fields: z.array(z.string()),
      }).optional(),
      orderBy: z
        .object({
          field: z.string(),
          direction: z.enum(["asc", "desc"]),
        })
        .optional(),
      limit: z.number().int().positive().max(100).optional(),
      offset: z.number().int().min(0).optional(),
    }),
    outputSchema: z.object({
      data: listSchema,
      total: z.number(),
    }),
    permissions: [ALLOW_ALL],
    idempotent: true,
    async execute(input, ctx) {
      const typedInput = input as {
        where?: Record<string, unknown>;
        search?: { term: string; fields: string[] };
        orderBy?: { field: string; direction: "asc" | "desc" };
        limit?: number;
        offset?: number;
      };

      const [data, total] = await Promise.all([
        ctx.db.findMany(entity.name, {
          where: typedInput.where,
          search: typedInput.search,
          orderBy: typedInput.orderBy ?? entity.ui.defaultSort,
          limit: typedInput.limit ?? 50,
          offset: typedInput.offset ?? 0,
        }),
        ctx.db.count(entity.name, typedInput.where, typedInput.search),
      ]);

      return { data, total };
    },
  };

  // ---------------------------------------------------------------
  // FIND BY ID
  // ---------------------------------------------------------------
  const findByIdAction: ActionDefinition = {
    id: `${entityLower}.findById`,
    name: `Get ${entity.name}`,
    description: `Retrieves a single ${entity.name} by its unique ID.`,
    inputSchema: z.object({ id: z.string().uuid() }),
    outputSchema: recordSchema.nullable(),
    permissions: [ALLOW_ALL],
    idempotent: true,
    async execute(input, ctx) {
      const { id } = input as { id: string };
      return ctx.db.findById(entity.name, id);
    },
  };

  // ---------------------------------------------------------------
  // UPDATE (with workflow validation)
  // ---------------------------------------------------------------
  const updateAction: ActionDefinition = {
    id: `${entityLower}.update`,
    name: `Update ${entity.name}`,
    description: `Updates an existing ${entity.name} record. Only provided fields are changed.`,
    inputSchema: z.object({
      id: z.string().uuid(),
      data: updateSchema,
    }),
    outputSchema: recordSchema,
    permissions: [ALLOW_ALL],
    beforeExecute: entity.hooks?.beforeUpdate as ActionDefinition["beforeExecute"],
    afterExecute: entity.hooks?.afterUpdate as ActionDefinition["afterExecute"],
    idempotent: true,
    affectsEntities: [entity.name],
    async execute(input, ctx) {
      const { id, data } = input as { id: string; data: Record<string, unknown> };

      // Workflow validation: if the entity has workflows, check transitions
      if (entity.workflows && entity.workflows.length > 0) {
        // Need the current record to compare state
        const hasWorkflowFieldChange = entity.workflows.some(
          (w) => data[w.field] !== undefined
        );

        if (hasWorkflowFieldChange) {
          const current = await ctx.db.findById(entity.name, id);
          if (!current) {
            throw new Error(`${entity.name} with id "${id}" not found`);
          }

          // validateWorkflowTransitions throws WorkflowError on invalid transitions
          const transitionResults = validateWorkflowTransitions(
            entity.workflows,
            data,
            current
          );

          // Emit workflow transition events for any triggers
          for (const result of transitionResults) {
            if (result.triggers.length > 0) {
              await ctx.emit({
                type: `${entityLower}.workflow.transitioned`,
                payload: {
                  id,
                  workflow: result.workflow.name,
                  field: result.workflow.field,
                  from: result.from,
                  to: result.to,
                  triggers: result.triggers,
                },
              });
            }
          }
        }
      }

      const result = await ctx.db.update(entity.name, id, data);
      await ctx.emit({
        type: `${entityLower}.updated`,
        payload: { id, changes: data },
      });
      return result;
    },
  };

  // ---------------------------------------------------------------
  // DELETE
  // ---------------------------------------------------------------
  const deleteAction: ActionDefinition = {
    id: `${entityLower}.delete`,
    name: `Delete ${entity.name}`,
    description: `Permanently deletes a ${entity.name} record by ID.`,
    inputSchema: z.object({ id: z.string().uuid() }),
    outputSchema: z.object({ success: z.boolean() }),
    permissions: [ALLOW_ALL],
    idempotent: true,
    affectsEntities: [entity.name],
    beforeExecute: entity.hooks?.beforeDelete as ActionDefinition["beforeExecute"],
    async execute(input, ctx) {
      const { id } = input as { id: string };
      const deleted = await ctx.db.delete(entity.name, id);
      if (deleted) {
        await ctx.emit({
          type: `${entityLower}.deleted`,
          payload: { id },
        });
      }
      return { success: deleted };
    },
  };

  return [createAction, findAllAction, findByIdAction, updateAction, deleteAction];
}
