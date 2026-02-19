# Patient

## Purpose

A Patient represents an individual receiving medical care at the clinic.
Tracks personal information, contact details, and visit history through
linked Appointments.

## Relationships

- A Patient has many Appointments

## Edge Cases

- Date of birth is optional but recommended for medical records
- A patient may be inactive if they haven't visited in over a year
- Emergency contact phone is optional but strongly recommended
