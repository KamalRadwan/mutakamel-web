import { describe, expect, it } from "vitest";
import type { DashboardCatalog } from "../dashboards/dashboard-catalog-contract";
import { EMPTY_WIDGET_FORM, buildQuerySpec, buildWidgetUpdate, buildableVisualizations, isSpecEditable, validateWidgetForm, widgetInput, widgetToForm, type WidgetFormState } from "./widget-form";
import { buildCreateWidgetRequest } from "../dashboards/widget-contract";
import { widgetDraftContent } from "./widget-draft-contract";
import { buildWidgetDraft, restoreWidgetEditorDraft } from "./widget-draft-form";
const catalog: DashboardCatalog = {
 gridColumns:12,maxWidgets:20,templates:[],dimensions:[{key:"none",grains:[]},{key:"time",grains:["DAY","WEEK"]},{key:"source",grains:[]}],
 visualizations:[
 {key:"METRIC_CARD",shapes:["SCALAR"],minSeries:1,maxSeries:1,requiresTarget:false,supportsPeriodComparison:true},
 {key:"COLUMN",shapes:["CATEGORY","TIME_SERIES"],minSeries:1,maxSeries:4,requiresTarget:false,supportsPeriodComparison:true,supportsDualAxis:true},
 {key:"MULTI_KPI",shapes:["SCALAR"],minSeries:2,maxSeries:4,requiresTarget:false,supportsPeriodComparison:false,supportsMixedUnits:true},
 {key:"SEMI_CIRCLE_GAUGE",shapes:["SCALAR"],minSeries:1,maxSeries:1,requiresTarget:true,supportsPeriodComparison:false},
 {key:"ALERT_LIST",shapes:["ROWS"],minSeries:1,maxSeries:1,requiresTarget:false,supportsPeriodComparison:false}
 ],
 metrics:[
 {key:"crm.count",nameAr:"عدد",nameEn:"Count",unit:"COUNT",shape:"SCALAR",dimensions:["none"],supportsPeriodComparison:true},
 {key:"crm.snapshot",nameAr:"حالي",nameEn:"Snapshot",unit:"COUNT",shape:"SCALAR",dimensions:["none"],supportsPeriodComparison:false},
 {key:"crm.opportunities.won.estimated_value",nameAr:"فرص رابحة",nameEn:"Won value",unit:"MONEY",shape:"SCALAR",dimensions:["none"],
  supportsPeriodComparison:true,comparisonTypes:["TARGET","GOVERNED_TARGET"]},
 {key:"crm.trend",nameAr:"اتجاه",nameEn:"Trend",unit:"COUNT",shape:"TIME_SERIES",dimensions:["time"],supportsPeriodComparison:true,
  datasetComparison:{bases:["PERIOD","BRANCH"],visualizations:["COLUMN"]}},
 {key:"crm.sources",nameAr:"مصادر",nameEn:"Sources",unit:"COUNT",shape:"CATEGORY",dimensions:["source"],supportsPeriodComparison:true},
 {key:"crm.money",nameAr:"مبلغ",nameEn:"Money",unit:"MONEY",shape:"CATEGORY",dimensions:["source"],supportsPeriodComparison:true},
 {key:"crm.score",nameAr:"نقاط",nameEn:"Score",unit:"SCORE",shape:"CATEGORY",dimensions:["source"],supportsPeriodComparison:true},
 {key:"crm.alerts",nameAr:"تنبيهات",nameEn:"Alerts",unit:"COUNT",shape:"ROWS",rowKind:"ALERT",dimensions:["none"],supportsPeriodComparison:false},
 {key:"crm.ranked",nameAr:"ترتيب",nameEn:"Ranked",unit:"COUNT",shape:"ROWS",rowKind:"RANKED",dimensions:["none"],supportsPeriodComparison:false}
 ]};
