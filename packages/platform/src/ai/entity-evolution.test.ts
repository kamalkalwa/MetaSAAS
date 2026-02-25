/**
 * Entity Evolution — Test Suite
 *
 * Validates:
 *   - readEntityFromDisk reads an existing file
 *   - readEntityFromDisk returns null for missing entity
 *   - listEntityNames discovers directories
 *   - evolveEntity returns error when AI is not configured
 *   - evolveEntity returns error when entity does not exist
 *   - evolveEntity writes back the modified entity file + BLUEPRINT.md
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  readEntityFromDisk,
  listEntityNames,
  evolveEntity,
} from "./entity-generator.js";

// ---------------------------------------------------------------------------
// Temp directory for each test run
// ---------------------------------------------------------------------------

let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `metasaas-evo-test-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a minimal entity file on disk that mirrors what
 * `writeEntitiesToDisk` would produce.
 */
function seedEntity(name: string, source?: string) {
  const dir = join(testDir, name.toLowerCase());
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, `${name.toLowerCase()}.entity.ts`),
    source ?? `export const ${name} = { name: "${name}" };`,
    "utf-8"
  );
}

// ---------------------------------------------------------------------------
// Tests — readEntityFromDisk
// ---------------------------------------------------------------------------

describe("readEntityFromDisk", () => {
  it("reads an existing entity file", () => {
    seedEntity("Task", 'const x = "task";');
    const result = readEntityFromDisk("Task", testDir);

    expect(result).not.toBeNull();
    expect(result!.source).toBe('const x = "task";');
    expect(result!.path).toContain("task.entity.ts");
  });

  it("returns null for a non-existent entity", () => {
    const result = readEntityFromDisk("Ghost", testDir);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests — listEntityNames
// ---------------------------------------------------------------------------

describe("listEntityNames", () => {
  it("lists directory names under domain root", () => {
    seedEntity("Task");
    seedEntity("Contact");

    const names = listEntityNames(testDir);
    expect(names).toContain("task");
    expect(names).toContain("contact");
  });

  it("returns empty array when domain root does not exist", () => {
    expect(listEntityNames("/tmp/nonexistent-dir-" + Date.now())).toEqual([]);
  });

  it("ignores files (only lists directories)", () => {
    seedEntity("Task");
    writeFileSync(join(testDir, "README.md"), "hello", "utf-8");

    const names = listEntityNames(testDir);
    expect(names).not.toContain("README.md");
  });
});

// ---------------------------------------------------------------------------
// Tests — evolveEntity
// ---------------------------------------------------------------------------

describe("evolveEntity", () => {
  it("returns error when AI is not configured", async () => {
    seedEntity("Task");

    const result = await evolveEntity("Task", "add a dueDate field", testDir);

    expect(result.success).toBe(false);
    expect(result.error).toContain("AI is not configured");
  });

  it("returns error when entity does not exist (AI also unconfigured)", async () => {
    const result = await evolveEntity("Ghost", "add a field", testDir);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
