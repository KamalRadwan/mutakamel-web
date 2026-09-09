// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { applicationsApi } from "@/features/admin/applications/api/applications.api";
import type {
  ApplicationDatabaseServerBindReceipt,
  ApplicationDatabaseServerCandidateView,
  ApplicationDatabaseServerCandidatesView,
  ApplicationMutationReceipt,
  ApplicationView,
  BindApplicationDatabaseServersDto,
  PublishApplicationDto,
} from "@/features/admin/applications/types";

import { ApplicationDatabaseBindDialog } from "./ApplicationDatabaseBindDialog";
import { ApplicationPublishActivateDialog } from "./ApplicationPublishActivateDialog";
import { ApplicationReleaseAuthorityRail } from "./ApplicationReleaseAuthorityRail";

type PublishFn = (dto: PublishApplicationDto) => Promise<ApplicationMutationReceipt>;
type ActivateFn = (
  expectedCatalogueRevision: string,
  reason: string,
) => Promise<unknown>;
type BindFn = (
  dto: BindApplicationDatabaseServersDto,
) => Promise<ApplicationDatabaseServerBindReceipt>;

vi.mock("@/features/admin/applications/api/applications.api", () => ({
  applicationsApi: { listBindableDatabaseServers: vi.fn() },
}));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en", dir: "ltr", t: en }),
  useOptionalI18n: () => ({ lang: "en", dir: "ltr", t: en }),
}));

const publishActivateCopy = en.applications.detail.publishActivate;
const bindCopy = en.applications.detail.databaseBind;
const listCandidates = vi.mocked(applicationsApi.listBindableDatabaseServers);

const SERVER_ONE = "01900000-0000-7000-8000-000000000001";
const SERVER_TWO = "01900000-0000-7000-8000-000000000002";
const SERVER_THREE = "01900000-0000-7000-8000-000000000003";

function application(overrides: Partial<ApplicationView> = {}): ApplicationView {
  return {
    id: "01900000-0000-7000-8000-0000000000a1",
    key: "crm",
    name: "CRM",
    lifecycleStatus: "DRAFT",
    publicationStatus: "UNPUBLISHED",
    catalogueRevision: "4",
    publicationRevision: "1",
    ...overrides,
  } as ApplicationView;
}

function publishReceipt(catalogueRevision: string): ApplicationMutationReceipt {
  return { catalogueRevision } as ApplicationMutationReceipt;
}

function candidate(
  databaseServerId: string,
  overrides: Partial<ApplicationDatabaseServerCandidateView> = {},
): ApplicationDatabaseServerCandidateView {
  return {
    databaseServerId,
    name: `db-${databaseServerId.slice(-1)}`,
    host: "postgres.internal",
    port: 5432,
    serverStatus: "ACTIVE",
    countryIsoCode: "EG",
    currentTenants: 3,
    maxTenants: 100,
    bindingStatus: null,
    credentialRevision: null,
    safeFailureCode: null,
    bound: false,
    bindable: true,
    blockedReason: null,
    ...overrides,
  };
}

function fleet(
  servers: ApplicationDatabaseServerCandidateView[],
  overrides: Partial<ApplicationDatabaseServerCandidatesView> = {},
): ApplicationDatabaseServerCandidatesView {
  return {
    applicationId: "01900000-0000-7000-8000-0000000000a1",
    applicationKey: "crm",
    applicationName: "CRM",
    databasePrincipal: "mutakamel_crm_app",
    catalogueRevision: "5",
    policyRevision: "2",
    bindable: true,
    blockedReason: null,
    servers,
    ...overrides,
  };
}

