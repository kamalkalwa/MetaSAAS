/**
 * Pagination — Test Suite
 *
 * Validates:
 *   - buildPageNumbers produces correct page arrays with ellipsis
 *   - Pagination component renders/hides based on total vs pageSize
 *   - Previous/Next buttons enable/disable at boundaries
 *   - Clicking page numbers fires onPageChange
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Pagination, buildPageNumbers } from "@metasaas/ui";

// ---------------------------------------------------------------------------
// buildPageNumbers (pure logic)
// ---------------------------------------------------------------------------

describe("buildPageNumbers", () => {
  it("returns all pages when totalPages <= 7", () => {
    expect(buildPageNumbers(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(buildPageNumbers(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("shows ellipsis after first page when current > 3", () => {
    const pages = buildPageNumbers(5, 10);
    expect(pages[0]).toBe(1);
    expect(pages[1]).toBe("...");
    expect(pages).toContain(5);
    expect(pages[pages.length - 1]).toBe(10);
  });

  it("shows ellipsis before last page when current < totalPages - 2", () => {
    const pages = buildPageNumbers(3, 10);
    expect(pages[pages.length - 2]).toBe("...");
    expect(pages[pages.length - 1]).toBe(10);
  });

  it("shows both ellipses for middle pages", () => {
    const pages = buildPageNumbers(5, 10);
    const ellipses = pages.filter((p) => p === "...");
    expect(ellipses.length).toBe(2);
  });

  it("no leading ellipsis on first pages", () => {
    const pages = buildPageNumbers(1, 10);
    expect(pages[1]).not.toBe("...");
    expect(pages[0]).toBe(1);
  });

  it("no trailing ellipsis on last pages", () => {
    const pages = buildPageNumbers(10, 10);
    expect(pages[pages.length - 2]).not.toBe("...");
    expect(pages[pages.length - 1]).toBe(10);
  });

  it("always includes first and last page", () => {
    for (let current = 1; current <= 20; current++) {
      const pages = buildPageNumbers(current, 20);
      expect(pages[0]).toBe(1);
      expect(pages[pages.length - 1]).toBe(20);
    }
  });
});

// ---------------------------------------------------------------------------
// Pagination component
// ---------------------------------------------------------------------------

describe("Pagination", () => {
  it("returns null when total fits in one page", () => {
    const { container } = render(
      <Pagination page={1} pageSize={25} total={20} onPageChange={() => {}} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders when total exceeds pageSize", () => {
    render(
      <Pagination page={1} pageSize={25} total={100} onPageChange={() => {}} />
    );
    expect(screen.getByText(/Showing 1–25 of 100 records/)).toBeDefined();
  });

  it("displays correct range for middle page", () => {
    render(
      <Pagination page={3} pageSize={25} total={100} onPageChange={() => {}} />
    );
    expect(screen.getByText(/Showing 51–75 of 100 records/)).toBeDefined();
  });

  it("clamps end to total on last page", () => {
    render(
      <Pagination page={4} pageSize={25} total={90} onPageChange={() => {}} />
    );
    expect(screen.getByText(/Showing 76–90 of 90 records/)).toBeDefined();
  });

  it("Previous button is disabled on page 1", () => {
    render(
      <Pagination page={1} pageSize={25} total={100} onPageChange={() => {}} />
    );
    const prevBtn = screen.getByText("Previous");
    expect(prevBtn).toBeDefined();
    expect((prevBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("Next button is disabled on last page", () => {
    render(
      <Pagination page={4} pageSize={25} total={100} onPageChange={() => {}} />
    );
    const nextBtn = screen.getByText("Next");
    expect((nextBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("calls onPageChange when Next is clicked", () => {
    const onPageChange = vi.fn();
    render(
      <Pagination page={1} pageSize={25} total={100} onPageChange={onPageChange} />
    );
    fireEvent.click(screen.getByText("Next"));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("calls onPageChange when a page number is clicked", () => {
    const onPageChange = vi.fn();
    render(
      <Pagination page={1} pageSize={25} total={100} onPageChange={onPageChange} />
    );
    fireEvent.click(screen.getByText("3"));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });
});
