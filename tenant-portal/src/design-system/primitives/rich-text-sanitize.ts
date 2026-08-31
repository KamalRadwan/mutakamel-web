/**
 * The allowlist sanitizer behind `RichTextEditor`.
 *
 * This matters more here than in most editors: `loginHtml` is tenant-authored
 * HTML that the **login page** renders, before any session exists. Anything
 * that survives this function runs on the most sensitive screen in the product.
 *
 * It is an allowlist, never a denylist — a denylist is a list of the attacks
 * someone thought of. Everything not named below is dropped, including every
 * attribute on every element except `href` on an anchor.
 *
 * This is a **defence in depth** measure, not the boundary. The backend
 * sanitizes what it stores and the renderer must still treat stored HTML as
 * untrusted; an editor cannot be the only thing standing between a tenant admin
 * and a script tag.
 */

const ALLOWED_TAGS = new Set([
  "P",
  "BR",
  "STRONG",
  "B",
  "EM",
  "I",
  "U",
  "S",
  "A",
  "UL",
  "OL",
  "LI",
  "H2",
  "H3",
  "H4",
  "BLOCKQUOTE",
]);

/**
 * Tags whose *content* is kept while the tag itself is unwrapped.
 *
 * `execCommand` emits `<div>`, `<span>` and `<font>` freely. Dropping them
 * outright would delete the user's text; unwrapping keeps the words and loses
 * only the markup.
 */
const UNWRAPPED_TAGS = new Set(["DIV", "SPAN", "FONT", "SECTION", "ARTICLE"]);

const SAFE_HREF = /^(?:https?:\/\/|mailto:|tel:|\/)/i;

function sanitizeNode(node: Node, document: Document): Node[] {
  if (node.nodeType === Node.TEXT_NODE) {
    return [document.createTextNode(node.textContent ?? "")];
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return [];

  const element = node as Element;
  const children = Array.from(element.childNodes).flatMap((child) => sanitizeNode(child, document));

  if (UNWRAPPED_TAGS.has(element.tagName)) return children;

  if (!ALLOWED_TAGS.has(element.tagName)) {
    // A <script>, <style>, <iframe> or <object> contributes nothing, not even
    // its text: its "text" is the payload.
    const CONTENT_IS_CODE = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "TEMPLATE"]);
    return CONTENT_IS_CODE.has(element.tagName) ? [] : children;
  }

  const clean = document.createElement(element.tagName.toLowerCase());

  if (clean.tagName === "A") {
    const href = element.getAttribute("href") ?? "";
    if (!SAFE_HREF.test(href.trim())) {
      // A javascript: or data: href is the whole attack. Keep the words, drop
      // the link — silently removing the text would look like data loss.
      return children;
    }
    clean.setAttribute("href", href.trim());
    clean.setAttribute("target", "_blank");
    // noopener is the security half; noreferrer keeps the tenant's URL out of
    // the destination's logs.
    clean.setAttribute("rel", "noopener noreferrer");
  }

  for (const child of children) clean.appendChild(child);
  return [clean];
}

/** Returns HTML containing only allowlisted tags, with every attribute dropped except a safe `href`. */
export function sanitizeRichText(html: string): string {
  const parsed = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const output = parsed.createElement("div");
  for (const child of Array.from(parsed.body.childNodes)) {
    for (const node of sanitizeNode(child, parsed)) output.appendChild(node);
  }
  return output.innerHTML;
}

/** Plain text of an HTML fragment — for a required-field check that `<p><br></p>` must fail. */
export function richTextIsEmpty(html: string): boolean {
  const parsed = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  return (parsed.body.textContent ?? "").trim().length === 0;
}
