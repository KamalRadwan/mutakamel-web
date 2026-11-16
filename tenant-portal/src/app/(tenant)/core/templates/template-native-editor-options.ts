import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { assertPersistedTemplateJson, retainPersistedTemplateJson } from "./template-persisted-json";
import type {
  FormulaFunctionDefinitionV1, FunctionWorkingBodyV1, TemplateDataSchemaV1,
  ValidateTemplateDocumentOptions,
} from '@mutakamel/template-schema/browser-safe';
import type * as Browser from '@mutakamel/template-schema/browser-safe';
import type { TemplateOwnerAdmission } from './template-owner-admission';

type Native = Pick<typeof Browser,'canonicalJson'|'validateDescriptorModel'|'validateTemplateDocumentModel'|'validateTemplateFunctionBody'|
  'collectTemplateFormulaSites'|'collectTemplateFormulaFunctionVersionIds'>;
export const NATIVE_EDITOR_OPTIONS_PAYLOAD_MAX_BYTES=850_000;
export const NATIVE_EDITOR_OPTIONS_ENVELOPE_MAX_BYTES=900_000;
export const NATIVE_EDITOR_OPTIONS_SUCCESS_STATUS=200;
export interface NativeEditorOptionsRequest {
  readonly templateId:string;
  readonly expectedDraftRevision:number;
  readonly expectedContentChecksum:string;
  readonly expectedOwnerContextFingerprint:string;
  readonly functionVersionIds:readonly string[];
  readonly currencyCodes:readonly string[];
  readonly unitCodes:readonly string[];
}
export interface NativeEditorOptionsHost {
  readonly native:Native;
  readonly owner:TemplateOwnerAdmission;
  readonly persistedDocument:unknown;
  readonly source:{readonly templateId:string;readonly draftId:string;readonly draftRevision:number;readonly contentChecksum:string};
  readonly request:NativeEditorOptionsRequest;
  /** Independent approved function release identity, never copied from this response. */
  readonly qualifiedRelease:unknown;
  isCurrent():boolean;
}
export interface BoundNativeEditorOptions {
  readonly fingerprint:string;
  isCurrent():boolean;
  validateTemplateDocumentModel(value:unknown):ReturnType<Native['validateTemplateDocumentModel']>;
}

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SHA=/^[0-9a-f]{64}$/u;
const denied=():ReturnType<Native['validateTemplateDocumentModel']>=>({valid:false,issues:[],bindingPaths:[],assetIds:[]});

