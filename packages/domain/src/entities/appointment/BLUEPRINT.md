# Appointment

## Purpose

An Appointment represents a scheduled medical consultation between a Doctor
and a Patient. Tracks the date/time, type of visit, and current booking status.

## Relationships

- An Appointment belongs to a Doctor
- An Appointment belongs to a Patient

## Edge Cases

- Status transitions: scheduled → confirmed → completed (or → cancelled at any point)
- An appointment marked as "no_show" means the patient didn't arrive
- Duration is optional; defaults vary by appointment type
- Notes may contain pre-visit patient concerns or post-visit summaries