const series=(metricKey="crm.count",axis:""|"LEFT"|"RIGHT"="")=>({metricKey,axis,label:"",color:""});
const form=(patch:Partial<WidgetFormState>={}):WidgetFormState=>({...structuredClone(EMPTY_WIDGET_FORM),name:"Leads",visualizationType:"METRIC_CARD",series:[series()],...patch});
describe("advanced widget authoring",()=>{
 it("keeps a governed target through an incomplete draft, then publishes the binding without a literal amount",()=>{
  const branchId="018f0000-0000-7000-8000-000000000001";
  const governedTarget={branchId,subjectId:branchId,subjectType:"BRANCH" as const,currencyCode:"EGP",periodGrain:"MONTH" as const};
  const draft=form({name:"",visualizationType:"SEMI_CIRCLE_GAUGE",series:[series("crm.opportunities.won.estimated_value")],
   comparison:"GOVERNED_TARGET",governedTarget,target:"42"});
  const restored=restoreWidgetEditorDraft(buildWidgetDraft(draft,catalog))!;
  expect(restored.governedTarget).toEqual(governedTarget);
  const valid={...restored,name:"Won value against target"};
  expect(validateWidgetForm(valid,catalog)).toBeNull();
  expect(buildWidgetDraft(valid,catalog).querySpec.comparison).toEqual({type:"GOVERNED_TARGET",governedTarget});
  expect(validateWidgetForm({...valid,filters:{currencyCode:"SAR"}},catalog)).toBe("FILTER_INVALID");
 });

 it("preserves partial controls across draft saves and promotes complete settings to a query spec",()=>{
  const partial=form({visualizationType:"COLUMN",series:[series("crm.trend")],dimensionKey:"time",grain:"WEEK",
   comparison:"DATASETS",datasetBasis:"PERIOD",datasets:[{datePreset:"CUSTOM",dateFrom:"2026-11-01"},{datePreset:"LAST_MONTH"}],
   target:"1.",filters:{currencyCode:"US",limit:"1.",branchId:null},displaySpec:{color:"#F",title:" Draft title "}});
  const saved=buildWidgetDraft(partial,catalog);
  expect(saved.querySpec).toHaveProperty("editorDraft");
  const restored=restoreWidgetEditorDraft(saved)!;
  expect(restored).toEqual(partial);
  const complete={...restored,datasets:[{datePreset:"CUSTOM",dateFrom:"2026-11-01",dateTo:"2026-11-10"},{datePreset:"LAST_MONTH"}],
   filters:{currencyCode:"USD",limit:"10"},displaySpec:{color:"#FFFFFF"}};
  const ready=buildWidgetDraft(complete,catalog);
  expect(ready.querySpec).not.toHaveProperty("editorDraft");
  expect(ready.querySpec).toMatchObject({series:[{metricKey:"crm.trend"}],filters:{currencyCode:"USD",limit:10}});
 });

 it("does not restore an unknown saved-editor representation over an existing definition",()=>{
  const saved=buildWidgetDraft(form({name:""}),catalog);
  expect(()=>restoreWidgetEditorDraft({...saved,querySpec:{...saved.querySpec,series:[]}})).toThrow();
  expect(()=>restoreWidgetEditorDraft({...saved,querySpec:{editorDraft:{version:2}}})).toThrow();
 });

 it("round-trips explicit comparison datasets and rejects duplicate or unsupported selections",()=>{
  const draft=form({visualizationType:"COLUMN",series:[series("crm.trend")],dimensionKey:"time",grain:"WEEK",
   comparison:"DATASETS",datasetBasis:"PERIOD",datasets:[{datePreset:"LAST_MONTH"},{datePreset:"CURRENT_MONTH"},{datePreset:"LAST_QUARTER"}]});
  expect(validateWidgetForm(draft,catalog)).toBeNull();
  const input=widgetInput(draft);
  expect(isSpecEditable(input.querySpec)).toBe(true);
  expect(buildQuerySpec(widgetToForm(input)).comparison).toEqual(input.querySpec.comparison);
  expect(validateWidgetForm({...draft,datasets:[{datePreset:"LAST_MONTH"},{datePreset:"LAST_MONTH"}]},catalog)).toBe("DATASETS_INVALID");
  expect(validateWidgetForm({...draft,series:[series("crm.trend"),series("crm.trend")]},catalog)).toBe("COMPARISON_UNSUPPORTED");
 });
 it("distinguishes inherited comparison from an explicitly disabled stored comparison",()=>{
  const stored={name:"Leads",visualizationType:"METRIC_CARD" as const,querySpec:{series:[{metricKey:"crm.count"}],comparison:{type:"NONE" as const}},displaySpec:{}};
  const disabled=widgetToForm(stored);
  expect(disabled.comparison).toBe("NONE");
  expect(buildQuerySpec(disabled).comparison).toEqual({type:"NONE"});
  expect(buildWidgetUpdate({...disabled,name:"Renamed"},stored)).toEqual({name:"Renamed"});
  const changed={...disabled,series:[series("crm.snapshot")]};
  expect(buildWidgetUpdate(changed,stored).querySpec?.comparison).toEqual({type:"NONE"});
  const inherited=widgetToForm({...stored,querySpec:{series:[{metricKey:"crm.count"}]}});
  expect(inherited.comparison).toBe("INHERIT");
  expect(buildQuerySpec(inherited)).not.toHaveProperty("comparison");
  expect(buildWidgetUpdate({...disabled,comparison:"INHERIT"},stored).querySpec).not.toHaveProperty("comparison");
  expect(buildWidgetUpdate({...inherited,comparison:"NONE"},{...stored,querySpec:{series:[{metricKey:"crm.count"}]}}).querySpec?.comparison).toEqual({type:"NONE"});
 });
 it("canonicalizes proven trimmed display fields for create and update without changing scalar options",()=>{
  const display={title:" Sales chart ",subtitle:" Period summary ",options:{customScalar:" keep spaces "}};
  const input=widgetInput(form({displaySpec:display}));
  expect(input.displaySpec).toEqual({title:"Sales chart",subtitle:"Period summary",options:display.options});
  expect(buildCreateWidgetRequest({...input,displaySpec:display}).displaySpec).toEqual(input.displaySpec);
  expect(widgetDraftContent({...input,displaySpec:display}).displaySpec).toEqual(input.displaySpec);
  const stored={name:"Leads",visualizationType:"METRIC_CARD" as const,querySpec:input.querySpec,displaySpec:input.displaySpec};
  expect(buildWidgetUpdate({...widgetToForm(stored),name:"Renamed",displaySpec:display},stored)).toEqual({name:"Renamed"});
 });
 it("offers the full server catalogue, including multi-series visualizations",()=>expect(buildableVisualizations(catalog).map(v=>v.key)).toContain("MULTI_KPI"));
 it("enforces visualization series bounds",()=>{
  expect(validateWidgetForm(form({visualizationType:"MULTI_KPI"}),catalog)).toBe("SERIES_INVALID");
  expect(validateWidgetForm(form({visualizationType:"MULTI_KPI",series:[series(),series()]}),catalog)).toBeNull();
  expect(validateWidgetForm(form({series:[series(),series()]}),catalog)).toBe("SERIES_INVALID");
 });
 it("refuses incompatible shapes and row contracts",()=>{
  expect(validateWidgetForm(form({visualizationType:"COLUMN",dimensionKey:"none"}),catalog)).toBe("SHAPE_INVALID");
  expect(validateWidgetForm(form({visualizationType:"ALERT_LIST",series:[series("crm.ranked")]}),catalog)).toBe("SHAPE_INVALID");
  expect(validateWidgetForm(form({visualizationType:"ALERT_LIST",series:[series("crm.alerts")]}),catalog)).toBeNull();
 });
 it("requires axes for two units and refuses more than two",()=>{
  const mixed=form({visualizationType:"COLUMN",dimensionKey:"source",series:[series("crm.sources"),series("crm.money")]});
  expect(validateWidgetForm(mixed,catalog)).toBe("AXIS_REQUIRED");
  expect(validateWidgetForm({...mixed,series:[series("crm.sources","LEFT"),series("crm.money","RIGHT")]},catalog)).toBeNull();
  expect(validateWidgetForm({...mixed,series:[series("crm.sources","LEFT"),series("crm.money","RIGHT"),series("crm.score","RIGHT")]},catalog)).toBe("UNITS_INVALID");
 });
 it("requires every metric to support comparison",()=>{
  expect(validateWidgetForm(form({visualizationType:"MULTI_KPI",series:[series(),series("crm.snapshot")],comparison:"PREVIOUS_PERIOD"}),catalog)).toBe("COMPARISON_UNSUPPORTED");
 });
 it("requires real time grains and finite targets >= 0.000001",()=>{
  expect(validateWidgetForm(form({visualizationType:"COLUMN",series:[series("crm.trend")],dimensionKey:"time",grain:""}),catalog)).toBe("GRAIN_REQUIRED");
  for(const target of ["","0","-1","Infinity","0.0000001"]) expect(validateWidgetForm(form({visualizationType:"SEMI_CIRCLE_GAUGE",comparison:"TARGET",target}),catalog)).toBe("TARGET_INVALID");
  expect(validateWidgetForm(form({visualizationType:"SEMI_CIRCLE_GAUGE",comparison:"TARGET",target:"25"}),catalog)).toBeNull();
 });
 it("blocks visible invalid filters, style and display values",()=>{
  expect(validateWidgetForm(form({filters:{limit:"abc"}}),catalog)).toBe("FILTER_INVALID");
  expect(validateWidgetForm(form({filters:{datePreset:"CUSTOM",dateFrom:"2026-11-04",dateTo:"2026-11-01"}}),catalog)).toBe("FILTER_INVALID");
  expect(validateWidgetForm(form({series:[{...series(),color:"blue"}]}),catalog)).toBe("SERIES_STYLE_INVALID");
  expect(validateWidgetForm(form({displaySpec:{color:"bad"}}),catalog)).toBe("DISPLAY_INVALID");
 });
 it("preserves all advanced settings and omits query/display for a name-only edit",()=>{
  const stored={name:"Sources",visualizationType:"COLUMN" as const,querySpec:{series:[{metricKey:"crm.sources",axis:"LEFT" as const,label:"Count",color:"#123456"},{metricKey:"crm.money",axis:"RIGHT" as const}],dimension:{key:"source"},filters:{compare:"NONE",limit:20}},displaySpec:{title:"Source performance",options:{showValues:true,customScalar:"retained"}}};
  const draft=widgetToForm(stored); expect(isSpecEditable(stored.querySpec,stored.displaySpec)).toBe(true);
  expect(buildQuerySpec(draft)).toEqual(stored.querySpec);
  expect(buildWidgetUpdate({...draft,name:"Renamed"},stored)).toEqual({name:"Renamed"});
  const edited={...draft,displaySpec:{...draft.displaySpec,title:"Changed"}};
  expect(buildWidgetUpdate(edited,stored).displaySpec?.options).toEqual(stored.displaySpec.options);
 });
 it("keeps retired and unknown query formats at a safe boundary",()=>{
  const spec={series:[{metricKey:"crm.count"}]};
  expect(isSpecEditable({...spec,engine:"SEMANTIC_V1"})).toBe(false);
  expect(isSpecEditable({...spec,topN:10})).toBe(false);
  expect(isSpecEditable({...spec,filters:{unexpected:"value"}})).toBe(false);
  expect(isSpecEditable(spec)).toBe(true);
 });
});

