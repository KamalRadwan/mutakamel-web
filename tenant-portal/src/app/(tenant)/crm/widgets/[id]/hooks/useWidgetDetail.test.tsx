// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { isUUIDv7 } from "@/lib/uuid";
import { useWidgetDetail } from "./useWidgetDetail";
const state=vi.hoisted(()=>({get:vi.fn(),patch:vi.fn(),post:vi.fn(),session:0,permissions:[] as string[]}));
vi.mock("@/context/AuthContext",()=>({useTenantAuth:()=>({user:{id:"01900100-0000-7000-8000-000000000002",permissions:state.permissions},realtimeAuthGeneration:"detail-receipt:"+state.session})}));
vi.mock("@/lib/api/axiosClient",async(original)=>({...await original<typeof import("@/lib/api/axiosClient")>(),axiosClient:{get:state.get,patch:state.patch,post:state.post}}));
const ID="01900300-0000-7000-8000-0000000000a1";
const OWNER_ID="01900100-0000-7000-8000-000000000002";
const DRAFT_ID="01900300-0000-7000-8000-0000000000a3";
const content={name:"Count",visualizationType:"METRIC_CARD" as const,querySpec:{series:[{metricKey:"crm.count"}],dimension:{key:"none"}},displaySpec:{}};
const widget=(draftRevision:number|null=null)=>({...content,id:ID,ownerUserId:OWNER_ID,ownerName:"Kamal",revision:1,schemaVersion:1,
  createdAt:"2026-11-03T08:00:00.000Z",updatedAt:"2026-11-03T08:00:00.000Z",accessLevel:"OWNER",
  status:"PUBLISHED",versionNumber:1,governanceRevision:1,isShared:false,hasDraft:draftRevision!==null,draftRevision});
const draftState=(draft:unknown=null)=>({widgetId:ID,widgetRevision:1,governanceRevision:1,activeVersionNumber:1,draft});
const savedDraft=(revision:number,displaySpec:Record<string,unknown>={})=>({...content,displaySpec,draftId:DRAFT_ID,
  revision,baseVersionNumber:1,schemaVersion:1,updatedAt:widget().updatedAt,updatedByUserId:OWNER_ID});
const catalog={grid:{},visualizations:[],metrics:[],dimensions:[],templates:[]};
function respond(draft:ReturnType<typeof savedDraft>|null=null){
  state.get.mockImplementation(async(path:string)=>({status:200,data:path.endsWith("/catalog")?catalog
    :path.endsWith("/draft")?draftState(draft):widget(draft?.revision)}));
}
beforeEach(()=>{state.session++;state.permissions=["crm.widgets.read","crm.widgets.update"];respond();});
afterEach(()=>{cleanup();vi.resetAllMocks();});
describe("Widget edit receipt fidelity",()=>{
 it("creates a working generation while leaving the published definition and head intact",async()=>{
  const canonical={title:"Sales chart",subtitle:"Period",options:{customScalar:" keep "}};
  const draft=savedDraft(1,canonical);
  state.patch.mockResolvedValue({status:200,data:draftState(draft)});
  const {result}=renderHook(()=>useWidgetDetail(ID));await waitFor(()=>expect(result.current.draftState).not.toBeNull());
  respond(draft);
  await act(async()=>{expect((await result.current.update({...content,displaySpec:canonical},result.current.draftState!)).ok).toBe(true);});
  expect(result.current.needsReview).toBe(false);
  expect(result.current.widget?.displaySpec).toEqual({});
  expect(result.current.draftState?.draft?.displaySpec).toEqual(canonical);
  expect(state.patch.mock.calls[0][1]).toEqual({...content,displaySpec:canonical,expectedWidgetRevision:1,expectedDraftId:null,expectedDraftRevision:0});
 });
 it("does not accept a mutation receipt for another widget",async()=>{
  state.patch.mockResolvedValue({status:200,data:{...draftState(savedDraft(1)),widgetId:"01900300-0000-7000-8000-0000000000a2"}});
  const {result}=renderHook(()=>useWidgetDetail(ID));await waitFor(()=>expect(result.current.draftState).not.toBeNull());
  await act(async()=>{const outcome=await result.current.update(content,result.current.draftState!);expect(outcome.ok).toBe(false);expect(outcome.uncertain).toBe(true);});
  expect(result.current.needsReview).toBe(true);expect(state.patch).toHaveBeenCalledTimes(1);
 });
 it("refuses a stale editor after reloading a newer revision in the same generation",async()=>{
  respond(savedDraft(1));
  const {result}=renderHook(()=>useWidgetDetail(ID));await waitFor(()=>expect(result.current.draftState?.draft?.revision).toBe(1));
  const editorBase=result.current.draftState!;
  respond(savedDraft(2));
  await act(async()=>{expect(await result.current.reload()).toBe(true);});
  await act(async()=>{expect(await result.current.update(content,editorBase)).toMatchObject({ok:false,conflict:true});});
  expect(state.patch).not.toHaveBeenCalled();
 });
 it("clears the widget and draft after read denial and keeps them hidden while retrying",async()=>{
  respond(savedDraft(1));
  const {result}=renderHook(()=>useWidgetDetail(ID));
  await waitFor(()=>expect(result.current.draftState?.draft?.revision).toBe(1));
  state.get.mockRejectedValue(new TenantApiClientError("denied",{status:403,statusText:"",headers:new Headers(),data:{}}));
  await act(async()=>{await result.current.reload();});
  expect(result.current.error?.status).toBe(403);
  state.get.mockReturnValue(new Promise(()=>{}));
  act(()=>{void result.current.reload();});
  expect(result.current.widget).toBeNull();
  expect(result.current.draftState).toBeNull();
 });
});

