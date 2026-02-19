# Doctor

## Purpose

A Doctor represents a medical professional who provides consultations at the
clinic. Tracks their specialty, availability, and contact information.

## Relationships

- A Doctor has many Appointments

## Edge Cases

- A doctor may be on leave (status: "unavailable")
- Multiple doctors may share the same specialty
- Phone and email are required for scheduling notifications
