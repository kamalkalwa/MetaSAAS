/**
 * Entity Generator
 *
 * Takes a natural language description of a business domain and returns
 * structured entity definitions that follow the MetaSAAS contracts.
 *
 * This is the "few prompts" capstone — the user describes what they want,
 * and the AI generates the entire domain model.
 *
 * Design:
 *   - Returns structured JSON, not raw TypeScript code
 *   - Each entity follows the EntityDefinition contract exactly
 *   - The output includes fields, relationships, workflows, and UI config
 *   - Fail-safe — returns empty array if AI fails
 */

import { getAIProvider } from "./gateway.js";
import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A generated field definition — matches the contracts FieldDefinition shape.
 */
interface GeneratedField {
  name: string;
  type: "text" | "email" | "phone" | "url" | "currency" | "date" | "datetime" | "number" | "percentage" | "enum" | "rich_text" | "boolean";
  required: boolean;
  description: string;
  options?: string[];
  defaultValue?: unknown;
}

/**
 * A generated relationship definition.
 */
interface GeneratedRelationship {
  type: "belongsTo";
  entity: string;
  foreignKey: string;
}

/**
 * A generated workflow transition.
 */
interface GeneratedWorkflow {
  name: string;
  field: string;
  transitions: { from: string; to: string }[];
}

/**
 * A single generated entity definition — the full shape the platform needs.
 */
export interface GeneratedEntity {
  name: string;
  pluralName: string;
  description: string;
  fields: GeneratedField[];
  relationships?: GeneratedRelationship[];
  workflows?: GeneratedWorkflow[];
  ui: {
    icon: string;
    listColumns: string[];
    searchFields: string[];
    defaultSort: { field: string; direction: "asc" | "desc" };
    defaultView?: "list" | "kanban" | "calendar";
    kanban?: { groupBy: string };
    calendar?: { dateField: string };
  };
}

/**
 * The result of a domain generation request.
 */
