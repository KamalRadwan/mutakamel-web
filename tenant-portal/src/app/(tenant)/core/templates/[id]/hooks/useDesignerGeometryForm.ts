import { useState, type ChangeEvent, type FormEvent } from "react";
import type { Frame } from "../../designer-interaction-contract";
import type { DesignerInteractionController } from "../../designer-interaction-controller";

export function useDesignerGeometryForm(initial: Frame, controller: DesignerInteractionController, applied: () => void) {
  const [values, setValues] = useState(() => ({ x: String(initial.x), y: String(initial.y), width: String(initial.width), height: String(initial.height), rotationDeg: String(initial.rotationDeg) }));
  const [aspect, setAspect] = useState(true);
  const [dimension, setDimension] = useState<"width" | "height" | null>(null);
  const change = (key: keyof typeof values) => (event: ChangeEvent<HTMLInputElement>) => {
    const text = event.target.value;
    setValues(previous => {
      const next = { ...previous, [key]: text }, value = Number(text);
      if (aspect && text.trim() && value > 0 && Number.isFinite(value)) {
        if (key === "width") next.height = String(value * initial.height / initial.width);
        if (key === "height") next.width = String(value * initial.width / initial.height);
      }
      return next;
    });
    if (key === "width" || key === "height") setDimension(key);
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const patch: Partial<Frame> = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim() ? Number(value) : Number.NaN]));
    if (!Object.values(patch).every(Number.isFinite)) return;
    if (aspect && dimension === "height") delete patch.width;
    if (controller.resizeNumeric(patch, aspect)) applied();
  };
  return { values, aspect, change, submit, setAspect: (checked: boolean | "indeterminate") => {
    setAspect(checked === true);
    if (checked === true) { setDimension("width"); setValues(previous => ({ ...previous, height: String(Number(previous.width) * initial.height / initial.width) })); }
  } };
}
export function useDesignerGeometryDialog() {
  const [open, setOpen] = useState(false);
  return { open, onOpenChange: setOpen, close: () => setOpen(false) };
}
