# Template data authoring

The T15 eligibility-r3 bindings source is applied on Main as of 10 November 2026. The bindings controls require a qualified native host. Native adapter application and runtime qualification remain pending.

The eligibility-r3 successor exports `createDataEligibilityPort(host)` and `DataEligibilityContext` for shared currency/reference options. Candidates require the complete current qualified descriptor and actual native validation/inference. Currency candidates are probed in existing current document value slots; no owner values or schema fields are fabricated. T19 optional-currency-r3 therefore admits its legitimate nullable CURRENCY/EMPTY/explicit-code display pair without making nullable MONEY/UNIT_PRICE or formula currency references valid. The no-explicit-code option appears only when native admission allows it. Receipt callbacks recheck current descriptor/source/owner/selection/native/identity/read-only/lock state. BindingPicker/CellValuePicker use the same port; T02's sibling format controls require their owner's explicit port/provider consumption. Existing paths are preserved for repair when qualification or a suitable slot is unavailable.

The successor composes the actual T02 successor-r3 published ports through `createInspectorDataPorts` and `createInspectorDataValidator`. A qualified host supplies live `bridge/readCatalogue/readNative/readSourceFingerprint` getters. The fingerprint is the already implemented T03 R6 `admission.fingerprint`, exposed only after T04 parsing, bundled browser identity verification and current-owner admission. The host never synthesizes it from the field list. R6's `admission.descriptor` is the genuine source candidate that resolves the older wire gap described below. It has not been represented here as adopted/live. The host recreates these integration objects when owner/source/native/identity qualification changes; it preserves the existing canonical store and T02's property draft/Apply/Undo.

BindingPicker omits its own format section because T02 retains standalone binding formats. CellValuePicker supplies text/binding/formula values and formats for the whole delegated cell region. It derives the dynamic row source from the selected actual canonical table and checks exact field-projection equality against the full descriptor. It does not claim future header/footer-band contexts. Port changes stage locally; detached callbacks and late scope/read-only/source/native/identity changes are rejected. Native and Radix controls receive explicit disabled state. Full server descriptor/function/unit contracts and the bounded independent T02 review are delivered alongside this successor packet.

When mounted by a qualified host, `TemplateBindingDialog` supplies the centered data/formula editor. Its content unmounts on close; typing remains local. Apply validates the complete edited document with the actual native schema and commits one document command through the existing canonical bridge. Reopen reads that same store. The existing T01 Save/receipt/recovery path remains responsible for durable storage. No new persistence endpoint or alternate authored store exists.

The current descriptor must come from the authorized owner context and contain the native `TemplateDataSchemaV1`, including key/version/checksum, field nullability/encoding, format eligibility and decimal dimensions. Its tuple must match the document. The catalogue carries the current tenant ID/company ID and session/scope authority key. Changing authority hides the retained local form; an obsolete catalogue cannot authorize Apply. `canEdit`, `readOnly`, selected identity, generation, node preimage, catalogue pins, gestures and locked ancestry are rechecked at the command boundary. The bridge subscription must publish both canonical document and selection/authority changes.

Field groups, counts and search results derive from the current descriptor. Arrays, objects, images and out-of-context row paths cannot become scalar text. Machine paths stay visible as exact LTR identifiers; localized human field names require the owner's label-key dictionary, which the current Portal does not provide. Root and row scopes remain distinct. Controlled `BindingEditor` accepts a row source path for T02's dynamic table editor; `FormulaEditor` supports `ROOT_BINDING`, `ROW_BINDING` and `SUM_ROWS` when its caller supplies that exact context and enables collection grammar. T02 must validate its complete table through its canonical Apply boundary.

The formula editor builds the closed native AST. It supports literals, registered bindings, existing formula references, exact immutable function calls, numeric/string/date operations and conditional values. Parameter expressions are owned by the separate function-definition editor; no free parameter input is offered in a template. Decimal values remain strings, including values beyond JavaScript's safe integer range. Numeric scale/rounding fields use numbers because the native grammar explicitly declares integer controls. Literal currency/unit identities require current owner membership authority; no unit registry, conversion, financial fact or grant is created here.

Immutable function results must include `id`, `functionId`, `versionNumber`, `contentChecksum`, exact tenant/company scope and the real definition. Summary-only rows are insufficient. The immutable owner definition is projected into the native closed inference shape (`numericPolicy`, `parameters`, `result`, `expression`); the complete owner body/version/checksum stays pinned in the local editing session. The owner service/compiler remains authoritative for version authenticity, dependencies, revocation, package pins and publication. A newer version never rewrites an existing call.

Exact authored locations are:

| Value | Canonical location |
| --- | --- |
| Data field + null/format behavior | `nodes[nodeId].binding.path/nullBehavior/fallback/format` |
| Formula | `nodes[nodeId].props.expression` |
| Immutable function version | AST `FUNCTION_CALL.functionVersionId`, plus named argument expressions |
| Unit and currency literals | AST `DECIMAL_LITERAL.unitCode/currencyCode/dimension` |
| Source dimensions | Registered descriptor field `dimension.currencyPath/unitPath`; never inferred from a label |
| Conditional visibility | `nodes[nodeId].visibilityExpression` |
| Rich text variable | `props.document` paragraph inline `type=variable`, `attrs.binding` |
| Link/button label tokens | `props.label.segments` |

No undocumented pin property is added to the schema. Schema checksum/version and function checksums are displayed and guarded in the open form; the existing owner draft/publication/compiled-manifest records own durable metadata pins. Rich text marks, list structure, paragraph alignment, unrelated nodes and document metadata are retained. Legacy visibility stays intact until an explicit replacement/clear. Predicate comparisons retain the registered source type; decimal comparisons keep exact text.

Missing/retired fields and unknown versions require explicit repair. Unavailable catalogue metadata closes this dialog, while unrelated document editing remains with T01. Native diagnostics are converted into bilingual safe messages; arbitrary thrown text is not displayed. There is no JS/eval or executable expression text input.

## Required owner integration

1. T03/T04: the current Core schema response omits `dimension`, forces previewAllowed and defaults encoding, while the Portal parser keeps only path/type/formats. Supply a genuinely complete native descriptor and its exact tenant/company authority. Do not reconstruct it from the lossy projection or synthetic fixtures.
2. Main has `@mutakamel/template-schema@0.0.9-t12-union.1` installed. Its browser-safe entry exports `validateDescriptorModel` and the existing native parser, inference and model validation methods. Provider mounting, bundled browser identity verification and actual owner admission remain pending. The source-test loader remains limited to test tooling.
3. T03/T05/T04: provide owner-authorized immutable function version bodies (including transitive versions where required). No function-detail/version endpoint or unit catalogue endpoint is invented by this UI.
4. T01: mount the dialog in Variables/Formulas and provide current authority and canonical bridge; T02 can consume the controlled editors for table/cell properties. The qualified native adapter requires a separate application lease.
5. Predicate test-data preview remains an engine/browser-owner dependency: current `prepareTypedVisibility` is tied to compiled Handlebars artifacts and is not a qualified browser predicate evaluator. The editor validates predicates but does not fake visibility preview results. Authenticated browser/RTL/theme/reference comparison and actual backend save/reload remain pending.

`PENDING: node scripts/rebuild-portal.mjs tenant` after an approved integration and runtime baseline. No package, lockfile, config, server, DB or deployment changes are included.
