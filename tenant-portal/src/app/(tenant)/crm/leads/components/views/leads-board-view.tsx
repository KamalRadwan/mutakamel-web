"use client";

import { useMemo, useState, useEffect } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import type { LeadItem, LeadStage } from "../../hooks/useLeads";
import { LeadCard } from "../shared/lead-card";
import { useI18n } from "@/i18n/I18nContext";

interface LeadsBoardViewProps {
  items: LeadItem[];
  stages: LeadStage[];
  moveLead: (
    leadId: string,
    destStageId: string,
  ) => void | Promise<void>;
  canUpdate: (lead: LeadItem) => boolean;
  isMovePending: boolean;
  canDelete: (lead: LeadItem) => boolean;
  onDelete?: (lead: LeadItem) => void;
}

export function LeadsBoardView({
  items,
  stages,
  moveLead,
  canUpdate,
  isMovePending,
  canDelete,
  onDelete,
}: LeadsBoardViewProps) {
  const { lang } = useI18n();
  const isRtl = lang === "ar";
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setMounted(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const boardData = useMemo(() => {
    return stages.map((stage) => {
      return {
        ...stage,
        items: items.filter((item) => item.stageId === stage.id),
      };
    });
  }, [items, stages]);

  const onDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;

    if (source.droppableId === destination.droppableId) return;

    moveLead(draggableId, destination.droppableId);
  };

  if (!mounted) return null; // Avoid hydration mismatch for dnd

  return (
    <div className="h-full flex flex-col">
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar">
          <div className="flex h-full gap-4 p-4 md:p-6 min-w-max items-start">
            {boardData.map((column) => (
              <div key={column.id} className="w-[300px] flex-shrink-0 flex flex-col max-h-full bg-slate-100/50 dark:bg-slate-900/50 rounded-2xl border border-slate-200/60 dark:border-slate-800/60">
                {/* Column Header */}
                <div className={`p-3 border-b-2 bg-white/50 dark:bg-slate-900/50 rounded-t-2xl flex items-center justify-between ${column.color}`}>
                  <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                    {isRtl ? column.nameAr : column.nameEn}
                  </h3>
                  <span className="text-xs font-semibold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">
                    {column.items.length}
                  </span>
                </div>

                {/* Droppable Area */}
                <Droppable
                  droppableId={column.id}
                  direction="vertical"
                  isDropDisabled={column.flag === "CONVERTED" || isMovePending}
                >
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 overflow-y-auto p-2 custom-scrollbar transition-colors ${
                        snapshot.isDraggingOver ? "bg-blue-50/50 dark:bg-blue-900/10" : ""
                      }`}
                    >
                      <div className="flex flex-col gap-2 min-h-[50px]">
                        {column.items.map((lead, index) => (
                          <Draggable
                            key={lead.id}
                            draggableId={lead.id}
                            index={index}
                            isDragDisabled={
                              isMovePending ||
                              column.flag === "CONVERTED" ||
                              !canUpdate(lead)
                            }
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                style={provided.draggableProps.style}
                                className={snapshot.isDragging ? "opacity-90 ring-2 ring-blue-500 shadow-xl rounded-xl z-50" : ""}
                              >
                                <LeadCard
                                  lead={lead}
                                  stages={stages}
                                  onDelete={onDelete}
                                  canDelete={canDelete(lead)}
                                />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </div>
      </DragDropContext>
    </div>
  );
}
