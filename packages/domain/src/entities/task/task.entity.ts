/**
 * Task Entity
 *
 * Represents a discrete unit of work within a Project.
 * Tracks individual deliverables and progress.
 */

import { defineEntity } from "@metasaas/contracts";

export const TaskEntity = defineEntity({
  name: "Task",
  pluralName: "Tasks",
  description:
    "A discrete unit of work within a project. Tracks deliverables and progress through a status workflow.",

  fields: [
    {
      name: "title",
      type: "text",
      required: true,
      description: "Short summary of what needs to be done",
    },
    {
      name: "description",
      type: "rich_text",
      required: false,
      description: "Detailed description, acceptance criteria, or notes",
    },
    {
      name: "status",
      type: "enum",
      required: true,
      options: ["todo", "in_progress", "review", "done"],
      defaultValue: "todo",
      description: "Current progress state of the task",
    },
    {
      name: "priority",
      type: "enum",
      required: true,
      options: ["low", "medium", "high"],
      defaultValue: "medium",
      description: "How urgent this task is relative to others",
    },
    {
      name: "dueDate",
      type: "date",
      required: false,
      description: "Target completion date for this task",
    },
    {
      name: "estimatedHours",
      type: "number",
      required: false,
      description: "Estimated effort in hours to complete this task",
    },
  ],

  relationships: [
    {
      type: "belongsTo",
      entity: "Project",
      foreignKey: "project_id",
    },
  ],

  workflows: [
    {
      name: "taskLifecycle",
      field: "status",
      transitions: [
        { from: "todo", to: "in_progress" },
        { from: "in_progress", to: "review" },
        { from: "in_progress", to: "todo" },   // return to backlog
        { from: "review", to: "done" },
        { from: "review", to: "in_progress" }, // rework
        // done is terminal — no outgoing transitions
      ],
    },
  ],

  ui: {
    icon: "check-square",
    listColumns: ["title", "status", "priority", "dueDate"],
    searchFields: ["title", "description"],
    defaultSort: { field: "title", direction: "asc" },
    defaultView: "kanban",
    kanban: { groupBy: "status" },
    calendar: { dateField: "dueDate" },
  },
});
