/**
 * Appointment Entity
 *
 * Represents a scheduled consultation between a Doctor and a Patient.
 * Tracks the date, type, status, and notes for the visit.
 */

import { defineEntity } from "@metasaas/contracts";

export const AppointmentEntity = defineEntity({
  name: "Appointment",
  pluralName: "Appointments",
  description:
    "A scheduled medical consultation between a doctor and a patient. Tracks date, type, status, and visit notes.",

  fields: [
    {
      name: "title",
      type: "text",
      required: true,
      description: "Short summary of the appointment (e.g., 'Annual checkup')",
    },
    {
      name: "dateTime",
      type: "datetime",
      required: true,
      description: "Scheduled date and time of the appointment",
    },
    {
      name: "type",
      type: "enum",
      required: true,
      options: ["consultation", "follow_up", "emergency", "routine_checkup"],
      defaultValue: "consultation",
      description: "Type of medical visit",
    },
    {
      name: "status",
      type: "enum",
      required: true,
      options: ["scheduled", "confirmed", "completed", "cancelled", "no_show"],
      defaultValue: "scheduled",
      description: "Current booking status of the appointment",
    },
    {
      name: "durationMinutes",
      type: "number",
      required: false,
      description: "Expected duration in minutes (varies by appointment type)",
    },
    {
      name: "notes",
      type: "rich_text",
      required: false,
      description: "Pre-visit concerns or post-visit summary notes",
    },
  ],

  relationships: [
    {
      type: "belongsTo",
      entity: "Doctor",
      foreignKey: "doctor_id",
    },
    {
      type: "belongsTo",
      entity: "Patient",
      foreignKey: "patient_id",
    },
  ],

  workflows: [
    {
      name: "appointmentLifecycle",
      field: "status",
      transitions: [
        { from: "scheduled", to: "confirmed" },
        { from: "scheduled", to: "cancelled" },
        { from: "confirmed", to: "completed" },
        { from: "confirmed", to: "cancelled" },
        { from: "confirmed", to: "no_show" },
        // completed and cancelled are terminal states
      ],
    },
  ],

  ui: {
    icon: "calendar-clock",
    listColumns: ["title", "dateTime", "type", "status"],
    searchFields: ["title", "notes"],
    defaultSort: { field: "dateTime", direction: "desc" },
    defaultView: "calendar",
    calendar: { dateField: "dateTime" },
  },
});
