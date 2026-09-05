/**
 * Localized copy for the tenant WebPhone settings screen.
 *
 * The screen is always rendered, so this includes copy for the three distinct
 * unavailable states. "You did not buy this", "your system is still being set
 * up", and "your subscription is suspended" are three different conversations
 * with a customer, and collapsing them into one sentence produces a support
 * ticket that cannot be answered from the screen alone.
 */
export const WEBPHONE_COPY = {
  en: {
    title: "WebPhone",
    subtitle:
      "The SIP servers your team registers against, in failover order, and the extensions they call from. Credentials are write-only: they are stored encrypted and never returned.",
    save: "Save configuration",
    readOnly:
      "Read-only view. Changes require the webphone.settings.update permission.",
    extensionsReadOnly:
      "Read-only view. Managing extensions requires the webphone.extensions.manage permission.",
    noReadPermission:
      "You do not have permission to view WebPhone settings. Ask an administrator for the webphone.settings.read permission.",
    retry: "Retry",
    reload: "Reload",
    loading: "Loading WebPhone settings...",
    loadFailed:
      "WebPhone settings could not be loaded. Nothing was saved and you can retry safely.",
    adding: "Adding...",
    remove: "Remove",
    enable: "Enable",
    disable: "Disable",
    enabled: "Enabled",
    disabled: "Disabled",
    configured: "Configured",
    notConfigured: "Not configured",

    unavailableHeading: "WebPhone is not available on this workspace",
    notPurchasedTitle: "WebPhone is not part of your subscription",
    notPurchasedBody:
      "This screen shows what WebPhone would configure. Add the module to your subscription to turn it on; nothing here can be changed until then.",
    provisioningPendingTitle: "WebPhone is being set up",
    provisioningPendingBody:
      "The module is purchased and its installation is still running. The controls unlock on their own once setup finishes — no action is needed from you.",
    suspendedTitle: "Your WebPhone subscription is suspended",
    suspendedBody:
      "Existing phones keep working and stay visible, but nothing can be changed until the subscription is reactivated. Settle the outstanding balance or contact support to restore it.",
    disabledControlsNote: "Every control on this screen is unavailable.",

    serversSection: "SIP servers",
    serversSectionHelp:
      "Tried in the order shown, top first. Drag a card, or use its move buttons, to change the failover order.",
    serversEmpty: "No SIP server is configured yet.",
    serverRegion: "SIP server",
    serverName: "Server name",
    serverEnabledLabel: "Server enabled",
    sipDomain: "SIP domain",
    websocketUrl: "WebSocket URL",
    serverProtocol: "Protocol",
    serverProtocolHelp:
      "Writes the scheme of the WebSocket URL. There is no separate protocol setting.",
    position: "Position",
    dragHandle: "Drag to reorder",
    moveEarlier: "Move earlier",
    moveLater: "Move later",
    savingOrder: "Saving the order...",
    addServer: "Add server",
    toggleServerOn: "Enable server",
    toggleServerOff: "Disable server",
    removeServer: "Remove server",
    deleteServerTitle: "Remove this server?",
    deleteServerMessage:
      "The server and its ICE entries are removed, and the rest of the chain is renumbered. Extensions are not deleted.",
    confirmDeleteServer: "Remove server",
    deleting: "Removing...",

    advancedSettings: "Advanced settings",
    advancedSettingsHelp:
      "Registration, identity and diagnostics for this server. Every field has a working default.",
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
    defaultTimeoutSeconds: "Registration timeout (seconds)",
    defaultMaxRetries: "Attempts before moving to the next server",

    iceSection: "ICE servers",
    iceSectionHelp:
      "NAT traversal for this server only — a relay is reachable inside its own network. A TURN credential is write-only: it is sent once and never displayed again.",
    iceEmpty: "No ICE server is configured for this server yet.",
    iceKind: "Kind",
    iceUrls: "URLs",
    iceUrlsHelp:
      "One or more stun:, stuns:, turn:, or turns: URIs, comma or space separated.",
    iceUsername: "TURN username",
    iceCredential: "TURN credential (write-only)",
    iceCredentialKeepHelp:
      "Leave blank to keep the stored credential. Typing a value replaces it.",
    iceCredentialState: "Credential",
    iceEnabledLabel: "ICE server enabled",
    addIceServer: "Add ICE server",
    iceRegion: "ICE server",
    toggleIceOn: "Enable ICE server",
    toggleIceOff: "Disable ICE server",
    removeIceServer: "Remove ICE server",

    extensionsSection: "Extensions",
    extensionsSectionHelp:
      "Each enabled extension occupies one seat from your subscription.",
    extensionsEmpty: "No extension exists yet.",
    ownerId: "Owner user ID",
    extension: "Extension",
    sipUsername: "SIP username",
    sipPassword: "SIP password (write-only)",
    sipPasswordKeepHelp:
      "Leave blank to keep the stored password. Typing a value replaces it.",
    passwordState: "Password",
    displayName: "Display name",
    outboundCallerId: "Outbound caller ID",
    transport: "Transport",
    extensionEnabledLabel: "Extension enabled",
    addExtension: "Add extension",
    extensionRegion: "Extension",
    deleteExtensionTitle: "Delete this extension?",
    deleteExtensionMessage:
      "The extension is deleted and its seat is released. The configuration is retained.",
    confirmDelete: "Delete extension",
    cancel: "Cancel",

    seatsSection: "Seats",
    seatsHeading: "Your WebPhone seats",
    seatsUnavailable: "Seat usage is unavailable while WebPhone is off.",
    seatsAllowed: "Allowed",
    seatsOccupied: "Occupied",
    seatsAvailable: "Available",
    overAllowance: "Over allowance",
    overAllowanceBy: "over allowance",
    overAllowanceExplanation:
      "More phones are enabled than your subscription allows. Reducing seats never switches off a working phone, so this state is expected — no new phone can be enabled until it is resolved.",
    seatsWithinAllowance: "Within allowance",

    toggleExtensionOn: "Enable extension",
    toggleExtensionOff: "Disable extension",
    removeExtension: "Delete extension",
    showCredential: "Show credential",
    hideCredential: "Hide credential",
    showPassword: "Show password",
    hidePassword: "Hide password",
  },
  ar: {
    title: "الهاتف المرئي",
    subtitle:
      "خوادم SIP التي يسجّل عليها فريقك، بترتيب التحويل عند الفشل، والامتدادات التي يتصل منها. بيانات الاعتماد للكتابة فقط: تُخزَّن مشفّرة ولا تُعاد أبداً.",
    save: "حفظ الإعدادات",
    readOnly: "العرض فقط. يتطلب التعديل صلاحية webphone.settings.update.",
    extensionsReadOnly:
      "العرض فقط. تتطلب إدارة الامتدادات صلاحية webphone.extensions.manage.",
    noReadPermission:
      "لا تملك صلاحية عرض إعدادات الهاتف المرئي. اطلب من المسؤول صلاحية webphone.settings.read.",
    retry: "إعادة المحاولة",
    reload: "إعادة التحميل",
    loading: "جارٍ تحميل إعدادات الهاتف المرئي...",
    loadFailed:
      "تعذر تحميل إعدادات الهاتف المرئي. لم يُحفظ أي شيء ويمكنك إعادة المحاولة بأمان.",
    adding: "جارٍ الإضافة...",
    remove: "حذف",
    enable: "تفعيل",
    disable: "إيقاف",
    enabled: "مفعّل",
    disabled: "متوقف",
    configured: "مهيأ",
    notConfigured: "غير مهيأ",

    unavailableHeading: "الهاتف المرئي غير متاح في مساحة العمل هذه",
    notPurchasedTitle: "الهاتف المرئي ليس ضمن اشتراكك",
    notPurchasedBody:
      "تعرض هذه الشاشة ما يمكن للهاتف المرئي ضبطه. أضف الوحدة إلى اشتراكك لتفعيلها؛ لا يمكن تغيير أي شيء هنا قبل ذلك.",
    provisioningPendingTitle: "جارٍ تهيئة الهاتف المرئي",
    provisioningPendingBody:
      "تم شراء الوحدة وما زال تنصيبها جارياً. ستُفتح عناصر التحكم تلقائياً عند اكتمال التهيئة، ولا يلزمك أي إجراء.",
    suspendedTitle: "اشتراك الهاتف المرئي موقوف",
    suspendedBody:
      "تظل الهواتف الحالية تعمل وتبقى ظاهرة، لكن لا يمكن تغيير أي شيء حتى إعادة تفعيل الاشتراك. سدّد المستحقات أو تواصل مع الدعم لاستعادته.",
    disabledControlsNote: "كل عناصر التحكم في هذه الشاشة غير متاحة.",

    serversSection: "خوادم SIP",
    serversSectionHelp:
      "تُجرَّب بالترتيب المعروض، الأعلى أولاً. اسحب البطاقة أو استخدم أزرار النقل فيها لتغيير ترتيب التحويل عند الفشل.",
    serversEmpty: "لا يوجد خادم SIP مهيأ بعد.",
    serverRegion: "خادم SIP",
    serverName: "اسم الخادم",
    serverEnabledLabel: "تفعيل الخادم",
    sipDomain: "نطاق SIP",
    websocketUrl: "رابط WebSocket",
    serverProtocol: "البروتوكول",
    serverProtocolHelp: "يكتب مخطط رابط WebSocket. لا يوجد إعداد بروتوكول منفصل.",
    position: "الترتيب",
    dragHandle: "اسحب لإعادة الترتيب",
    moveEarlier: "نقل إلى الأعلى",
    moveLater: "نقل إلى الأسفل",
    savingOrder: "جارٍ حفظ الترتيب...",
    addServer: "إضافة خادم",
    toggleServerOn: "تفعيل الخادم",
    toggleServerOff: "إيقاف الخادم",
    removeServer: "حذف الخادم",
    deleteServerTitle: "حذف هذا الخادم؟",
    deleteServerMessage:
      "يُحذف الخادم ومعه مدخلات ICE الخاصة به، ويُعاد ترقيم بقية السلسلة. لا تُحذف الامتدادات.",
    confirmDeleteServer: "حذف الخادم",
    deleting: "جارٍ الحذف...",

    advancedSettings: "إعدادات متقدمة",
    advancedSettingsHelp:
      "التسجيل والهوية والتشخيص لهذا الخادم. لكل حقل قيمة افتراضية صالحة.",
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
    failoverDefaults: "إعدادات التحويل الافتراضية",
    defaultTimeoutSeconds: "مهلة التسجيل (ثواني)",
    defaultMaxRetries: "عدد المحاولات قبل الانتقال إلى الخادم التالي",

    iceSection: "خوادم ICE",
    iceSectionHelp:
      "اجتياز NAT لهذا الخادم وحده، فالمُرحِّل لا يمكن الوصول إليه إلا داخل شبكته. بيانات اعتماد TURN للكتابة فقط: تُرسل مرة واحدة ولا تُعرض بعدها أبداً.",
    iceEmpty: "لا يوجد خادم ICE مهيأ لهذا الخادم بعد.",
    iceKind: "النوع",
    iceUrls: "العناوين",
    iceUrlsHelp:
      "عنوان أو أكثر بصيغة stun: أو stuns: أو turn: أو turns:، مفصولة بفاصلة أو مسافة.",
    iceUsername: "اسم مستخدم TURN",
    iceCredential: "بيانات اعتماد TURN (للكتابة فقط)",
    iceCredentialKeepHelp:
      "اتركه فارغاً للإبقاء على القيمة المخزّنة. إدخال قيمة يستبدلها.",
    iceCredentialState: "بيانات الاعتماد",
    iceEnabledLabel: "تفعيل خادم ICE",
    addIceServer: "إضافة خادم ICE",
    iceRegion: "خادم ICE",
    toggleIceOn: "تفعيل خادم ICE",
    toggleIceOff: "إيقاف خادم ICE",
    removeIceServer: "حذف خادم ICE",

    extensionsSection: "الامتدادات",
    extensionsSectionHelp: "كل امتداد مفعّل يشغل مقعداً واحداً من اشتراكك.",
    extensionsEmpty: "لا يوجد امتداد بعد.",
    ownerId: "معرّف المستخدم المالك",
    extension: "الامتداد",
    sipUsername: "اسم مستخدم SIP",
    sipPassword: "كلمة مرور SIP (للكتابة فقط)",
    sipPasswordKeepHelp:
      "اتركها فارغة للإبقاء على كلمة المرور المخزّنة. إدخال قيمة يستبدلها.",
    passwordState: "كلمة المرور",
    displayName: "الاسم المعروض",
    outboundCallerId: "رقم المتصل الصادر",
    transport: "الناقل",
    extensionEnabledLabel: "تفعيل الامتداد",
    addExtension: "إضافة امتداد",
    extensionRegion: "امتداد",
    deleteExtensionTitle: "حذف هذا الامتداد؟",
    deleteExtensionMessage:
      "يُحذف الامتداد ويُحرَّر مقعده، مع الاحتفاظ بالإعدادات.",
    confirmDelete: "حذف الامتداد",
    cancel: "إلغاء",

    seatsSection: "المقاعد",
    seatsHeading: "مقاعد الهاتف المرئي لديك",
    seatsUnavailable: "بيانات المقاعد غير متاحة أثناء إيقاف الهاتف المرئي.",
    seatsAllowed: "المسموح",
    seatsOccupied: "المشغول",
    seatsAvailable: "المتاح",
    overAllowance: "تجاوز الحد",
    overAllowanceBy: "فوق الحد المسموح",
    overAllowanceExplanation:
      "عدد الهواتف المفعّلة أكبر مما يسمح به اشتراكك. تقليل المقاعد لا يوقف هاتفاً عاملاً، لذا هذه الحالة متوقعة، ولا يمكن تفعيل هاتف جديد قبل معالجتها.",
    seatsWithinAllowance: "ضمن الحد المسموح",

    toggleExtensionOn: "تفعيل الامتداد",
    toggleExtensionOff: "إيقاف الامتداد",
    removeExtension: "حذف الامتداد",
    showCredential: "إظهار بيانات الاعتماد",
    hideCredential: "إخفاء بيانات الاعتماد",
    showPassword: "إظهار كلمة المرور",
    hidePassword: "إخفاء كلمة المرور",
  },
} as const;

