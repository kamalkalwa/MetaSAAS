/**
 * Trainer Entity
 *
 * Represents a personal trainer.
 */

import { defineEntity } from "@metasaas/contracts";

export const TrainerEntity = defineEntity({
  name: "Trainer",
  pluralName: "Trainers",
  description:
    "Represents a personal trainer.",

  fields: [
    {
      name: "firstName",
      type: "text",
      required: true,
      description: "Trainer's first name.",
    },
    {
      name: "lastName",
      type: "text",
      required: true,
      description: "Trainer's last name.",
    },
    {
      name: "email",
      type: "email",
      required: true,
      description: "Trainer's email address.",
    },
    {
      name: "phone",
      type: "phone",
      required: false,
      description: "Trainer's phone number.",
    },
    {
      name: "specialization",
      type: "text",
      required: false,
      description: "Trainer's area of expertise.",
    },
  ],

  ui: {
    icon: "user",
    listColumns: ["firstName", "lastName", "email", "specialization"],
    searchFields: ["firstName", "lastName"],
    defaultSort: { field: "lastName", direction: "asc" },
    defaultView: "list",
  },
});
