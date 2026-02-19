/**
 * Contact Entity
 *
 * Represents a person the business has a relationship with.
 * This is the core entity of the CRM domain.
 */

import { defineEntity } from "@metasaas/contracts";

export const ContactEntity = defineEntity({
  name: "Contact",
  pluralName: "Contacts",
  description:
    "A person the business has a relationship with. The core entity of the CRM.",

  fields: [
    {
      name: "name",
      type: "text",
      required: true,
      description: "Full name of the contact",
    },
    {
      name: "email",
      type: "email",
      required: true,
      description: "Primary email address",
    },
    {
      name: "phone",
      type: "phone",
      required: false,
      description: "Phone number",
      sensitive: true,
    },
    {
      name: "role",
      type: "text",
      required: false,
      description: "Job title or role at their company",
    },
    {
      name: "status",
      type: "enum",
      required: true,
      options: ["lead", "active", "inactive"],
      defaultValue: "lead",
      description: "Current relationship status with this contact",
    },
    {
      name: "source",
      type: "enum",
      required: false,
      options: ["website", "referral", "conference", "cold_outreach", "other"],
      description: "How this contact was acquired",
    },
    {
      name: "notes",
      type: "rich_text",
      required: false,
      description: "Free-form notes about this contact",
    },
  ],

  relationships: [
    {
      type: "belongsTo",
      entity: "Company",
      foreignKey: "company_id",
    },
  ],

  ui: {
    icon: "users",
    listColumns: ["name", "email", "role", "status"],
    searchFields: ["name", "email", "role"],
    defaultSort: { field: "name", direction: "asc" },
  },
});
