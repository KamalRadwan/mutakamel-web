import { describe, expect, it } from "vitest";
import {
  DOSSIER_CARD_TONES,
  DOSSIER_CARD_TONE_CLASSES,
  DOSSIER_COLOR_PALETTE,
  DOSSIER_HEADER_CARD_COLORS,
  DOSSIER_KPI_KINDS,
  DOSSIER_KPI_PILL_CLASSES,
  dossierAvatarClass,
  dossierStageCellClass,
  dossierStatusBadgeClass,
} from "./dossier-modal-tokens";

describe("dossier-modal-tokens", () => {
  it("defines Light and Dark mode color tokens and card tone classes", () => {
    expect(DOSSIER_COLOR_PALETTE.light.modalBg).toBe("#ffffff");
    expect(DOSSIER_COLOR_PALETTE.dark.modalBg).toBe("#0f172a");
    expect(DOSSIER_CARD_TONES).toEqual(["indigo", "violet", "emerald", "amber", "cyan"]);
    for (const tone of DOSSIER_CARD_TONES) {
      expect(DOSSIER_CARD_TONE_CLASSES[tone].card).toContain(`dossier-card-${tone}`);
      expect(DOSSIER_CARD_TONE_CLASSES[tone].iconPill).toContain(`dossier-ip-${tone}`);
    }
  });

  it("maps KPI pills, avatar classes, status badges, and stage cells accurately", () => {
    expect(DOSSIER_KPI_KINDS).toHaveLength(4);
    expect(DOSSIER_KPI_PILL_CLASSES.opportunities).toContain("dossier-kpi-opp");
    expect(DOSSIER_HEADER_CARD_COLORS).toHaveLength(6);
    expect(DOSSIER_HEADER_CARD_COLORS[0]?.color).toBeNull();

    expect(dossierAvatarClass(true, false)).toContain("dossier-avatar-corp");
    expect(dossierAvatarClass(false, false)).toContain("dossier-avatar-indiv");
    expect(dossierAvatarClass(true, true)).toContain("dossier-avatar-conv");

    expect(dossierStatusBadgeClass("OPEN")).toContain("dossier-badge-status-open");
    expect(dossierStatusBadgeClass("CONVERTED")).toContain("dossier-badge-status-conv");

    expect(dossierStageCellClass({ flag: "CONVERTED", isCurrent: true, isPast: false })).toBe(
      "dossier-stage-cell conv-active",
    );
    expect(dossierStageCellClass({ flag: "QUALIFIED", isCurrent: true, isPast: false })).toBe(
      "dossier-stage-cell current",
    );
    expect(dossierStageCellClass({ flag: "NEW", isCurrent: false, isPast: true })).toBe(
      "dossier-stage-cell past",
    );
  });
});
