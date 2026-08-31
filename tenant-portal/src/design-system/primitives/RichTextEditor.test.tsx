// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RichTextEditor, type RichTextEditorProps } from "./RichTextEditor";
import { richTextIsEmpty, sanitizeRichText } from "./rich-text-sanitize";

afterEach(cleanup);

const labels: RichTextEditorProps["labels"] = {
  bold: "Bold",
  italic: "Italic",
  underline: "Underline",
  bulletList: "Bulleted list",
  orderedList: "Numbered list",
  link: "Insert link",
  unlink: "Remove link",
  clearFormatting: "Clear formatting",
  editor: "Sign-in message",
  linkUrl: "Link address",
  linkApply: "Apply",
};

describe("sanitizeRichText", () => {
  it("keeps the formatting tags the toolbar can produce", () => {
    const html = "<p>Hello <strong>world</strong> and <em>friends</em></p><ul><li>One</li></ul>";
    expect(sanitizeRichText(html)).toBe(html);
  });

  it("drops a script tag AND its contents — the text is the payload", () => {
    expect(sanitizeRichText("<p>Hi</p><script>alert(1)</script>")).toBe("<p>Hi</p>");
  });

  it("drops style, iframe and object entirely", () => {
    expect(sanitizeRichText("<style>body{display:none}</style><iframe src='x'></iframe><object></object>")).toBe("");
  });

  it("strips every attribute, including event handlers", () => {
    expect(sanitizeRichText('<p onclick="steal()" class="x" style="color:red">Hi</p>')).toBe("<p>Hi</p>");
  });

  it("refuses a javascript: href but keeps the words", () => {
    expect(sanitizeRichText('<a href="javascript:alert(1)">Click</a>')).toBe("Click");
  });

  it("refuses a data: href", () => {
    expect(sanitizeRichText('<a href="data:text/html,<script>alert(1)</script>">Click</a>')).toBe("Click");
  });

  it("keeps an http, mailto, tel or root-relative link and hardens its rel", () => {
    expect(sanitizeRichText('<a href="https://example.com">Site</a>')).toBe(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">Site</a>',
    );
    expect(sanitizeRichText('<a href="mailto:a@b.com">Mail</a>')).toContain('href="mailto:a@b.com"');
    expect(sanitizeRichText('<a href="/login">Sign in</a>')).toContain('href="/login"');
  });

  it("unwraps the div and font soup execCommand produces, keeping the text", () => {
    expect(sanitizeRichText('<div><font color="red">Kept</font></div>')).toBe("Kept");
  });

  it("survives a nested payload rather than half-cleaning it", () => {
    expect(sanitizeRichText('<p><span><a href="javascript:x"><script>y</script>Text</a></span></p>')).toBe(
      "<p>Text</p>",
    );
  });
});

describe("richTextIsEmpty", () => {
  it("treats an empty paragraph as empty, which a length check does not", () => {
    expect(richTextIsEmpty("<p><br></p>")).toBe(true);
    expect(richTextIsEmpty("   ")).toBe(true);
    expect(richTextIsEmpty("<p>Hello</p>")).toBe(false);
  });
});

describe("RichTextEditor", () => {
  function renderEditor(overrides: Partial<RichTextEditorProps> = {}) {
    const props: RichTextEditorProps = {
      value: "<p>Welcome</p>",
      onChange: vi.fn(),
      labels,
      ...overrides,
    };
    return { props, ...render(<RichTextEditor {...props} />) };
  }

  it("exposes a named multi-line textbox", () => {
    renderEditor();
    const editor = screen.getByRole("textbox", { name: "Sign-in message" });
    expect(editor).toHaveAttribute("aria-multiline", "true");
    expect(editor).toHaveAttribute("contenteditable", "true");
  });

  it("seeds the editor with the SANITIZED value, never the raw one", () => {
    renderEditor({ value: '<p onclick="x">Welcome</p><script>alert(1)</script>' });
    const editor = screen.getByRole("textbox", { name: "Sign-in message" });
    expect(editor.innerHTML).toBe("<p>Welcome</p>");
  });

  it("gives every toolbar control an accessible name", () => {
    renderEditor();
    for (const name of ["Bold", "Italic", "Underline", "Bulleted list", "Numbered list", "Insert link", "Remove link", "Clear formatting"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("exposes the toolbar as a toolbar", () => {
    renderEditor();
    expect(screen.getByRole("toolbar", { name: "Sign-in message" })).toBeInTheDocument();
  });

  it("stops editing while disabled", () => {
    renderEditor({ disabled: true });
    expect(screen.getByRole("textbox", { name: "Sign-in message" })).toHaveAttribute(
      "contenteditable",
      "false",
    );
    expect(screen.getByRole("button", { name: "Bold" })).toBeDisabled();
  });
});
