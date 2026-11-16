import type { DesignerInteractionExit, DesignerInteractionTicket } from "../../designer-interaction-exit";
import type { TemplateInspectorDialogLifecycle } from "./useTemplateInspectorDialog";

/** Consume T01's actual aggregate port; never substitute model-only cancellation. */
export function bindTemplateInspectorInteractionExit(lifecycle: TemplateInspectorDialogLifecycle, exit: DesignerInteractionExit, current: () => boolean): TemplateInspectorDialogLifecycle {
  const expected: DesignerInteractionTicket = { bridgeKey: exit.ticket.bridgeKey, generation: exit.ticket.generation };
  return {
    ...lifecycle,
    onBeforeClose: () => current() && exit.cancelAllCurrent(expected) && current(),
    onEscapeKeyDown: event => {
      if (event.defaultPrevented) return;
      if (!current()) { event.preventDefault(); return; }
      if (!exit.hasActive()) return;
      event.preventDefault();
      event.stopPropagation();
      // Missing/unavailable participants keep the aggregate refusal intact.
      exit.cancelAllCurrent(expected);
    },
  };
}
