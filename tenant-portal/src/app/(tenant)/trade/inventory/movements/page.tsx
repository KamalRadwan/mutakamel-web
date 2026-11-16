"use client";
import { useInventoryMovements } from "./hooks/useInventoryMovements";
import { MovementWorkspace } from "./components/MovementWorkspace";

export default function InventoryMovementsPage() {
  const controller = useInventoryMovements();
  return <MovementWorkspace key={controller.scopeKey} controller={controller} />;
}
