# Warehouse

## Purpose

A Warehouse is a physical location where products are stored. Each warehouse
has a name, address, capacity, and operational status. Products belong to
warehouses, allowing inventory to be tracked per location.

## Context

- Warehouses are parent entities — Products reference them via belongsTo
- A warehouse can be active, under maintenance, or closed
- Capacity is tracked in square meters
