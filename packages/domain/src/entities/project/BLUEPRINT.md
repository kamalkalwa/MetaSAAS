# Project

## Purpose

A Project represents a body of work with a defined scope, timeline, and goal.
Projects group related Tasks together and track overall progress through
status and priority.

## Relationships

- A Project has many Tasks
- Deleting a Project should cascade or warn about orphaned Tasks

## Edge Cases

- A Project can exist with zero Tasks (planning phase)
- Status transitions: planning → active → on_hold or completed
  - on_hold can return to active
  - completed is terminal
- Start date should be before or equal to due date
- Priority drives ordering in list views