function receipt(
  overrides: Partial<ApplicationDatabaseServerBindReceipt> = {},
): ApplicationDatabaseServerBindReceipt {
  return {
    applicationId: "01900000-0000-7000-8000-0000000000a1",
    applicationKey: "crm",
    requested: 0,
    bound: 0,
    alreadyBound: 0,
    failed: 0,
    results: [],
    completedAt: "2026-08-02T12:00:00.000Z",
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ApplicationPublishActivateDialog (step 1)", () => {
  function renderDialog(
    overrides: {
      application?: ApplicationView;
      activationBlockedReason?: string | null;
      onPublish?: Mock<PublishFn>;
      onActivate?: Mock<ActivateFn>;
      onContinueToBind?: Mock<() => void>;
    } = {},
  ) {
    const onPublish =
      overrides.onPublish ?? vi.fn<PublishFn>(async () => publishReceipt("5"));
    const onActivate =
      overrides.onActivate ?? vi.fn<ActivateFn>(async () => undefined);
    const onContinueToBind = overrides.onContinueToBind ?? vi.fn<() => void>();
    render(
      <ApplicationPublishActivateDialog
        isOpen
        application={overrides.application ?? application()}
        isSubmitting={false}
        activationBlockedReason={overrides.activationBlockedReason ?? null}
        onClose={vi.fn()}
        onPublish={onPublish}
        onActivate={onActivate}
        onContinueToBind={onContinueToBind}
      />,
    );
    return { onPublish, onActivate, onContinueToBind };
  }

  function submitWithReason(reason = "Approved for the August release") {
    fireEvent.change(screen.getByRole("textbox"), { target: { value: reason } });
    fireEvent.click(screen.getByRole("button", { name: publishActivateCopy.confirm }));
  }

  it("publishes, then activates against the revision the publish returned", async () => {
    const { onPublish, onActivate } = renderDialog();

    submitWithReason();

    await waitFor(() => expect(onActivate).toHaveBeenCalled());
    expect(onPublish).toHaveBeenCalledWith({
      expectedCatalogueRevision: "4",
      expectedPublicationRevision: "1",
      reason: "Approved for the August release",
    });
    // Publishing bumps the catalogue revision, so activation must not reuse "4".
    expect(onActivate).toHaveBeenCalledWith("5", "Approved for the August release");
    expect(
      await screen.findByRole("button", { name: publishActivateCopy.continueToBind }),
    ).toBeTruthy();
  });

  it("defers activation without calling it when it is already known to be refused", async () => {
    const { onPublish, onActivate } = renderDialog({
      activationBlockedReason: "Fleet coverage is incomplete.",
    });

    submitWithReason();

    await waitFor(() => expect(onPublish).toHaveBeenCalled());
    expect(onActivate).not.toHaveBeenCalled();
    expect(await screen.findByText(publishActivateCopy.deferredHint)).toBeTruthy();
    expect(screen.getByText("Fleet coverage is incomplete.")).toBeTruthy();
    // Publication still stands, so the operator continues to binding.
    expect(
      screen.getByRole("button", { name: publishActivateCopy.continueToBind }),
    ).toBeTruthy();
  });

  it("reports a refused activation as deferred and keeps the publication", async () => {
    const onActivate = vi.fn<ActivateFn>(async () => {
      throw new Error("APPLICATION_REQUIRED_DATABASE_COVERAGE_INCOMPLETE");
    });
    renderDialog({ onActivate });

    submitWithReason();

    expect(
      await screen.findByText("APPLICATION_REQUIRED_DATABASE_COVERAGE_INCOMPLETE"),
    ).toBeTruthy();
    expect(screen.getByText(publishActivateCopy.stateDeferred)).toBeTruthy();
    expect(screen.getByText(publishActivateCopy.stateDone)).toBeTruthy();
  });

  it("stops the flow when publishing fails and never activates", async () => {
    const onPublish = vi.fn<PublishFn>(async () => {
      throw new Error("APPLICATION_CATALOGUE_REVISION_STALE");
    });
    const { onActivate } = renderDialog({ onPublish });

    submitWithReason();

    expect(
      await screen.findByText("APPLICATION_CATALOGUE_REVISION_STALE"),
    ).toBeTruthy();
    expect(onActivate).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: publishActivateCopy.continueToBind }),
    ).toBeNull();
  });

  it("requires a reason before running anything", async () => {
    const { onPublish } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: publishActivateCopy.confirm }));

    expect(await screen.findByText(publishActivateCopy.reasonRequired)).toBeTruthy();
    expect(onPublish).not.toHaveBeenCalled();
  });

  it("offers only the binding step for an already published and active Application", () => {
    const { onContinueToBind } = renderDialog({
      application: application({
        lifecycleStatus: "ACTIVE",
        publicationStatus: "PUBLISHED",
      }),
    });

    expect(screen.getByText(publishActivateCopy.nothingToDo)).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: publishActivateCopy.continueToBind }),
    );
    expect(onContinueToBind).toHaveBeenCalled();
  });

  it("publishes an explicitly pending draft without activating an already active Application", async () => {
    const { onPublish, onActivate } = renderDialog({ application: application({
      publicationStatus: "PUBLISHED", lifecycleStatus: "ACTIVE", hasPendingDraft: true,
      catalogueRevision: "99", publicationRevision: "2",
    }) });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Approve reviewed pending changes" } });
    fireEvent.click(screen.getByRole("button", { name: en.applications.detail.releaseAuthority.republish }));
    await waitFor(() => expect(onPublish).toHaveBeenCalledWith({ expectedCatalogueRevision: "99", expectedPublicationRevision: "2", reason: "Approve reviewed pending changes" }));
    expect(onActivate).not.toHaveBeenCalled();
  });
});

