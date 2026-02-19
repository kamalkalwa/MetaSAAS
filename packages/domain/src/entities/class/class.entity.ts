/**
 * Class Entity
 *
 * Represents a gym class.
 */

import { defineEntity } from "@metasaas/contracts";

export const ClassEntity = defineEntity({
  name: "Class",
  pluralName: "Classes",
  description:
    "Represents a gym class.",

  fields: [
    {
      name: "name",
      type: "text",
      required: true,
      description: "Name of the class.",
    },
    {
      name: "description",
      type: "rich_text",
      required: false,
      description: "Description of the class.",
    },
    {
      name: "startTime",
      type: "datetime",
      required: true,
      description: "Start time of the class.",
    },
    {
      name: "duration",
      type: "number",
      required: true,
      description: "Duration of the class in minutes.",
    },
    {
      name: "capacity",
      type: "number",
      required: true,
      description: "Maximum number of participants.",
    },
    {
      name: "trainer_id",
      type: "text",
      required: true,
      description: "Foreign key for Trainer",
    },
  ],

  relationships: [
    {
      type: "belongsTo",
      entity: "Trainer",
      foreignKey: "trainer_id",
    },
  ],

  ui: {
    icon: "calendar",
    listColumns: ["name", "startTime", "duration", "capacity"],
    searchFields: ["name"],
    defaultSort: { field: "startTime", direction: "asc" },
    defaultView: "calendar",
    calendar: { dateField: "startTime" },
  },
});
