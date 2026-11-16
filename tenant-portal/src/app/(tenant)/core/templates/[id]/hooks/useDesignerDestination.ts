import { useState, type FormEvent } from "react";
import type { EditorDocument } from "../../template-editor-model";
import type { DesignerInteractionController } from "../../designer-interaction-controller";

export function useDesignerDestination(document: EditorDocument | null, controller: DesignerInteractionController, operation: "move" | "paste", done: () => void) {
  const destinations = document ? Object.values(document.nodes).filter(node => ["container", "row", "column", "group", "header", "footer"].includes(node.type) && !node.locked && !node.hidden) : [];
  const [rejected, setRejected] = useState(false);
  const [destination, setDestination] = useState(destinations[0]?.id ?? "");
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!destinations.some(node => node.id === destination)) return;
    const accepted = operation === "move" ? controller.moveTo(destination) : controller.paste(destination);
    setRejected(!accepted); if (accepted) done();
  };
  return { destinations, destination, setDestination, submit, rejected };
}
