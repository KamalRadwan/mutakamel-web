// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWidgetShareGrants } from "./useWidgetShareGrants";
const state=vi.hoisted(()=>({get:vi.fn(),post:vi.fn(),remove:vi.fn(),session:0}));
vi.mock("@/context/AuthContext",()=>({useTenantAuth:()=>({user:{id:"01900100-0000-7000-8000-000000000002",permissions:["crm.widgets.share"]},realtimeAuthGeneration:"share-tests:"+state.session})}));
vi.mock("@/lib/api/axiosClient",async(original)=>({...await original<typeof import("@/lib/api/axiosClient")>(),axiosClient:{get:state.get,post:state.post,delete:state.remove}}));
const ID="01900300-0000-7000-8000-0000000000a1", USER="01900100-0000-7000-8000-000000000003";
const input={subjectType:"USER" as const,subjectId:USER,accessLevel:"VIEW" as const,expiresAt:""};
beforeEach(()=>{state.session++;state.get.mockResolvedValue({status:200,data:[],headers:new Headers()});});
afterEach(()=>{cleanup();vi.resetAllMocks();});
describe("Widget share independent sources and receipts",()=>{
 it("keeps readable shares when the target search fails, and does not call that empty",async()=>{
  const {result}=renderHook(()=>useWidgetShareGrants(ID,true));await waitFor(()=>expect(result.current.isLoading).toBe(false));
  state.get.mockRejectedValueOnce(new Error("picker offline"));
  await act(async()=>{await result.current.searchTargets("Nour");});
  expect(result.current.targetsError).not.toBeNull();expect(result.current.error).toBeNull();expect(result.current.shares).toEqual([]);
 });
 it("reconciles a malformed share receipt once and fences writes until explicit review",async()=>{
  const {result,unmount}=renderHook(()=>useWidgetShareGrants(ID,true));await waitFor(()=>expect(result.current.isLoading).toBe(false));
  state.post.mockResolvedValue({status:201,data:{id:ID},headers:new Headers()});
  await act(async()=>{expect((await result.current.share(input)).uncertain).toBe(true);});
  expect(state.get).toHaveBeenCalledTimes(2);expect(result.current.needsReview).toBe(true);unmount();
  const second=renderHook(()=>useWidgetShareGrants(ID,true));await waitFor(()=>expect(second.result.current.reviewReady).toBe(true));
  await act(async()=>{expect((await second.result.current.share(input)).ok).toBe(false);});
  expect(state.post).toHaveBeenCalledTimes(1);act(()=>second.result.current.review());expect(second.result.current.needsReview).toBe(false);
 });
 it("rejects a past expiry locally before sending or acquiring another write",async()=>{
  const {result}=renderHook(()=>useWidgetShareGrants(ID,true));await waitFor(()=>expect(result.current.isLoading).toBe(false));
  await act(async()=>{const outcome=await result.current.share({...input,expiresAt:"2020-01-01T00:00:00.000Z"});expect(outcome.error?.code).toBe("CRM_SHARE_EXPIRY_INVALID");});
  expect(state.post).not.toHaveBeenCalled();
 });
});

