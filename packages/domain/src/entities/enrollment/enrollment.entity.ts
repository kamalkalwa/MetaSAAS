/**
 * Enrollment Entity
 *
 * Represents a member's enrollment in a class.
 */

import { defineEntity } from "@metasaas/contracts";

export const EnrollmentEntity = defineEntity({
  name: "Enrollment",
  pluralName: "Enrollments",
  description:
    "Represents a member's enrollment in a class.",

  fields: [
    {
      name: "enrollmentDate",
      type: "datetime",
      required: true,
      description: "Date and time of enrollment.",
    },
    {
      name: "member_id",
      type: "text",
      required: true,
      description: "Foreign key for Member",
    },
    {
      name: "class_id",
      type: "text",
      required: true,
      description: "Foreign key for Class",
    },
  ],

  relationships: [
    {
      type: "belongsTo",
      entity: "Member",
      foreignKey: "member_id",
    },
    {
      type: "belongsTo",
      entity: "Class",
      foreignKey: "class_id",
    },
  ],

  ui: {
    icon: "listChecks",
    listColumns: ["enrollmentDate"],
    searchFields: [],
    defaultSort: { field: "enrollmentDate", direction: "desc" },
    defaultView: "list",
  },
});