export interface GenerationResult {
  /** Whether the generation succeeded */
  success: boolean;
  /** The generated entity definitions */
  entities: GeneratedEntity[];
  /** Human-readable summary of what was generated */
  summary: string;
  /** Error message if generation failed */
  error?: string;
  /** Sample records keyed by entity name */
  seedData?: Record<string, Record<string, unknown>[]>;
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

/**
 * Builds the system prompt that teaches the AI how to generate entity
 * definitions. Includes the full contract shape, field types, and examples.
 */
function buildGenerationPrompt(): string {
  return [
    "You are a domain modeling expert for a SaaS application framework.",
    "The user will describe a business domain in natural language.",
    "Your job is to generate entity definitions that model that domain.",
    "",
    "Respond with ONLY valid JSON in this exact format:",
    "{",
    '  "entities": [',
    "    {",
    '      "name": "PascalCase singular name (e.g., Doctor, not Doctors)",',
    '      "pluralName": "Plural form (e.g., Doctors)",',
    '      "description": "One sentence explaining what this entity IS",',
    '      "fields": [',
    "        {",
    '          "name": "camelCase field name",',
    '          "type": "one of: text, email, phone, url, currency, date, datetime, number, percentage, enum, rich_text, boolean",',
    '          "required": true,',
    '          "description": "What this field stores",',
    '          "options": ["only for enum type — list valid values"],',
    '          "defaultValue": "optional — default for required fields"',
    "        }",
    "      ],",
    '      "relationships": [',
    '        { "type": "belongsTo", "entity": "ParentEntity", "foreignKey": "parent_entity_id" }',
    "      ],",
    '      "workflows": [',
    "        {",
    '          "name": "lifecycleName",',
    '          "field": "status",',
    '          "transitions": [{ "from": "draft", "to": "active" }]',
    "        }",
    "      ],",
    '      "ui": {',
    '        "icon": "lucide icon name",',
    '        "listColumns": ["field1", "field2", "field3"],',
    '        "searchFields": ["field1"],',
    '        "defaultSort": { "field": "name", "direction": "asc" },',
    '        "defaultView": "list or kanban or calendar",',
    '        "kanban": { "groupBy": "status" },',
    '        "calendar": { "dateField": "dateField" }',
    "      }",
    "    }",
    "  ],",
    '  "summary": "Brief description of what was generated",',
    '  "seedData": {',
    '    "EntityName": [',
    '      { "fieldName": "realistic sample value", "otherField": "value" }',
    "    ]",
    "  }",
    "}",
    "",
    "RULES:",
    "- Generate 2-5 entities that model the described domain",
    "- Entity names: PascalCase singular (Invoice, not Invoices)",
    "- Field names: camelCase (firstName, not first_name)",
    "- Every entity MUST have a primary text field (name or title)",
    "- Use enum fields with options for statuses, categories, types",
    "- Required enum fields with sensible defaults should set defaultValue",
    "- Add relationships where entities are naturally connected (belongsTo)",
    "- Parent entities MUST appear before children in the array",
    "- Add workflows for status fields with logical transitions",
    "- Use kanban view for entities with status workflows",
    "- Use calendar view for entities with date/datetime fields",
    "- listColumns: pick 3-5 most useful fields",
    "- searchFields: pick 1-2 text fields users would search by",
    "- Use realistic icon names from Lucide (e.g., users, building, calendar, package)",
    "- Foreign keys: snake_case with _id suffix (e.g., doctor_id)",
    "- Every field MUST have a clear description",
    "- Keep the domain model practical — avoid over-engineering",
    "- seedData: provide 3-5 realistic sample records per entity",
    "- seedData records should only include domain fields (not id, tenantId, createdAt, updatedAt)",
    "- For entities with relationships, omit foreign key values in seed data (they are linked at runtime)",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generates entity definitions from a natural language domain description.
 *
 * @param description - Natural language description of the business domain
 * @returns GenerationResult with entity definitions or error
 */
export async function generateEntities(
  description: string
): Promise<GenerationResult> {
  const provider = getAIProvider();

  // Guard: AI must be configured
  if (provider.name === "null") {
    return {
      success: false,
      entities: [],
      summary: "",
      error: "AI is not configured. Set an AI provider API key to generate entities.",
    };
  }

  // Guard: reject empty input
  const trimmed = description.trim();
  if (!trimmed) {
    return {
      success: false,
      entities: [],
      summary: "",
      error: "Please describe the business domain you want to model.",
    };
  }

  try {
    const systemPrompt = buildGenerationPrompt();

    const raw = await provider.complete(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: trimmed },
      ],
      {
        responseFormat: "json",
        temperature: 0.2,
        maxTokens: 4000,
      }
    );

    // Parse the AI response
    let parsed: {
      entities: GeneratedEntity[];
      summary: string;
      seedData?: Record<string, Record<string, unknown>[]>;
    };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {
        success: false,
        entities: [],
        summary: "",
        error: "Failed to parse AI response. Please try rephrasing your description.",
      };
    }

    // Validate the shape
    if (!Array.isArray(parsed.entities) || parsed.entities.length === 0) {
      return {
        success: false,
        entities: [],
        summary: "",
        error: "AI returned no entities. Please provide more detail about your domain.",
      };
    }

    return {
      success: true,
      entities: parsed.entities,
      summary: parsed.summary || `Generated ${parsed.entities.length} entities.`,
      seedData: parsed.seedData,
    };
  } catch (error) {
    return {
      success: false,
      entities: [],
      summary: "",
      error:
        error instanceof Error
          ? error.message
          : "An unexpected error occurred during entity generation.",
    };
  }
}

/**
 * Converts a GeneratedEntity into TypeScript source code for a .entity.ts file.
 * This produces the exact pattern documented in the entities BLUEPRINT.md.
 */
