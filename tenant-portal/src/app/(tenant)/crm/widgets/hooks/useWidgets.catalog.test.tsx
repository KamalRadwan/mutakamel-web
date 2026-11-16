// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { buildWidgetDraft } from "../widget-draft-form";
import { EMPTY_WIDGET_FORM } from "../widget-form";
import { useWidgets } from "./useWidgets";
const state=vi.hoisted(()=>({get:vi.fn(),post:vi.fn(),user:{id:"01900100-0000-7000-8000-000000000002",permissions:["crm.widgets.read","crm.widgets.create"]},session:0}));
vi.mock("@/context/AuthContext",()=>({useTenantAuth:()=>({user:state.user,realtimeAuthGeneration:"widget-test:"+state.session})}));
vi.mock("@/lib/api/axiosClient",async(original)=>({...await original<typeof import("@/lib/api/axiosClient")>(),axiosClient:{get:state.get,post:state.post}}));
const input={name:"Lead count",visualizationType:"METRIC_CARD" as const,querySpec:{series:[{metricKey:"crm.leads.created.count"}],dimension:{key:"none"}},displaySpec:{}};
const widget=()=>({...input,id:"018f0000-0000-7000-8000-000000000101",ownerUserId:state.user.id,ownerName:"Kamal",accessLevel:"OWNER",displaySpec:{},revision:1,schemaVersion:1,createdAt:"2026-11-03T08:00:00.000Z",updatedAt:"2026-11-03T08:00:00.000Z",
  status:"PUBLISHED",versionNumber:1,governanceRevision:1,hasDraft:false,draftRevision:null,isShared:false});
const receipt=(displaySpec:Record<string,unknown>={})=>({widgetId:widget().id,widgetRevision:1,governanceRevision:1,activeVersionNumber:null,
  draft:{...input,displaySpec,draftId:"018f0000-0000-7000-8000-000000000102",revision:1,baseVersionNumber:null,schemaVersion:1,
    updatedAt:widget().updatedAt,updatedByUserId:state.user.id}});
