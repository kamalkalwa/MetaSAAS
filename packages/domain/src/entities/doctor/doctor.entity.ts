/**
 * Doctor Entity
 *
 * Represents a medical professional at the clinic.
 * Tracks specialty, contact information, and availability status.
 */

import { defineEntity } from "@metasaas/contracts";

export const DoctorEntity = defineEntity({
  name: "Doctor",
  pluralName: "Doctors",
  description:
    "A medical professional who provides consultations. Tracks specialty, contact details, and availability.",

  fields: [
    {
      name: "name",
      type: "text",
      required: true,
      description: "Full name of the doctor (e.g., Dr. Sarah Chen)",
    },
    {
      name: "specialty",
      type: "enum",
      required: true,
      options: [
        "general_practice",
        "cardiology",
        "dermatology",
        "orthopedics",
        "pediatrics",
        "neurology",
      ],
      description: "Medical specialty or department",
    },
    {
      name: "email",
      type: "email",
      required: true,
      description: "Professional email for scheduling and notifications",
    },
    {
      name: "phone",
      type: "phone",
      required: true,
      description: "Direct phone number for urgent contact",
    },
    {
      name: "status",
      type: "enum",
      required: true,
      options: ["available", "unavailable", "on_leave"],
      defaultValue: "available",
      description: "Current availability status",
    },
    {
      name: "notes",
      type: "rich_text",
      required: false,
      description: "Internal notes about the doctor (schedule preferences, etc.)",
    },
  ],

  ui: {
    icon: "stethoscope",
    listColumns: ["name", "specialty", "status", "phone"],
    searchFields: ["name", "email"],
    defaultSort: { field: "name", direction: "asc" },
  },
});
