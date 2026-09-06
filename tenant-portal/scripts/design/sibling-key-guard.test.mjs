import { describe, expect, it } from "vitest";
import { findSiblingKeyCollisions } from "./sibling-key-guard.mjs";

/** The guard reads text, so each case is the JSX it would have read. */
const page = (body) => `export default function Page() {\n  return (\n    <div>\n${body}\n    </div>\n  );\n}\n`;

describe("sibling key guard", () => {
  it("catches the dialog stack that shipped the warning", () => {
    // The leads page as it was: two dialogs, one parent, both "closed" while
    // nothing is open.
    const collisions = findSiblingKeyCollisions(
      page(`      <CreateLeadsModal key={isCreateOpen ? "open" : "closed"} />
      <LeadActivityDialog key={activityLead?.id ?? "closed"} />`),
    );

    expect(collisions).toHaveLength(1);
    expect(collisions[0].shared).toEqual(["closed"]);
    expect([collisions[0].left.tag, collisions[0].right.tag]).toEqual([
      "CreateLeadsModal",
      "LeadActivityDialog",
    ]);
  });

  it("passes the namespaced fix, template fallback included", () => {
    expect(
      findSiblingKeyCollisions(
        page(`      <CreateLeadsModal key={isCreateOpen ? "create-open" : "create-closed"} />
      <LeadActivityDialog key={\`activity-\${activityLead?.id ?? "closed"}\`} />`),
      ),
    ).toEqual([]);
  });

  it("evaluates a template rather than trusting its prefix", () => {
    // `activity-${x ?? "closed"}` and a literal "activity-closed" are the same
    // string. A prefix check would call this pair namespaced and miss it.
    const collisions = findSiblingKeyCollisions(
      page(`      <ActivityDialog key={\`activity-\${lead?.id ?? "closed"}\`} />
      <OtherDialog key="activity-closed" />`),
    );

    expect(collisions).toHaveLength(1);
    expect(collisions[0].shared).toEqual(["activity-closed"]);
  });

  it("catches a guarded child against a plain sibling", () => {
    expect(
      findSiblingKeyCollisions(
        page(`      {isOpen && <EditDrawer key="closed" />}
      <DeleteDialog key="closed" />`),
      ),
    ).toHaveLength(1);
  });

  it("does not fault a ternary's own branches", () => {
    // One child position renders one of them, never both.
    expect(
      findSiblingKeyCollisions(page(`      {isEditing ? <EditForm key="form" /> : <ReadOnly key="form" />}`)),
    ).toEqual([]);
  });

  it("stays quiet on keys it cannot evaluate", () => {
    // A guard that guessed here would fail every list in the tree.
    expect(
      findSiblingKeyCollisions(
        page(`      <FirstDialog key={someLead.id} />
      <SecondDialog key={otherLead.id} />`),
      ),
    ).toEqual([]);
  });

  it("reads siblings inside a fragment, and only real siblings", () => {
    const nested = findSiblingKeyCollisions(
      page(`      <>
        <One key="closed" />
        <section>
          <Two key="closed" />
        </section>
      </>`),
    );

    // `Two` is a child of <section>, not a sibling of `One`.
    expect(nested).toEqual([]);

    expect(
      findSiblingKeyCollisions(
        page(`      <>
        <One key="closed" />
        <Two key="closed" />
      </>`),
      ),
    ).toHaveLength(1);
  });
});