describe("Application explicit pending-draft rail", () => {
  it.each([true, false, undefined])("uses explicit pending evidence %s, never revision inequality", hasPendingDraft => {
    render(<ApplicationReleaseAuthorityRail application={application({ publicationStatus: "PUBLISHED", lifecycleStatus: "ACTIVE", hasPendingDraft,
      catalogueRevision: "99", publicationRevision: "2", publishedAt: "2026-09-07T00:00:00.000Z", publishedBy: SERVER_ONE })}
      readiness={null} isReadinessLoading={false} hasReadinessError={false} canPublish isPublishing={false} onPublish={vi.fn()} />);
    const action = screen.queryByRole("button", { name: en.applications.detail.releaseAuthority.republish });
    if (hasPendingDraft === true) {
      expect(action).toBeInTheDocument(); expect(screen.getByText(en.applications.detail.releaseAuthority.pendingDraft)).toBeInTheDocument();
    } else expect(action).not.toBeInTheDocument();
    if (hasPendingDraft === undefined) expect(screen.getByText(en.applications.detail.releaseAuthority.pendingDraftUnknown)).toBeInTheDocument();
    expect(screen.getByText(`PUBLISHED · ${en.applications.detail.releaseAuthority.revision} 2`)).toBeInTheDocument();
  });
  it.each(["permission", "disabled"])("does not turn pending evidence into %s authority", gate => {
    render(<ApplicationReleaseAuthorityRail application={application({ publicationStatus: "PUBLISHED", lifecycleStatus: gate === "disabled" ? "DISABLED" : "ACTIVE", hasPendingDraft: true })}
      readiness={null} isReadinessLoading={false} hasReadinessError={false} canPublish={gate !== "permission"} isPublishing={false} onPublish={vi.fn()} />);
    expect(screen.queryByRole("button", { name: en.applications.detail.releaseAuthority.republish })).not.toBeInTheDocument();
  });
});