const catalog={grid:{},visualizations:[{key:"METRIC_CARD",shapes:["SCALAR"],minSeries:1,maxSeries:1}],metrics:[{key:"crm.leads.created.count",unit:"COUNT",shape:"SCALAR",dimensions:["none"]}],dimensions:[{key:"none",grains:[]}],templates:[]};
beforeEach(()=>{
 state.session++; state.user={id:"01900100-0000-7000-8000-000000000002",permissions:["crm.widgets.read","crm.widgets.create"]};
 state.get.mockImplementation(async(path:string)=>({status:200,data:path.includes("/catalog")?catalog:{items:[],nextCursor:null},headers:new Headers()}));
 state.post.mockImplementation(async()=>({status:201,data:receipt(),headers:new Headers()}));
});
afterEach(()=>{cleanup();vi.resetAllMocks();});
describe("Widget catalogue authority and write fences",()=>{
 it("accepts canonical trimmed display receipts without marking a successful create uncertain",async()=>{
  const raw={title:" Sales chart ",subtitle:" Monthly ",options:{customScalar:" keep "}};
  state.post.mockResolvedValue({status:201,data:receipt({title:"Sales chart",subtitle:"Monthly",options:raw.options}),headers:new Headers()});
  const {result}=renderHook(()=>useWidgets());await waitFor(()=>expect(result.current.isLoading).toBe(false));
  await act(async()=>{expect((await result.current.create({...input,displaySpec:raw})).ok).toBe(true);});
  expect(result.current.needsReview).toBe(false);expect(state.post.mock.calls[0][1].displaySpec).toEqual({title:"Sales chart",subtitle:"Monthly",options:raw.options});
 });
 it("loads widget metadata and creates without dashboard-read permission or preview calls",async()=>{
  const {result}=renderHook(()=>useWidgets());await waitFor(()=>expect(result.current.isLoading).toBe(false));
  expect(result.current.catalog).not.toBeNull();expect(result.current.canPreview).toBe(false);
  await act(async()=>{expect((await result.current.create(input)).ok).toBe(true);});
  expect(state.post).toHaveBeenCalledTimes(1);expect(state.post.mock.calls[0][1].displaySpec).toEqual({});
  expect(state.get.mock.calls.every(([path])=>!String(path).includes("/dashboards/"))).toBe(true);
 });
 it("creates and reconciles an incomplete widget without imposing publication validation",async()=>{
  const draft=buildWidgetDraft({...EMPTY_WIDGET_FORM,displaySpec:{title:" Draft title "}},null);
  state.post.mockResolvedValue({status:201,data:{...receipt(),draft:{...receipt().draft,...draft}},headers:new Headers()});
  const {result}=renderHook(()=>useWidgets());
  await waitFor(()=>expect(result.current.hasLoaded).toBe(true));
  await act(async()=>{expect(await result.current.create(draft)).toMatchObject({ok:true,createdId:widget().id});});
  expect(state.post).toHaveBeenCalledExactlyOnceWith(expect.stringContaining("/widgets"),draft,expect.anything());
 });
 it("synchronously prevents a second create before React paints pending state",async()=>{
  const {result}=renderHook(()=>useWidgets());await waitFor(()=>expect(result.current.isLoading).toBe(false));
  let release!:(value:unknown)=>void;state.post.mockReturnValue(new Promise(resolve=>{release=resolve;}));
  let first!:ReturnType<typeof result.current.create>;let second!:ReturnType<typeof result.current.create>;
  act(()=>{first=result.current.create(input);second=result.current.create(input);});
  expect(state.post).toHaveBeenCalledTimes(1);
  await act(async()=>{release({status:201,data:receipt(),headers:new Headers()});await first;expect((await second).ok).toBe(false);});
 });
 it("clones an active publication to a distinct draft and omits an empty copy name",async()=>{
  const source={...widget(),id:"018f0000-0000-7000-8000-000000000104"};
  const draft={...widget(),status:"DRAFT",versionNumber:null,querySpec:null,displaySpec:null,schemaVersion:null,hasDraft:true,draftRevision:1};
  state.get.mockImplementation(async(path:string)=>({status:200,data:path.includes("/catalog")?catalog:{items:[source,draft],nextCursor:null}}));
  const {result}=renderHook(()=>useWidgets());await waitFor(()=>expect(result.current.hasLoaded).toBe(true));
  await act(async()=>{
   expect((await result.current.clone(draft.id)).ok).toBe(false);
   expect(await result.current.clone(source.id,"   ")).toMatchObject({ok:true,createdId:receipt().widgetId});
  });
  expect(state.post).toHaveBeenCalledExactlyOnceWith(expect.stringContaining(`/${source.id}/clone`),{},expect.anything());
 });
 it("treats malformed receipts as uncertain, reconciles once and requires explicit review across remount",async()=>{
  state.post.mockResolvedValue({status:201,data:{id:widget().id},headers:new Headers()});
  const first=renderHook(()=>useWidgets());await waitFor(()=>expect(first.result.current.isLoading).toBe(false));
  await act(async()=>{const outcome=await first.result.current.create(input);expect(outcome.ok).toBe(false);expect(outcome.uncertain).toBe(true);});
  expect(first.result.current.needsReview).toBe(true);first.unmount();
  const next=renderHook(()=>useWidgets());await waitFor(()=>expect(next.result.current.reviewReady).toBe(true));
  expect(next.result.current.blocked).toBe(true);
  await act(async()=>{expect((await next.result.current.create(input)).ok).toBe(false);});
  expect(state.post).toHaveBeenCalledTimes(1);act(()=>next.result.current.review());expect(next.result.current.needsReview).toBe(false);
 });
 it("masks the previous actor's rows on the first new-scope render",async()=>{
  state.get.mockImplementation(async(path:string)=>({status:200,data:path.includes("/catalog")?catalog:{items:[widget()],nextCursor:null},headers:new Headers()}));
  const {result,rerender}=renderHook(()=>useWidgets());await waitFor(()=>expect(result.current.items).toHaveLength(1));
  state.user={...state.user,id:"01900100-0000-7000-8000-000000000003"};state.get.mockReturnValue(new Promise(()=>{}));rerender();
  expect(result.current.items).toEqual([]);expect(result.current.hasLoaded).toBe(false);
  await act(async()=>{await Promise.resolve();});
 });
 it("keeps the verified catalogue when loading the next widget page",async()=>{
  const first=widget();
  const second={...first,id:"018f0000-0000-7000-8000-000000000100"};
  state.get.mockImplementation(async(path:string)=>({status:200,data:path.includes("/catalog")?catalog
    :path.includes("?cursor=")?{items:[second],nextCursor:null}:{items:[first],nextCursor:first.id}}));
  const {result}=renderHook(()=>useWidgets());
  await waitFor(()=>expect(result.current.hasMore).toBe(true));
  await act(async()=>{expect(await result.current.loadMore()).toBe(true);});
  expect(result.current.catalog).not.toBeNull();
  expect(result.current.items.map(({id})=>id)).toEqual([first.id,second.id]);
  expect(state.get.mock.calls.filter(([path])=>String(path).includes("/catalog"))).toHaveLength(1);
 });
 it("searches the server before paging and keeps the active filters on the next request", async () => {
  const first = widget();
  const matching = { ...first, id: "018f0000-0000-7000-8000-000000000100", name: "Renewals_50%", sourceResources: ["leads", "opportunities"] };
  const next = { ...matching, id: "018f0000-0000-7000-8000-000000000099" };
  state.get.mockImplementation(async (path: string) => ({ status: 200, data: path.includes("/catalog") ? catalog
   : path.includes("cursor=") ? { items: [next], nextCursor: null }
   : path.includes("search=") ? { items: [matching], nextCursor: matching.id } : { items: [first], nextCursor: first.id } }));
  const { result } = renderHook(() => useWidgets());
  await waitFor(() => expect(result.current.items).toHaveLength(1));
  act(() => {
   result.current.setSearchQuery(" Renewals_50% ");
   result.current.setAccess("OWNED");
   result.current.setStatus("PUBLISHED");
   result.current.setSource("leads");
   result.current.setOwner(matching.ownerUserId);
  });
  expect(result.current.items).toEqual([]);
  expect(result.current.hasMore).toBe(false);
  await waitFor(() => expect(result.current.items.map(({ id }) => id)).toEqual([matching.id]));
  await act(async () => { expect(await result.current.loadMore()).toBe(true); });
  expect(result.current.items.map(({ id }) => id)).toEqual([matching.id, next.id]);
  expect(state.get).toHaveBeenLastCalledWith(expect.stringContaining(`?search=Renewals_50%25&access=OWNED&status=PUBLISHED&source=leads&ownerUserId=${matching.ownerUserId}&cursor=${matching.id}`), expect.anything());
  act(() => result.current.setAccess("SHARED"));
  expect(result.current.filters.ownerUserId).toBeNull();
  act(() => result.current.clearFilters());
  await waitFor(() => expect(result.current.items.map(({ id }) => id)).toEqual([first.id]));
 });
 it("distinguishes an unclassified widget from missing source metadata", async () => {
  const base = widget();
  let filtered: ReturnType<typeof widget> & { sourceResources?: string[] } = base;
  state.get.mockImplementation(async (path: string) => ({ status: 200, data: path.includes("/catalog") ? catalog
   : { items: [path.includes("source=") ? filtered : base], nextCursor: null } }));
  const { result } = renderHook(() => useWidgets());
  await waitFor(() => expect(result.current.items).toHaveLength(1));
  act(() => result.current.setSource("unclassified"));
  await waitFor(() => expect(result.current.queryError).not.toBeNull());
  expect(result.current.items).toEqual([]);
  filtered = { ...base, sourceResources: [] };
  await act(async () => { expect(await result.current.reload()).toBe(true); });
  expect(result.current.items[0]?.sourceResources).toEqual([]);
 });
 it("discards an older search response after a different search starts", async () => {
  let releaseFirst!: (value: unknown) => void;
  const first = new Promise(resolve => { releaseFirst = resolve; });
  const current = { ...widget(), name: "Current" };
  state.get.mockImplementation(async (path: string) => path.endsWith("search=Old") ? first : { status: 200, data:
   path.includes("/catalog") ? catalog : { items: path.endsWith("search=Current") ? [current] : [], nextCursor: null } });
  const { result } = renderHook(() => useWidgets());
  await waitFor(() => expect(result.current.hasLoaded).toBe(true));
  act(() => result.current.setSearchQuery("Old"));
  await waitFor(() => expect(state.get).toHaveBeenCalledWith(expect.stringContaining("search=Old"), expect.anything()));
  act(() => result.current.setSearchQuery("Current"));
  await waitFor(() => expect(result.current.items.map(({ name }) => name)).toEqual(["Current"]));
  await act(async () => { releaseFirst({ status: 200, data: { items: [{ ...widget(), name: "Old" }], nextCursor: null } }); await first; });
  expect(result.current.items.map(({ name }) => name)).toEqual(["Current"]);
 });
 it("does not restore prior rows or catalogue during a retry after read permission denial",async()=>{
  state.get.mockImplementation(async(path:string)=>({status:200,data:path.includes("/catalog")?catalog:{items:[widget()],nextCursor:null}}));
  const {result}=renderHook(()=>useWidgets());
  await waitFor(()=>expect(result.current.items).toHaveLength(1));
  state.get.mockRejectedValue(new TenantApiClientError("denied",{status:403,statusText:"",headers:new Headers(),data:{}}));
  await act(async()=>{await result.current.reload();});
  expect(result.current.queryError?.status).toBe(403);
  state.get.mockReturnValue(new Promise(()=>{}));
  act(()=>{void result.current.reload();});
  expect(result.current.items).toEqual([]);
  expect(result.current.catalog).toBeNull();
 });
 it("does not reuse a recovery read from an older grants scope",async()=>{
  state.post.mockResolvedValue({status:201,data:{id:widget().id},headers:new Headers()});
  const {result,rerender}=renderHook(()=>useWidgets());await waitFor(()=>expect(result.current.isLoading).toBe(false));
  await act(async()=>{await result.current.create(input);});expect(result.current.reviewReady).toBe(true);
  state.user={...state.user,permissions:[...state.user.permissions,"crm.widgets.delete"]};state.get.mockReturnValue(new Promise(()=>{}));rerender();
  expect(result.current.reviewReady).toBe(false);act(()=>result.current.review());expect(result.current.needsReview).toBe(true);
  await act(async()=>{await Promise.resolve();});
 });
});

