/**
 * Patient Entity
 *
 * Represents an individual receiving medical care.
 * Tracks personal information, contact details, and registration status.
 */

import { defineEntity } from "@metasaas/contracts";

export const PatientEntity = defineEntity({
  name: "Patient",
  pluralName: "Patients",
  description:
    "An individual receiving medical care at the clinic. Tracks personal details, contact info, and registration status.",

  fields: [
    {
      name: "name",
      type: "text",
      required: true,
      description: "Full name of the patient",
    },
    {
      name: "email",
      type: "email",
      required: true,
      description: "Email address for appointment confirmations and reminders",
    },
    {
      name: "phone",
      type: "phone",
      required: true,
      description: "Primary phone number for contact",
    },
    {
      name: "dateOfBirth",
      type: "date",
      required: false,
      description: "Date of birth for medical records",
    },
    {
      name: "status",
      type: "enum",
      required: true,
      options: ["active", "inactive"],
      defaultValue: "active",
      description: "Whether the patient is currently active at the clinic",
    },
    {
      name: "emergencyContact",
      type: "phone",
      required: false,
      description: "Emergency contact phone number",
    },
    {
      name: "notes",
      type: "rich_text",
      required: false,
      description: "General notes about the patient (allergies, preferences, etc.)",
    },
  ],

  ui: {
    icon: "user",
    listColumns: ["name", "email", "phone", "status"],
    searchFields: ["name", "email"],
    defaultSort: { field: "name", direction: "asc" },
  },
});