export function entityToTypeScript(entity: GeneratedEntity): string {
  const lines: string[] = [];

  lines.push("/**");
  lines.push(` * ${entity.name} Entity`);
  lines.push(" *");
  lines.push(` * ${entity.description}`);
  lines.push(" */");
  lines.push("");
  lines.push('import { defineEntity } from "@metasaas/contracts";');
  lines.push("");
  lines.push(`export const ${entity.name}Entity = defineEntity({`);
  lines.push(`  name: "${entity.name}",`);
  lines.push(`  pluralName: "${entity.pluralName}",`);
  lines.push(`  description:`);
  lines.push(`    "${entity.description}",`);
  lines.push("");
  lines.push("  fields: [");

  for (const field of entity.fields) {
    const parts: string[] = [];
    parts.push(`    {`);
    parts.push(`      name: "${field.name}",`);
    parts.push(`      type: "${field.type}",`);
    parts.push(`      required: ${field.required},`);
    if (field.options?.length) {
      parts.push(`      options: [${field.options.map((o) => `"${o}"`).join(", ")}],`);
    }
    if (field.defaultValue !== undefined) {
      parts.push(`      defaultValue: ${JSON.stringify(field.defaultValue)},`);
    }
    parts.push(`      description: "${field.description}",`);
    parts.push(`    },`);
    lines.push(parts.join("\n"));
  }

  lines.push("  ],");

  if (entity.relationships?.length) {
    lines.push("");
    lines.push("  relationships: [");
    for (const rel of entity.relationships) {
      lines.push(`    {`);
      lines.push(`      type: "${rel.type}",`);
      lines.push(`      entity: "${rel.entity}",`);
      lines.push(`      foreignKey: "${rel.foreignKey}",`);
      lines.push(`    },`);
    }
    lines.push("  ],");
  }

  if (entity.workflows?.length) {
    lines.push("");
    lines.push("  workflows: [");
    for (const wf of entity.workflows) {
      lines.push(`    {`);
      lines.push(`      name: "${wf.name}",`);
      lines.push(`      field: "${wf.field}",`);
      lines.push(`      transitions: [`);
      for (const t of wf.transitions) {
        lines.push(`        { from: "${t.from}", to: "${t.to}" },`);
      }
      lines.push(`      ],`);
      lines.push(`    },`);
    }
    lines.push("  ],");
  }

  lines.push("");
  lines.push("  ui: {");
  lines.push(`    icon: "${entity.ui.icon}",`);
  lines.push(`    listColumns: [${entity.ui.listColumns.map((c) => `"${c}"`).join(", ")}],`);
  lines.push(`    searchFields: [${entity.ui.searchFields.map((s) => `"${s}"`).join(", ")}],`);
  lines.push(`    defaultSort: { field: "${entity.ui.defaultSort.field}", direction: "${entity.ui.defaultSort.direction}" },`);

  if (entity.ui.defaultView) {
    lines.push(`    defaultView: "${entity.ui.defaultView}",`);
  }
  if (entity.ui.kanban) {
    lines.push(`    kanban: { groupBy: "${entity.ui.kanban.groupBy}" },`);
  }
  if (entity.ui.calendar) {
    lines.push(`    calendar: { dateField: "${entity.ui.calendar.dateField}" },`);
  }

  lines.push("  },");
  lines.push("});");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Disk writer
// ---------------------------------------------------------------------------

/**
 * Result of writing entities to disk.
 */
export interface WriteResult {
  /** Whether all files were written successfully */
  success: boolean;
  /** Files that were created */
  filesCreated: string[];
  /** Error message if something failed */
  error?: string;
  /** Whether the domain index was updated */
  indexUpdated: boolean;
}

/**
 * Generates a BLUEPRINT.md for a generated entity.
 */
function entityToBlueprint(entity: GeneratedEntity): string {
  const lines: string[] = [];
  lines.push(`# ${entity.name}`);
  lines.push("");
  lines.push("## Purpose");
  lines.push("");
  lines.push(entity.description);
  lines.push("");

  if (entity.relationships?.length) {
    lines.push("## Relationships");
    lines.push("");
    for (const rel of entity.relationships) {
      lines.push(`- ${entity.name} ${rel.type} ${rel.entity}`);
    }
    lines.push("");
  }

  if (entity.workflows?.length) {
    lines.push("## Workflows");
    lines.push("");
    for (const wf of entity.workflows) {
      const states = [...new Set(wf.transitions.flatMap((t) => [t.from, t.to]))];
      lines.push(`- ${wf.name}: ${states.join(" → ")}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Writes generated entities to the domain package on disk.
 *
 * Creates directories, .entity.ts files, and BLUEPRINT.md files.
 * Updates the domain index.ts to import and export the new entities.
 *
 * @param entities - The generated entity definitions
 * @param domainRoot - Absolute path to packages/domain/src/entities/
 * @param indexPath - Absolute path to packages/domain/src/index.ts
 * @returns WriteResult describing what was created
 */
export function writeEntitiesToDisk(
  entities: GeneratedEntity[],
  domainRoot: string,
  indexPath: string,
  seedData?: Record<string, Record<string, unknown>[]>
): WriteResult {
  const filesCreated: string[] = [];

  try {
    // 1. Write entity files
    for (const entity of entities) {
      const dirName = entity.name.toLowerCase();
      const entityDir = join(domainRoot, dirName);

      // Create directory if it doesn't exist
      if (!existsSync(entityDir)) {
        mkdirSync(entityDir, { recursive: true });
      }

      // Write .entity.ts
      const entityFile = join(entityDir, `${dirName}.entity.ts`);
      writeFileSync(entityFile, entityToTypeScript(entity) + "\n", "utf-8");
      filesCreated.push(entityFile);

      // Write BLUEPRINT.md
      const blueprintFile = join(entityDir, "BLUEPRINT.md");
      writeFileSync(blueprintFile, entityToBlueprint(entity), "utf-8");
      filesCreated.push(blueprintFile);
    }

    // 2. Update domain index.ts
    let indexUpdated = false;
    if (existsSync(indexPath)) {
      let indexContent = readFileSync(indexPath, "utf-8");
      let modified = false;

      for (const entity of entities) {
        const dirName = entity.name.toLowerCase();
        const importLine = `import { ${entity.name}Entity } from "./entities/${dirName}/${dirName}.entity.js";`;
        const navEntry = `  { label: "${entity.pluralName}", href: "/${entity.pluralName.toLowerCase()}", icon: "${entity.ui.icon}", order: 99 },`;

        // Add import if not already present
        if (!indexContent.includes(`${entity.name}Entity`)) {
          // Insert import after the last existing entity import
          const lastImportIdx = indexContent.lastIndexOf('from "./entities/');
          if (lastImportIdx !== -1) {
            const lineEnd = indexContent.indexOf("\n", lastImportIdx);
            indexContent =
              indexContent.slice(0, lineEnd + 1) +
              importLine +
              "\n" +
              indexContent.slice(lineEnd + 1);
            modified = true;
          }

          // Add to entities array
          const entitiesArrayEnd = indexContent.indexOf("];", indexContent.indexOf("export const entities"));
          if (entitiesArrayEnd !== -1) {
            indexContent =
              indexContent.slice(0, entitiesArrayEnd) +
              `  ${entity.name}Entity,\n` +
              indexContent.slice(entitiesArrayEnd);
            modified = true;
          }

          // Add navigation entry
          const navArrayEnd = indexContent.indexOf("];", indexContent.indexOf("export const navigation"));
          if (navArrayEnd !== -1) {
            indexContent =
              indexContent.slice(0, navArrayEnd) +
              navEntry +
              "\n" +
              indexContent.slice(navArrayEnd);
            modified = true;
          }

          // Add seed data if available
          if (seedData?.[entity.name]?.length) {
            const seedJson = JSON.stringify(seedData[entity.name], null, 4)
              .split("\n")
              .map((line, i) => (i === 0 ? line : `  ${line}`))
              .join("\n");

            const seedClosing = "};";
            const seedClosingIdx = indexContent.lastIndexOf(seedClosing);
            if (seedClosingIdx !== -1) {
              const seedEntry = `  ${entity.name}: ${seedJson},\n`;
              indexContent =
                indexContent.slice(0, seedClosingIdx) +
                seedEntry +
                indexContent.slice(seedClosingIdx);
              modified = true;
            }
          }
        }
      }

      if (modified) {
        writeFileSync(indexPath, indexContent, "utf-8");
        indexUpdated = true;
      }
    }

    return {
      success: true,
      filesCreated,
      indexUpdated,
    };
  } catch (error) {
    return {
      success: false,
      filesCreated,
      indexUpdated: false,
      error: error instanceof Error ? error.message : "Failed to write entity files.",
    };
  }
}

// ---------------------------------------------------------------------------
// Entity Evolution (modify existing entities via AI)
// ---------------------------------------------------------------------------

export interface EvolutionResult {
  success: boolean;
  entityName: string;
  changes: string;
  error?: string;
}

/**
 * Builds the system prompt for entity modification.
 * Teaches the AI how to modify an existing entity definition.
 */
function buildEvolutionPrompt(): string {
  return [
    "You are a domain modeling expert modifying an existing entity definition.",
    "The user will describe changes they want to make to an entity.",
    "You will receive the current entity definition as JSON.",
    "",
    "Respond with ONLY valid JSON containing the COMPLETE modified entity in the same format.",
    "The response must include ALL fields (not just the changed ones) because the entire file will be rewritten.",
    "",
    "RULES:",
    "- Preserve all existing fields unless the user explicitly asks to remove them",
    "- When adding a field, choose the most appropriate type from: text, email, phone, url, currency, date, datetime, number, percentage, enum, rich_text, boolean",
    "- When adding an enum field, include the options array",
    "- When modifying workflow transitions, ensure all states are reachable",
    "- Update listColumns and searchFields if the changes warrant it",
    "- Return the COMPLETE entity definition, not just the changes",
    "- Include a 'changes' field with a human-readable summary of what was modified",
    "",
    "Response format:",
    "{",
    '  "entity": { ... complete entity definition ... },',
    '  "changes": "Added dueDate field, updated listColumns to include dueDate"',
    "}",
  ].join("\n");
}

/**
 * Reads an existing entity definition file from disk and parses it
 * into a GeneratedEntity shape by evaluating the AI-readable JSON format.
 */
export function readEntityFromDisk(
  entityName: string,
  domainRoot: string
): { source: string; path: string } | null {
  const dirName = entityName.toLowerCase();
  const entityDir = join(domainRoot, dirName);
  const entityFile = join(entityDir, `${dirName}.entity.ts`);

  if (!existsSync(entityFile)) return null;
  return {
    source: readFileSync(entityFile, "utf-8"),
    path: entityFile,
  };
}

/**
 * Lists all entity directories in the domain root.
 */
export function listEntityNames(domainRoot: string): string[] {
  if (!existsSync(domainRoot)) return [];
  return readdirSync(domainRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

/**
 * Evolves an existing entity based on a natural language modification request.
 * Reads the current entity file, sends it to AI with the change request,
 * and writes the modified entity back to disk.
 */
export async function evolveEntity(
  entityName: string,
  modification: string,
  domainRoot: string
): Promise<EvolutionResult> {
  const provider = getAIProvider();

  if (provider.name === "null") {
    return {
      success: false,
      entityName,
      changes: "",
      error: "AI is not configured. Set an AI provider API key.",
    };
  }

  // Read the existing entity file
  const existing = readEntityFromDisk(entityName, domainRoot);
  if (!existing) {
    return {
      success: false,
      entityName,
      changes: "",
      error: `Entity "${entityName}" not found in ${domainRoot}. Available: ${listEntityNames(domainRoot).join(", ")}`,
    };
  }

  try {
    const systemPrompt = buildEvolutionPrompt();

    const raw = await provider.complete(
      [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            `Current entity file for ${entityName}:`,
            "```typescript",
            existing.source,
            "```",
            "",
            `Requested change: ${modification}`,
          ].join("\n"),
        },
      ],
      {
        responseFormat: "json",
        temperature: 0.1,
        maxTokens: 4000,
      }
    );

    let parsed: { entity: GeneratedEntity; changes: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {
        success: false,
        entityName,
        changes: "",
        error: "Failed to parse AI response for entity modification.",
      };
    }

    if (!parsed.entity?.name || !parsed.entity?.fields?.length) {
      return {
        success: false,
        entityName,
        changes: "",
        error: "AI returned an invalid entity definition.",
      };
    }

    // Write the modified entity back to disk
    const newSource = entityToTypeScript(parsed.entity) + "\n";
    writeFileSync(existing.path, newSource, "utf-8");

    return {
      success: true,
      entityName: parsed.entity.name,
      changes: parsed.changes || "Entity modified successfully.",
    };
  } catch (error) {
    return {
      success: false,
      entityName,
      changes: "",
      error: error instanceof Error ? error.message : "Failed to evolve entity.",
    };
  }
}
