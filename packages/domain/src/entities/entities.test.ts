/**
 * Domain Entities — Test Suite
 *
 * Validates that Company and Contact entity definitions are structurally
 * correct and follow the conventions defined in contracts.
 *
 * These tests catch misconfigured entities BEFORE they hit the database.
 * If an entity has a typo in a field name, a missing required flag,
 * or an invalid relationship, these tests fail.
 */

import { describe, it, expect } from "vitest";
import { CompanyEntity } from "./company/company.entity.js";
import { ContactEntity } from "./contact/contact.entity.js";
import { entities, seedData } from "../index.js";
import { FIELD_TYPES, type FieldType } from "@metasaas/contracts";

// ---------------------------------------------------------------------------
// Company Entity
// ---------------------------------------------------------------------------

describe("CompanyEntity", () => {
  it("has the correct name and plural", () => {
    expect(CompanyEntity.name).toBe("Company");
    expect(CompanyEntity.pluralName).toBe("Companies");
  });

  it("has a description", () => {
    expect(CompanyEntity.description.length).toBeGreaterThan(0);
  });

  it("has at least one required field", () => {
    const requiredFields = CompanyEntity.fields.filter((f) => f.required);
    expect(requiredFields.length).toBeGreaterThan(0);
  });

  it("has 'name' as a required text field", () => {
    const nameField = CompanyEntity.fields.find((f) => f.name === "name");
    expect(nameField).toBeDefined();
    expect(nameField!.type).toBe("text");
    expect(nameField!.required).toBe(true);
  });

  it("all fields use valid field types", () => {
    for (const field of CompanyEntity.fields) {
      expect(FIELD_TYPES).toContain(field.type as FieldType);
    }
  });

  it("has a valid UI config", () => {
    expect(CompanyEntity.ui.icon).toBeTruthy();
    expect(CompanyEntity.ui.listColumns.length).toBeGreaterThan(0);
    expect(CompanyEntity.ui.searchFields.length).toBeGreaterThan(0);
    expect(CompanyEntity.ui.defaultSort.field).toBeTruthy();
    expect(["asc", "desc"]).toContain(CompanyEntity.ui.defaultSort.direction);
  });

  it("listColumns reference existing field names", () => {
    const fieldNames = CompanyEntity.fields.map((f) => f.name);
    for (const col of CompanyEntity.ui.listColumns) {
      expect(fieldNames).toContain(col);
    }
  });

  it("searchFields reference existing field names", () => {
    const fieldNames = CompanyEntity.fields.map((f) => f.name);
    for (const col of CompanyEntity.ui.searchFields) {
      expect(fieldNames).toContain(col);
    }
  });

  it("has a hasMany relationship to Contact", () => {
    const contactRel = CompanyEntity.relationships?.find(
      (r) => r.entity === "Contact"
    );
    expect(contactRel).toBeDefined();
    expect(contactRel!.type).toBe("hasMany");
  });
});

// ---------------------------------------------------------------------------
// Contact Entity
// ---------------------------------------------------------------------------

describe("ContactEntity", () => {
  it("has the correct name and plural", () => {
    expect(ContactEntity.name).toBe("Contact");
    expect(ContactEntity.pluralName).toBe("Contacts");
  });

  it("has a description", () => {
    expect(ContactEntity.description.length).toBeGreaterThan(0);
  });

  it("has 'name' and 'email' as required fields", () => {
    const nameField = ContactEntity.fields.find((f) => f.name === "name");
    const emailField = ContactEntity.fields.find((f) => f.name === "email");

    expect(nameField).toBeDefined();
    expect(nameField!.required).toBe(true);

    expect(emailField).toBeDefined();
    expect(emailField!.required).toBe(true);
    expect(emailField!.type).toBe("email");
  });

  it("all fields use valid field types", () => {
    for (const field of ContactEntity.fields) {
      expect(FIELD_TYPES).toContain(field.type as FieldType);
    }
  });

  it("has a belongsTo relationship to Company", () => {
    const companyRel = ContactEntity.relationships?.find(
      (r) => r.entity === "Company"
    );
    expect(companyRel).toBeDefined();
    expect(companyRel!.type).toBe("belongsTo");
  });

  it("marks phone as sensitive", () => {
    const phoneField = ContactEntity.fields.find((f) => f.name === "phone");
    expect(phoneField).toBeDefined();
    expect(phoneField!.sensitive).toBe(true);
  });

  it("status field has valid enum options including the default value", () => {
    const statusField = ContactEntity.fields.find((f) => f.name === "status");
    expect(statusField).toBeDefined();
    expect(statusField!.type).toBe("enum");
    expect(statusField!.options).toContain("lead");
    expect(statusField!.options).toContain("active");
    expect(statusField!.options).toContain("inactive");
    expect(statusField!.options).toContain(statusField!.defaultValue as string);
  });

  it("has a valid UI config", () => {
    expect(ContactEntity.ui.icon).toBeTruthy();
    expect(ContactEntity.ui.listColumns.length).toBeGreaterThan(0);
    expect(ContactEntity.ui.searchFields.length).toBeGreaterThan(0);
  });

  it("listColumns reference existing field names", () => {
    const fieldNames = ContactEntity.fields.map((f) => f.name);
    for (const col of ContactEntity.ui.listColumns) {
      expect(fieldNames).toContain(col);
    }
  });
});

// ---------------------------------------------------------------------------
// Domain exports
// ---------------------------------------------------------------------------

describe("domain exports", () => {
  it("exports entities array in dependency order (parents before children)", () => {
    // Verify all entities are present (count updates as domain grows)
    expect(entities.length).toBeGreaterThanOrEqual(9);

    // Build a lookup: entity name → index in array
    const indexOf = (name: string) => entities.findIndex((e) => e.name === name);

    // Verify parent entities appear before their children.
    // Contact.belongsTo(Company) → Company must come first
    expect(indexOf("Company")).toBeLessThan(indexOf("Contact"));
    // Task.belongsTo(Project) → Project must come first
    expect(indexOf("Project")).toBeLessThan(indexOf("Task"));
    // Product.belongsTo(Warehouse) → Warehouse must come first
    expect(indexOf("Warehouse")).toBeLessThan(indexOf("Product"));
    // Appointment.belongsTo(Doctor) and Appointment.belongsTo(Patient)
    expect(indexOf("Doctor")).toBeLessThan(indexOf("Appointment"));
    expect(indexOf("Patient")).toBeLessThan(indexOf("Appointment"));
  });

  it("provides seed data for each entity", () => {
    for (const entity of entities) {
      expect(seedData[entity.name]).toBeDefined();
      expect(seedData[entity.name].length).toBeGreaterThan(0);
    }
  });

  it("seed data for Company includes required 'name' field", () => {
    for (const record of seedData.Company) {
      expect(record.name).toBeTruthy();
    }
  });

  it("seed data for Contact includes required 'name' and 'email' fields", () => {
    for (const record of seedData.Contact) {
      expect(record.name).toBeTruthy();
      expect(record.email).toBeTruthy();
    }
  });
});
