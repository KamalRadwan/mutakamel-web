/**
 * Localized copy for the admin WebPhone settings screen.
 *
 * Extracted from the page because the server list, every server card and its
 * nested ICE list share it. The shape mirrors the sibling settings pages'
 * inline `COPY` constant.
 */
export const WEBPHONE_COPY = {
  en: {
    title: "WebPhone",
    save: "Save",
    saving: "Saving...",
    saved: "Saved.",
    added: "Added.",
    readOnly:
      "Read-only view. Changes require the admin.webphone.update permission.",
    adding: "Adding...",
    remove: "Remove",
    enabled: "Enabled",
    disabled: "Disabled",
    configured: "Configured",
    notConfigured: "Not configured",
    writeOnly: "Write-only",

    // The screen deliberately holds two save rules. Each one says so, next to
    // the control it governs, rather than being inferred from a nearby button.
    savesInstantly:
      "Saved the moment it changes — this switch has no Save button.",
    savesOnSave: "These fields are saved with the Save button below.",

    serversSection: "SIP servers",
    serversSectionHelp:
      "Tried top to bottom. Drag a server, or use the move buttons, to change the failover order; the order is saved as soon as it changes.",
    serversEmpty: "No SIP server is configured yet.",
    serverRegion: "SIP server",
    serverName: "Name",
    sipDomain: "SIP domain",
    websocketUrl: "WebSocket URL",
    protocol: "Protocol",
    protocolHelp: "Sets the scheme of the WebSocket URL above.",
    serverEnabledLabel: "Server enabled",
    addServer: "Add server",
    addServerHelp:
      "A new server joins the end of the failover chain, disabled and holding placeholder details; fill them in on its card, then drag it higher.",
    newServerName: "New server",
    orderPosition: "Order position",
    moveUp: "Move earlier in the failover order",
    moveDown: "Move later in the failover order",
    dragHandle: "Reorder this server",
    reordering: "Saving the new order...",
    reorderSaved: "The failover order was saved.",
    deleteServerTitle: "Delete this server?",
    deleteServerDescription:
      "The server and its ICE entries are removed. Users whose chain referenced it fall through to the next server.",
    confirmDeleteServer: "Delete server",
    removeServer: "Delete server",
    deleting: "Deleting...",

    basicSection: "Basic",
    basicSectionHelp:
      "The three values that decide whether a browser can reach this server at all.",
    advancedSection: "Advanced",
    advancedSectionHelp:
      "SIP identity, registration, media and ICE, diagnostics, and this server's failover defaults. Most servers never need any of it.",
    showAdvanced: "Show advanced settings",
    hideAdvanced: "Hide advanced settings",

    identitySection: "SIP identity and routing",
    registrationSection: "Registration",
    mediaSection: "Media and ICE",
    diagnosticsSection: "Diagnostics",

    realm: "Authentication realm",
    outboundProxy: "Outbound SIP proxy",
    fromDomain: "From-domain override",
    registrarServer: "Registrar server URI",
    contactUri: "Contact URI override",
    registerExpires: "Registration expiry (seconds)",
    sessionTimers: "SIP session timers",
    traceSip: "Verbose SIP tracing",
    allowInvalidTls: "Allow invalid backend TLS certificate",
    allowInvalidTlsHelp:
      "Documents a backend-proxy capability only. A browser cannot be made to trust an invalid certificate by toggling this.",
    iceTransportPolicy: "ICE transport policy",
    iceTransportPolicyAll: "All (direct and relay)",
    iceTransportPolicyRelay: "Relay only (force TURN)",
    defaultCallerId: "Default caller ID",
    failoverDefaults: "Failover defaults",
    failoverDefaultsHelp:
      "Applied to every user whose chain leaves these blank for this server.",
    defaultTimeoutSeconds: "Default timeout (seconds)",
    defaultMaxRetries: "Default max retries",

    serverIceEnabledLabel: "Use ICE on this server",
    serverIceEnabledHelp:
      "Off means this server offers no STUN or TURN to the browser at all. The entries below are kept exactly as they are and come back the moment it is switched on.",
    serverIceOffNotice:
      "ICE is switched off for this server, so none of the entries below is being used. They are kept as configured; switch ICE on above to use them again.",

    iceSection: "ICE servers",
    iceSectionHelp:
      "STUN and TURN entries for this server. A TURN credential is write-only: it is sent once and never displayed again.",
    iceEmpty: "No ICE server is configured for this server yet.",
    iceKind: "Type",
    iceUrls: "URLs",
    iceUrlsHelp: "One or more stun:, stuns:, turn:, or turns: URIs, comma or space separated.",
    iceUsername: "TURN username",
    iceCredential: "TURN credential (write-only)",
    iceCredentialKeepHelp:
      "Leave blank to keep the stored credential. Typing a value replaces it.",
    iceCredentialState: "Credential",
    iceEnabledLabel: "ICE server enabled",
    iceEntryFields: "Entry details",
    addIceServer: "Add ICE server",
    iceRegion: "ICE server",
    deleteIceTitle: "Delete this ICE entry?",
    deleteIceDescription:
      "The entry is removed from this server. A relay-only server left with no enabled TURN entry will refuse to save until one is restored.",
    confirmDeleteIce: "Delete ICE entry",

    // Control accessible names
    removeIceServer: "Delete ICE entry",
    showCredential: "Show credential",
    hideCredential: "Hide credential",
  },
  ar: {
    title: "الهاتف المرئي",
    save: "حفظ",
    saving: "جارٍ الحفظ...",
    saved: "تم الحفظ.",
    added: "تمت الإضافة.",
    readOnly: "العرض فقط. يتطلب التعديل صلاحية admin.webphone.update.",
    adding: "جارٍ الإضافة...",
    remove: "حذف",
    enabled: "مفعّل",
    disabled: "متوقف",
    configured: "مهيأ",
    notConfigured: "غير مهيأ",
    writeOnly: "للكتابة فقط",

    savesInstantly: "يُحفظ فور تغييره — لا يحتاج هذا المفتاح إلى زر حفظ.",
    savesOnSave: "تُحفظ هذه الحقول بزر الحفظ أدناه.",

    serversSection: "خوادم SIP",
    serversSectionHelp:
      "تُجرَّب من الأعلى إلى الأسفل. اسحب الخادم أو استخدم أزرار النقل لتغيير ترتيب التحويل عند الفشل؛ يُحفظ الترتيب فور تغييره.",
    serversEmpty: "لا يوجد خادم SIP مهيأ بعد.",
    serverRegion: "خادم SIP",
    serverName: "الاسم",
    sipDomain: "نطاق SIP",
    websocketUrl: "رابط WebSocket",
    protocol: "البروتوكول",
    protocolHelp: "يحدد مخطط رابط WebSocket أعلاه.",
    serverEnabledLabel: "تفعيل الخادم",
    addServer: "إضافة خادم",
    addServerHelp:
      "ينضم الخادم الجديد إلى نهاية سلسلة التحويل، متوقفاً وببيانات مبدئية؛ أكمل بياناته في بطاقته ثم اسحبه للأعلى.",
    newServerName: "خادم جديد",
    orderPosition: "موضع الترتيب",
    moveUp: "نقل لأعلى في ترتيب التحويل",
    moveDown: "نقل لأسفل في ترتيب التحويل",
    dragHandle: "إعادة ترتيب هذا الخادم",
    reordering: "جارٍ حفظ الترتيب الجديد...",
    reorderSaved: "تم حفظ ترتيب التحويل.",
    deleteServerTitle: "حذف هذا الخادم؟",
    deleteServerDescription:
      "يُحذف الخادم ومدخلات ICE الخاصة به. المستخدمون الذين تشير سلسلتهم إليه ينتقلون إلى الخادم التالي.",
    confirmDeleteServer: "حذف الخادم",
    removeServer: "حذف الخادم",
    deleting: "جارٍ الحذف...",

    basicSection: "الأساسية",
    basicSectionHelp:
      "القيم الثلاث التي تحدد ما إذا كان المتصفح يستطيع الوصول إلى هذا الخادم أصلاً.",
    advancedSection: "المتقدمة",
    advancedSectionHelp:
      "هوية SIP والتسجيل والوسائط وICE والتشخيص والقيم الافتراضية للتحويل في هذا الخادم. معظم الخوادم لا تحتاج أياً منها.",
    showAdvanced: "إظهار الإعدادات المتقدمة",
    hideAdvanced: "إخفاء الإعدادات المتقدمة",

    identitySection: "هوية SIP والتوجيه",
    registrationSection: "التسجيل",
    mediaSection: "الوسائط وICE",
    diagnosticsSection: "التشخيص",

    realm: "نطاق المصادقة (Realm)",
    outboundProxy: "خادم البروكسي الصادر",
    fromDomain: "تجاوز نطاق From",
    registrarServer: "عنوان خادم التسجيل",
    contactUri: "تجاوز عنوان Contact",
    registerExpires: "مدة صلاحية التسجيل (ثواني)",
    sessionTimers: "مؤقتات جلسة SIP",
    traceSip: "تتبع SIP المفصّل",
    allowInvalidTls: "السماح بشهادة TLS غير صالحة في الخادم الخلفي",
    allowInvalidTlsHelp:
      "يوثّق قدرة في الوسيط الخلفي فقط. لا يمكن جعل المتصفح يثق بشهادة غير صالحة عبر هذا الخيار.",
    iceTransportPolicy: "سياسة نقل ICE",
    iceTransportPolicyAll: "الكل (مباشر وعبر TURN)",
    iceTransportPolicyRelay: "عبر TURN فقط (إجباري)",
    defaultCallerId: "رقم المتصل الافتراضي",
    failoverDefaults: "القيم الافتراضية للتحويل",
    failoverDefaultsHelp:
      "تُطبَّق على كل مستخدم تركها فارغة لهذا الخادم في سلسلته.",
    defaultTimeoutSeconds: "المهلة الافتراضية (ثواني)",
    defaultMaxRetries: "أقصى عدد محاولات افتراضي",

    serverIceEnabledLabel: "استخدام ICE في هذا الخادم",
    serverIceEnabledHelp:
      "الإيقاف يعني ألا يقدّم هذا الخادم أي STUN أو TURN للمتصفح إطلاقاً. تبقى المدخلات أدناه كما هي وتعود فور إعادة التفعيل.",
    serverIceOffNotice:
      "ICE متوقف في هذا الخادم، لذا لا يُستخدم أي من المدخلات أدناه. تبقى محفوظة كما هي؛ فعّل ICE بالأعلى لاستخدامها من جديد.",

    iceSection: "خوادم ICE",
    iceSectionHelp:
      "مدخلات STUN وTURN لهذا الخادم. بيانات اعتماد TURN للكتابة فقط: تُرسل مرة واحدة ولا تُعرض بعدها أبداً.",
    iceEmpty: "لا يوجد خادم ICE مهيأ لهذا الخادم بعد.",
    iceKind: "النوع",
    iceUrls: "العناوين",
    iceUrlsHelp: "عنوان أو أكثر بصيغة stun: أو stuns: أو turn: أو turns:، مفصولة بفاصلة أو مسافة.",
    iceUsername: "اسم مستخدم TURN",
    iceCredential: "بيانات اعتماد TURN (للكتابة فقط)",
    iceCredentialKeepHelp:
      "اتركه فارغاً للإبقاء على القيمة المخزّنة. إدخال قيمة يستبدلها.",
    iceCredentialState: "بيانات الاعتماد",
    iceEnabledLabel: "تفعيل خادم ICE",
    iceEntryFields: "بيانات المدخل",
    addIceServer: "إضافة خادم ICE",
    iceRegion: "خادم ICE",
    deleteIceTitle: "حذف مدخل ICE هذا؟",
    deleteIceDescription:
      "يُحذف المدخل من هذا الخادم. والخادم المضبوط على TURN فقط ولم يبقَ له مدخل TURN مفعّل سيرفض الحفظ حتى يُستعاد واحد.",
    confirmDeleteIce: "حذف مدخل ICE",

    removeIceServer: "حذف مدخل ICE",
    showCredential: "إظهار بيانات الاعتماد",
    hideCredential: "إخفاء بيانات الاعتماد",
  },
} as const;

