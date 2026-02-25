/**
 * Shared UI Components — Test Suite
 *
 * Validates the extracted @metasaas/ui components:
 *   - SearchFilterBar renders search input + enum dropdowns
 *   - BulkActionsBar shows/hides based on selection count
 *   - DataTable renders rows with checkboxes and fires callbacks
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SearchFilterBar, BulkActionsBar, DataTable } from "@metasaas/ui";
import type { FieldDefinition } from "@metasaas/contracts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function textField(name = "name"): FieldDefinition {
  return { name, type: "text", required: true, description: "" };
}

function enumField(name = "status", options = ["draft", "active", "done"]): FieldDefinition {
  return { name, type: "enum", required: true, description: "", options };
}

// ---------------------------------------------------------------------------
// SearchFilterBar
// ---------------------------------------------------------------------------

describe("SearchFilterBar", () => {
  it("renders search input when searchFields are present", () => {
    render(
      <SearchFilterBar
        pluralName="Tasks"
        fields={[textField(), enumField()]}
        searchFields={["name"]}
        searchTerm=""
        onSearchChange={() => {}}
        activeFilters={{}}
        onFilterChange={() => {}}
      />
    );

    expect(screen.getByPlaceholderText("Search tasks...")).toBeDefined();
  });

  it("does not render search input when searchFields is empty", () => {
    render(
      <SearchFilterBar
        pluralName="Tasks"
        fields={[textField()]}
        searchFields={[]}
        searchTerm=""
        onSearchChange={() => {}}
        activeFilters={{}}
        onFilterChange={() => {}}
      />
    );

    expect(screen.queryByPlaceholderText("Search tasks...")).toBeNull();
  });

  it("renders dropdown for each enum field", () => {
    render(
      <SearchFilterBar
        pluralName="Tasks"
        fields={[textField(), enumField("status"), enumField("priority", ["low", "high"])]}
        searchFields={[]}
        searchTerm=""
        onSearchChange={() => {}}
        activeFilters={{}}
        onFilterChange={() => {}}
      />
    );

    const selects = screen.getAllByRole("combobox");
    expect(selects.length).toBe(2);
  });

  it("calls onSearchChange when typing in the search input", () => {
    const onSearchChange = vi.fn();
    render(
      <SearchFilterBar
        pluralName="Tasks"
        fields={[textField()]}
        searchFields={["name"]}
        searchTerm=""
        onSearchChange={onSearchChange}
        activeFilters={{}}
        onFilterChange={() => {}}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Search tasks..."), {
      target: { value: "hello" },
    });

    expect(onSearchChange).toHaveBeenCalledWith("hello");
  });

  it("shows 'Clear filters' button only when filters are active", () => {
    const { rerender } = render(
      <SearchFilterBar
        pluralName="Tasks"
        fields={[]}
        searchFields={[]}
        searchTerm=""
        onSearchChange={() => {}}
        activeFilters={{}}
        onFilterChange={() => {}}
      />
    );

    expect(screen.queryByText("Clear filters")).toBeNull();

    rerender(
      <SearchFilterBar
        pluralName="Tasks"
        fields={[]}
        searchFields={[]}
        searchTerm="hello"
        onSearchChange={() => {}}
        activeFilters={{}}
        onFilterChange={() => {}}
      />
    );

    expect(screen.getByText("Clear filters")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// BulkActionsBar
// ---------------------------------------------------------------------------

describe("BulkActionsBar", () => {
  it("renders nothing when selectedCount is 0", () => {
    const { container } = render(
      <BulkActionsBar
        selectedCount={0}
        fields={[enumField()]}
        onBulkStatusChange={() => {}}
        onBulkDelete={() => {}}
        onClearSelection={() => {}}
        busy={false}
      />
    );

    expect(container.innerHTML).toBe("");
  });

  it("renders selected count and action buttons when records are selected", () => {
    render(
      <BulkActionsBar
        selectedCount={5}
        fields={[enumField()]}
        onBulkStatusChange={() => {}}
        onBulkDelete={() => {}}
        onClearSelection={() => {}}
        busy={false}
      />
    );

    expect(screen.getByText("5 selected")).toBeDefined();
    expect(screen.getByText("Delete selected")).toBeDefined();
    expect(screen.getByText("Clear selection")).toBeDefined();
  });

  it("calls onBulkDelete when delete button is clicked", () => {
    const onBulkDelete = vi.fn();
    render(
      <BulkActionsBar
        selectedCount={3}
        fields={[]}
        onBulkStatusChange={() => {}}
        onBulkDelete={onBulkDelete}
        onClearSelection={() => {}}
        busy={false}
      />
    );

    fireEvent.click(screen.getByText("Delete selected"));
    expect(onBulkDelete).toHaveBeenCalledOnce();
  });

  it("shows busy label when busy", () => {
    render(
      <BulkActionsBar
        selectedCount={3}
        fields={[]}
        onBulkStatusChange={() => {}}
        onBulkDelete={() => {}}
        onClearSelection={() => {}}
        busy={true}
        busyLabel="deleting"
      />
    );

    expect(screen.getByText("deleting...")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// DataTable
// ---------------------------------------------------------------------------

describe("DataTable", () => {
  const rows = [
    { id: "1", name: "Alice", status: "active" },
    { id: "2", name: "Bob", status: "draft" },
  ];

  it("renders all rows", () => {
    render(
      <DataTable
        columns={["name", "status"]}
        rows={rows}
        selected={new Set()}
        onToggleSelect={() => {}}
        onToggleSelectAll={() => {}}
        onRowClick={() => {}}
        onDelete={() => {}}
      />
    );

    expect(screen.getByText("Alice")).toBeDefined();
    expect(screen.getByText("Bob")).toBeDefined();
  });

  it("renders column headers from field names", () => {
    render(
      <DataTable
        columns={["name", "status"]}
        rows={rows}
        selected={new Set()}
        onToggleSelect={() => {}}
        onToggleSelectAll={() => {}}
        onRowClick={() => {}}
        onDelete={() => {}}
      />
    );

    expect(screen.getByText("Name")).toBeDefined();
    expect(screen.getByText("Status")).toBeDefined();
  });

  it("calls onRowClick when a row is clicked", () => {
    const onRowClick = vi.fn();
    render(
      <DataTable
        columns={["name"]}
        rows={rows}
        selected={new Set()}
        onToggleSelect={() => {}}
        onToggleSelectAll={() => {}}
        onRowClick={onRowClick}
        onDelete={() => {}}
      />
    );

    fireEvent.click(screen.getByText("Alice"));
    expect(onRowClick).toHaveBeenCalledWith("1");
  });

  it("calls onDelete when delete button is clicked", () => {
    const onDelete = vi.fn();
    render(
      <DataTable
        columns={["name"]}
        rows={[{ id: "1", name: "Alice" }]}
        selected={new Set()}
        onToggleSelect={() => {}}
        onToggleSelectAll={() => {}}
        onRowClick={() => {}}
        onDelete={onDelete}
      />
    );

    fireEvent.click(screen.getByText("Delete"));
    expect(onDelete).toHaveBeenCalledWith("1");
  });

  it("checkboxes reflect selected state", () => {
    const { container } = render(
      <DataTable
        columns={["name"]}
        rows={rows}
        selected={new Set(["1"])}
        onToggleSelect={() => {}}
        onToggleSelectAll={() => {}}
        onRowClick={() => {}}
        onDelete={() => {}}
      />
    );

    const checkboxes = container.querySelectorAll<HTMLInputElement>("input[type='checkbox']");
    // First checkbox is the "select all" in the header
    // checkboxes[1] is row "1" (Alice), checkboxes[2] is row "2" (Bob)
    expect(checkboxes[1].checked).toBe(true);
    expect(checkboxes[2].checked).toBe(false);
  });
});
