"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { getStoredTenantSessionMeta } from "@/lib/api/axiosClient";
import { can } from "@/lib/auth/permission-scope";
import { subscribeToTenantAuthEvents } from "@/lib/auth/sessionCoordinator";
import { invalidCoreResponse } from "../../../contracts/core-page";
import { fetchTemplate } from "../../templates-api";
import { fetchTemplateDataSchema } from "../../template-design-api";
import { TEMPLATE_PREVIEW_PERMISSION, type TemplateDetail } from "../../templates-contract";
import { classifyPreviewFailure, supportsCurrentPdfPreview, type PreviewPreparationFailure } from "../../template-preview-availability";
import type { TemplatePdfSessionInput } from "./useTemplatePdfSession";

export interface TemplateDetailPdfPortInput {
  template: TemplateDetail; canPreview: boolean; reload: () => void;
  draftPdfRecovery?: TemplatePdfSessionInput["draftPdfRecovery"];
}
function tuple(template: TemplateDetail) {
  return JSON.stringify([template.id,template.dataSourceKey,template.documentType,template.outputChannel,template.layoutMode,
    template.locale,template.direction,template.scope.type,template.scope.companyId??null,template.scope.branchId??null]);
}

/** Detail preview has an actual server source pin, not an invented editor/document store. */
export function useTemplateDetailPdfPort(input: TemplateDetailPdfPortInput): TemplatePdfSessionInput {
  const { template, canPreview }=input;
  const { authState,user,realtimeAuthGeneration }=useTenantAuth();
  const target=template.scope.type==="TENANT"?{tenantWide:true}:{companyId:template.scope.companyId,
    ...(template.scope.type==="BRANCH"?{branchId:template.scope.branchId}:{})};
  const allowed=canPreview&&authState==="AUTHENTICATED"&&can(user,TEMPLATE_PREVIEW_PERMISSION,target);
  const [retry,setRetry]=useState(0);
  const key=JSON.stringify([tuple(template),template.definitionRevision,template.currentDraft.draftId,template.currentDraft.revision,
    template.currentDraft.etag,template.currentDraft.contentChecksum,authState,user?.id,realtimeAuthGeneration,allowed,retry]);
  const owner=useMemo(()=>({key}),[key]);
  const live=useRef<object|null>(null),io=useRef<AbortController|null>(null),latest=useRef(input);
  const [state,setState]=useState<{owner:object;template:TemplateDetail|null;schema:TemplatePdfSessionInput["schema"];error:PreviewPreparationFailure|null}|null>(null);
  const current=useCallback(()=>{
    const sessionId=getStoredTenantSessionMeta()?.sessionId;
    return live.current===owner&&allowed&&Boolean(sessionId&&user?.id)&&
      realtimeAuthGeneration===`tenant:${sessionId}:${user?.id}`;
  },[owner,allowed,user?.id,realtimeAuthGeneration]);
  useLayoutEffect(()=>{latest.current=input;});
  useLayoutEffect(()=>{
    live.current=owner;
    const unsubscribe=subscribeToTenantAuthEvents(event=>{
      const same=realtimeAuthGeneration===`tenant:${event.sessionId}:${user?.id}`;
      if(event.kind==="session-ended"?same:!same){
        live.current=null;io.current?.abort();setState({owner,template:null,schema:null,error:"denied"});
      }
    });
    return()=>{unsubscribe();live.current=null;io.current?.abort();};
  },[owner,realtimeAuthGeneration,user?.id]);
  useEffect(()=>{
    if(!allowed||!supportsCurrentPdfPreview(template))return;
    const controller=new AbortController();io.current=controller;
    const load=async()=>{
      if(!current())return;
      try{
        const fresh=await fetchTemplate(template.id,controller.signal);
        if(controller.signal.aborted)return;
        if(!current()){if(live.current===owner)setState({owner,template:null,schema:null,error:"denied"});return;}
        if(tuple(fresh)!==tuple(template))invalidCoreResponse();
        if(fresh.currentDraft.draftId!==template.currentDraft.draftId||fresh.currentDraft.revision!==template.currentDraft.revision||
          fresh.currentDraft.etag!==template.currentDraft.etag){setState({owner,template:null,schema:null,error:"stale"});return;}
        if(fresh.currentDraft.contentChecksum!==template.currentDraft.contentChecksum||!/^[a-f0-9]{64}$/u.test(fresh.currentDraft.contentChecksum))invalidCoreResponse();
        const schema=await fetchTemplateDataSchema(fresh.dataSourceKey,fresh.scope,controller.signal);
        if(controller.signal.aborted)return;
        if(!current()){if(live.current===owner)setState({owner,template:null,schema:null,error:"denied"});return;}
        setState({owner,template:fresh,schema,error:null});
      }catch(error){
        if(!controller.signal.aborted&&live.current===owner)setState({owner,template:null,schema:null,error:current()?classifyPreviewFailure(error):"denied"});
      }
    };
    void load();return()=>controller.abort();
  },[owner,allowed,template,current]);
  const visible=state?.owner===owner?state:null,fresh=visible?.template;
  const reload=useCallback(()=>{latest.current.reload();if(current())setRetry(value=>value+1);},[current,setRetry]);
  const reloadInvalidPreparation = useCallback(() => { if (current()) latest.current.reload(); }, [current]);
  return{template:fresh??template,
    draft:fresh?{templateId:fresh.id,draftId:fresh.currentDraft.draftId,revision:fresh.currentDraft.revision}:null,
    schema:visible?.schema??null,canPreview:allowed,blocked:false,current,reload,reloadInvalidPreparation,lifetime:owner,
    draftPdfRecovery:input.draftPdfRecovery,
    preparation:visible?.error??(fresh?undefined:"preparing")};
}
