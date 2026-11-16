import { useState } from "react";
import type { EditorNode } from "../../template-editor-model";
import { openRichSession } from "../rich-text/rich-text-session";
import type { RichNative, RichSession } from "../rich-text/rich-text-contract";
import type { RichTextLease } from "../rich-text/rich-text-host-interlock";
import { useDesignerExtensionScope } from "../components/designer-extension-context";

export function useDesignerRichTextPort(node: EditorNode, native: RichNative, disabled: boolean) {
  const scope = useDesignerExtensionScope();
  const [editing, setEditing] = useState<{ session: RichSession; lease: RichTextLease } | null>(null);
  const [appearanceRequested, setAppearanceRequested] = useState(false);
  const bridge = scope.editor.richTextBridge;
  const onRichSession = scope.onRichSession;
  // Unexpected child unmount does not release the owner-held lease. Explicit
  // Apply/Discard, dialog discard, or editor-owner disposal performs release.
  const complete = () => {
    if (editing && scope.editor.localSessions.richText.getSnapshot().active && !editing.lease.matches(editing.session)) return;
    editing?.lease.release(); onRichSession(false); setEditing(null); setAppearanceRequested(false);
  };
  return { editing, bridge, appearanceRequested,
    requestAppearance: () => setAppearanceRequested(true), keepEditing: () => setAppearanceRequested(false),
    disabled: !scope.provider.isCurrent() || !bridge.canEdit(),
    startDisabled: disabled || !scope.provider.isCurrent() || !bridge.canEdit(),
    start() {
      if (disabled || !scope.provider.isCurrent()) return;
      const next = openRichSession(bridge, native, node.id);
      if (!next) return;
      const lease = scope.editor.localSessions.openRichText(next);
      if (!lease) return;
      onRichSession(true); setEditing({ session: next, lease });
    },
    complete,
  };
}