export function webphoneFieldErrorText(
  code: string,
  lang: "ar" | "en",
): string {
  const english: Record<string, string> = {
    INVALID_SERVER_NAME: "Name the server, in up to 80 characters.",
    INVALID_SIP_DOMAIN:
      "Enter a domain, optionally with a port, up to 253 characters.",
    INVALID_SIP_URI: "Enter a sip: URI without whitespace, up to 512 characters.",
    INVALID_WS_URL:
      "Enter a ws:// or wss:// URL without whitespace, up to 512 characters.",
    INVALID_ICE_URLS: "Enter 1 to 8 stun:, stuns:, turn:, or turns: URIs.",
    // Letters are legitimate: a dial plan addresses queues and departments by
    // name as often as by number, so `SQ_1023` is an ordinary extension.
    INVALID_EXTENSION:
      "Use 1 to 32 letters, digits, or the separators * # + . _ and -.",
    INVALID_SIP_USERNAME: "Enter a SIP username up to 120 characters.",
    OUT_OF_RANGE: "Enter a whole number inside the allowed range.",
    TOO_LONG: "This value is longer than the field allows.",
    OWNER_REQUIRED: "Select the user who will own this extension.",
    PASSWORD_REQUIRED_TO_ENABLE: "An enabled extension needs a SIP password.",
    STUN_HAS_NO_CREDENTIALS: "STUN entries carry no username or credential.",
    TURN_CREDENTIAL_PAIR_REQUIRED:
      "Supply the TURN username and credential together.",
    RELAY_REQUIRES_TURN:
      "Relay-only transport needs an enabled TURN entry on this server, or every call through it loses its media path.",
  };
  if (lang === "en") return english[code] ?? "This value is invalid.";

  const arabic: Record<string, string> = {
    INVALID_SERVER_NAME: "أدخل اسماً للخادم بحد أقصى 80 حرفاً.",
    INVALID_SIP_DOMAIN: "أدخل نطاقاً، مع منفذ اختياري، بحد أقصى 253 حرفاً.",
    INVALID_SIP_URI: "أدخل عنوان sip: بدون مسافات وبحد أقصى 512 حرفاً.",
    INVALID_WS_URL: "أدخل رابط ws:// أو wss:// بدون مسافات وبحد أقصى 512 حرفاً.",
    INVALID_ICE_URLS: "أدخل من 1 إلى 8 عناوين stun: أو stuns: أو turn: أو turns:.",
    INVALID_EXTENSION:
      "استخدم من 1 إلى 32 خانة من الحروف أو الأرقام أو الفواصل * # + . _ و -.",
    INVALID_SIP_USERNAME: "أدخل اسم مستخدم SIP بحد أقصى 120 حرفاً.",
    OUT_OF_RANGE: "أدخل رقماً صحيحاً ضمن المدى المسموح.",
    TOO_LONG: "القيمة أطول مما يسمح به الحقل.",
    OWNER_REQUIRED: "اختر المستخدم الذي سيملك هذا الامتداد.",
    PASSWORD_REQUIRED_TO_ENABLE: "الامتداد المفعّل يحتاج كلمة مرور SIP.",
    STUN_HAS_NO_CREDENTIALS: "مدخلات STUN لا تحمل اسم مستخدم أو بيانات اعتماد.",
    TURN_CREDENTIAL_PAIR_REQUIRED: "أدخل اسم مستخدم TURN وبيانات الاعتماد معاً.",
    RELAY_REQUIRES_TURN:
      "يتطلب النقل عبر TURN فقط مدخلة TURN مفعّلة في هذا الخادم، وإلا فقدت كل مكالمة عبره مسار الوسائط.",
  };
  return arabic[code] ?? "هذه القيمة غير صالحة.";
}

