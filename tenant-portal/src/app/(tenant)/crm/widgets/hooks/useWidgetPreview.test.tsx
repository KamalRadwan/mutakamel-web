// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useWidgetPreview } from "./useWidgetPreview";
const state=vi.hoisted(()=>({post:vi.fn()}));
vi.mock("@/context/AuthContext",()=>({useTenantAuth:()=>({user:{id:"01900100-0000-7000-8000-000000000002",permissions:["crm.dashboards.read.all"]},realtimeAuthGeneration:"preview-tests"})}));
vi.mock("@/lib/api/axiosClient",async(original)=>({...await original<typeof import("@/lib/api/axiosClient")>(),axiosClient:{post:state.post}}));
afterEach(()=>{cleanup();vi.resetAllMocks();});
const input={name:"Count",visualizationType:"METRIC_CARD" as const,querySpec:{series:[{metricKey:"crm.count"}]}};
const receipt=(id="preview")=>({status:201,data:{widgetId:id,shape:"SCALAR",value:4,series:[],meta:{unit:"COUNT",generatedAt:"2026-11-03T08:00:00.000Z",warnings:[]}}});
describe("Unsaved widget previews",()=>{
 it("masks old preview data immediately when the visible draft changes",async()=>{
  state.post.mockResolvedValue(receipt());
  const {result,rerender}=renderHook(({signature})=>useWidgetPreview(signature,true),{initialProps:{signature:"draft A"}});
  await act(async()=>{await result.current.run(input);});expect(result.current.result?.value).toBe(4);
  rerender({signature:"draft B"});expect(result.current.result).toBeNull();
 });
 it("never requests preview without its independent permission",async()=>{
  const {result}=renderHook(()=>useWidgetPreview("draft",false));await act(async()=>{await result.current.run(input);});expect(state.post).not.toHaveBeenCalled();
 });
 it("refuses a result for a different resource",async()=>{
  state.post.mockResolvedValue(receipt("some-saved-widget"));
  const {result}=renderHook(()=>useWidgetPreview("draft",true));await act(async()=>{await result.current.run(input);});
  await waitFor(()=>expect(result.current.error).not.toBeNull());expect(result.current.result).toBeNull();
 });
});

