/**
 * Project Entity
 *
 * Represents a body of work with a defined scope, timeline, and goal.
 * Projects group related Tasks together.
 */

import { defineEntity } from "@metasaas/contracts";

export const ProjectEntity = defineEntity({
  name: "Project",
  pluralName: "Projects",
  description:
    "A body of work with a defined scope, timeline, and goal. Groups related tasks together.",

  fields: [
    {
      name: "name",
      type: "text",
      required: true,
      description: "Project name or title",
    },
    {
      name: "description",
      type: "rich_text",
      required: false,
      description: "Detailed description of the project scope and goals",
    },
    {
      name: "status",
      type: "enum",
      required: true,
      options: ["planning", "active", "on_hold", "completed"],
      defaultValue: "planning",
      description: "Current phase of the project lifecycle",
    },
    {
      name: "priority",
      type: "enum",
      required: true,
      options: ["low", "medium", "high", "critical"],
      defaultValue: "medium",
      description: "How urgent or important this project is",
    },
    {
      name: "startDate",
      type: "date",
      required: false,
      description: "When work on this project begins",
    },
    {
      name: "dueDate",
      type: "date",
      required: false,
      description: "Target completion date for the project",
    },
  ],

  relationships: [
    {
      type: "hasMany",
      entity: "Task",
      foreignKey: "project_id",
    },
  ],

  workflows: [
    {
      name: "projectLifecycle",
      field: "status",
      transitions: [
        { from: "planning", to: "active" },
        { from: "active", to: "on_hold" },
        { from: "active", to: "completed" },
        { from: "on_hold", to: "active" },
        // completed is terminal — no outgoing transitions
      ],
    },
  ],

  ui: {
    icon: "folder-kanban",
    listColumns: ["name", "status", "priority", "dueDate"],
    searchFields: ["name", "description"],
    defaultSort: { field: "name", direction: "asc" },
  },
});