/**
 * Localizes a field-validation code. Unknown codes fall back to a generic
 * message rather than leaking the raw code into the interface.
 */
export function webphoneFieldErrorText(
  code: string,
  lang: "ar" | "en",
): string {
  const english: Record<string, string> = {
    NAME_REQUIRED: "Give the server a name of up to 64 characters.",
    INVALID_SIP_DOMAIN: "Enter a domain, optionally with a port, up to 253 characters.",
    SIP_DOMAIN_REQUIRED: "A SIP domain is required.",
    INVALID_SIP_URI: "Enter a sip: URI without whitespace, up to 512 characters.",
    INVALID_WS_URL: "Enter a ws:// or wss:// URL without whitespace, up to 512 characters.",
    INVALID_ICE_URLS: "Enter 1 to 8 stun:, stuns:, turn:, or turns: URIs.",
    OUT_OF_RANGE: "Enter a whole number inside the allowed range.",
    TOO_LONG: "This value is longer than the field allows.",
    STUN_HAS_NO_CREDENTIALS: "STUN entries carry no username or credential.",
    TURN_CREDENTIAL_PAIR_REQUIRED: "Supply the TURN username and credential together.",
    RELAY_REQUIRES_TURN:
      "Relay-only transport needs at least one enabled TURN entry on this server, or every call loses its media path.",
    RELAY_REQUIRES_ICE_ENABLED:
      "ICE is switched off for this server, so relay-only transport would leave every call without a media path. Switch ICE on, or choose “All”.",
  };
  if (lang === "en") return english[code] ?? "This value is invalid.";

  const arabic: Record<string, string> = {
    NAME_REQUIRED: "أعطِ الخادم اسماً بحد أقصى 64 حرفاً.",
    INVALID_SIP_DOMAIN: "أدخل نطاقاً، مع منفذ اختياري، بحد أقصى 253 حرفاً.",
    SIP_DOMAIN_REQUIRED: "نطاق SIP مطلوب.",
    INVALID_SIP_URI: "أدخل عنوان sip: بدون مسافات وبحد أقصى 512 حرفاً.",
    INVALID_WS_URL: "أدخل رابط ws:// أو wss:// بدون مسافات وبحد أقصى 512 حرفاً.",
    INVALID_ICE_URLS: "أدخل من 1 إلى 8 عناوين stun: أو stuns: أو turn: أو turns:.",
    OUT_OF_RANGE: "أدخل رقماً صحيحاً ضمن المدى المسموح.",
    TOO_LONG: "القيمة أطول مما يسمح به الحقل.",
    STUN_HAS_NO_CREDENTIALS: "مدخلات STUN لا تحمل اسم مستخدم أو بيانات اعتماد.",
    TURN_CREDENTIAL_PAIR_REQUIRED: "أدخل اسم مستخدم TURN وبيانات الاعتماد معاً.",
    RELAY_REQUIRES_TURN:
      "يتطلب النقل عبر TURN فقط مدخل TURN مفعّلاً واحداً على الأقل في هذا الخادم، وإلا فقدت كل مكالمة مسار الوسائط.",
    RELAY_REQUIRES_ICE_ENABLED:
      "ICE متوقف في هذا الخادم، لذا سيترك النقل عبر TURN فقط كل مكالمة بلا مسار وسائط. فعّل ICE أو اختر «الكل».",
  };
  return arabic[code] ?? "هذه القيمة غير صالحة.";
}

