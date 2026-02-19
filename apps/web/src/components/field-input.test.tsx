/**
 * FieldInput Component — Test Suite
 *
 * Validates that the shared FieldInput component renders the correct
 * HTML input element for each field type, and that user interactions
 * (typing, selecting, checking) propagate correctly via onChange.
 *
 * This is a critical test because FieldInput is the ONLY place where
 * field types map to form inputs. If this is wrong, every form in the
 * app renders the wrong input.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FieldInput } from "./field-input";
import type { FieldDefinition } from "@metasaas/contracts";

/**
 * Factory: creates a minimal FieldDefinition for testing.
 */
function createField(overrides: Partial<FieldDefinition> = {}): FieldDefinition {
  return {
    name: "testField",
    type: "text",
    required: false,
    description: "A test field",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Field type → input type mapping
// ---------------------------------------------------------------------------

describe("FieldInput — input type rendering", () => {
  it("renders a text input for type 'text'", () => {
    const { container } = render(
      <FieldInput field={createField({ type: "text" })} value="" onChange={() => {}} />
    );
    const input = container.querySelector("input[type='text']");
    expect(input).toBeTruthy();
  });

  it("renders an email input for type 'email'", () => {
    const { container } = render(
      <FieldInput field={createField({ type: "email" })} value="" onChange={() => {}} />
    );
    const input = container.querySelector("input[type='email']");
    expect(input).toBeTruthy();
  });

  it("renders a URL input for type 'url'", () => {
    const { container } = render(
      <FieldInput field={createField({ type: "url" })} value="" onChange={() => {}} />
    );
    const input = container.querySelector("input[type='url']");
    expect(input).toBeTruthy();
  });

  it("renders a tel input for type 'phone'", () => {
    const { container } = render(
      <FieldInput field={createField({ type: "phone" })} value="" onChange={() => {}} />
    );
    const input = container.querySelector("input[type='tel']");
    expect(input).toBeTruthy();
  });

  it("renders a number input for type 'number'", () => {
    const { container } = render(
      <FieldInput field={createField({ type: "number" })} value="" onChange={() => {}} />
    );
    const input = container.querySelector("input[type='number']");
    expect(input).toBeTruthy();
  });

  it("renders a number input for type 'currency' with step=0.01", () => {
    const { container } = render(
      <FieldInput field={createField({ type: "currency" })} value="" onChange={() => {}} />
    );
    const input = container.querySelector("input[type='number']") as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.step).toBe("0.01");
  });

  it("renders a number input for type 'percentage' with step=any", () => {
    const { container } = render(
      <FieldInput field={createField({ type: "percentage" })} value="" onChange={() => {}} />
    );
    const input = container.querySelector("input[type='number']") as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.step).toBe("any");
  });

  it("renders a date input for type 'date'", () => {
    const { container } = render(
      <FieldInput field={createField({ type: "date" })} value="" onChange={() => {}} />
    );
    const input = container.querySelector("input[type='date']");
    expect(input).toBeTruthy();
  });

  it("renders a datetime-local input for type 'datetime'", () => {
    const { container } = render(
      <FieldInput field={createField({ type: "datetime" })} value="" onChange={() => {}} />
    );
    const input = container.querySelector("input[type='datetime-local']");
    expect(input).toBeTruthy();
  });

  it("renders a textarea for type 'rich_text'", () => {
    const { container } = render(
      <FieldInput field={createField({ type: "rich_text" })} value="" onChange={() => {}} />
    );
    const textarea = container.querySelector("textarea");
    expect(textarea).toBeTruthy();
  });

  it("renders a checkbox for type 'boolean'", () => {
    const { container } = render(
      <FieldInput field={createField({ type: "boolean" })} value="false" onChange={() => {}} />
    );
    const checkbox = container.querySelector("input[type='checkbox']");
    expect(checkbox).toBeTruthy();
  });

  it("renders a select for type 'enum' with options", () => {
    const field = createField({
      type: "enum",
      options: ["lead", "active", "inactive"],
    });
    const { container } = render(
      <FieldInput field={field} value="" onChange={() => {}} />
    );
    const select = container.querySelector("select");
    expect(select).toBeTruthy();

    // Should have the options plus the placeholder
    const options = container.querySelectorAll("option");
    expect(options.length).toBe(4); // "Select..." + 3 enum values
  });

  it("falls back to text input for unknown field types", () => {
    const { container } = render(
      <FieldInput
        field={createField({ type: "unknown_future_type" as any })}
        value=""
        onChange={() => {}}
      />
    );
    const input = container.querySelector("input[type='text']");
    expect(input).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// onChange propagation
// ---------------------------------------------------------------------------

describe("FieldInput — onChange", () => {
  it("calls onChange when text is typed", async () => {
    const handleChange = vi.fn();
    const { container } = render(
      <FieldInput field={createField({ type: "text" })} value="" onChange={handleChange} />
    );

    const input = container.querySelector("input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "hello" } });
    expect(handleChange).toHaveBeenCalledWith("hello");
  });

  it("calls onChange with 'true'/'false' for checkbox toggle", () => {
    const handleChange = vi.fn();
    const { container } = render(
      <FieldInput field={createField({ type: "boolean" })} value="false" onChange={handleChange} />
    );

    const checkbox = container.querySelector("input[type='checkbox']") as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(handleChange).toHaveBeenCalledWith("true");
  });

  it("calls onChange when an enum option is selected", () => {
    const handleChange = vi.fn();
    const field = createField({
      type: "enum",
      options: ["lead", "active"],
    });
    const { container } = render(
      <FieldInput field={field} value="" onChange={handleChange} />
    );

    const select = container.querySelector("select") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "active" } });
    expect(handleChange).toHaveBeenCalledWith("active");
  });

  it("calls onChange when textarea content changes", () => {
    const handleChange = vi.fn();
    const { container } = render(
      <FieldInput field={createField({ type: "rich_text" })} value="" onChange={handleChange} />
    );

    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "new content" } });
    expect(handleChange).toHaveBeenCalledWith("new content");
  });
});

