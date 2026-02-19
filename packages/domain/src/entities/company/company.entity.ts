/**
 * Company Entity
 *
 * Represents an organization the business has a relationship with.
 * Companies group contacts — multiple people can work at the same company.
 */

import { defineEntity } from "@metasaas/contracts";

export const CompanyEntity = defineEntity({
  name: "Company",
  pluralName: "Companies",
  description:
    "An organization the business has a relationship with. Companies group related contacts together.",

  fields: [
    {
      name: "name",
      type: "text",
      required: true,
      description: "Official company name",
    },
    {
      name: "industry",
      type: "text",
      required: false,
      description: "Industry or sector (e.g., Technology, Healthcare, Finance)",
    },
    {
      name: "website",
      type: "url",
      required: false,
      description: "Company website URL",
    },
    {
      name: "size",
      type: "enum",
      required: false,
      options: ["1-10", "11-50", "51-200", "201-1000", "1000+"],
      description: "Approximate number of employees",
    },
    {
      name: "notes",
      type: "rich_text",
      required: false,
      description: "Free-form notes about this company",
    },
  ],

  relationships: [
    {
      type: "hasMany",
      entity: "Contact",
      foreignKey: "company_id",
    },
  ],

  ui: {
    icon: "building",
    listColumns: ["name", "industry", "size"],
    searchFields: ["name", "industry"],
    defaultSort: { field: "name", direction: "asc" },
  },
});