/**
 * Localizes a server error code. The WebPhone module's codes are the ones an
 * operator can act on, so each gets a real sentence; anything else falls back
 * to the code itself so support can still trace it.
 */
export function webphoneErrorText(
  code: string | null | undefined,
  lang: "ar" | "en",
  details?: Record<string, string[]> | null,
): string {
  const safeCode = code ?? "UNKNOWN_ERROR";
  const limit = details?.limit?.[0];

  if (lang === "en") {
    const english: Record<string, string> = {
      WEBPHONE_RELAY_WITHOUT_TURN:
        "Relay-only transport needs ICE switched on for this server and at least one enabled TURN entry, or every call loses its media path.",
      WEBPHONE_LAST_SERVER:
        "This is the last enabled server of an enabled module and cannot be removed.",
      WEBPHONE_SERVER_NOT_FOUND:
        "That server no longer exists. Reload the screen to see the current list.",
      WEBPHONE_SERVER_ORDER_MISMATCH:
        "The server list changed while you were reordering it. Reload and try again.",
      WEBPHONE_SERVER_LIMIT_REACHED: limit
        ? `The maximum number of SIP servers (${limit}) is already configured. Delete one before adding another.`
        : "The maximum number of SIP servers is already configured. Delete one before adding another.",
      WEBPHONE_MODULE_NOT_PURCHASED: "The WebPhone module is not subscribed.",
      WEBPHONE_MODULE_INACTIVE: "The WebPhone subscription is suspended.",
      WEBPHONE_PROVISIONING_PENDING:
        "WebPhone is purchased but its setup is still in progress.",
      WEBPHONE_VALIDATION_FAILED: "Review and correct the highlighted fields.",
      WEBPHONE_UPDATE_PERMISSION_REQUIRED:
        "Changing this requires the admin.webphone.update permission.",
    };
    return (
      english[safeCode] ??
      `The operation could not be completed safely. Error code: ${safeCode}`
    );
  }

  const arabic: Record<string, string> = {
    WEBPHONE_RELAY_WITHOUT_TURN:
      "يتطلب النقل عبر TURN فقط تفعيل ICE في هذا الخادم ووجود مدخل TURN مفعّل واحد على الأقل، وإلا فقدت كل مكالمة مسار الوسائط.",
    WEBPHONE_LAST_SERVER:
      "هذا آخر خادم مفعّل في وحدة مفعّلة ولا يمكن حذفه.",
    WEBPHONE_SERVER_NOT_FOUND:
      "لم يعد هذا الخادم موجوداً. أعد تحميل الشاشة لعرض القائمة الحالية.",
    WEBPHONE_SERVER_ORDER_MISMATCH:
      "تغيّرت قائمة الخوادم أثناء إعادة ترتيبها. أعد التحميل ثم حاول مجدداً.",
    WEBPHONE_SERVER_LIMIT_REACHED: limit
      ? `بلغ عدد خوادم SIP الحد الأقصى المسموح (${limit}). احذف خادماً قبل إضافة آخر.`
      : "بلغ عدد خوادم SIP الحد الأقصى المسموح. احذف خادماً قبل إضافة آخر.",
    WEBPHONE_MODULE_NOT_PURCHASED: "وحدة الهاتف المرئي غير مشترك بها.",
    WEBPHONE_MODULE_INACTIVE: "اشتراك الهاتف المرئي موقوف حالياً.",
    WEBPHONE_PROVISIONING_PENDING:
      "تم شراء الهاتف المرئي لكن تهيئته ما زالت جارية.",
    WEBPHONE_VALIDATION_FAILED: "راجع الحقول المميزة وصحّحها.",
    WEBPHONE_UPDATE_PERMISSION_REQUIRED:
      "يتطلب التغيير صلاحية admin.webphone.update.",
  };
  return (
    arabic[safeCode] ??
    `تعذر إكمال العملية بأمان. رمز الخطأ: ${safeCode}`
  );
}