// ---------------------------------------------------------------------------
// Value display
// ---------------------------------------------------------------------------

describe("FieldInput — value display", () => {
  it("displays the provided value in a text input", () => {
    const { container } = render(
      <FieldInput field={createField({ type: "text" })} value="existing value" onChange={() => {}} />
    );
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.value).toBe("existing value");
  });

  it("checks the checkbox when value is 'true'", () => {
    const { container } = render(
      <FieldInput field={createField({ type: "boolean" })} value="true" onChange={() => {}} />
    );
    const checkbox = container.querySelector("input[type='checkbox']") as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it("unchecks the checkbox when value is 'false'", () => {
    const { container } = render(
      <FieldInput field={createField({ type: "boolean" })} value="false" onChange={() => {}} />
    );
    const checkbox = container.querySelector("input[type='checkbox']") as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });

  it("selects the correct enum option", () => {
    const field = createField({
      type: "enum",
      options: ["lead", "active", "inactive"],
    });
    const { container } = render(
      <FieldInput field={field} value="active" onChange={() => {}} />
    );
    const select = container.querySelector("select") as HTMLSelectElement;
    expect(select.value).toBe("active");
  });
});

// ---------------------------------------------------------------------------
// Placeholder / description
// ---------------------------------------------------------------------------

describe("FieldInput — placeholder", () => {
  it("uses field.description as placeholder for text inputs", () => {
    const { container } = render(
      <FieldInput
        field={createField({ type: "text", description: "Enter your name" })}
        value=""
        onChange={() => {}}
      />
    );
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.placeholder).toBe("Enter your name");
  });

  it("uses field.description as placeholder for email inputs", () => {
    const { container } = render(
      <FieldInput
        field={createField({ type: "email", description: "Work email address" })}
        value=""
        onChange={() => {}}
      />
    );
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.placeholder).toBe("Work email address");
  });
});