const IMPACT_ID="01900300-0000-7000-8000-0000000000a4";
const DASHBOARD_ID="01900300-0000-7000-8000-0000000000a5";
const IMPACT_BODY={expectedWidgetRevision:1,expectedGovernanceRevision:1,expectedDraftId:DRAFT_ID,expectedDraftRevision:2};
const response=(data:unknown)=>({status:200,data,headers:new Headers()});
const impactResponse=()=>response({impactId:IMPACT_ID,widgetId:ID,widgetRevision:1,governanceRevision:1,draftId:DRAFT_ID,
  draftRevision:2,nextVersionNumber:2,expiresAt:"2026-11-10T07:10:00.000Z",
  dashboards:[{id:DASHBOARD_ID,name:"Sales overview",revision:3,affected:true}],layoutAdjustments:[]});

describe("Widget publication and discard",()=>{
 it("requires a separate publish permission even when the editor can save or discard",async()=>{
  respond(savedDraft(2));
  const {result}=renderHook(()=>useWidgetDetail(ID));
  await waitFor(()=>expect(result.current.draftState?.draft?.revision).toBe(2));
  await act(async()=>{await result.current.lifecycle.inspect();});
  expect(result.current.lifecycle.canPublish).toBe(false);
  expect(state.post).not.toHaveBeenCalled();
 });

 it("reviews first and reuses the exact reviewed body and UUIDv7 key after an unconfirmed publish",async()=>{
  state.permissions.push("crm.widgets.publish");
  respond(savedDraft(2));
  const {result}=renderHook(()=>useWidgetDetail(ID));
  await waitFor(()=>expect(result.current.draftState?.draft?.revision).toBe(2));
  state.post.mockResolvedValueOnce(impactResponse());
  await act(async()=>{await result.current.lifecycle.inspect();});
  expect(state.post).toHaveBeenCalledExactlyOnceWith(expect.stringContaining("/publish-impact"),IMPACT_BODY,expect.anything());
  expect(result.current.lifecycle.review?.impact.dashboards).toEqual([{id:DASHBOARD_ID,name:"Sales overview",revision:3,affected:true}]);
  state.post.mockRejectedValueOnce(new Error("connection lost"));
  await act(async()=>{await result.current.lifecycle.confirm();});
  expect(result.current.lifecycle.review?.unconfirmed).toBe(true);
  act(()=>result.current.lifecycle.closeReview());
  expect(result.current.lifecycle.review).not.toBeNull();
  const [firstPath,firstBody,firstConfig]=state.post.mock.calls[1];
  expect(firstPath).toContain("/publish");
  expect(firstBody).toEqual({...IMPACT_BODY,impactId:IMPACT_ID});
  expect(isUUIDv7(firstConfig.headers["x-idempotency-key"])).toBe(true);
  state.get.mockImplementation(async(path:string)=>response(path.endsWith("/catalog")?catalog:path.endsWith("/draft")
    ?{...draftState(),widgetRevision:2,activeVersionNumber:2}:{...widget(),revision:2,versionNumber:2}));
  state.post.mockResolvedValueOnce(response({widgetId:ID,widgetRevision:2,versionNumber:2,sourceDraftId:DRAFT_ID,
    sourceDraftRevision:2,publishedAt:"2026-11-10T07:04:00.000Z",dashboardRevisions:{[DASHBOARD_ID]:4},replayed:true}));
  await act(async()=>{expect(await result.current.lifecycle.confirm()).toEqual({versionNumber:2,refreshed:true});});
  expect(state.post.mock.calls[2]).toEqual([firstPath,firstBody,firstConfig]);
  expect(result.current.lifecycle.review).toBeNull();
  expect(result.current.widget?.versionNumber).toBe(2);
 });

 it("requires a new review after the server rejects a stale proof",async()=>{
  state.permissions.push("crm.widgets.publish");
  respond(savedDraft(2));
  const {result}=renderHook(()=>useWidgetDetail(ID));
  await waitFor(()=>expect(result.current.draftState?.draft?.revision).toBe(2));
  state.post.mockResolvedValueOnce(impactResponse());
  await act(async()=>{await result.current.lifecycle.inspect();});
  state.post.mockRejectedValueOnce(new TenantApiClientError("stale",{
    status:409,statusText:"",headers:new Headers(),data:{code:"CRM_WIDGET_PUBLISH_IMPACT_STALE"},
  }));
  await act(async()=>{await result.current.lifecycle.confirm();});
  expect(result.current.lifecycle.review).toBeNull();
  expect(result.current.lifecycle.failure?.error.code).toBe("CRM_WIDGET_PUBLISH_IMPACT_STALE");
  await act(async()=>{await result.current.lifecycle.confirm();});
  expect(state.post).toHaveBeenCalledTimes(2);
 });

 it("never discards a different revision from the one captured at confirmation",async()=>{
  respond(savedDraft(2));
  const {result}=renderHook(()=>useWidgetDetail(ID));
  await waitFor(()=>expect(result.current.draftState?.draft?.revision).toBe(2));
  act(()=>result.current.lifecycle.setDiscardOpen(true));
  respond(savedDraft(3));
  await act(async()=>{await result.current.reload();});
  await act(async()=>{await result.current.lifecycle.discard();});
  expect(result.current.lifecycle.discardOpen).toBe(false);
  expect(result.current.lifecycle.failure?.error.code).toBe("CRM_WIDGET_DRAFT_CONFLICT");
  expect(state.post).not.toHaveBeenCalled();
 });

 it("discards a reviewed generation and keeps the publication and head revision",async()=>{
  respond(savedDraft(2));
  const {result}=renderHook(()=>useWidgetDetail(ID));
  await waitFor(()=>expect(result.current.draftState?.draft?.revision).toBe(2));
  act(()=>result.current.lifecycle.setDiscardOpen(true));
  respond();
  state.post.mockResolvedValueOnce(response(draftState()));
  await act(async()=>{expect(await result.current.lifecycle.discard()).toEqual({refreshed:true});});
  expect(state.post).toHaveBeenCalledExactlyOnceWith(expect.stringContaining("/draft/discard"),
    {expectedWidgetRevision:1,expectedDraftId:DRAFT_ID,expectedDraftRevision:2},expect.anything());
  expect(result.current.widget).toMatchObject({versionNumber:1,revision:1});
  expect(result.current.draftState?.draft).toBeNull();
 });
});

