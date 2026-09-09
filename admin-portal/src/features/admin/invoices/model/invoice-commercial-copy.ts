export const INVOICE_COMMERCIAL_COPY = {
  en: {
    title: "Retained commercial evidence", hint: "Historical seats and prices as accepted. These do not establish current access or reprice this invoice.",
    unavailable: "This manual invoice has no subscription seat attribution. Seats, application and addon identities cannot be inferred from its description.",
    source: { APPLICATION: "Application", ADDON: "Addon" }, seats: "Accepted seats", quantity: "Invoice line quantity",
    parent: "Base subscription item", selection: "Addon selection", definition: "Accepted definition version", priceRevision: "Accepted price revision",
    amount: "Accepted recurring amount", cycle: { MONTHLY: "Monthly", ANNUAL: "Annual" },
    breakdown: "Recorded applied pricing brackets", from: "From", through: "Through", open: "No upper limit", charged: "Charged users",
    unit: "USD / user", lineAmount: "Amount USD", fxUnavailable: "Not included in this retained detail contract",
  },
  ar: {
    title: "الأدلة التجارية المحفوظة", hint: "المقاعد والأسعار التاريخية وقت القبول. لا تثبت صلاحية الاستخدام الحالية ولا تعيد تسعير الفاتورة.",
    unavailable: "هذه فاتورة يدوية دون إسناد لمقاعد الاشتراك. لا يمكن استنتاج المقاعد أو هوية التطبيق والإضافة من وصف السطر.",
    source: { APPLICATION: "تطبيق", ADDON: "إضافة" }, seats: "المقاعد المقبولة", quantity: "كمية سطر الفاتورة",
    parent: "بند الاشتراك الأساسي", selection: "اختيار الإضافة", definition: "إصدار التعريف المقبول", priceRevision: "مراجعة السعر المقبول",
    amount: "المبلغ الدوري المقبول", cycle: { MONTHLY: "شهري", ANNUAL: "سنوي" },
    breakdown: "شرائح السعر المحتسبة المحفوظة", from: "من", through: "حتى", open: "بلا حد أعلى", charged: "المستخدمون المحتسبون",
    unit: "دولار / مستخدم", lineAmount: "المبلغ بالدولار", fxUnavailable: "غير مدرج ضمن عقد قراءة التفاصيل المحفوظة",
  },
} as const;