describe("ApplicationDatabaseBindDialog (step 2)", () => {
  beforeEach(() => {
    listCandidates.mockResolvedValue(
      fleet([candidate(SERVER_ONE), candidate(SERVER_TWO)]),
    );
  });

  function renderDialog(onBind: Mock<BindFn> = vi.fn<BindFn>(async () => receipt())) {
    render(
      <ApplicationDatabaseBindDialog
        isOpen
        applicationKey="crm"
        isSubmitting={false}
        onClose={vi.fn()}
        onBind={onBind}
      />,
    );
    return { onBind };
  }

  async function fillReason(reason = "Roll CRM out to the Cairo fleet") {
    fireEvent.change(await screen.findByRole("textbox"), {
      target: { value: reason },
    });
  }

  it("pre-selects every bindable server and submits the fleet revisions", async () => {
    const { onBind } = renderDialog();

    expect(await screen.findByText("db-1")).toBeTruthy();
    expect(
      screen.getByText(bindCopy.selectedCount.replace("{{count}}", "2")),
    ).toBeTruthy();
    await fillReason();
    fireEvent.click(screen.getByRole("button", { name: bindCopy.confirm }));

    await waitFor(() => expect(onBind).toHaveBeenCalled());
    expect(onBind).toHaveBeenCalledWith({
      databaseServerIds: [SERVER_ONE, SERVER_TWO],
      expectedCatalogueRevision: "5",
      expectedPolicyRevision: "2",
      reason: "Roll CRM out to the Cairo fleet",
    });
  });

  it("leaves an already-bound server out of the selection and marks it", async () => {
    listCandidates.mockResolvedValue(
      fleet([
        candidate(SERVER_ONE, {
          bound: true,
          bindable: false,
          bindingStatus: "READY",
          credentialRevision: "1",
        }),
        candidate(SERVER_TWO),
      ]),
    );
    const { onBind } = renderDialog();

    expect(await screen.findByText(bindCopy.boundBadge)).toBeTruthy();
    expect(
      screen.getByText(bindCopy.selectedCount.replace("{{count}}", "1")),
    ).toBeTruthy();
    await fillReason();
    fireEvent.click(screen.getByRole("button", { name: bindCopy.confirm }));

    await waitFor(() => expect(onBind).toHaveBeenCalled());
    expect(onBind.mock.calls[0]?.[0].databaseServerIds).toEqual([SERVER_TWO]);
  });

  it("explains why a blocked server cannot be selected", async () => {
    listCandidates.mockResolvedValue(
      fleet([
        candidate(SERVER_ONE, {
          bindable: false,
          blockedReason: "DB_SERVER_SECURITY_ADMIN_CREDENTIALS_REQUIRED",
        }),
        candidate(SERVER_TWO, {
          bindable: false,
          bindingStatus: "RECONCILING",
          blockedReason: "DB_SERVER_APPLICATION_ALREADY_BOUND_OR_NEEDS_RECOVERY",
        }),
        candidate(SERVER_THREE),
      ]),
    );
    renderDialog();

    expect(await screen.findByText(bindCopy.blockedSecurityAdmin)).toBeTruthy();
    expect(screen.getByText(bindCopy.blockedBindingBusy)).toBeTruthy();
    expect(
      screen.getByText(bindCopy.selectedCount.replace("{{count}}", "1")),
    ).toBeTruthy();
  });

  it("renders per-server outcomes and retries only the failed servers", async () => {
    const onBind = vi
      .fn<BindFn>()
      .mockResolvedValueOnce(
        receipt({
          requested: 2,
          bound: 1,
          failed: 1,
          results: [
            {
              databaseServerId: SERVER_ONE,
              databaseServerName: "db-1",
              outcome: "BOUND",
              databasePrincipal: "mutakamel_crm_app",
              credentialRevision: "1",
              bindingStatus: "READY",
              code: null,
              message: null,
            },
            {
              databaseServerId: SERVER_TWO,
              databaseServerName: "db-2",
              outcome: "FAILED",
              databasePrincipal: null,
              credentialRevision: null,
              bindingStatus: "PENDING",
              code: "DB_SERVER_APPLICATION_NETWORK_FAILED",
              message: "An operational dependency is unavailable.",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(receipt({ requested: 1, bound: 1 }));
    renderDialog(onBind);

    await fillReason();
    fireEvent.click(screen.getByRole("button", { name: bindCopy.confirm }));

    const outcomes = await screen.findByRole("region", {
      name: bindCopy.outcomeTitle,
    });
    expect(
      within(outcomes).getByText(
        bindCopy.outcomeSummary
          .replace("{{bound}}", "1")
          .replace("{{alreadyBound}}", "0")
          .replace("{{failed}}", "1"),
      ),
    ).toBeTruthy();
    expect(
      within(outcomes).getByText("An operational dependency is unavailable."),
    ).toBeTruthy();
    expect(
      within(outcomes).getByText("DB_SERVER_APPLICATION_NETWORK_FAILED"),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: bindCopy.retryFailed }));

    await waitFor(() => expect(onBind).toHaveBeenCalledTimes(2));
    expect(onBind.mock.calls[1]?.[0].databaseServerIds).toEqual([SERVER_TWO]);
  });

  it("reports an already-bound outcome as a success, not a failure", async () => {
    const onBind = vi.fn<BindFn>(async () =>
      receipt({
        requested: 1,
        alreadyBound: 1,
        results: [
          {
            databaseServerId: SERVER_ONE,
            databaseServerName: "db-1",
            outcome: "ALREADY_BOUND",
            databasePrincipal: "mutakamel_crm_app",
            credentialRevision: "1",
            bindingStatus: "READY",
            code: null,
            message: null,
          },
        ],
      }),
    );
    renderDialog(onBind);

    await fillReason();
    fireEvent.click(screen.getByRole("button", { name: bindCopy.confirm }));

    expect(await screen.findByText(bindCopy.outcomeAlreadyBound)).toBeTruthy();
    expect(screen.queryByRole("button", { name: bindCopy.retryFailed })).toBeNull();
  });

  it("refuses a reason shorter than the audited minimum", async () => {
    const { onBind } = renderDialog();

    await fillReason("short");
    fireEvent.click(screen.getByRole("button", { name: bindCopy.confirm }));

    expect(await screen.findByText(bindCopy.reasonMinimum)).toBeTruthy();
    expect(onBind).not.toHaveBeenCalled();
  });

  it("refuses to submit with nothing selected", async () => {
    const { onBind } = renderDialog();

    fireEvent.click(await screen.findByRole("button", { name: bindCopy.clear }));
    await fillReason();
    const confirm = screen.getByRole("button", { name: bindCopy.confirm });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(confirm);

    expect(onBind).not.toHaveBeenCalled();
  });

  it("blocks binding entirely when the Application is not eligible", async () => {
    listCandidates.mockResolvedValue(
      fleet([candidate(SERVER_ONE)], {
        bindable: false,
        blockedReason: "DB_SERVER_APPLICATION_NOT_AVAILABLE",
      }),
    );
    renderDialog();

    expect(await screen.findByText(bindCopy.applicationBlocked)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: bindCopy.confirm });
    expect(confirm.hasAttribute("disabled")).toBe(true);
  });

  it("offers a retry when the fleet cannot be loaded", async () => {
    listCandidates.mockRejectedValueOnce(new Error("Fleet read failed."));
    renderDialog();

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Fleet read failed.")).toBeTruthy();

    listCandidates.mockResolvedValue(fleet([candidate(SERVER_ONE)]));
    fireEvent.click(screen.getByRole("button", { name: bindCopy.retry }));

    expect(await screen.findByText("db-1")).toBeTruthy();
  });
});