export function webphoneErrorText(
  code: string | null | undefined,
  lang: "ar" | "en",
  details?: Record<string, string[]> | null,
): string {
  const safeCode = code ?? "UNKNOWN_ERROR";
  const allowed = details?.allowed?.[0];
  const occupied = details?.occupied?.[0];

  if (lang === "en") {
    const english: Record<string, string> = {
      WEBPHONE_SEAT_LIMIT_REACHED:
        allowed && occupied
          ? `Enabling this would exceed your seat allowance (${occupied} occupied of ${allowed} allowed).`
          : "Enabling this would exceed your seat allowance.",
      WEBPHONE_CONFIG_INCOMPLETE:
        "The extension is missing fields required to enable it, such as its SIP password.",
      WEBPHONE_RELAY_WITHOUT_TURN:
        "Relay-only transport needs at least one enabled TURN server, or every call loses its media path.",
      // The endpoints table was absorbed into servers, but the refusal kept its
      // original code — it now means the last enabled server of an enabled scope.
      WEBPHONE_LAST_ENDPOINT:
        "This is the last enabled server of an enabled configuration and cannot be removed.",
      WEBPHONE_EXTENSION_TAKEN: "That extension number is already in use here.",
      WEBPHONE_SIP_USERNAME_TAKEN: "That SIP username is already in use here.",
      WEBPHONE_OWNER_HAS_EXTENSION: "That user already has an extension.",
      WEBPHONE_MODULE_NOT_PURCHASED: "WebPhone is not part of your subscription.",
      WEBPHONE_MODULE_INACTIVE: "Your WebPhone subscription is suspended.",
      WEBPHONE_PROVISIONING_PENDING: "WebPhone is still being set up.",
      WEBPHONE_UPDATE_PERMISSION_REQUIRED:
        "Changing this requires the webphone.settings.update permission.",
      WEBPHONE_EXTENSION_PERMISSION_REQUIRED:
        "Changing this requires the webphone.extensions.manage permission.",
      WEBPHONE_MODULE_UNAVAILABLE:
        "WebPhone is unavailable on this workspace, so nothing was sent.",
    };
    return (
      english[safeCode] ??
      `The operation could not be completed safely. Error code: ${safeCode}`
    );
  }

  const arabic: Record<string, string> = {
    WEBPHONE_SEAT_LIMIT_REACHED:
      allowed && occupied
        ? `التفعيل سيتجاوز حد المقاعد لديك (${occupied} مشغول من ${allowed} مسموح).`
        : "التفعيل سيتجاوز حد المقاعد المسموح لديك.",
    WEBPHONE_CONFIG_INCOMPLETE:
      "ينقص الامتداد حقول لازمة للتفعيل، مثل كلمة مرور SIP.",
    WEBPHONE_RELAY_WITHOUT_TURN:
      "يتطلب النقل عبر TURN فقط خادم TURN مفعّلاً واحداً على الأقل، وإلا فقدت كل مكالمة مسار الوسائط.",
    WEBPHONE_LAST_ENDPOINT: "هذا آخر خادم مفعّل في إعداد مفعّل ولا يمكن حذفه.",
    WEBPHONE_EXTENSION_TAKEN: "رقم الامتداد مستخدم بالفعل هنا.",
    WEBPHONE_SIP_USERNAME_TAKEN: "اسم مستخدم SIP مستخدم بالفعل هنا.",
    WEBPHONE_OWNER_HAS_EXTENSION: "هذا المستخدم لديه امتداد بالفعل.",
    WEBPHONE_MODULE_NOT_PURCHASED: "الهاتف المرئي ليس ضمن اشتراكك.",
    WEBPHONE_MODULE_INACTIVE: "اشتراك الهاتف المرئي لديك موقوف.",
    WEBPHONE_PROVISIONING_PENDING: "ما زالت تهيئة الهاتف المرئي جارية.",
    WEBPHONE_UPDATE_PERMISSION_REQUIRED:
      "يتطلب التغيير صلاحية webphone.settings.update.",
    WEBPHONE_EXTENSION_PERMISSION_REQUIRED:
      "يتطلب التغيير صلاحية webphone.extensions.manage.",
    WEBPHONE_MODULE_UNAVAILABLE:
      "الهاتف المرئي غير متاح في مساحة العمل هذه، لذا لم يُرسل أي شيء.",
  };
  return arabic[safeCode] ?? `تعذر إكمال العملية بأمان. رمز الخطأ: ${safeCode}`;
}