/** Separate closed options contract; descriptor-only and stale contexts never produce a provider. */
export async function bindTemplateNativeEditorOptions(payload:unknown,host:NativeEditorOptionsHost):Promise<BoundNativeEditorOptions|null>{
  try{
    if(!host.isCurrent())return null;
    assertPersistedTemplateJson(host.persistedDocument);
    const native={canonicalJson:host.native.canonicalJson,validateDescriptorModel:host.native.validateDescriptorModel,validateTemplateDocumentModel:host.native.validateTemplateDocumentModel,
      validateTemplateFunctionBody:host.native.validateTemplateFunctionBody,collectTemplateFormulaSites:host.native.collectTemplateFormulaSites,
      collectTemplateFormulaFunctionVersionIds:host.native.collectTemplateFormulaFunctionVersionIds};
    if(Object.values(native).some(value=>typeof value!=='function'))return null;
    const owner=detach(host.owner),sourcePin=detach(host.source),request=detach(host.request),
      persistedDocument=detach(host.persistedDocument),qualifiedRelease=detach(host.qualifiedRelease);
    const scopeCurrent=host.isCurrent.bind(host);
    const text=JSON.stringify(payload);if(new TextEncoder().encode(text).byteLength>NATIVE_EDITOR_OPTIONS_PAYLOAD_MAX_BYTES)return null;
    const row=record(JSON.parse(text) as unknown);
    closed(row,['contract','source','ownerContextFingerprint','request','rootFunctionVersionIds','release','versions','membership','issuedAt','expiresAt','fingerprint']);
    if(row.contract!=='template-native-editor-options.v1'||typeof row.fingerprint!=='string'||!SHA.test(row.fingerprint))return null;
    const {fingerprint,...committed}=row;
    if(await digest(native.canonicalJson(committed))!==fingerprint)return null;
    if(native.canonicalJson(row.source)!==native.canonicalJson(sourcePin)||
      native.canonicalJson(row.request)!==native.canonicalJson(normalizeRequest(request))||
      row.ownerContextFingerprint!==owner.fingerprint||
      row.ownerContextFingerprint!==request.expectedOwnerContextFingerprint||
      native.canonicalJson(row.release)!==native.canonicalJson(qualifiedRelease))return null;
    if(request.templateId!==sourcePin.templateId||request.expectedDraftRevision!==sourcePin.draftRevision||
      request.expectedContentChecksum!==sourcePin.contentChecksum)return null;
    if(await digest(native.canonicalJson(persistedDocument))!==sourcePin.contentChecksum||
      await digest(native.canonicalJson(owner.descriptor))!==owner.descriptorCanonicalSha256)return null;
    const release=record(row.release),execution=record(release.executionPackagePins);
    closed(release,['qualifiedManifestSha256','executionPackagePins','compatibleProducerPins','ownerPackagePins']);
    if(typeof release.qualifiedManifestSha256!=='string'||!SHA.test(release.qualifiedManifestSha256)||
      execution.templateSchemaVersion!==owner.pins.schema.version||execution.templateEngineVersion!==owner.pins.engine.version||
      !Array.isArray(release.compatibleProducerPins)||release.compatibleProducerPins.length<1||release.compatibleProducerPins.length>20)return null;
    const issuedAt=instant(row.issuedAt),expiresAt=instant(row.expiresAt),receivedAt=performance.now();
    if(expiresAt-issuedAt!==30_000||issuedAt>Date.now()+5_000||expiresAt<=Date.now())return null;
    const lifetime=Math.min(30_000,expiresAt-Date.now());
    const current=()=>scopeCurrent()&&performance.now()-receivedAt<lifetime&&Date.now()<expiresAt;
    const membership=record(row.membership);closed(membership,['currencyCodes','unitCodes']);
    const currencyCodes=strings(membership.currencyCodes,200,code=>/^[A-Z]{3}$/u.test(code));
    const unitCodes=strings(membership.unitCodes,200,unit);
    const currencies=new Set(currencyCodes),units=new Set(unitCodes);
    const formulaIdentityAuthority={currency:(code:string)=>current()&&currencies.has(code),unit:(code:string)=>current()&&units.has(code)};
    if(!Array.isArray(row.versions)||row.versions.length>20)return null;
    const versions=new Map<string,Record<string,unknown>>();
    const functions:Record<string,FormulaFunctionDefinitionV1>={};
    let previous='';
    for(const value of row.versions){
      const version=record(value);closed(version,['id','functionId','versionNumber','definition','contentChecksum','dependencies','testProof','packagePins']);
      if(typeof version.id!=='string'||!UUID.test(version.id)||version.id<=previous||typeof version.functionId!=='string'||!UUID.test(version.functionId)||
        typeof version.versionNumber!=='number'||!Number.isSafeInteger(version.versionNumber)||version.versionNumber<1||
        typeof version.contentChecksum!=='string'||!SHA.test(version.contentChecksum)||
        await digest(native.canonicalJson(version.definition))!==version.contentChecksum)return null;
      previous=version.id;
      if(!release.compatibleProducerPins.some(pins=>native.canonicalJson(pins)===native.canonicalJson(version.packagePins)))return null;
      const definition=record(version.definition);
      const keys=Object.hasOwn(definition,'description')?['numericPolicy','name','description','parameters','result','expression','tests']:['numericPolicy','name','parameters','result','expression','tests'];
      closed(definition,keys);
      const proof=record(version.testProof);closed(proof,['validationId','passedCount','totalCount','checksum']);
      if(typeof proof.validationId!=='string'||!UUID.test(proof.validationId)||typeof proof.checksum!=='string'||!SHA.test(proof.checksum)||
        !Array.isArray(definition.tests)||proof.passedCount!==definition.tests.length||proof.totalCount!==definition.tests.length)return null;
      const body=definition as unknown as FunctionWorkingBodyV1;
      // Exact projection of the authored immutable body; the actual SDK validates it below.
      functions[version.id]={numericPolicy:body.numericPolicy,parameters:body.parameters,result:body.result,expression:body.expression};
      versions.set(version.id,version);
    }
    const requestedCurrencies=new Set(request.currencyCodes),requestedUnits=new Set(request.unitCodes);
    const scan:unknown[]=[persistedDocument,...[...versions.values()].map(version=>version.definition)];
    let scanned=0;
    while(scan.length){
      const value=scan.pop();if(++scanned>100_000)return null;
      if(!value||typeof value!=='object')continue;
      for(const [key,child] of Object.entries(value)){
        if(key==='currencyCode'&&typeof child==='string')requestedCurrencies.add(child);
        if(key==='unitCode'&&typeof child==='string')requestedUnits.add(child);
        if(child&&typeof child==='object')scan.push(child);
      }
    }
    if(currencyCodes.some(code=>!requestedCurrencies.has(code))||unitCodes.some(code=>!requestedUnits.has(code)))return null;
    const descriptor=owner.descriptor as unknown as TemplateDataSchemaV1;
    native.validateDescriptorModel(descriptor);
    const options:ValidateTemplateDocumentOptions={dataSchema:descriptor,functions,formulaIdentityAuthority};
    const document=persistedDocument as Parameters<Native['collectTemplateFormulaSites']>[0];
    const persisted=native.collectTemplateFormulaSites(document).flatMap(site=>[...native.collectTemplateFormulaFunctionVersionIds(site.expression)]);
    const roots=[...new Set([...persisted,...request.functionVersionIds])].sort();
    if(native.canonicalJson(row.rootFunctionVersionIds)!==native.canonicalJson(roots))return null;
    const visited=new Set<string>(),visiting=new Set<string>(),deepest=new Map<string,number>();
    const visit=(id:string,depth:number):void=>{
      if(depth>8||visiting.has(id))throw new Error('Invalid immutable graph');
      const version=versions.get(id);if(!version)throw new Error('Missing exact function');
      visited.add(id);
      if(visited.size>20)throw new Error('Function closure exceeds limit');
      if((deepest.get(id)??0)>=depth)return;
      deepest.set(id,depth);visiting.add(id);
      const body=record(version.definition) as unknown as FunctionWorkingBodyV1;
      const dependencies=Array.isArray(version.dependencies)?version.dependencies:[];
      if(!Array.isArray(version.dependencies)||dependencies.length>20)throw new Error('Invalid dependencies');
      const direct:string[]=[];
      for(const value of dependencies){
        const dependency=record(value);closed(dependency,['functionVersionId','contentChecksum']);
        if(typeof dependency.functionVersionId!=='string'||!UUID.test(dependency.functionVersionId)||
          dependency.contentChecksum!==versions.get(dependency.functionVersionId)?.contentChecksum)throw new Error('Dependency checksum changed');
        direct.push(dependency.functionVersionId);
      }
      if(native.canonicalJson(direct)!==native.canonicalJson([...new Set(direct)].sort())||
        native.canonicalJson(direct)!==native.canonicalJson([...native.collectTemplateFormulaFunctionVersionIds(body.expression)].sort()))throw new Error('Dependency manifest changed');
      direct.forEach(child=>visit(child,depth+1));visiting.delete(id);
    };
    roots.forEach(id=>visit(id,1));if(visited.size!==versions.size)return null;
    for(const version of versions.values())if(native.validateTemplateFunctionBody(version.definition as FunctionWorkingBodyV1,
      {functions,identityAuthority:formulaIdentityAuthority}).length)return null;
    const admitted=native.validateTemplateDocumentModel(persistedDocument,options);
    if(!admitted.valid||!admitted.document||!current())return null;
    // The complete descriptor is the original authorized JSON; no field-list reconstruction occurs.
    freeze(functions);freeze(descriptor);
    const tuple=['schemaVersion','documentType','outputChannel','layoutMode','dataSourceKey','locale','direction'] as const;
    const source=admitted.document;
    return Object.freeze({fingerprint,isCurrent:current,validateTemplateDocumentModel(value:unknown){
      if(!current())return denied();
      assertPersistedTemplateJson(value);
      const result=native.validateTemplateDocumentModel(value,options);
      if(!current()||!result.valid||!result.document||tuple.some(key=>result.document![key]!==source[key]))return denied();
      return retainPersistedTemplateJson(value,result);
    }});
  }catch{return null;}
}

