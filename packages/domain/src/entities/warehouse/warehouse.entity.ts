/**
 * Warehouse Entity
 *
 * A physical location where products are stored.
 * Tracks location details, capacity, and operational status.
 */

import { defineEntity } from "@metasaas/contracts";

export const WarehouseEntity = defineEntity({
  name: "Warehouse",
  pluralName: "Warehouses",
  description:
    "A physical storage location for inventory. Tracks address, capacity, and operational status.",

  fields: [
    {
      name: "name",
      type: "text",
      required: true,
      description: "Human-readable name for the warehouse (e.g., 'East Coast Hub')",
    },
    {
      name: "address",
      type: "text",
      required: true,
      description: "Full street address of the warehouse",
    },
    {
      name: "status",
      type: "enum",
      required: true,
      options: ["active", "maintenance", "closed"],
      defaultValue: "active",
      description: "Current operational status of the warehouse",
    },
    {
      name: "capacitySqm",
      type: "number",
      required: false,
      description: "Total storage capacity in square meters",
    },
    {
      name: "managerEmail",
      type: "email",
      required: false,
      description: "Email address of the warehouse manager",
    },
  ],

  ui: {
    icon: "package",
    listColumns: ["name", "status", "address", "capacitySqm"],
    searchFields: ["name", "address"],
    defaultSort: { field: "name", direction: "asc" },
  },
});
