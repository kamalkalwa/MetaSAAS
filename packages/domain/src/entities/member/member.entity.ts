/**
 * Member Entity
 *
 * Represents a gym member.
 */

import { defineEntity } from "@metasaas/contracts";

export const MemberEntity = defineEntity({
  name: "Member",
  pluralName: "Members",
  description:
    "Represents a gym member.",

  fields: [
    {
      name: "firstName",
      type: "text",
      required: true,
      description: "Member's first name.",
    },
    {
      name: "lastName",
      type: "text",
      required: true,
      description: "Member's last name.",
    },
    {
      name: "email",
      type: "email",
      required: true,
      description: "Member's email address.",
    },
    {
      name: "phone",
      type: "phone",
      required: false,
      description: "Member's phone number.",
    },
    {
      name: "membershipType",
      type: "enum",
      required: true,
      options: ["Basic", "Premium", "VIP"],
      defaultValue: "Basic",
      description: "Type of membership the member has.",
    },
    {
      name: "status",
      type: "enum",
      required: true,
      options: ["Active", "Inactive", "Suspended"],
      defaultValue: "Active",
      description: "Status of the member's account.",
    },
    {
      name: "joinDate",
      type: "date",
      required: true,
      description: "Date when the member joined the gym.",
    },
  ],

  workflows: [
    {
      name: "memberLifecycle",
      field: "status",
      transitions: [
        { from: "Inactive", to: "Active" },
        { from: "Active", to: "Suspended" },
        { from: "Suspended", to: "Active" },
      ],
    },
  ],

  ui: {
    icon: "users",
    listColumns: ["firstName", "lastName", "email", "membershipType", "status"],
    searchFields: ["firstName", "lastName", "email"],
    defaultSort: { field: "lastName", direction: "asc" },
    defaultView: "list",
    kanban: { groupBy: "status" },
  },
});