function normalizeRequest(value:NativeEditorOptionsRequest){return {...value,functionVersionIds:[...value.functionVersionIds].sort(),currencyCodes:[...value.currencyCodes].sort(),unitCodes:[...value.unitCodes].sort()};}
function record(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid native options');return value as Record<string,unknown>;}
function closed(value:Record<string,unknown>,keys:readonly string[]){if(Object.keys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key)))throw new Error('Invalid native options');}
function unit(code:string){return [...code].length>=1&&[...code].length<=200&&code.normalize('NFC')===code&&!/[\p{Cc}\p{Cs}]/u.test(code);}
function strings(value:unknown,max:number,valid:(code:string)=>boolean):string[]{if(!Array.isArray(value)||value.length>max||value.some(code=>typeof code!=='string'||!valid(code))||new Set(value).size!==value.length||value.some((code,index)=>index>0&&value[index-1]>=code))throw new Error('Invalid membership');return value as string[];}
function instant(value:unknown){if(typeof value!=='string')throw new Error('Invalid expiry');const time=Date.parse(value);if(!Number.isFinite(time)||new Date(time).toISOString()!==value)throw new Error('Invalid expiry');return time;}
async function digest(value: string): Promise<string> {
  return bytesToHex(sha256(new TextEncoder().encode(value)));
}
function freeze(value:object){const pending=[value];while(pending.length){const current=pending.pop()!;for(const child of Object.values(current))if(child&&typeof child==='object')pending.push(child);Object.freeze(current);}}

function detach<T>(value:T):T{return JSON.parse(JSON.stringify(value)) as T;}
