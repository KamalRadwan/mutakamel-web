// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { buildWidgetDraft } from "../../widget-draft-form";
import { EMPTY_WIDGET_FORM } from "../../widget-form";
const ID="01900300-0000-7000-8000-0000000000a1";
const state=vi.hoisted(()=>({user:null as unknown,get:vi.fn(),post:vi.fn(),session:0}));
vi.mock("next/navigation",async(original)=>{
 const router={push:vi.fn()};
 return {...await original<typeof import("next/navigation")>(),useRouter:()=>router};
});
vi.mock("@/context/AuthContext",()=>({useTenantAuth:()=>({user:state.user,realtimeAuthGeneration:"detail-ui:"+state.session})}));
vi.mock("@/i18n/I18nContext",()=>({useI18n:()=>({t:en,lang:"en",dir:"ltr"})}));
vi.mock("@/lib/api/axiosClient",async(original)=>({...await original<typeof import("@/lib/api/axiosClient")>(),axiosClient:{get:(...args:unknown[])=>state.get(...args),post:state.post,patch:vi.fn(),delete:vi.fn()}}));
const {TenantApiClientError}=await import("@/lib/api/axiosClient");
const {WidgetDetailWorkspace}=await import("./widget-detail-workspace");
const user=(permissions:string[])=>({id:"01900100-0000-7000-8000-000000000002",permissions,accessibleBranches:[],accessibleCompanies:[],teamMemberships:[]});
function widget(patch:Record<string,unknown>={}){return{id:ID,ownerUserId:"01900100-0000-7000-8000-000000000002",ownerName:"Kamal",name:"New leads",visualizationType:"METRIC_CARD",querySpec:{series:[{metricKey:"crm.leads.created.count"}],dimension:{key:"none"}},displaySpec:{},revision:3,schemaVersion:1,createdAt:"2026-11-03T08:00:00.000Z",updatedAt:"2026-11-03T08:00:00.000Z",accessLevel:"OWNER",status:"PUBLISHED",versionNumber:1,governanceRevision:1,hasDraft:false,draftRevision:null,isShared:false,...patch};}
const metadata={grid:{},visualizations:[{key:"METRIC_CARD",shapes:["SCALAR"],minSeries:1,maxSeries:1}],metrics:[{key:"crm.leads.created.count",labelEn:"New leads",labelAr:"عملاء جدد",shape:"SCALAR",unit:"COUNT",dimensions:["none"]}],dimensions:[],templates:[]};
function respond(detail:()=>Promise<{data:unknown}>){
 state.get.mockImplementation(async(path:string)=>{
  if(path.endsWith("/catalog"))return {status:200,data:metadata};
  if(path.endsWith("/draft"))return {status:200,data:{widgetId:ID,widgetRevision:3,governanceRevision:1,activeVersionNumber:1,draft:null}};
  return {status:200,...await detail()};
 });
}
const error=(status:number,code:string)=>new TenantApiClientError("failed",{status,statusText:"",headers:new Headers(),data:{code}});
const impactId="01900300-0000-7000-8000-0000000000a9";
function governanceImpact(action:"ARCHIVE"|"RESTORE",revision:number,governanceRevision:number) {
  return {status:200,data:{widgetId:ID,action,impactId,widgetRevision:revision,governanceRevision,activeVersionNumber:1,
    expiresAt:"2026-11-10T08:30:00Z",hiddenPlacementCount:1,placements:[{
      dashboardId:"01900300-0000-7000-8000-0000000000a5",dashboardName:"Branch dashboard",dashboardRevision:2,
      placementId:"01900300-0000-7000-8000-0000000000a6",versionPolicy:"PINNED",versionNumber:1,eligibleToResume:action==="RESTORE",
    }]}};
}
beforeEach(()=>{state.session++;state.user=user(["crm.widgets.read","crm.widgets.update"]);respond(async()=>({data:widget()}));});
afterEach(()=>{cleanup();vi.clearAllMocks();});
describe("Widget detail visible state and safe advanced access",()=>{
 it("shows a skeleton while the actual read is pending",async()=>{
  respond(()=>new Promise(()=>{}));const {container}=render(<WidgetDetailWorkspace widgetId={ID}/>);
  expect(container.querySelector('[class*="shimmer"]')).not.toBeNull();expect(screen.queryByText(en.crmWidgets.definition)).not.toBeInTheDocument();
  await act(async()=>{await Promise.resolve();});
 });
 it("shows authoritative 403 distinctly from not-found",async()=>{
  respond(async()=>{throw error(403,"CRM_PERMISSION_DENIED");});render(<WidgetDetailWorkspace widgetId={ID}/>);
  await screen.findByText(en.permissionGate.title);expect(screen.queryByText(en.crmWidgets.notFoundTitle)).not.toBeInTheDocument();
 });
 it("provides a back link for a real 404",async()=>{
  respond(async()=>{throw error(404,"CRM_WIDGET_NOT_FOUND");});render(<WidgetDetailWorkspace widgetId={ID}/>);
  expect(await screen.findByRole("link",{name:en.crmWidgets.backToList})).toHaveAttribute("href","/crm/widgets");
 });
 it("offers retry for network failure rather than calling it not-found",async()=>{
  respond(async()=>{throw new Error("offline");});render(<WidgetDetailWorkspace widgetId={ID}/>);
  expect(await screen.findByRole("button",{name:en.common.retry})).toBeInTheDocument();expect(screen.queryByText(en.crmWidgets.notFoundTitle)).not.toBeInTheDocument();
 });
 it("retains readable data without edit for a VIEW grant",async()=>{
  respond(async()=>({data:widget({accessLevel:"VIEW",hasDraft:null,isShared:true})}));render(<WidgetDetailWorkspace widgetId={ID}/>);
  await screen.findByText(en.crmWidgets.definition);expect(screen.queryByRole("button",{name:en.crmWidgets.edit})).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: en.crmWidgets.versionComparison.openHistory })).not.toBeInTheDocument();
  expect(state.get.mock.calls.every(([path])=>!String(path).endsWith("/draft"))).toBe(true);
 });
 it("offers advanced editing without collapsing two styled series and filters",async()=>{
  respond(async()=>({data:widget({visualizationType:"LINE_AREA",querySpec:{series:[{metricKey:"crm.count",axis:"LEFT",label:"Count"},{metricKey:"crm.value",axis:"RIGHT",label:"Value"}],dimension:{key:"time",grain:"DAY"},filters:{compare:"NONE"}}})}));
  render(<WidgetDetailWorkspace widgetId={ID}/>);
  expect(await screen.findByRole("button",{name:en.crmWidgets.edit})).toBeEnabled();expect(screen.getByText("Count · Value")).toBeInTheDocument();expect(screen.queryByText(en.crmWidgets.notEditableTitle)).not.toBeInTheDocument();
 });
 it("opens the working draft while displaying the active publication on the detail screen",async()=>{
  const published=widget({hasDraft:true,draftRevision:2});
  const draft={draftId:"01900300-0000-7000-8000-0000000000a3",revision:2,baseVersionNumber:1,name:"Lead volume draft",
    visualizationType:published.visualizationType,querySpec:published.querySpec,displaySpec:{},schemaVersion:1,
    updatedAt:published.updatedAt,updatedByUserId:published.ownerUserId};
  state.get.mockImplementation(async(path:string)=>({status:200,data:path.endsWith("/catalog")?metadata
    :path.endsWith("/draft")?{widgetId:ID,widgetRevision:3,governanceRevision:1,activeVersionNumber:1,draft}:published}));
  render(<WidgetDetailWorkspace widgetId={ID}/>);
  expect(await screen.findByRole("heading",{name:"New leads"})).toBeInTheDocument();
  fireEvent.click(await screen.findByRole("button",{name:en.crmWidgets.edit}));
  expect(screen.getByRole("textbox",{name:en.crmWidgets.name})).toHaveValue(draft.name);
 });
 it.each([false, true])("restores from the independent history flow and verifies uncertain receipts (%s)", async (uncertain) => {
  const labels = en.crmWidgets.versionComparison;
  const published = widget({ versionNumber: 2 });
  const version = { name: published.name, schemaVersion: 1, querySpec: published.querySpec, displaySpec: published.displaySpec };
  const left = { ...version, versionNumber: 1, visualizationType: "RETIRED_CHART", publishedAt: null, provenance: "EXISTING_DEFINITION_BACKFILL" };
  const right = { ...version, versionNumber: 2, visualizationType: published.visualizationType, publishedAt: published.updatedAt, provenance: "USER_PUBLISH" };
  let saved = false;
  const draft = { draftId: "01900300-0000-7000-8000-0000000000a3", revision: 1, baseVersionNumber: 2, name: left.name,
    visualizationType: left.visualizationType, querySpec: left.querySpec, displaySpec: left.displaySpec, schemaVersion: left.schemaVersion,
    updatedAt: published.updatedAt, updatedByUserId: published.ownerUserId };
  const head = { widgetId: ID, widgetRevision: 3, governanceRevision: 1, activeVersionNumber: 2 };
  state.get.mockImplementation(async (path: string) => ({ status: 200, data: path.endsWith("/catalog") ? metadata
    : path.endsWith("/versions") ? { ...head, items: [right, left], nextBeforeVersion: null }
      : path.endsWith("/draft") ? { ...head, draft: saved ? draft : null }
        : { ...published, hasDraft: saved, draftRevision: saved ? 1 : null } }));
  state.post.mockImplementation(async (path: string) => {
    if (path.endsWith("/compare")) return { status: 200, data: { ...head, archived: false, left, right,
      changedSections: ["VISUALIZATION"], restoreState: "AVAILABLE", proof: { impactId, expiresAt: published.updatedAt } } };
    if (!path.endsWith("/restore-draft")) throw new Error("Unexpected mutation");
    saved = true;
    if (uncertain) throw new Error("Response lost");
    return { status: 200, data: { ...head, draft, restoredFromVersionNumber: 1 } };
  });
  render(<WidgetDetailWorkspace widgetId={ID} />);
  fireEvent.click(await screen.findByRole("button", { name: labels.openHistory }));
  fireEvent.click(await screen.findByRole("button", { name: labels.compare }));
  const dialog = await screen.findByRole("dialog", { name: labels.title });
  expect(await within(dialog).findByText(labels.retiredVisualization)).toBeInTheDocument();
  const confirm = within(dialog).getByRole("button", { name: labels.confirm });
  expect(confirm).toBeDisabled();
  fireEvent.click(within(dialog).getByRole("checkbox", { name: labels.acknowledge }));
  fireEvent.click(confirm);
  await waitFor(() => expect(screen.queryByRole("dialog", { name: labels.title })).not.toBeInTheDocument());
  expect(await screen.findByText(en.crmWidgets.notEditableTitle)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: en.crmWidgets.edit })).not.toBeInTheDocument();
  expect(state.post.mock.calls.map(([path]) => path)).toEqual([
    `/api/tenant/crm/v1/widgets/${ID}/versions/compare`,
    `/api/tenant/crm/v1/widgets/${ID}/versions/restore-draft`,
  ]);
  expect(state.post.mock.calls[1][1]).toEqual({ leftVersionNumber: 1, rightVersionNumber: 2, sourceVersionNumber: 1,
    expectedWidgetRevision: 3, expectedGovernanceRevision: 1, impactId, acknowledged: true });
  if (uncertain) expect(screen.getByRole("button", { name: en.crmWidgets.review.reviewed })).toBeEnabled();
 });
 it("restores an incomplete saved form and disables publication review",async()=>{
  state.user=user(["crm.widgets.read","crm.widgets.update","crm.widgets.publish"]);
  const published=widget({hasDraft:true,draftRevision:2});
  const content=buildWidgetDraft({...EMPTY_WIDGET_FORM,name:"Saved early"},null);
  const draft={...content,draftId:"01900300-0000-7000-8000-0000000000a3",revision:2,baseVersionNumber:1,
    schemaVersion:1,updatedAt:published.updatedAt,updatedByUserId:published.ownerUserId};
  state.get.mockImplementation(async(path:string)=>({status:200,data:path.endsWith("/catalog")?metadata
    :path.endsWith("/draft")?{widgetId:ID,widgetRevision:3,governanceRevision:1,activeVersionNumber:1,draft}:published}));
  render(<WidgetDetailWorkspace widgetId={ID}/>);
  expect(await screen.findByRole("button",{name:en.crmWidgets.lifecycle.reviewPublication})).toBeDisabled();
  expect(screen.getByText(en.crmWidgets.lifecycle.completeDraftBeforePublish)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button",{name:en.crmWidgets.edit}));
  expect(screen.getByRole("textbox",{name:en.crmWidgets.name})).toHaveValue(draft.name);
  expect(screen.getByRole("button",{name:en.crmWidgets.lifecycle.saveDraft})).toBeEnabled();
  expect(state.post).not.toHaveBeenCalled();
 });
 it("shows only the reviewed dashboard impact and waits for explicit publication",async()=>{
  state.user=user(["crm.widgets.read","crm.widgets.update","crm.widgets.publish","crm.dashboards.read.all"]);
  const published=widget({hasDraft:true,draftRevision:2,versionNumber:2});
  const draftId="01900300-0000-7000-8000-0000000000a3";
  const draft={draftId,revision:2,baseVersionNumber:2,name:"Lead volume draft",visualizationType:published.visualizationType,
    querySpec:published.querySpec,displaySpec:{},schemaVersion:1,updatedAt:published.updatedAt,updatedByUserId:published.ownerUserId};
  state.get.mockImplementation(async(path:string)=>{
    const head={widgetId:ID,widgetRevision:3,activeVersionNumber:2};
    if(path.endsWith("/versions"))return {status:200,data:{...head,nextBeforeVersion:2,items:[
      {versionNumber:2,name:"New leads",publishedAt:published.updatedAt,provenance:"USER_PUBLISH"},
    ]}};
    if(path.endsWith("/versions?beforeVersion=2"))return {status:200,data:{...head,nextBeforeVersion:null,items:[
      {versionNumber:1,name:"Original leads",publishedAt:null,provenance:"EXISTING_DEFINITION_BACKFILL"},
    ]}};
    return {status:200,data:path.endsWith("/catalog")?metadata
      :path.endsWith("/draft")?{...head,governanceRevision:1,draft}:published};
  });
  state.post.mockResolvedValueOnce({status:200,data:{
    impactId:"01900300-0000-7000-8000-0000000000a4",widgetId:ID,widgetRevision:3,governanceRevision:1,draftId,
    draftRevision:2,nextVersionNumber:3,expiresAt:"2026-11-10T07:10:00.000Z",
    layoutAdjustments:[{placementId:"01900300-0000-7000-8000-0000000000a7",dashboardId:"01900300-0000-7000-8000-0000000000a5",
      x:1,y:4,width:4,height:3}],
    dashboards:[{id:"01900300-0000-7000-8000-0000000000a5",name:"Sales overview",revision:4,affected:true},
      {id:"01900300-0000-7000-8000-0000000000a6",name:"Branch overview",revision:1,affected:false}],
  }}).mockResolvedValueOnce({status:201,data:{widgetId:"preview",shape:"SCALAR",value:4,series:[],
    meta:{unit:"COUNT",generatedAt:published.updatedAt,warnings:[]}}});
  render(<WidgetDetailWorkspace widgetId={ID}/>);
  fireEvent.click(await screen.findByRole("button",{name:en.crmWidgets.lifecycle.reviewPublication}));
  expect(await screen.findByRole("heading",{name:en.crmWidgets.lifecycle.reviewPublication})).toHaveFocus();
  expect(screen.getByText("Sales overview")).toBeInTheDocument();
  expect(screen.getByText(en.crmWidgets.lifecycle.unchanged)).toBeInTheDocument();
  expect(screen.getByText("Column 2, row 5 · 4 × 3")).toBeInTheDocument();
  expect(screen.getByRole("button",{name:"Publish version 3"})).toBeEnabled();
  expect(await screen.findByText(en.crmWidgets.lifecycle.history.active)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button",{name:en.crmWidgets.lifecycle.history.more}));
  expect(await screen.findByText("Original leads")).toBeInTheDocument();
  expect(screen.getByText(en.crmWidgets.lifecycle.history.superseded)).toBeInTheDocument();
  expect(screen.getByText(en.crmWidgets.lifecycle.history.unknownDate)).toBeInTheDocument();
  expect(state.post).toHaveBeenCalledTimes(1);
  const preview=within(screen.getByRole("region",{name:en.crmWidgets.lifecycle.savedDraftPreview}));
  fireEvent.click(preview.getByRole("button",{name:en.crmWidgets.preview}));
  expect(await preview.findByRole("cell",{name:"4"})).toBeInTheDocument();
  expect(preview.getByText("4",{selector:"p"})).toBeInTheDocument();
  expect(state.post.mock.calls[1].slice(0,2)).toEqual([expect.stringContaining("/widgets/preview"),{
    name:draft.name,visualizationType:draft.visualizationType,querySpec:draft.querySpec,
  }]);
  fireEvent.click(screen.getByRole("button",{name:en.crmWidgets.lifecycle.backToDraft}));
  expect(await screen.findByRole("heading",{name:"New leads"})).toBeInTheDocument();
  expect(state.post).toHaveBeenCalledTimes(2);
 });
 it("protects a retired engine instead of silently rebuilding it",async()=>{
  respond(async()=>({data:widget({querySpec:{engine:"SEMANTIC_V1",series:[{metricKey:"crm.count"}],topN:5}})}));
  render(<WidgetDetailWorkspace widgetId={ID}/>);
  await screen.findByText(en.crmWidgets.notEditableTitle);expect(screen.getByText(en.crmWidgets.notEditableReasons.SEMANTIC_ENGINE)).toBeInTheDocument();expect(screen.queryByRole("button",{name:en.crmWidgets.edit})).not.toBeInTheDocument();
 });
 it("masks prior data on the first auth/resource-scope render",async()=>{
  const {rerender}=render(<WidgetDetailWorkspace widgetId={ID}/>);await screen.findByText(en.crmWidgets.definition);
  state.user=user(["crm.widgets.read"]);state.session++;state.get.mockReturnValue(new Promise(()=>{}));rerender(<WidgetDetailWorkspace widgetId="01900300-0000-7000-8000-0000000000a2"/>);
  await waitFor(()=>expect(screen.queryByText(en.crmWidgets.definition)).not.toBeInTheDocument());
 });
 it("archives only after the owner acknowledges impact and supplies a reason",async()=>{
  state.user=user(["crm.widgets.read","crm.widgets.delete"]);
  let head=widget();
  respond(async()=>({data:head}));
  state.post.mockImplementation(async(path:string)=>{
    if(path.endsWith("/lifecycle-impact"))return governanceImpact("ARCHIVE",3,1);
    head=widget({status:"ARCHIVED",revision:4,governanceRevision:2});
    return {status:200,data:{widgetId:ID,status:"ARCHIVED",widgetRevision:4,governanceRevision:2,
      activeVersionNumber:1,affectedDashboardCount:2}};
  });
  render(<WidgetDetailWorkspace widgetId={ID}/>);
  const labels=en.crmWidgets.governance;
  fireEvent.click(await screen.findByRole("button",{name:labels.archive}));
  const modal=within(await screen.findByRole("alertdialog",{name:labels.archive}));
  expect(await modal.findByText(labels.policies.PINNED)).toBeInTheDocument();
  expect(modal.getByText("Additional uses on dashboards outside your access (1).")).toBeInTheDocument();
  expect(modal.getAllByText(labels.blocked)).toHaveLength(2);
  const confirm=modal.getByRole("button",{name:labels.archive});
  expect(confirm).toBeDisabled();
  fireEvent.click(modal.getByRole("checkbox",{name:labels.acknowledge}));
  expect(confirm).toBeDisabled();
  fireEvent.change(modal.getByRole("textbox",{name:labels.reason}),{target:{value:" Review this report "}});
  expect(confirm).toBeEnabled();
  fireEvent.click(confirm);
  expect(await screen.findByRole("button",{name:labels.restore})).toBeInTheDocument();
  expect(state.post.mock.calls[1].slice(0,2)).toEqual([expect.stringContaining("/lifecycle"),{
    action:"ARCHIVE",expectedWidgetRevision:3,expectedGovernanceRevision:1,impactId,reason:"Review this report",
  }]);
 });

 it("reads the current server state after an unconfirmed restore and sends no second confirmation",async()=>{
  state.user=user(["crm.widgets.read","crm.widgets.delete"]);
  let head=widget({status:"ARCHIVED",revision:4,governanceRevision:2});
  respond(async()=>({data:head}));
  state.post.mockImplementation(async(path:string)=>{
    if(path.endsWith("/lifecycle-impact"))return governanceImpact("RESTORE",4,2);
    head=widget({revision:5,governanceRevision:3});
    throw new Error("response lost");
  });
  render(<WidgetDetailWorkspace widgetId={ID}/>);
  const labels=en.crmWidgets.governance;
  fireEvent.click(await screen.findByRole("button",{name:labels.restore}));
  const modal=within(await screen.findByRole("alertdialog",{name:labels.restore}));
  expect(await modal.findByText(labels.eligible)).toBeInTheDocument();
  expect(modal.queryByRole("textbox",{name:labels.reason})).not.toBeInTheDocument();
  fireEvent.click(modal.getByRole("checkbox",{name:labels.acknowledge}));
  fireEvent.click(modal.getByRole("button",{name:labels.restore}));
  expect(await modal.findByText("Current widget status is Published.")).toBeInTheDocument();
  expect(modal.getByText(labels.uncertain)).toBeInTheDocument();
  expect(state.post).toHaveBeenCalledTimes(2);
  expect(state.post.mock.calls[1][1]).not.toHaveProperty("reason");
 });

 it("requires a fresh impact and acknowledgement after a stale confirmation",async()=>{
  state.user=user(["crm.widgets.read","crm.widgets.delete"]);
  let head=widget();
  respond(async()=>({data:head}));
  state.post.mockResolvedValueOnce(governanceImpact("ARCHIVE",3,1))
    .mockImplementationOnce(async()=>{
      head=widget({revision:4});
      throw error(409,"CRM_WIDGET_LIFECYCLE_IMPACT_STALE");
    }).mockResolvedValueOnce(governanceImpact("ARCHIVE",4,1));
  render(<WidgetDetailWorkspace widgetId={ID}/>);
  const labels=en.crmWidgets.governance;
  fireEvent.click(await screen.findByRole("button",{name:labels.archive}));
  const modal=within(await screen.findByRole("alertdialog",{name:labels.archive}));
  fireEvent.click(await modal.findByRole("checkbox",{name:labels.acknowledge}));
  fireEvent.change(modal.getByRole("textbox",{name:labels.reason}),{target:{value:"Review changed use"}});
  fireEvent.click(modal.getByRole("button",{name:labels.archive}));
  expect(await modal.findByRole("alert")).toHaveTextContent(labels.stale);
  fireEvent.click(modal.getByRole("button",{name:en.common.retry}));
  expect(await modal.findByRole("checkbox",{name:labels.acknowledge})).not.toBeChecked();
  expect(modal.getByRole("button",{name:labels.archive})).toBeDisabled();
  expect(state.post.mock.calls[2][1]).toEqual({action:"ARCHIVE",expectedWidgetRevision:4,expectedGovernanceRevision:1});
  fireEvent.click(modal.getByRole("button",{name:en.common.cancel}));
  await waitFor(()=>expect(screen.getByRole("button",{name:labels.archive})).toHaveFocus());
 });
});

