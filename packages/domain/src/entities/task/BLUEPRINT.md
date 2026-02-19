# Task

## Purpose

A Task represents a discrete unit of work within a Project. Tasks track
individual deliverables, assignments, and progress through a status workflow.

## Relationships

- A Task belongs to a Project
- A Task cannot exist without a parent Project (in future: enforce on create)

## Edge Cases

- Status transitions: todo → in_progress → review → done
  - Can go back from review to in_progress (rework)
  - done is terminal
- Estimated hours can be zero (trivial tasks) or null (not estimated)
- Due date is optional but recommended
- Priority defaults to medium
