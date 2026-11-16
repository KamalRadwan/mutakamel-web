import type { CorePath } from '@/lib/api/envelope';
import { corePostResponse } from '../core-api';
import { readTemplateResponse } from './template-wire';
import { bindTemplateNativeEditorOptions, NATIVE_EDITOR_OPTIONS_ENVELOPE_MAX_BYTES, NATIVE_EDITOR_OPTIONS_SUCCESS_STATUS,
  type NativeEditorOptionsHost, type BoundNativeEditorOptions } from './template-native-editor-options';

/** Separate protected, read-only POST contract; it does not alter ownerContext.v1 transport. */
export async function fetchTemplateNativeEditorOptions(host:NativeEditorOptionsHost,signal?:AbortSignal):Promise<BoundNativeEditorOptions|null>{
  if(!host.isCurrent())return null;
  const request=host.request;
  const body={templateId:request.templateId,expectedDraftRevision:request.expectedDraftRevision,
    expectedContentChecksum:request.expectedContentChecksum,expectedOwnerContextFingerprint:request.expectedOwnerContextFingerprint,
    functionVersionIds:[...request.functionVersionIds],currencyCodes:[...request.currencyCodes],unitCodes:[...request.unitCodes]};
  const response=await corePostResponse('/api/tenant/core/v1/templates/functions/editor-context' as CorePath,body,{
    signal,maxResponseBytes:NATIVE_EDITOR_OPTIONS_ENVELOPE_MAX_BYTES,requireExactResponseTarget:true,
  });
  return bindTemplateNativeEditorOptions(readTemplateResponse(response,[NATIVE_EDITOR_OPTIONS_SUCCESS_STATUS]),host);
}
