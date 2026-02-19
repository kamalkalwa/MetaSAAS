# Product

## Purpose

A Product is a physical item managed in inventory. Each product has a name,
SKU, category, price, quantity on hand, and a lifecycle status. Products
belong to a Warehouse where they are physically stored.

## Context

- Products have a lifecycle: draft → active → discontinued
- Products belong to exactly one Warehouse (belongsTo)
- SKU (Stock Keeping Unit) is a unique identifier for inventory tracking
- Quantity and reorder level help determine when to restock
- The kanban view groups products by lifecycle status
