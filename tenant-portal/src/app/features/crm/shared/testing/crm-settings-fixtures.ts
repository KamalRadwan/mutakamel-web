// Snapshot of the settings seeds. Relative dates are fixed at 2026-11-18 for repeatable tests.
export const CRM_SETTINGS_FIXTURES: Readonly<Record<string, unknown>> = {
  "/tags": [
    {
      "id": "tag-009",
      "name": "Expo 2026",
      "backgroundColor": "#FFEDD5",
      "textColor": "#9A3412",
      "createdAt": "2026-11-12T10:00:00.000Z",
      "updatedAt": "2026-11-12T10:00:00.000Z"
    },
    {
      "id": "tag-004",
      "name": "Follow up",
      "backgroundColor": "#DBEAFE",
      "textColor": "#1E40AF",
      "createdAt": "2026-11-15T10:00:00.000Z",
      "updatedAt": "2026-11-15T10:00:00.000Z"
    },
    {
      "id": "tag-007",
      "name": "Government",
      "backgroundColor": "#4338CA",
      "textColor": "#FFFFFF",
      "createdAt": "2026-11-04T10:00:00.000Z",
      "updatedAt": "2026-11-04T10:00:00.000Z"
    },
    {
      "id": "tag-002",
      "name": "Hot lead",
      "backgroundColor": "#B91C1C",
      "textColor": "#FFFFFF",
      "createdAt": "2026-11-17T10:00:00.000Z",
      "updatedAt": "2026-11-17T10:00:00.000Z"
    },
    {
      "id": "tag-010",
      "name": "Lost price",
      "backgroundColor": null,
      "textColor": null,
      "createdAt": "2026-10-31T10:00:00.000Z",
      "updatedAt": "2026-10-31T10:00:00.000Z"
    },
    {
      "id": "tag-005",
      "name": "Partner",
      "backgroundColor": "#CCFBF1",
      "textColor": "#115E59",
      "createdAt": "2026-11-11T10:00:00.000Z",
      "updatedAt": "2026-11-11T10:00:00.000Z"
    },
    {
      "id": "tag-008",
      "name": "Trial",
      "backgroundColor": "#ECFCCB",
      "textColor": "#3F6212",
      "createdAt": "2026-11-13T10:00:00.000Z",
      "updatedAt": "2026-11-13T10:00:00.000Z"
    },
    {
      "id": "tag-001",
      "name": "VIP",
      "backgroundColor": "#FBBF24",
      "textColor": "#451A03",
      "createdAt": "2026-11-16T10:00:00.000Z",
      "updatedAt": "2026-11-16T10:00:00.000Z"
    },
    {
      "id": "tag-006",
      "name": "Wholesale",
      "backgroundColor": "#F1F5F9",
      "textColor": "#1E293B",
      "createdAt": "2026-11-08T10:00:00.000Z",
      "updatedAt": "2026-11-08T10:00:00.000Z"
    },
    {
      "id": "tag-003",
      "name": "عميل مميز",
      "backgroundColor": "#F3E8FF",
      "textColor": "#6B21A8",
      "createdAt": "2026-11-14T10:00:00.000Z",
      "updatedAt": "2026-11-14T10:00:00.000Z"
    }
  ],
  "/acquisition-sources": [
    {
      "id": "00000000-0000-7000-8000-000000000001",
      "nameAr": "الموقع الإلكتروني",
      "nameEn": "Website",
      "isActive": true,
      "sortOrder": 1,
      "iconUrl": "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%3E%3Crect%20width%3D%2224%22%20height%3D%2224%22%20rx%3D%226%22%20fill%3D%22%231d56c9%22%2F%3E%3Ccircle%20cx%3D%2212%22%20cy%3D%2212%22%20r%3D%225.5%22%20fill%3D%22none%22%20stroke%3D%22%23fff%22%20stroke-width%3D%221.6%22%2F%3E%3Cpath%20d%3D%22M6.5%2012h11M12%206.5a8%208%200%200%201%200%2011M12%206.5a8%208%200%200%200%200%2011%22%20fill%3D%22none%22%20stroke%3D%22%23fff%22%20stroke-width%3D%221.4%22%2F%3E%3C%2Fsvg%3E",
      "createdAt": "2026-10-01T09:00:00.000Z",
      "updatedAt": "2026-10-01T09:00:00.000Z"
    },
    {
      "id": "00000000-0000-7000-8000-000000000002",
      "nameAr": "فيسبوك",
      "nameEn": "Facebook",
      "isActive": true,
      "sortOrder": 2,
      "iconUrl": "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%3E%3Crect%20width%3D%2224%22%20height%3D%2224%22%20rx%3D%226%22%20fill%3D%22%231877f2%22%2F%3E%3Cpath%20d%3D%22M13.5%2018v-5.5h1.8l.3-2.2h-2.1V8.9c0-.6.2-1.1%201.1-1.1h1.1V5.8c-.5-.1-1.1-.1-1.7-.1-1.7%200-2.8%201-2.8%202.9v1.7H9.4v2.2h1.8V18h2.3z%22%20fill%3D%22%23fff%22%2F%3E%3C%2Fsvg%3E",
      "createdAt": "2026-10-01T09:00:00.000Z",
      "updatedAt": "2026-10-01T09:00:00.000Z"
    },
    {
      "id": "00000000-0000-7000-8000-000000000003",
      "nameAr": "إنستغرام",
      "nameEn": "Instagram",
      "isActive": true,
      "sortOrder": 3,
      "iconUrl": "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%3E%3Crect%20width%3D%2224%22%20height%3D%2224%22%20rx%3D%226%22%20fill%3D%22%23c13584%22%2F%3E%3Crect%20x%3D%226.5%22%20y%3D%226.5%22%20width%3D%2211%22%20height%3D%2211%22%20rx%3D%223%22%20fill%3D%22none%22%20stroke%3D%22%23fff%22%20stroke-width%3D%221.6%22%2F%3E%3Ccircle%20cx%3D%2212%22%20cy%3D%2212%22%20r%3D%222.6%22%20fill%3D%22none%22%20stroke%3D%22%23fff%22%20stroke-width%3D%221.6%22%2F%3E%3Ccircle%20cx%3D%2215.3%22%20cy%3D%228.7%22%20r%3D%220.8%22%20fill%3D%22%23fff%22%2F%3E%3C%2Fsvg%3E",
      "createdAt": "2026-10-01T09:00:00.000Z",
      "updatedAt": "2026-10-01T09:00:00.000Z"
    },
    {
      "id": "00000000-0000-7000-8000-000000000004",
      "nameAr": "لينكدإن",
      "nameEn": "LinkedIn",
      "isActive": true,
      "sortOrder": 4,
      "iconUrl": "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%3E%3Crect%20width%3D%2224%22%20height%3D%2224%22%20rx%3D%226%22%20fill%3D%22%230a66c2%22%2F%3E%3Ccircle%20cx%3D%228%22%20cy%3D%228%22%20r%3D%221.1%22%20fill%3D%22%23fff%22%2F%3E%3Cpath%20d%3D%22M7.1%2010.6v6.2M10.6%2010.6v6.2M10.6%2013.1c0-1.5%201-2.5%202.4-2.5%201.3%200%202.1.9%202.1%202.4v3.8%22%20fill%3D%22none%22%20stroke%3D%22%23fff%22%20stroke-width%3D%221.7%22%20stroke-linecap%3D%22round%22%2F%3E%3C%2Fsvg%3E",
      "createdAt": "2026-10-01T09:00:00.000Z",
      "updatedAt": "2026-10-01T09:00:00.000Z"
    },
    {
      "id": "00000000-0000-7000-8000-000000000005",
      "nameAr": "واتساب",
      "nameEn": "WhatsApp",
      "isActive": true,
      "sortOrder": 5,
      "iconUrl": "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%3E%3Crect%20width%3D%2224%22%20height%3D%2224%22%20rx%3D%226%22%20fill%3D%22%23067d4d%22%2F%3E%3Cpath%20d%3D%22M12%206a6%206%200%200%200-5.2%209l-.8%203%203.1-.8A6%206%200%201%200%2012%206z%22%20fill%3D%22none%22%20stroke%3D%22%23fff%22%20stroke-width%3D%221.6%22%20stroke-linejoin%3D%22round%22%2F%3E%3Cpath%20d%3D%22M10%209.8c.2-.3.5-.3.7%200l.7%201c.1.2.1.4%200%20.6l-.4.4c.5.9%201.2%201.6%202.1%202.1l.4-.4c.2-.1.4-.1.6%200l1%20.7c.3.2.3.5%200%20.7-.5.5-1.3.7-2%20.4a6.5%206.5%200%200%201-3.5-3.5c-.3-.7-.1-1.5.4-2z%22%20fill%3D%22%23fff%22%2F%3E%3C%2Fsvg%3E",
      "createdAt": "2026-10-01T09:00:00.000Z",
      "updatedAt": "2026-10-01T09:00:00.000Z"
    },
    {
      "id": "00000000-0000-7000-8000-000000000006",
      "nameAr": "تيك توك",
      "nameEn": "TikTok",
      "isActive": true,
      "sortOrder": 6,
      "iconUrl": "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%3E%3Crect%20width%3D%2224%22%20height%3D%2224%22%20rx%3D%226%22%20fill%3D%22%2312141c%22%2F%3E%3Cpath%20d%3D%22M13.6%206.2v8a2.6%202.6%200%201%201-1.8-2.5%22%20fill%3D%22none%22%20stroke%3D%22%23fff%22%20stroke-width%3D%221.7%22%20stroke-linecap%3D%22round%22%2F%3E%3Cpath%20d%3D%22M13.6%206.2c.6%201.7%201.8%202.8%203.6%203%22%20fill%3D%22none%22%20stroke%3D%22%23fff%22%20stroke-width%3D%221.7%22%20stroke-linecap%3D%22round%22%2F%3E%3C%2Fsvg%3E",
      "createdAt": "2026-10-01T09:00:00.000Z",
      "updatedAt": "2026-10-01T09:00:00.000Z"
    },
    {
      "id": "00000000-0000-7000-8000-000000000007",
      "nameAr": "إعلانات جوجل",
      "nameEn": "Google Ads",
      "isActive": true,
      "sortOrder": 7,
      "iconUrl": "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%3E%3Crect%20width%3D%2224%22%20height%3D%2224%22%20rx%3D%226%22%20fill%3D%22%23b45309%22%2F%3E%3Cpath%20d%3D%22M7.2%2016.5l4.8-9.2%204.8%209.2%22%20fill%3D%22none%22%20stroke%3D%22%23fff%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3Ccircle%20cx%3D%227.4%22%20cy%3D%2216.2%22%20r%3D%221.5%22%20fill%3D%22%23fff%22%2F%3E%3C%2Fsvg%3E",
      "createdAt": "2026-10-01T09:00:00.000Z",
      "updatedAt": "2026-10-01T09:00:00.000Z"
    },
    {
      "id": "00000000-0000-7000-8000-000000000008",
      "nameAr": "حملة بريد إلكتروني",
      "nameEn": "Email Campaign",
      "isActive": true,
      "sortOrder": 8,
      "iconUrl": "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%3E%3Crect%20width%3D%2224%22%20height%3D%2224%22%20rx%3D%226%22%20fill%3D%22%230f2f78%22%2F%3E%3Crect%20x%3D%226%22%20y%3D%227.5%22%20width%3D%2212%22%20height%3D%229%22%20rx%3D%221.6%22%20fill%3D%22none%22%20stroke%3D%22%23fff%22%20stroke-width%3D%221.6%22%2F%3E%3Cpath%20d%3D%22M6.5%208.5l5.5%204%205.5-4%22%20fill%3D%22none%22%20stroke%3D%22%23fff%22%20stroke-width%3D%221.5%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E",
      "createdAt": "2026-10-01T09:00:00.000Z",
      "updatedAt": "2026-10-01T09:00:00.000Z"
    },
    {
      "id": "00000000-0000-7000-8000-000000000009",
      "nameAr": "إحالة",
      "nameEn": "Referral",
      "isActive": true,
      "sortOrder": 9,
      "iconUrl": "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%3E%3Crect%20width%3D%2224%22%20height%3D%2224%22%20rx%3D%226%22%20fill%3D%22%230b7a85%22%2F%3E%3Ccircle%20cx%3D%229%22%20cy%3D%229%22%20r%3D%222.2%22%20fill%3D%22none%22%20stroke%3D%22%23fff%22%20stroke-width%3D%221.6%22%2F%3E%3Ccircle%20cx%3D%2215.5%22%20cy%3D%2210%22%20r%3D%221.8%22%20fill%3D%22none%22%20stroke%3D%22%23fff%22%20stroke-width%3D%221.6%22%2F%3E%3Cpath%20d%3D%22M5.5%2017a3.5%203.5%200%200%201%207%200M13%2017a2.8%202.8%200%200%201%205.5%200%22%20fill%3D%22none%22%20stroke%3D%22%23fff%22%20stroke-width%3D%221.6%22%20stroke-linecap%3D%22round%22%2F%3E%3C%2Fsvg%3E",
      "createdAt": "2026-10-01T09:00:00.000Z",
      "updatedAt": "2026-10-01T09:00:00.000Z"
    },
    {
      "id": "00000000-0000-7000-8000-00000000000a",
      "nameAr": "مكالمة هاتفية",
      "nameEn": "Phone Call",
      "isActive": true,
      "sortOrder": 10,
      "iconUrl": "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%3E%3Crect%20width%3D%2224%22%20height%3D%2224%22%20rx%3D%226%22%20fill%3D%22%231d56c9%22%2F%3E%3Cpath%20d%3D%22M8.2%206.8l2.1%202.1-1.2%201.4a8.2%208.2%200%200%200%204.6%204.6l1.4-1.2%202.1%202.1-1.1%201.3c-.6.7-1.6.9-2.5.6A11%2011%200%200%201%206.3%2010.4c-.3-.9-.1-1.9.6-2.5l1.3-1.1z%22%20fill%3D%22none%22%20stroke%3D%22%23fff%22%20stroke-width%3D%221.5%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E",
      "createdAt": "2026-10-01T09:00:00.000Z",
      "updatedAt": "2026-10-01T09:00:00.000Z"
    },
    {
      "id": "00000000-0000-7000-8000-00000000000b",
      "nameAr": "زيارة مباشرة",
      "nameEn": "Walk-in",
      "isActive": true,
      "sortOrder": 11,
      "iconUrl": "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%3E%3Crect%20width%3D%2224%22%20height%3D%2224%22%20rx%3D%226%22%20fill%3D%22%236b3fc4%22%2F%3E%3Ccircle%20cx%3D%2212%22%20cy%3D%227.5%22%20r%3D%221.6%22%20fill%3D%22%23fff%22%2F%3E%3Cpath%20d%3D%22M11.5%2010.2l-1.5%204.2M11.5%2010.2l2.5%202%201.8.6M10%2014.4l-1.8%203.2M12.4%2013.8l1.6%203.8%22%20fill%3D%22none%22%20stroke%3D%22%23fff%22%20stroke-width%3D%221.6%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E",
      "createdAt": "2026-10-01T09:00:00.000Z",
      "updatedAt": "2026-10-01T09:00:00.000Z"
    },
    {
      "id": "00000000-0000-7000-8000-00000000000c",
      "nameAr": "بيانات غير متصلة",
      "nameEn": "Offline Data",
      "isActive": true,
      "sortOrder": 12,
      "iconUrl": "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%3E%3Crect%20width%3D%2224%22%20height%3D%2224%22%20rx%3D%226%22%20fill%3D%22%233c4257%22%2F%3E%3Cellipse%20cx%3D%2212%22%20cy%3D%228%22%20rx%3D%224.8%22%20ry%3D%221.8%22%20fill%3D%22none%22%20stroke%3D%22%23fff%22%20stroke-width%3D%221.5%22%2F%3E%3Cpath%20d%3D%22M7.2%208v4c0%201%202.1%201.8%204.8%201.8s4.8-.8%204.8-1.8V8M7.2%2012v4c0%201%202.1%201.8%204.8%201.8s4.8-.8%204.8-1.8v-4%22%20fill%3D%22none%22%20stroke%3D%22%23fff%22%20stroke-width%3D%221.5%22%2F%3E%3C%2Fsvg%3E",
      "createdAt": "2026-10-01T09:00:00.000Z",
      "updatedAt": "2026-10-01T09:00:00.000Z"
    }
  ],
  "/lead-stages": [
    {
      "id": "018f0000-0000-7000-8000-000000000410",
      "sortOrder": 1,
      "flag": "NEW",
      "category": "IN_PROGRESS",
      "nameAr": "جديد",
      "nameEn": "New",
      "isDefault": true,
      "isActive": true,
      "createdAt": "2026-11-01T09:00:00.000Z",
      "updatedAt": "2026-11-01T09:00:00.000Z"
    },
    {
      "id": "018f0000-0000-7000-8000-000000000411",
      "sortOrder": 2,
      "flag": "CONTACTED",
      "category": "IN_PROGRESS",
      "nameAr": "تم التواصل",
      "nameEn": "Contacted",
      "isDefault": false,
      "isActive": true,
      "createdAt": "2026-11-01T09:00:00.000Z",
      "updatedAt": "2026-11-01T09:00:00.000Z"
    },
    {
      "id": "018f0000-0000-7000-8000-000000000412",
      "sortOrder": 3,
      "flag": "QUALIFYING",
      "category": "IN_PROGRESS",
      "nameAr": "تحت التأهيل",
      "nameEn": "Qualifying",
      "isDefault": false,
      "isActive": true,
      "createdAt": "2026-11-01T09:00:00.000Z",
      "updatedAt": "2026-11-01T09:00:00.000Z"
    },
    {
      "id": "018f0000-0000-7000-8000-000000000413",
      "sortOrder": 4,
      "flag": "QUALIFIED",
      "category": "POSITIVE",
      "nameAr": "مؤهل",
      "nameEn": "Qualified",
      "isDefault": false,
      "isActive": true,
      "createdAt": "2026-11-01T09:00:00.000Z",
      "updatedAt": "2026-11-01T09:00:00.000Z"
    },
    {
      "id": "018f0000-0000-7000-8000-000000000414",
      "sortOrder": 5,
      "flag": "NURTURING",
      "category": "IN_PROGRESS",
      "nameAr": "متابعة لاحقة",
      "nameEn": "Nurturing",
      "isDefault": false,
      "isActive": true,
      "createdAt": "2026-11-01T09:00:00.000Z",
      "updatedAt": "2026-11-01T09:00:00.000Z"
    },
    {
      "id": "018f0000-0000-7000-8000-000000000415",
      "sortOrder": 6,
      "flag": "ON_HOLD",
      "category": "IN_PROGRESS",
      "nameAr": "معلق",
      "nameEn": "On hold",
      "isDefault": false,
      "isActive": true,
      "createdAt": "2026-11-01T09:00:00.000Z",
      "updatedAt": "2026-11-01T09:00:00.000Z"
    },
    {
      "id": "018f0000-0000-7000-8000-000000000416",
      "sortOrder": 7,
      "flag": "DISQUALIFIED",
      "category": "NEGATIVE",
      "nameAr": "غير مؤهل",
      "nameEn": "Disqualified",
      "isDefault": false,
      "isActive": true,
      "createdAt": "2026-11-01T09:00:00.000Z",
      "updatedAt": "2026-11-01T09:00:00.000Z"
    },
    {
      "id": "018f0000-0000-7000-8000-000000000417",
      "sortOrder": 8,
      "flag": "CONVERTED",
      "category": "POSITIVE",
      "nameAr": "تم التحويل",
      "nameEn": "Converted",
      "isDefault": false,
      "isActive": true,
      "createdAt": "2026-11-01T09:00:00.000Z",
      "updatedAt": "2026-11-01T09:00:00.000Z"
    }
  ],
  "/opportunity-stages": [
    {
      "id": "01950000-0000-7000-8000-000000000429",
      "nameAr": "خسارة",
      "nameEn": "Lost",
      "flag": "LOST",
      "category": "NEGATIVE",
      "isActive": true,
      "isSystem": true,
      "createdAt": "2026-01-10T09:00:00.000Z",
      "updatedAt": "2026-01-10T09:00:00.000Z"
    },
    {
      "id": "01950000-0000-7000-8000-000000000425",
      "nameAr": "تفاوض",
      "nameEn": "Negotiation",
      "flag": "NEGOTIATION",
      "category": "IN_PROGRESS",
      "isActive": true,
      "isSystem": true,
      "createdAt": "2026-01-10T09:00:00.000Z",
      "updatedAt": "2026-01-10T09:00:00.000Z"
    },
    {
      "id": "01950000-0000-7000-8000-000000000421",
      "nameAr": "جديد",
      "nameEn": "New",
      "flag": "NEW",
      "category": "OPEN",
      "isActive": true,
      "isSystem": true,
      "createdAt": "2026-01-10T09:00:00.000Z",
      "updatedAt": "2026-01-10T09:00:00.000Z"
    },
    {
      "id": "01950000-0000-7000-8000-000000000424",
      "nameAr": "عرض",
      "nameEn": "Proposal",
      "flag": "PROPOSAL",
      "category": "IN_PROGRESS",
      "isActive": true,
      "isSystem": true,
      "createdAt": "2026-01-10T09:00:00.000Z",
      "updatedAt": "2026-01-10T09:00:00.000Z"
    },
    {
      "id": "01950000-0000-7000-8000-000000000423",
      "nameAr": "تأهيل",
      "nameEn": "Qualification",
      "flag": "QUALIFICATION",
      "category": "IN_PROGRESS",
      "isActive": true,
      "isSystem": true,
      "createdAt": "2026-01-10T09:00:00.000Z",
      "updatedAt": "2026-01-10T09:00:00.000Z"
    },
    {
      "id": "01950000-0000-7000-8000-000000000428",
      "nameAr": "تم الفوز",
      "nameEn": "Won",
      "flag": "WON",
      "category": "POSITIVE",
      "isActive": true,
      "isSystem": true,
      "createdAt": "2026-01-10T09:00:00.000Z",
      "updatedAt": "2026-01-10T09:00:00.000Z"
    }
  ],
  "/pipelines": [
    {
      "id": "01950000-0000-7000-8000-000000000201",
      "code": "DEFAULT",
      "nameAr": "الافتراضي",
      "nameEn": "Default",
      "description": null,
      "isDefault": true,
      "isActive": true,
      "accessMode": "ALL",
      "stages": [
        {
          "id": "ps-def-1",
          "pipelineId": "01950000-0000-7000-8000-000000000201",
          "opportunityStageId": "01950000-0000-7000-8000-000000000421",
          "rank": 1,
          "nameAr": "جديد",
          "nameEn": "New",
          "flag": "NEW",
          "category": "OPEN",
          "isActive": true,
          "isSystem": true
        },
        {
          "id": "ps-def-2",
          "pipelineId": "01950000-0000-7000-8000-000000000201",
          "opportunityStageId": "01950000-0000-7000-8000-000000000423",
          "rank": 2,
          "nameAr": "تأهيل",
          "nameEn": "Qualification",
          "flag": "QUALIFICATION",
          "category": "IN_PROGRESS",
          "isActive": true,
          "isSystem": true
        },
        {
          "id": "ps-def-3",
          "pipelineId": "01950000-0000-7000-8000-000000000201",
          "opportunityStageId": "01950000-0000-7000-8000-000000000424",
          "rank": 3,
          "nameAr": "عرض",
          "nameEn": "Proposal",
          "flag": "PROPOSAL",
          "category": "IN_PROGRESS",
          "isActive": true,
          "isSystem": true
        },
        {
          "id": "ps-def-4",
          "pipelineId": "01950000-0000-7000-8000-000000000201",
          "opportunityStageId": "01950000-0000-7000-8000-000000000425",
          "rank": 4,
          "nameAr": "تفاوض",
          "nameEn": "Negotiation",
          "flag": "NEGOTIATION",
          "category": "IN_PROGRESS",
          "isActive": true,
          "isSystem": true
        },
        {
          "id": "ps-def-5",
          "pipelineId": "01950000-0000-7000-8000-000000000201",
          "opportunityStageId": "01950000-0000-7000-8000-000000000428",
          "rank": 5,
          "nameAr": "تم الفوز",
          "nameEn": "Won",
          "flag": "WON",
          "category": "POSITIVE",
          "isActive": true,
          "isSystem": true
        },
        {
          "id": "ps-def-6",
          "pipelineId": "01950000-0000-7000-8000-000000000201",
          "opportunityStageId": "01950000-0000-7000-8000-000000000429",
          "rank": 6,
          "nameAr": "خسارة",
          "nameEn": "Lost",
          "flag": "LOST",
          "category": "NEGATIVE",
          "isActive": true,
          "isSystem": true
        }
      ],
      "createdAt": "2026-01-12T10:00:00.000Z",
      "updatedAt": "2026-01-12T10:00:00.000Z"
    }
  ],
  "/pipelines/configuration": [
    {
      "id": "01950000-0000-7000-8000-000000000201",
      "code": "DEFAULT",
      "nameAr": "الافتراضي",
      "nameEn": "Default",
      "description": null,
      "isDefault": true,
      "isActive": true,
      "accessMode": "ALL",
      "stages": [
        {
          "id": "ps-def-1",
          "pipelineId": "01950000-0000-7000-8000-000000000201",
          "opportunityStageId": "01950000-0000-7000-8000-000000000421",
          "rank": 1,
          "nameAr": "جديد",
          "nameEn": "New",
          "flag": "NEW",
          "category": "OPEN",
          "isActive": true,
          "isSystem": true
        },
        {
          "id": "ps-def-2",
          "pipelineId": "01950000-0000-7000-8000-000000000201",
          "opportunityStageId": "01950000-0000-7000-8000-000000000423",
          "rank": 2,
          "nameAr": "تأهيل",
          "nameEn": "Qualification",
          "flag": "QUALIFICATION",
          "category": "IN_PROGRESS",
          "isActive": true,
          "isSystem": true
        },
        {
          "id": "ps-def-3",
          "pipelineId": "01950000-0000-7000-8000-000000000201",
          "opportunityStageId": "01950000-0000-7000-8000-000000000424",
          "rank": 3,
          "nameAr": "عرض",
          "nameEn": "Proposal",
          "flag": "PROPOSAL",
          "category": "IN_PROGRESS",
          "isActive": true,
          "isSystem": true
        },
        {
          "id": "ps-def-4",
          "pipelineId": "01950000-0000-7000-8000-000000000201",
          "opportunityStageId": "01950000-0000-7000-8000-000000000425",
          "rank": 4,
          "nameAr": "تفاوض",
          "nameEn": "Negotiation",
          "flag": "NEGOTIATION",
          "category": "IN_PROGRESS",
          "isActive": true,
          "isSystem": true
        },
        {
          "id": "ps-def-5",
          "pipelineId": "01950000-0000-7000-8000-000000000201",
          "opportunityStageId": "01950000-0000-7000-8000-000000000428",
          "rank": 5,
          "nameAr": "تم الفوز",
          "nameEn": "Won",
          "flag": "WON",
          "category": "POSITIVE",
          "isActive": true,
          "isSystem": true
        },
        {
          "id": "ps-def-6",
          "pipelineId": "01950000-0000-7000-8000-000000000201",
          "opportunityStageId": "01950000-0000-7000-8000-000000000429",
          "rank": 6,
          "nameAr": "خسارة",
          "nameEn": "Lost",
          "flag": "LOST",
          "category": "NEGATIVE",
          "isActive": true,
          "isSystem": true
        }
      ],
      "assignments": {
        "accessMode": "ALL",
        "userIds": [],
        "teamIds": []
      },
      "createdAt": "2026-01-12T10:00:00.000Z",
      "updatedAt": "2026-01-12T10:00:00.000Z"
    }
  ],
  "/custom-fields": [
    {
      "id": "cf-cust-tax",
      "ownerType": "CUSTOMER_PROFILE",
      "fieldKey": "tax_card_number",
      "nameAr": "رقم البطاقة الضريبية",
      "nameEn": "Tax card number",
      "type": "TEXT",
      "placeholderAr": "أدخل رقم البطاقة الضريبية",
      "placeholderEn": "Enter tax card number",
      "options": [],
      "sortOrder": 10,
      "isActive": true,
      "requirements": [
        {
          "operation": "CONVERT",
          "entityScope": null,
          "isRequired": true
        },
        {
          "operation": "UPDATE",
          "entityScope": null,
          "isRequired": true
        }
      ],
      "createdAt": "2026-11-18T10:00:00.000Z",
      "updatedAt": "2026-11-18T10:00:00.000Z"
    },
    {
      "id": "cf-cust-industry",
      "ownerType": "CUSTOMER_PROFILE",
      "fieldKey": "industry_segment",
      "nameAr": "قطاع النشاط",
      "nameEn": "Industry segment",
      "type": "MULTI_SELECT",
      "placeholderAr": "اختر قطاعًا واحدًا أو أكثر",
      "placeholderEn": "Select one or more segments",
      "options": [
        {
          "key": "retail",
          "nameAr": "التجزئة",
          "nameEn": "Retail",
          "sortOrder": 1,
          "isActive": true
        },
        {
          "key": "manufacturing",
          "nameAr": "التصنيع",
          "nameEn": "Manufacturing",
          "sortOrder": 2,
          "isActive": true
        },
        {
          "key": "healthcare",
          "nameAr": "الرعاية الصحية",
          "nameEn": "Healthcare",
          "sortOrder": 3,
          "isActive": true
        },
        {
          "key": "technology",
          "nameAr": "التقنية",
          "nameEn": "Technology",
          "sortOrder": 4,
          "isActive": true
        }
      ],
      "sortOrder": 20,
      "isActive": true,
      "requirements": [],
      "createdAt": "2026-11-18T10:00:00.000Z",
      "updatedAt": "2026-11-18T10:00:00.000Z"
    },
    {
      "id": "cf-lead-budget",
      "ownerType": "LEAD",
      "fieldKey": "budget_range",
      "nameAr": "نطاق الميزانية",
      "nameEn": "Budget range",
      "type": "SELECT",
      "placeholderAr": "اختر نطاق الميزانية",
      "placeholderEn": "Select budget range",
      "options": [
        {
          "key": "under_50k",
          "nameAr": "أقل من 50,000",
          "nameEn": "Under 50,000",
          "sortOrder": 1,
          "isActive": true
        },
        {
          "key": "50k_200k",
          "nameAr": "50,000 – 200,000",
          "nameEn": "50,000 – 200,000",
          "sortOrder": 2,
          "isActive": true
        },
        {
          "key": "200k_500k",
          "nameAr": "200,000 – 500,000",
          "nameEn": "200,000 – 500,000",
          "sortOrder": 3,
          "isActive": true
        },
        {
          "key": "over_500k",
          "nameAr": "أكثر من 500,000",
          "nameEn": "Over 500,000",
          "sortOrder": 4,
          "isActive": true
        }
      ],
      "sortOrder": 10,
      "isActive": true,
      "requirements": [
        {
          "operation": "CREATE",
          "entityScope": null,
          "isRequired": true
        }
      ],
      "createdAt": "2026-11-18T10:00:00.000Z",
      "updatedAt": "2026-11-18T10:00:00.000Z"
    },
    {
      "id": "cf-lead-start",
      "ownerType": "LEAD",
      "fieldKey": "expected_start_date",
      "nameAr": "تاريخ البدء المتوقع",
      "nameEn": "Expected start date",
      "type": "DATE",
      "placeholderAr": null,
      "placeholderEn": null,
      "options": [],
      "sortOrder": 20,
      "isActive": true,
      "requirements": [],
      "createdAt": "2026-11-18T10:00:00.000Z",
      "updatedAt": "2026-11-18T10:00:00.000Z"
    },
    {
      "id": "cf-lead-visits",
      "ownerType": "LEAD",
      "fieldKey": "website_visits",
      "nameAr": "زيارات الموقع",
      "nameEn": "Website visits",
      "type": "NUMBER",
      "placeholderAr": "مثال: 12",
      "placeholderEn": "e.g. 12",
      "options": [],
      "sortOrder": 30,
      "isActive": true,
      "requirements": [],
      "createdAt": "2026-11-18T10:00:00.000Z",
      "updatedAt": "2026-11-18T10:00:00.000Z"
    },
    {
      "id": "cf-lead-notes",
      "ownerType": "LEAD",
      "fieldKey": "qualification_notes",
      "nameAr": "ملاحظات التأهيل",
      "nameEn": "Qualification notes",
      "type": "TEXTAREA",
      "placeholderAr": "أضف ملخص احتياجات العميل المحتمل",
      "placeholderEn": "Summarize prospect requirements",
      "options": [],
      "sortOrder": 40,
      "isActive": true,
      "requirements": [],
      "createdAt": "2026-11-18T10:00:00.000Z",
      "updatedAt": "2026-11-18T10:00:00.000Z"
    },
    {
      "id": "cf-lead-contacted",
      "ownerType": "LEAD",
      "fieldKey": "last_contacted_at",
      "nameAr": "آخر تواصل",
      "nameEn": "Last contacted at",
      "type": "DATETIME",
      "placeholderAr": null,
      "placeholderEn": null,
      "options": [],
      "sortOrder": 50,
      "isActive": true,
      "requirements": [],
      "createdAt": "2026-11-18T10:00:00.000Z",
      "updatedAt": "2026-11-18T10:00:00.000Z"
    },
    {
      "id": "cf-lead-old-score",
      "ownerType": "LEAD",
      "fieldKey": "old_score",
      "nameAr": "التقييم القديم",
      "nameEn": "Old score",
      "type": "NUMBER",
      "placeholderAr": null,
      "placeholderEn": null,
      "options": [],
      "sortOrder": 90,
      "isActive": false,
      "requirements": [],
      "createdAt": "2026-11-18T10:00:00.000Z",
      "updatedAt": "2026-11-18T10:00:00.000Z"
    },
    {
      "id": "cf-legacy-national-id",
      "ownerType": "LEAD_AND_PARTY",
      "fieldKey": "national_id",
      "nameAr": "الرقم القومي",
      "nameEn": "National ID",
      "type": "TEXT",
      "placeholderAr": "أدخل الرقم القومي",
      "placeholderEn": "Enter national ID",
      "options": [],
      "sortOrder": 100,
      "isActive": true,
      "requirements": [
        {
          "operation": "CREATE",
          "entityScope": "LEAD",
          "isRequired": true
        }
      ],
      "createdAt": "2026-11-18T10:00:00.000Z",
      "updatedAt": "2026-11-18T10:00:00.000Z"
    },
    {
      "id": "cf-opp-competitor",
      "ownerType": "OPPORTUNITY",
      "fieldKey": "competitor",
      "nameAr": "المنافس",
      "nameEn": "Competitor",
      "type": "TEXT",
      "placeholderAr": "اسم المنافس الرئيسي",
      "placeholderEn": "Primary competitor name",
      "options": [],
      "sortOrder": 10,
      "isActive": true,
      "requirements": [],
      "createdAt": "2026-11-18T10:00:00.000Z",
      "updatedAt": "2026-11-18T10:00:00.000Z"
    },
    {
      "id": "cf-opp-contract-url",
      "ownerType": "OPPORTUNITY",
      "fieldKey": "contract_url",
      "nameAr": "رابط العقد",
      "nameEn": "Contract URL",
      "type": "URL",
      "placeholderAr": "https://example.com/contract",
      "placeholderEn": "https://example.com/contract",
      "options": [],
      "sortOrder": 20,
      "isActive": true,
      "requirements": [],
      "createdAt": "2026-11-18T10:00:00.000Z",
      "updatedAt": "2026-11-18T10:00:00.000Z"
    },
    {
      "id": "cf-opp-sponsor",
      "ownerType": "OPPORTUNITY",
      "fieldKey": "executive_approved",
      "nameAr": "موافقة الإدارة التنفيذية",
      "nameEn": "Executive sponsor approved",
      "type": "BOOLEAN",
      "placeholderAr": null,
      "placeholderEn": null,
      "options": [],
      "sortOrder": 30,
      "isActive": true,
      "requirements": [],
      "createdAt": "2026-11-18T10:00:00.000Z",
      "updatedAt": "2026-11-18T10:00:00.000Z"
    },
    {
      "id": "cf-party-linkedin",
      "ownerType": "PARTY",
      "fieldKey": "linkedin_url",
      "nameAr": "حساب لينكدإن",
      "nameEn": "LinkedIn",
      "type": "URL",
      "placeholderAr": "https://linkedin.com/in/...",
      "placeholderEn": "https://linkedin.com/in/...",
      "options": [],
      "sortOrder": 10,
      "isActive": true,
      "requirements": [],
      "createdAt": "2026-11-18T10:00:00.000Z",
      "updatedAt": "2026-11-18T10:00:00.000Z"
    },
    {
      "id": "cf-party-contact-time",
      "ownerType": "PARTY",
      "fieldKey": "preferred_contact_time",
      "nameAr": "وقت التواصل المفضل",
      "nameEn": "Preferred contact time",
      "type": "SELECT",
      "placeholderAr": "اختر الوقت المفضل",
      "placeholderEn": "Select preferred time",
      "options": [
        {
          "key": "morning",
          "nameAr": "صباحًا (9 ص – 12 م)",
          "nameEn": "Morning (9 AM – 12 PM)",
          "sortOrder": 1,
          "isActive": true
        },
        {
          "key": "afternoon",
          "nameAr": "ظهرًا (12 م – 4 م)",
          "nameEn": "Afternoon (12 PM – 4 PM)",
          "sortOrder": 2,
          "isActive": true
        },
        {
          "key": "evening",
          "nameAr": "مساءً (4 م – 8 م)",
          "nameEn": "Evening (4 PM – 8 PM)",
          "sortOrder": 3,
          "isActive": true
        }
      ],
      "sortOrder": 20,
      "isActive": true,
      "requirements": [],
      "createdAt": "2026-11-18T10:00:00.000Z",
      "updatedAt": "2026-11-18T10:00:00.000Z"
    },
    {
      "id": "cf-party-direct-phone",
      "ownerType": "PARTY",
      "fieldKey": "direct_phone",
      "nameAr": "الهاتف المباشر",
      "nameEn": "Direct phone",
      "type": "PHONE",
      "placeholderAr": "+201001234567",
      "placeholderEn": "+201001234567",
      "options": [],
      "sortOrder": 30,
      "isActive": true,
      "requirements": [],
      "createdAt": "2026-11-18T10:00:00.000Z",
      "updatedAt": "2026-11-18T10:00:00.000Z"
    },
    {
      "id": "cf-party-work-email",
      "ownerType": "PARTY",
      "fieldKey": "secondary_email",
      "nameAr": "البريد الإلكتروني البديل",
      "nameEn": "Secondary email",
      "type": "EMAIL",
      "placeholderAr": "name@company.com",
      "placeholderEn": "name@company.com",
      "options": [],
      "sortOrder": 40,
      "isActive": true,
      "requirements": [],
      "createdAt": "2026-11-18T10:00:00.000Z",
      "updatedAt": "2026-11-18T10:00:00.000Z"
    }
  ],
  "/settings/reasons": {
    "items": [
      {
        "id": "01950000-0000-7000-8000-000000000316",
        "reasonKind": "ACTIVITY_OUTCOME",
        "code": "CALL_CONNECTED",
        "nameEn": "Call connected",
        "nameAr": "تم الاتصال",
        "definitionEn": "The contact was reached and spoken to.",
        "definitionAr": "تم التحدث مع جهة الاتصال.",
        "polarity": "POSITIVE",
        "activityType": "CALL",
        "isSystem": false,
        "isActive": true,
        "sortOrder": 10,
        "revision": 1
      },
      {
        "id": "01950000-0000-7000-8000-000000000317",
        "reasonKind": "ACTIVITY_OUTCOME",
        "code": "CALL_NO_ANSWER",
        "nameEn": "No answer",
        "nameAr": "لم يتم الرد",
        "definitionEn": "The contact did not answer the call.",
        "definitionAr": "لم ترد جهة الاتصال على المكالمة.",
        "polarity": "NEGATIVE",
        "activityType": "CALL",
        "isSystem": false,
        "isActive": true,
        "sortOrder": 20,
        "revision": 1
      },
      {
        "id": "01950000-0000-7000-8000-000000000318",
        "reasonKind": "ACTIVITY_OUTCOME",
        "code": "MEETING_HELD",
        "nameEn": "Meeting held",
        "nameAr": "عُقد الاجتماع",
        "definitionEn": "The meeting took place with the customer.",
        "definitionAr": "عُقد الاجتماع بحضور العميل.",
        "polarity": "POSITIVE",
        "activityType": "MEETING",
        "isSystem": false,
        "isActive": true,
        "sortOrder": 30,
        "revision": 1
      },
      {
        "id": "01950000-0000-7000-8000-000000000319",
        "reasonKind": "ACTIVITY_OUTCOME",
        "code": "MEETING_NO_SHOW",
        "nameEn": "Customer no-show",
        "nameAr": "لم يحضر العميل",
        "definitionEn": "The customer did not attend the scheduled meeting.",
        "definitionAr": "لم يحضر العميل الاجتماع المحدد.",
        "polarity": "NEGATIVE",
        "activityType": "MEETING",
        "isSystem": false,
        "isActive": true,
        "sortOrder": 40,
        "revision": 1
      },
      {
        "id": "01950000-0000-7000-8000-000000000320",
        "reasonKind": "ACTIVITY_OUTCOME",
        "code": "EMAIL_REPLY_LOGGED",
        "nameEn": "Email reply logged",
        "nameAr": "تم تسجيل رد على البريد",
        "definitionEn": "The customer replied to the email and the reply was logged.",
        "definitionAr": "ردّ العميل على البريد وتم تسجيل الرد.",
        "polarity": "POSITIVE",
        "activityType": "EMAIL",
        "isSystem": false,
        "isActive": true,
        "sortOrder": 50,
        "revision": 1
      },
      {
        "id": "01950000-0000-7000-8000-000000000321",
        "reasonKind": "ACTIVITY_OUTCOME",
        "code": "OTHER",
        "nameEn": "Other outcome",
        "nameAr": "نتيجة أخرى",
        "definitionEn": "An outcome that matches no other code.",
        "definitionAr": "نتيجة لا تطابق أي رمز آخر.",
        "polarity": "NEUTRAL",
        "activityType": null,
        "isSystem": true,
        "isActive": true,
        "sortOrder": 90,
        "revision": 1
      },
      {
        "id": "01950000-0000-7000-8000-000000000322",
        "reasonKind": "CONTACT_ROLE",
        "code": "DECISION_MAKER",
        "nameEn": "Decision maker",
        "nameAr": "صاحب القرار",
        "definitionEn": null,
        "definitionAr": null,
        "polarity": null,
        "activityType": null,
        "isSystem": false,
        "isActive": true,
        "sortOrder": 10,
        "revision": 1
      },
      {
        "id": "01950000-0000-7000-8000-000000000323",
        "reasonKind": "CONTACT_ROLE",
        "code": "INFLUENCER",
        "nameEn": "Influencer",
        "nameAr": "مؤثر",
        "definitionEn": null,
        "definitionAr": null,
        "polarity": null,
        "activityType": null,
        "isSystem": false,
        "isActive": true,
        "sortOrder": 20,
        "revision": 1
      },
      {
        "id": "01950000-0000-7000-8000-000000000324",
        "reasonKind": "CONTACT_ROLE",
        "code": "USER",
        "nameEn": "User",
        "nameAr": "مستخدم",
        "definitionEn": null,
        "definitionAr": null,
        "polarity": null,
        "activityType": null,
        "isSystem": false,
        "isActive": true,
        "sortOrder": 30,
        "revision": 1
      },
      {
        "id": "01950000-0000-7000-8000-000000000325",
        "reasonKind": "CONTACT_ROLE",
        "code": "FINANCE",
        "nameEn": "Finance",
        "nameAr": "المالية",
        "definitionEn": null,
        "definitionAr": null,
        "polarity": null,
        "activityType": null,
        "isSystem": false,
        "isActive": true,
        "sortOrder": 40,
        "revision": 1
      },
      {
        "id": "01950000-0000-7000-8000-000000000326",
        "reasonKind": "CONTACT_ROLE",
        "code": "OTHER",
        "nameEn": "Other",
        "nameAr": "دور آخر",
        "definitionEn": null,
        "definitionAr": null,
        "polarity": null,
        "activityType": null,
        "isSystem": true,
        "isActive": true,
        "sortOrder": 90,
        "revision": 1
      },
      {
        "id": "01950000-0000-7000-8000-000000000311",
        "reasonKind": "DISQUALIFICATION",
        "code": "BUDGET",
        "nameEn": "No budget",
        "nameAr": "لا توجد ميزانية",
        "definitionEn": null,
        "definitionAr": null,
        "polarity": null,
        "activityType": null,
        "isSystem": false,
        "isActive": true,
        "sortOrder": 10,
        "revision": 1
      },
      {
        "id": "01950000-0000-7000-8000-000000000312",
        "reasonKind": "DISQUALIFICATION",
        "code": "FIT",
        "nameEn": "Not a fit",
        "nameAr": "غير مناسب",
        "definitionEn": null,
        "definitionAr": null,
        "polarity": null,
        "activityType": null,
        "isSystem": false,
        "isActive": true,
        "sortOrder": 20,
        "revision": 1
      },
      {
        "id": "01950000-0000-7000-8000-000000000313",
        "reasonKind": "DISQUALIFICATION",
        "code": "UNREACHABLE",
        "nameEn": "Unreachable",
        "nameAr": "تعذّر الوصول",
        "definitionEn": null,
        "definitionAr": null,
        "polarity": null,
        "activityType": null,
        "isSystem": false,
        "isActive": true,
        "sortOrder": 30,
        "revision": 1
      },
      {
        "id": "01950000-0000-7000-8000-000000000314",
        "reasonKind": "DISQUALIFICATION",
        "code": "CONFIRMED_DUPLICATE",
        "nameEn": "Confirmed duplicate",
        "nameAr": "مكرر مؤكد",
        "definitionEn": null,
        "definitionAr": null,
        "polarity": null,
        "activityType": null,
        "isSystem": false,
        "isActive": true,
        "sortOrder": 40,
        "revision": 1
      },
      {
        "id": "01950000-0000-7000-8000-000000000315",
        "reasonKind": "DISQUALIFICATION",
        "code": "OTHER",
        "nameEn": "Other",
        "nameAr": "سبب آخر",
        "definitionEn": null,
        "definitionAr": null,
        "polarity": null,
        "activityType": null,
        "isSystem": true,
        "isActive": true,
        "sortOrder": 90,
        "revision": 1
      },
      {
        "id": "01950000-0000-7000-8000-000000000301",
        "reasonKind": "LOSS",
        "code": "PRICE",
        "nameEn": "Price",
        "nameAr": "السعر",
        "definitionEn": null,
        "definitionAr": null,
        "polarity": null,
        "activityType": null,
        "isSystem": false,
        "isActive": true,
        "sortOrder": 10,
        "revision": 1
      },
      {
        "id": "01950000-0000-7000-8000-000000000302",
        "reasonKind": "LOSS",
        "code": "COMPETITOR",
        "nameEn": "Chose a competitor",
        "nameAr": "اختار منافسًا",
        "definitionEn": null,
        "definitionAr": null,
        "polarity": null,
        "activityType": null,
        "isSystem": false,
        "isActive": true,
        "sortOrder": 20,
        "revision": 1
      },
      {
        "id": "01950000-0000-7000-8000-000000000303",
        "reasonKind": "LOSS",
        "code": "TIMING",
        "nameEn": "Timing",
        "nameAr": "التوقيت غير مناسب",
        "definitionEn": null,
        "definitionAr": null,
        "polarity": null,
        "activityType": null,
        "isSystem": false,
        "isActive": true,
        "sortOrder": 30,
        "revision": 1
      },
      {
        "id": "01950000-0000-7000-8000-000000000304",
        "reasonKind": "LOSS",
        "code": "NO_RESPONSE",
        "nameEn": "No response",
        "nameAr": "لا استجابة من العميل",
        "definitionEn": null,
        "definitionAr": null,
        "polarity": null,
        "activityType": null,
        "isSystem": false,
        "isActive": true,
        "sortOrder": 40,
        "revision": 1
      },
      {
        "id": "01950000-0000-7000-8000-000000000305",
        "reasonKind": "LOSS",
        "code": "OTHER",
        "nameEn": "Other",
        "nameAr": "سبب آخر",
        "definitionEn": null,
        "definitionAr": null,
        "polarity": null,
        "activityType": null,
        "isSystem": true,
        "isActive": true,
        "sortOrder": 90,
        "revision": 1
      },
      {
        "id": "01950000-0000-7000-8000-000000000306",
        "reasonKind": "LOSS",
        "code": "LEGACY_UNMAPPED",
        "nameEn": "Legacy reason (unmapped)",
        "nameAr": "سبب قديم غير مصنّف",
        "definitionEn": "A loss reason recorded as free text before governed reasons existed that matched no code.",
        "definitionAr": "سبب خسارة سُجّل نصًا حرًا قبل اعتماد الأسباب المنظّمة ولم يطابق أي رمز.",
        "polarity": null,
        "activityType": null,
        "isSystem": true,
        "isActive": true,
        "sortOrder": 99,
        "revision": 1
      },
      {
        "id": "01950000-0000-7000-8000-000000000307",
        "reasonKind": "WIN",
        "code": "VALUE_FIT",
        "nameEn": "Value fit",
        "nameAr": "ملاءمة القيمة",
        "definitionEn": null,
        "definitionAr": null,
        "polarity": null,
        "activityType": null,
        "isSystem": false,
        "isActive": true,
        "sortOrder": 10,
        "revision": 1
      },
      {
        "id": "01950000-0000-7000-8000-000000000308",
        "reasonKind": "WIN",
        "code": "RELATIONSHIP",
        "nameEn": "Relationship",
        "nameAr": "العلاقة مع العميل",
        "definitionEn": null,
        "definitionAr": null,
        "polarity": null,
        "activityType": null,
        "isSystem": false,
        "isActive": true,
        "sortOrder": 20,
        "revision": 1
      },
      {
        "id": "01950000-0000-7000-8000-000000000309",
        "reasonKind": "WIN",
        "code": "PRICE",
        "nameEn": "Price",
        "nameAr": "السعر",
        "definitionEn": null,
        "definitionAr": null,
        "polarity": null,
        "activityType": null,
        "isSystem": false,
        "isActive": true,
        "sortOrder": 30,
        "revision": 1
      },
      {
        "id": "01950000-0000-7000-8000-000000000310",
        "reasonKind": "WIN",
        "code": "OTHER",
        "nameEn": "Other",
        "nameAr": "سبب آخر",
        "definitionEn": null,
        "definitionAr": null,
        "polarity": null,
        "activityType": null,
        "isSystem": true,
        "isActive": true,
        "sortOrder": 90,
        "revision": 1
      }
    ]
  },
  "/static-data": {
    "pagination": {
      "pageSizes": [
        20,
        50,
        100
      ],
      "defaultPageSize": 20,
      "maxPageSize": 100
    },
    "enums": {
      "profileTypes": [
        "INDIVIDUAL",
        "CORPORATE"
      ],
      "customerStatuses": [
        "PROSPECT",
        "ACTIVE_CUSTOMER",
        "INACTIVE",
        "BLACKLISTED"
      ],
      "leadStatuses": [
        "OPEN",
        "CONVERTED",
        "DISQUALIFIED",
        "ON_HOLD"
      ],
      "leadStageFlags": [
        "NEW",
        "CONTACTED",
        "QUALIFYING",
        "QUALIFIED",
        "DISQUALIFIED",
        "CONVERTED",
        "NURTURING",
        "ON_HOLD"
      ],
      "opportunityStatuses": [
        "IN_PROGRESS",
        "ON_HOLD",
        "WON",
        "LOST"
      ],
      "opportunityStageFlags": [
        "NEW",
        "DISCOVERY",
        "QUALIFICATION",
        "PROPOSAL",
        "NEGOTIATION",
        "CONTRACTING",
        "ON_HOLD",
        "WON",
        "LOST"
      ],
      "customFieldOwnerTypes": [
        "PARTY",
        "LEAD",
        "LEAD_AND_PARTY",
        "CUSTOMER_PROFILE",
        "OPPORTUNITY"
      ],
      "customFieldTypes": [
        "TEXT",
        "TEXTAREA",
        "NUMBER",
        "DATE",
        "DATETIME",
        "BOOLEAN",
        "SELECT",
        "MULTI_SELECT",
        "URL",
        "EMAIL",
        "PHONE"
      ],
      "fieldRequirementOperations": [
        "CREATE",
        "UPDATE",
        "CONVERT"
      ],
      "activityTypes": [
        "CALL",
        "MEETING",
        "EMAIL",
        "VISIT",
        "NOTE",
        "FOLLOW_UP",
        "OTHER"
      ],
      "activityStatuses": [
        "OPEN",
        "DONE"
      ]
    },
    "enumOptions": {
      "profileTypes": [
        {
          "value": "INDIVIDUAL",
          "label": {
            "en": "Individual",
            "ar": "فرد"
          }
        },
        {
          "value": "CORPORATE",
          "label": {
            "en": "Corporate",
            "ar": "شركة / مؤسسة"
          }
        }
      ],
      "customerStatuses": [
        {
          "value": "PROSPECT",
          "label": {
            "en": "Prospect",
            "ar": "عميل محتمل"
          }
        },
        {
          "value": "ACTIVE_CUSTOMER",
          "label": {
            "en": "Active customer",
            "ar": "عميل نشط"
          }
        },
        {
          "value": "INACTIVE",
          "label": {
            "en": "Inactive",
            "ar": "غير نشط"
          }
        },
        {
          "value": "BLACKLISTED",
          "label": {
            "en": "Blacklisted",
            "ar": "محظور"
          }
        }
      ],
      "leadStatuses": [
        {
          "value": "OPEN",
          "label": {
            "en": "Open",
            "ar": "مفتوح"
          }
        },
        {
          "value": "CONVERTED",
          "label": {
            "en": "Converted",
            "ar": "تم التحويل"
          }
        },
        {
          "value": "DISQUALIFIED",
          "label": {
            "en": "Disqualified",
            "ar": "غير مؤهل"
          }
        },
        {
          "value": "ON_HOLD",
          "label": {
            "en": "On hold",
            "ar": "معلق"
          }
        }
      ],
      "leadStageFlags": [
        {
          "value": "NEW",
          "label": {
            "en": "New",
            "ar": "جديد"
          }
        },
        {
          "value": "CONTACTED",
          "label": {
            "en": "Contacted",
            "ar": "تم التواصل"
          }
        },
        {
          "value": "QUALIFYING",
          "label": {
            "en": "Qualifying",
            "ar": "تحت التأهيل"
          }
        },
        {
          "value": "QUALIFIED",
          "label": {
            "en": "Qualified",
            "ar": "مؤهل"
          }
        },
        {
          "value": "DISQUALIFIED",
          "label": {
            "en": "Disqualified",
            "ar": "غير مؤهل"
          }
        },
        {
          "value": "CONVERTED",
          "label": {
            "en": "Converted",
            "ar": "تم التحويل"
          }
        },
        {
          "value": "NURTURING",
          "label": {
            "en": "Nurturing",
            "ar": "متابعة لاحقة"
          }
        },
        {
          "value": "ON_HOLD",
          "label": {
            "en": "On hold",
            "ar": "معلق"
          }
        }
      ],
      "opportunityStatuses": [
        {
          "value": "IN_PROGRESS",
          "label": {
            "en": "In progress",
            "ar": "قيد التنفيذ"
          }
        },
        {
          "value": "ON_HOLD",
          "label": {
            "en": "On hold",
            "ar": "معلق"
          }
        },
        {
          "value": "WON",
          "label": {
            "en": "Won",
            "ar": "تم الفوز"
          }
        },
        {
          "value": "LOST",
          "label": {
            "en": "Lost",
            "ar": "خسارة"
          }
        }
      ],
      "opportunityStageFlags": [
        {
          "value": "NEW",
          "label": {
            "en": "New",
            "ar": "جديد"
          }
        },
        {
          "value": "DISCOVERY",
          "label": {
            "en": "Discovery",
            "ar": "استكشاف"
          }
        },
        {
          "value": "QUALIFICATION",
          "label": {
            "en": "Qualification",
            "ar": "تأهيل"
          }
        },
        {
          "value": "PROPOSAL",
          "label": {
            "en": "Proposal",
            "ar": "عرض"
          }
        },
        {
          "value": "NEGOTIATION",
          "label": {
            "en": "Negotiation",
            "ar": "تفاوض"
          }
        },
        {
          "value": "CONTRACTING",
          "label": {
            "en": "Contracting",
            "ar": "تعاقد"
          }
        },
        {
          "value": "ON_HOLD",
          "label": {
            "en": "On hold",
            "ar": "معلق"
          }
        },
        {
          "value": "WON",
          "label": {
            "en": "Won",
            "ar": "تم الفوز"
          }
        },
        {
          "value": "LOST",
          "label": {
            "en": "Lost",
            "ar": "خسارة"
          }
        }
      ],
      "customFieldOwnerTypes": [
        {
          "value": "PARTY",
          "label": {
            "en": "Party",
            "ar": "طرف"
          }
        },
        {
          "value": "LEAD",
          "label": {
            "en": "Lead",
            "ar": "عميل محتمل"
          }
        },
        {
          "value": "LEAD_AND_PARTY",
          "label": {
            "en": "Lead and party",
            "ar": "عميل محتمل وطرف"
          }
        },
        {
          "value": "CUSTOMER_PROFILE",
          "label": {
            "en": "Customer profile",
            "ar": "ملف العميل"
          }
        },
        {
          "value": "OPPORTUNITY",
          "label": {
            "en": "Opportunity",
            "ar": "فرصة"
          }
        }
      ],
      "customFieldTypes": [
        {
          "value": "TEXT",
          "label": {
            "en": "Text",
            "ar": "نص"
          }
        },
        {
          "value": "TEXTAREA",
          "label": {
            "en": "Long text",
            "ar": "نص طويل"
          }
        },
        {
          "value": "NUMBER",
          "label": {
            "en": "Number",
            "ar": "رقم"
          }
        },
        {
          "value": "DATE",
          "label": {
            "en": "Date",
            "ar": "تاريخ"
          }
        },
        {
          "value": "DATETIME",
          "label": {
            "en": "Date and time",
            "ar": "تاريخ ووقت"
          }
        },
        {
          "value": "BOOLEAN",
          "label": {
            "en": "Yes / No",
            "ar": "نعم / لا"
          }
        },
        {
          "value": "SELECT",
          "label": {
            "en": "Single select",
            "ar": "اختيار واحد"
          }
        },
        {
          "value": "MULTI_SELECT",
          "label": {
            "en": "Multi select",
            "ar": "اختيارات متعددة"
          }
        },
        {
          "value": "URL",
          "label": {
            "en": "URL",
            "ar": "رابط"
          }
        },
        {
          "value": "EMAIL",
          "label": {
            "en": "Email",
            "ar": "بريد إلكتروني"
          }
        },
        {
          "value": "PHONE",
          "label": {
            "en": "Phone",
            "ar": "هاتف"
          }
        }
      ],
      "fieldRequirementOperations": [
        {
          "value": "CREATE",
          "label": {
            "en": "Create",
            "ar": "إنشاء"
          }
        },
        {
          "value": "UPDATE",
          "label": {
            "en": "Update",
            "ar": "تحديث"
          }
        },
        {
          "value": "CONVERT",
          "label": {
            "en": "Convert",
            "ar": "تحويل"
          }
        }
      ],
      "activityTypes": [
        {
          "value": "CALL",
          "label": {
            "en": "Call",
            "ar": "مكالمة"
          }
        },
        {
          "value": "MEETING",
          "label": {
            "en": "Meeting",
            "ar": "اجتماع"
          }
        },
        {
          "value": "EMAIL",
          "label": {
            "en": "Email",
            "ar": "بريد إلكتروني"
          }
        },
        {
          "value": "VISIT",
          "label": {
            "en": "Visit",
            "ar": "زيارة"
          }
        },
        {
          "value": "NOTE",
          "label": {
            "en": "Note",
            "ar": "ملاحظة"
          }
        },
        {
          "value": "FOLLOW_UP",
          "label": {
            "en": "Follow up",
            "ar": "متابعة"
          }
        },
        {
          "value": "OTHER",
          "label": {
            "en": "Other",
            "ar": "أخرى"
          }
        }
      ],
      "activityStatuses": [
        {
          "value": "OPEN",
          "label": {
            "en": "Open",
            "ar": "مفتوح"
          }
        },
        {
          "value": "DONE",
          "label": {
            "en": "Done",
            "ar": "تم"
          }
        }
      ]
    },
    "attachmentPolicy": {
      "maxSizeBytes": 26214400,
      "allowedMimeTypes": {
        "pdf": [
          "application/pdf"
        ],
        "images": [
          "image/png",
          "image/jpeg",
          "image/webp"
        ],
        "word": [
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ],
        "excel": [
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ],
        "text": [
          "text/csv",
          "text/plain"
        ]
      },
      "allowedExtensions": {
        "pdf": [
          ".pdf"
        ],
        "images": [
          ".png",
          ".jpeg",
          ".jpg",
          ".webp"
        ],
        "word": [
          ".docx"
        ],
        "excel": [
          ".xlsx"
        ],
        "text": [
          ".csv",
          ".txt"
        ]
      },
      "rejectedFamilies": [
        "executables",
        "scripts",
        "archives",
        "html",
        "unknown_binary"
      ],
      "familyLabels": [
        {
          "value": "pdf",
          "label": {
            "en": "PDF",
            "ar": "PDF"
          }
        },
        {
          "value": "images",
          "label": {
            "en": "Images",
            "ar": "صور"
          }
        },
        {
          "value": "word",
          "label": {
            "en": "Word documents",
            "ar": "مستندات Word"
          }
        },
        {
          "value": "excel",
          "label": {
            "en": "Excel spreadsheets",
            "ar": "جداول Excel"
          }
        },
        {
          "value": "text",
          "label": {
            "en": "Text files",
            "ar": "ملفات نصية"
          }
        }
      ],
      "rejectedFamilyLabels": [
        {
          "value": "executables",
          "label": {
            "en": "Executables",
            "ar": "ملفات تشغيلية"
          }
        },
        {
          "value": "scripts",
          "label": {
            "en": "Scripts",
            "ar": "سكريبتات"
          }
        },
        {
          "value": "archives",
          "label": {
            "en": "Archives",
            "ar": "ملفات مضغوطة"
          }
        },
        {
          "value": "html",
          "label": {
            "en": "HTML files",
            "ar": "ملفات HTML"
          }
        },
        {
          "value": "unknown_binary",
          "label": {
            "en": "Unknown binary files",
            "ar": "ملفات ثنائية غير معروفة"
          }
        }
      ]
    },
    "permissions": [
      "crm.customer_profiles.export",
      "crm.customer_profiles.status.manage",
      "crm.leads.export",
      "crm.opportunities.export",
      "crm.settings.read",
      "crm.settings.manage",
      "crm.lead_stages.read",
      "crm.lead_stages.manage",
      "crm.acquisition_sources.read",
      "crm.acquisition_sources.manage",
      "crm.tags.read",
      "crm.tags.manage",
      "crm.pipelines.read",
      "crm.pipelines.manage",
      "crm.custom_fields.read",
      "crm.custom_fields.manage",
      "crm.dashboards.create",
      "crm.dashboards.update",
      "crm.dashboards.delete",
      "crm.dashboards.share",
      "crm.targets.manage",
      "crm.targets.approve",
      "crm.sla.manage",
      "crm.alerts.manage",
      "crm.subscriptions.manage",
      "crm.exports.create",
      "crm.analytics.readiness.view",
      "crm.inquiry_identities.manage",
      "crm.inquiry_identities.classification.read",
      "crm.widgets.read",
      "crm.widgets.create",
      "crm.widgets.update",
      "crm.widgets.publish",
      "crm.widgets.delete",
      "crm.widgets.share",
      "crm.widgets.transfer_ownership",
      "crm.customer_profiles.read.own",
      "crm.customer_profiles.read.team",
      "crm.customer_profiles.read.all",
      "crm.customer_profiles.create.own",
      "crm.customer_profiles.create.team",
      "crm.customer_profiles.create.all",
      "crm.customer_profiles.update.own",
      "crm.customer_profiles.update.team",
      "crm.customer_profiles.update.all",
      "crm.customer_profiles.delete.own",
      "crm.customer_profiles.delete.team",
      "crm.customer_profiles.delete.all",
      "crm.leads.read.own",
      "crm.leads.read.team",
      "crm.leads.read.all",
      "crm.leads.create.own",
      "crm.leads.create.team",
      "crm.leads.create.all",
      "crm.leads.update.own",
      "crm.leads.update.team",
      "crm.leads.update.all",
      "crm.leads.convert.own",
      "crm.leads.convert.team",
      "crm.leads.convert.all",
      "crm.leads.delete.own",
      "crm.leads.delete.team",
      "crm.leads.delete.all",
      "crm.opportunities.read.own",
      "crm.opportunities.read.team",
      "crm.opportunities.read.all",
      "crm.opportunities.create.own",
      "crm.opportunities.create.team",
      "crm.opportunities.create.all",
      "crm.opportunities.update.own",
      "crm.opportunities.update.team",
      "crm.opportunities.update.all",
      "crm.opportunities.delete.own",
      "crm.opportunities.delete.team",
      "crm.opportunities.delete.all",
      "crm.activities.read.own",
      "crm.activities.read.team",
      "crm.activities.read.all",
      "crm.activities.create.own",
      "crm.activities.create.team",
      "crm.activities.create.all",
      "crm.activities.update.own",
      "crm.activities.update.team",
      "crm.activities.update.all",
      "crm.activities.delete.own",
      "crm.activities.delete.team",
      "crm.activities.delete.all",
      "crm.notes.read.own",
      "crm.notes.read.team",
      "crm.notes.read.all",
      "crm.notes.create.own",
      "crm.notes.create.team",
      "crm.notes.create.all",
      "crm.notes.update.own",
      "crm.notes.update.team",
      "crm.notes.update.all",
      "crm.notes.delete.own",
      "crm.notes.delete.team",
      "crm.notes.delete.all",
      "crm.attachments.read.own",
      "crm.attachments.read.team",
      "crm.attachments.read.all",
      "crm.attachments.create.own",
      "crm.attachments.create.team",
      "crm.attachments.create.all",
      "crm.attachments.delete.own",
      "crm.attachments.delete.team",
      "crm.attachments.delete.all",
      "crm.dashboards.read.own",
      "crm.dashboards.read.team",
      "crm.dashboards.read.all",
      "crm.targets.read.own",
      "crm.targets.read.team",
      "crm.targets.read.all",
      "crm.email.send.own",
      "crm.email.send.team",
      "crm.email.send.all"
    ],
    "permissionOptions": [
      {
        "value": "crm.customer_profiles.export",
        "label": {
          "en": "Export customer profiles",
          "ar": "تصدير ملفات العملاء"
        }
      },
      {
        "value": "crm.customer_profiles.status.manage",
        "label": {
          "en": "Manage customer status",
          "ar": "إدارة حالة العميل"
        }
      },
      {
        "value": "crm.leads.export",
        "label": {
          "en": "Export leads",
          "ar": "تصدير العملاء المحتملين"
        }
      },
      {
        "value": "crm.opportunities.export",
        "label": {
          "en": "Export opportunities",
          "ar": "تصدير الفرص"
        }
      },
      {
        "value": "crm.settings.read",
        "label": {
          "en": "Read CRM settings",
          "ar": "عرض إعدادات إدارة العملاء"
        }
      },
      {
        "value": "crm.settings.manage",
        "label": {
          "en": "Manage CRM settings",
          "ar": "إدارة إعدادات إدارة العملاء"
        }
      },
      {
        "value": "crm.lead_stages.read",
        "label": {
          "en": "Read lead stages",
          "ar": "عرض مراحل العملاء المحتملين"
        }
      },
      {
        "value": "crm.lead_stages.manage",
        "label": {
          "en": "Manage lead stages",
          "ar": "إدارة مراحل العملاء المحتملين"
        }
      },
      {
        "value": "crm.acquisition_sources.read",
        "label": {
          "en": "Read lead sources",
          "ar": "عرض مصادر العملاء"
        }
      },
      {
        "value": "crm.acquisition_sources.manage",
        "label": {
          "en": "Manage lead sources",
          "ar": "إدارة مصادر العملاء"
        }
      },
      {
        "value": "crm.tags.read",
        "label": {
          "en": "Read tags",
          "ar": "عرض الوسوم"
        }
      },
      {
        "value": "crm.tags.manage",
        "label": {
          "en": "Manage tags",
          "ar": "إدارة الوسوم"
        }
      },
      {
        "value": "crm.pipelines.read",
        "label": {
          "en": "Read pipelines",
          "ar": "عرض مسارات البيع"
        }
      },
      {
        "value": "crm.pipelines.manage",
        "label": {
          "en": "Manage pipelines",
          "ar": "إدارة مسارات البيع"
        }
      },
      {
        "value": "crm.custom_fields.read",
        "label": {
          "en": "Read custom fields",
          "ar": "عرض الحقول المخصصة"
        }
      },
      {
        "value": "crm.custom_fields.manage",
        "label": {
          "en": "Manage custom fields",
          "ar": "إدارة الحقول المخصصة"
        }
      },
      {
        "value": "crm.dashboards.create",
        "label": {
          "en": "Create dashboards",
          "ar": "إنشاء لوحات المعلومات"
        }
      },
      {
        "value": "crm.dashboards.update",
        "label": {
          "en": "Update dashboards",
          "ar": "تعديل لوحات المعلومات"
        }
      },
      {
        "value": "crm.dashboards.delete",
        "label": {
          "en": "Delete dashboards",
          "ar": "حذف لوحات المعلومات"
        }
      },
      {
        "value": "crm.dashboards.share",
        "label": {
          "en": "Share dashboards",
          "ar": "مشاركة لوحات المعلومات"
        }
      },
      {
        "value": "crm.targets.manage",
        "label": {
          "en": "crm targets manage",
          "ar": "crm targets manage"
        }
      },
      {
        "value": "crm.targets.approve",
        "label": {
          "en": "crm targets approve",
          "ar": "crm targets approve"
        }
      },
      {
        "value": "crm.sla.manage",
        "label": {
          "en": "crm sla manage",
          "ar": "crm sla manage"
        }
      },
      {
        "value": "crm.alerts.manage",
        "label": {
          "en": "crm alerts manage",
          "ar": "crm alerts manage"
        }
      },
      {
        "value": "crm.subscriptions.manage",
        "label": {
          "en": "crm subscriptions manage",
          "ar": "crm subscriptions manage"
        }
      },
      {
        "value": "crm.exports.create",
        "label": {
          "en": "crm exports create",
          "ar": "crm exports create"
        }
      },
      {
        "value": "crm.analytics.readiness.view",
        "label": {
          "en": "crm analytics readiness view",
          "ar": "crm analytics readiness view"
        }
      },
      {
        "value": "crm.inquiry_identities.manage",
        "label": {
          "en": "crm inquiry identities manage",
          "ar": "crm inquiry identities manage"
        }
      },
      {
        "value": "crm.inquiry_identities.classification.read",
        "label": {
          "en": "crm inquiry identities classification read",
          "ar": "crm inquiry identities classification read"
        }
      },
      {
        "value": "crm.widgets.read",
        "label": {
          "en": "Read dashboard widgets",
          "ar": "عرض عناصر لوحات المعلومات"
        }
      },
      {
        "value": "crm.widgets.create",
        "label": {
          "en": "Create dashboard widgets",
          "ar": "إنشاء عناصر لوحات المعلومات"
        }
      },
      {
        "value": "crm.widgets.update",
        "label": {
          "en": "Update dashboard widgets",
          "ar": "تعديل عناصر لوحات المعلومات"
        }
      },
      {
        "value": "crm.widgets.publish",
        "label": {
          "en": "crm widgets publish",
          "ar": "crm widgets publish"
        }
      },
      {
        "value": "crm.widgets.delete",
        "label": {
          "en": "Delete dashboard widgets",
          "ar": "حذف عناصر لوحات المعلومات"
        }
      },
      {
        "value": "crm.widgets.share",
        "label": {
          "en": "Share dashboard widgets",
          "ar": "مشاركة عناصر لوحات المعلومات"
        }
      },
      {
        "value": "crm.widgets.transfer_ownership",
        "label": {
          "en": "crm widgets transfer ownership",
          "ar": "crm widgets transfer ownership"
        }
      },
      {
        "value": "crm.customer_profiles.read.own",
        "label": {
          "en": "Read customer profiles (own)",
          "ar": "عرض ملفات العملاء (الخاصة بي)"
        }
      },
      {
        "value": "crm.customer_profiles.read.team",
        "label": {
          "en": "Read customer profiles (team)",
          "ar": "عرض ملفات العملاء (الفريق)"
        }
      },
      {
        "value": "crm.customer_profiles.read.all",
        "label": {
          "en": "Read customer profiles (all)",
          "ar": "عرض ملفات العملاء (الكل)"
        }
      },
      {
        "value": "crm.customer_profiles.create.own",
        "label": {
          "en": "Create customer profiles (own)",
          "ar": "إنشاء ملفات العملاء (الخاصة بي)"
        }
      },
      {
        "value": "crm.customer_profiles.create.team",
        "label": {
          "en": "Create customer profiles (team)",
          "ar": "إنشاء ملفات العملاء (الفريق)"
        }
      },
      {
        "value": "crm.customer_profiles.create.all",
        "label": {
          "en": "Create customer profiles (all)",
          "ar": "إنشاء ملفات العملاء (الكل)"
        }
      },
      {
        "value": "crm.customer_profiles.update.own",
        "label": {
          "en": "Update customer profiles (own)",
          "ar": "تعديل ملفات العملاء (الخاصة بي)"
        }
      },
      {
        "value": "crm.customer_profiles.update.team",
        "label": {
          "en": "Update customer profiles (team)",
          "ar": "تعديل ملفات العملاء (الفريق)"
        }
      },
      {
        "value": "crm.customer_profiles.update.all",
        "label": {
          "en": "Update customer profiles (all)",
          "ar": "تعديل ملفات العملاء (الكل)"
        }
      },
      {
        "value": "crm.customer_profiles.delete.own",
        "label": {
          "en": "Delete customer profiles (own)",
          "ar": "حذف ملفات العملاء (الخاصة بي)"
        }
      },
      {
        "value": "crm.customer_profiles.delete.team",
        "label": {
          "en": "Delete customer profiles (team)",
          "ar": "حذف ملفات العملاء (الفريق)"
        }
      },
      {
        "value": "crm.customer_profiles.delete.all",
        "label": {
          "en": "Delete customer profiles (all)",
          "ar": "حذف ملفات العملاء (الكل)"
        }
      },
      {
        "value": "crm.leads.read.own",
        "label": {
          "en": "Read leads (own)",
          "ar": "عرض العملاء المحتملين (الخاصة بي)"
        }
      },
      {
        "value": "crm.leads.read.team",
        "label": {
          "en": "Read leads (team)",
          "ar": "عرض العملاء المحتملين (الفريق)"
        }
      },
      {
        "value": "crm.leads.read.all",
        "label": {
          "en": "Read leads (all)",
          "ar": "عرض العملاء المحتملين (الكل)"
        }
      },
      {
        "value": "crm.leads.create.own",
        "label": {
          "en": "Create leads (own)",
          "ar": "إنشاء العملاء المحتملين (الخاصة بي)"
        }
      },
      {
        "value": "crm.leads.create.team",
        "label": {
          "en": "Create leads (team)",
          "ar": "إنشاء العملاء المحتملين (الفريق)"
        }
      },
      {
        "value": "crm.leads.create.all",
        "label": {
          "en": "Create leads (all)",
          "ar": "إنشاء العملاء المحتملين (الكل)"
        }
      },
      {
        "value": "crm.leads.update.own",
        "label": {
          "en": "Update leads (own)",
          "ar": "تعديل العملاء المحتملين (الخاصة بي)"
        }
      },
      {
        "value": "crm.leads.update.team",
        "label": {
          "en": "Update leads (team)",
          "ar": "تعديل العملاء المحتملين (الفريق)"
        }
      },
      {
        "value": "crm.leads.update.all",
        "label": {
          "en": "Update leads (all)",
          "ar": "تعديل العملاء المحتملين (الكل)"
        }
      },
      {
        "value": "crm.leads.convert.own",
        "label": {
          "en": "Convert leads (own)",
          "ar": "تحويل العملاء المحتملين (الخاصة بي)"
        }
      },
      {
        "value": "crm.leads.convert.team",
        "label": {
          "en": "Convert leads (team)",
          "ar": "تحويل العملاء المحتملين (الفريق)"
        }
      },
      {
        "value": "crm.leads.convert.all",
        "label": {
          "en": "Convert leads (all)",
          "ar": "تحويل العملاء المحتملين (الكل)"
        }
      },
      {
        "value": "crm.leads.delete.own",
        "label": {
          "en": "Delete leads (own)",
          "ar": "حذف العملاء المحتملين (الخاصة بي)"
        }
      },
      {
        "value": "crm.leads.delete.team",
        "label": {
          "en": "Delete leads (team)",
          "ar": "حذف العملاء المحتملين (الفريق)"
        }
      },
      {
        "value": "crm.leads.delete.all",
        "label": {
          "en": "Delete leads (all)",
          "ar": "حذف العملاء المحتملين (الكل)"
        }
      },
      {
        "value": "crm.opportunities.read.own",
        "label": {
          "en": "Read opportunities (own)",
          "ar": "عرض الفرص (الخاصة بي)"
        }
      },
      {
        "value": "crm.opportunities.read.team",
        "label": {
          "en": "Read opportunities (team)",
          "ar": "عرض الفرص (الفريق)"
        }
      },
      {
        "value": "crm.opportunities.read.all",
        "label": {
          "en": "Read opportunities (all)",
          "ar": "عرض الفرص (الكل)"
        }
      },
      {
        "value": "crm.opportunities.create.own",
        "label": {
          "en": "Create opportunities (own)",
          "ar": "إنشاء الفرص (الخاصة بي)"
        }
      },
      {
        "value": "crm.opportunities.create.team",
        "label": {
          "en": "Create opportunities (team)",
          "ar": "إنشاء الفرص (الفريق)"
        }
      },
      {
        "value": "crm.opportunities.create.all",
        "label": {
          "en": "Create opportunities (all)",
          "ar": "إنشاء الفرص (الكل)"
        }
      },
      {
        "value": "crm.opportunities.update.own",
        "label": {
          "en": "Update opportunities (own)",
          "ar": "تعديل الفرص (الخاصة بي)"
        }
      },
      {
        "value": "crm.opportunities.update.team",
        "label": {
          "en": "Update opportunities (team)",
          "ar": "تعديل الفرص (الفريق)"
        }
      },
      {
        "value": "crm.opportunities.update.all",
        "label": {
          "en": "Update opportunities (all)",
          "ar": "تعديل الفرص (الكل)"
        }
      },
      {
        "value": "crm.opportunities.delete.own",
        "label": {
          "en": "Delete opportunities (own)",
          "ar": "حذف الفرص (الخاصة بي)"
        }
      },
      {
        "value": "crm.opportunities.delete.team",
        "label": {
          "en": "Delete opportunities (team)",
          "ar": "حذف الفرص (الفريق)"
        }
      },
      {
        "value": "crm.opportunities.delete.all",
        "label": {
          "en": "Delete opportunities (all)",
          "ar": "حذف الفرص (الكل)"
        }
      },
      {
        "value": "crm.activities.read.own",
        "label": {
          "en": "Read activities (own)",
          "ar": "عرض الأنشطة (الخاصة بي)"
        }
      },
      {
        "value": "crm.activities.read.team",
        "label": {
          "en": "Read activities (team)",
          "ar": "عرض الأنشطة (الفريق)"
        }
      },
      {
        "value": "crm.activities.read.all",
        "label": {
          "en": "Read activities (all)",
          "ar": "عرض الأنشطة (الكل)"
        }
      },
      {
        "value": "crm.activities.create.own",
        "label": {
          "en": "Create activities (own)",
          "ar": "إنشاء الأنشطة (الخاصة بي)"
        }
      },
      {
        "value": "crm.activities.create.team",
        "label": {
          "en": "Create activities (team)",
          "ar": "إنشاء الأنشطة (الفريق)"
        }
      },
      {
        "value": "crm.activities.create.all",
        "label": {
          "en": "Create activities (all)",
          "ar": "إنشاء الأنشطة (الكل)"
        }
      },
      {
        "value": "crm.activities.update.own",
        "label": {
          "en": "Update activities (own)",
          "ar": "تعديل الأنشطة (الخاصة بي)"
        }
      },
      {
        "value": "crm.activities.update.team",
        "label": {
          "en": "Update activities (team)",
          "ar": "تعديل الأنشطة (الفريق)"
        }
      },
      {
        "value": "crm.activities.update.all",
        "label": {
          "en": "Update activities (all)",
          "ar": "تعديل الأنشطة (الكل)"
        }
      },
      {
        "value": "crm.activities.delete.own",
        "label": {
          "en": "Delete activities (own)",
          "ar": "حذف الأنشطة (الخاصة بي)"
        }
      },
      {
        "value": "crm.activities.delete.team",
        "label": {
          "en": "Delete activities (team)",
          "ar": "حذف الأنشطة (الفريق)"
        }
      },
      {
        "value": "crm.activities.delete.all",
        "label": {
          "en": "Delete activities (all)",
          "ar": "حذف الأنشطة (الكل)"
        }
      },
      {
        "value": "crm.notes.read.own",
        "label": {
          "en": "Read notes (own)",
          "ar": "عرض الملاحظات (الخاصة بي)"
        }
      },
      {
        "value": "crm.notes.read.team",
        "label": {
          "en": "Read notes (team)",
          "ar": "عرض الملاحظات (الفريق)"
        }
      },
      {
        "value": "crm.notes.read.all",
        "label": {
          "en": "Read notes (all)",
          "ar": "عرض الملاحظات (الكل)"
        }
      },
      {
        "value": "crm.notes.create.own",
        "label": {
          "en": "Create notes (own)",
          "ar": "إنشاء الملاحظات (الخاصة بي)"
        }
      },
      {
        "value": "crm.notes.create.team",
        "label": {
          "en": "Create notes (team)",
          "ar": "إنشاء الملاحظات (الفريق)"
        }
      },
      {
        "value": "crm.notes.create.all",
        "label": {
          "en": "Create notes (all)",
          "ar": "إنشاء الملاحظات (الكل)"
        }
      },
      {
        "value": "crm.notes.update.own",
        "label": {
          "en": "Update notes (own)",
          "ar": "تعديل الملاحظات (الخاصة بي)"
        }
      },
      {
        "value": "crm.notes.update.team",
        "label": {
          "en": "Update notes (team)",
          "ar": "تعديل الملاحظات (الفريق)"
        }
      },
      {
        "value": "crm.notes.update.all",
        "label": {
          "en": "Update notes (all)",
          "ar": "تعديل الملاحظات (الكل)"
        }
      },
      {
        "value": "crm.notes.delete.own",
        "label": {
          "en": "Delete notes (own)",
          "ar": "حذف الملاحظات (الخاصة بي)"
        }
      },
      {
        "value": "crm.notes.delete.team",
        "label": {
          "en": "Delete notes (team)",
          "ar": "حذف الملاحظات (الفريق)"
        }
      },
      {
        "value": "crm.notes.delete.all",
        "label": {
          "en": "Delete notes (all)",
          "ar": "حذف الملاحظات (الكل)"
        }
      },
      {
        "value": "crm.attachments.read.own",
        "label": {
          "en": "Read attachments (own)",
          "ar": "عرض المرفقات (الخاصة بي)"
        }
      },
      {
        "value": "crm.attachments.read.team",
        "label": {
          "en": "Read attachments (team)",
          "ar": "عرض المرفقات (الفريق)"
        }
      },
      {
        "value": "crm.attachments.read.all",
        "label": {
          "en": "Read attachments (all)",
          "ar": "عرض المرفقات (الكل)"
        }
      },
      {
        "value": "crm.attachments.create.own",
        "label": {
          "en": "Create attachments (own)",
          "ar": "إنشاء المرفقات (الخاصة بي)"
        }
      },
      {
        "value": "crm.attachments.create.team",
        "label": {
          "en": "Create attachments (team)",
          "ar": "إنشاء المرفقات (الفريق)"
        }
      },
      {
        "value": "crm.attachments.create.all",
        "label": {
          "en": "Create attachments (all)",
          "ar": "إنشاء المرفقات (الكل)"
        }
      },
      {
        "value": "crm.attachments.delete.own",
        "label": {
          "en": "Delete attachments (own)",
          "ar": "حذف المرفقات (الخاصة بي)"
        }
      },
      {
        "value": "crm.attachments.delete.team",
        "label": {
          "en": "Delete attachments (team)",
          "ar": "حذف المرفقات (الفريق)"
        }
      },
      {
        "value": "crm.attachments.delete.all",
        "label": {
          "en": "Delete attachments (all)",
          "ar": "حذف المرفقات (الكل)"
        }
      },
      {
        "value": "crm.dashboards.read.own",
        "label": {
          "en": "Read dashboards (own)",
          "ar": "عرض لوحات المعلومات (الخاصة بي)"
        }
      },
      {
        "value": "crm.dashboards.read.team",
        "label": {
          "en": "Read dashboards (team)",
          "ar": "عرض لوحات المعلومات (الفريق)"
        }
      },
      {
        "value": "crm.dashboards.read.all",
        "label": {
          "en": "Read dashboards (all)",
          "ar": "عرض لوحات المعلومات (الكل)"
        }
      },
      {
        "value": "crm.targets.read.own",
        "label": {
          "en": "crm targets read own",
          "ar": "crm targets read own"
        }
      },
      {
        "value": "crm.targets.read.team",
        "label": {
          "en": "crm targets read team",
          "ar": "crm targets read team"
        }
      },
      {
        "value": "crm.targets.read.all",
        "label": {
          "en": "crm targets read all",
          "ar": "crm targets read all"
        }
      },
      {
        "value": "crm.email.send.own",
        "label": {
          "en": "Send CRM email (own)",
          "ar": "إرسال بريد إدارة العملاء (الخاصة بي)"
        }
      },
      {
        "value": "crm.email.send.team",
        "label": {
          "en": "Send CRM email (team)",
          "ar": "إرسال بريد إدارة العملاء (الفريق)"
        }
      },
      {
        "value": "crm.email.send.all",
        "label": {
          "en": "Send CRM email (all)",
          "ar": "إرسال بريد إدارة العملاء (الكل)"
        }
      }
    ],
    "ownerTypeOptions": [
      {
        "value": "LEAD",
        "label": {
          "en": "Lead",
          "ar": "عميل محتمل"
        }
      },
      {
        "value": "CUSTOMER_PROFILE",
        "label": {
          "en": "Customer profile",
          "ar": "ملف العميل"
        }
      },
      {
        "value": "PARTY",
        "label": {
          "en": "Party",
          "ar": "طرف"
        }
      },
      {
        "value": "OPPORTUNITY",
        "label": {
          "en": "Opportunity",
          "ar": "فرصة"
        }
      },
      {
        "value": "ACTIVITY",
        "label": {
          "en": "Activity",
          "ar": "نشاط"
        }
      },
      {
        "value": "NOTE",
        "label": {
          "en": "Note",
          "ar": "ملاحظة"
        }
      }
    ],
    "eventOptions": [
      {
        "value": "crm.lead.created",
        "label": {
          "en": "Lead created",
          "ar": "تم إنشاء العميل المحتمل"
        }
      },
      {
        "value": "crm.lead.stage_changed",
        "label": {
          "en": "Lead stage changed",
          "ar": "تم تغيير مرحلة العميل المحتمل"
        }
      },
      {
        "value": "crm.lead.converted",
        "label": {
          "en": "Lead converted",
          "ar": "تم تحويل العميل المحتمل"
        }
      },
      {
        "value": "crm.lead.changed",
        "label": {
          "en": "Lead changed",
          "ar": "تم تغيير العميل المحتمل"
        }
      },
      {
        "value": "crm.lead.deleted",
        "label": {
          "en": "Lead deleted",
          "ar": "تم حذف العميل المحتمل"
        }
      },
      {
        "value": "crm.leads.changed.v1",
        "label": {
          "en": "Lead board changed",
          "ar": "تم تغيير لوحة العملاء المحتملين"
        }
      },
      {
        "value": "crm.customer_profile.created",
        "label": {
          "en": "Customer profile created",
          "ar": "تم إنشاء ملف العميل"
        }
      },
      {
        "value": "crm.customer_profile.changed",
        "label": {
          "en": "Customer profile changed",
          "ar": "تم تغيير ملف العميل"
        }
      },
      {
        "value": "crm.customer_profile.deleted",
        "label": {
          "en": "Customer profile deleted",
          "ar": "تم حذف ملف العميل"
        }
      },
      {
        "value": "crm.opportunity.created",
        "label": {
          "en": "Opportunity created",
          "ar": "تم إنشاء الفرصة"
        }
      },
      {
        "value": "crm.opportunity.stage_changed",
        "label": {
          "en": "Opportunity stage changed",
          "ar": "تم تغيير مرحلة الفرصة"
        }
      },
      {
        "value": "crm.opportunity.won",
        "label": {
          "en": "Opportunity won",
          "ar": "تم الفوز بالفرصة"
        }
      },
      {
        "value": "crm.opportunity.lost",
        "label": {
          "en": "Opportunity lost",
          "ar": "تم خسارة الفرصة"
        }
      },
      {
        "value": "crm.opportunity.reopened",
        "label": {
          "en": "Opportunity reopened",
          "ar": "تم إعادة فتح الفرصة"
        }
      },
      {
        "value": "crm.opportunity.changed",
        "label": {
          "en": "Opportunity changed",
          "ar": "تم تغيير الفرصة"
        }
      },
      {
        "value": "crm.notification.requested.v1",
        "label": {
          "en": "Notification requested",
          "ar": "تم طلب إشعار"
        }
      },
      {
        "value": "crm.email.send.v1",
        "label": {
          "en": "CRM email queued",
          "ar": "تمت إضافة رسالة CRM إلى قائمة الإرسال"
        }
      },
      {
        "value": "crm.analytics.export.pdf_render_requested.v1",
        "label": {
          "en": "Analytics PDF export requested",
          "ar": "طُلب تصدير التحليلات بصيغة PDF"
        }
      }
    ],
    "derivedRules": {
      "opportunityStatusByStageFlag": {
        "WON": "WON",
        "LOST": "LOST",
        "ON_HOLD": "ON_HOLD",
        "default": "IN_PROGRESS"
      },
      "leadConversionCopiesCustomFieldOwnerType": "LEAD_AND_PARTY"
    }
  },
  "/settings": {
    "id": "01950000-0000-7000-8000-000000000101",
    "leadsEnabled": true,
    "opportunitiesEnabled": true,
    "requireQualifiedStageForConversion": true,
    "defaultPipelineId": "01950000-0000-7000-8000-000000000201",
    "outboundEmailContentRetentionDays": 730,
    "outboundEmailRetentionPolicyRevision": 1,
    "analyticsTimeZone": "Africa/Cairo",
    "clickToCallEnabled": true,
    "logCallsAsActivities": true,
    "createdAt": "2026-01-15T09:00:00.000Z",
    "updatedAt": "2026-10-12T14:30:00.000Z"
  },
  "/settings/duplicate-policy": {
    "revision": 1,
    "truncated": false,
    "defaults": {
      "allowAcrossUsers": false,
      "allowAcrossBranches": false,
      "allowAcrossCompanies": false,
      "checkEmail": true,
      "checkPhone": true,
      "checkWhatsapp": true
    },
    "companies": [
      {
        "companyId": "01950000-0000-7000-8000-000000000501",
        "code": "EG",
        "name": "Mutakamel Egypt",
        "status": "ACTIVE",
        "override": {
          "allowAcrossUsers": null,
          "allowAcrossBranches": true,
          "allowAcrossCompanies": true
        },
        "effective": {
          "u": false,
          "b": true,
          "c": true
        },
        "limits": {},
        "branches": [
          {
            "branchId": "01950000-0000-7000-8000-000000000601",
            "code": "CAI",
            "name": "Cairo HQ",
            "status": "ACTIVE",
            "override": {
              "allowAcrossUsers": true,
              "allowAcrossBranches": null
            },
            "effective": {
              "u": true,
              "b": true,
              "c": true
            },
            "limits": {}
          },
          {
            "branchId": "01950000-0000-7000-8000-000000000602",
            "code": "ALX",
            "name": "Alexandria",
            "status": "ACTIVE",
            "override": {
              "allowAcrossUsers": null,
              "allowAcrossBranches": null
            },
            "effective": {
              "u": false,
              "b": true,
              "c": true
            },
            "limits": {}
          },
          {
            "branchId": "01950000-0000-7000-8000-000000000603",
            "code": "GIZ",
            "name": "Giza",
            "status": "ACTIVE",
            "override": {
              "allowAcrossUsers": null,
              "allowAcrossBranches": false
            },
            "effective": {
              "u": false,
              "b": false,
              "c": true
            },
            "limits": {}
          }
        ]
      },
      {
        "companyId": "01950000-0000-7000-8000-000000000502",
        "code": "SA",
        "name": "Mutakamel KSA",
        "status": "ACTIVE",
        "override": {
          "allowAcrossUsers": null,
          "allowAcrossBranches": null,
          "allowAcrossCompanies": true
        },
        "effective": {
          "u": false,
          "b": false,
          "c": true
        },
        "limits": {},
        "branches": [
          {
            "branchId": "01950000-0000-7000-8000-000000000604",
            "code": "RUH",
            "name": "Riyadh",
            "status": "ACTIVE",
            "override": {
              "allowAcrossUsers": null,
              "allowAcrossBranches": null
            },
            "effective": {
              "u": false,
              "b": false,
              "c": true
            },
            "limits": {}
          },
          {
            "branchId": "01950000-0000-7000-8000-000000000605",
            "code": "JED",
            "name": "Jeddah",
            "status": "ACTIVE",
            "override": {
              "allowAcrossUsers": null,
              "allowAcrossBranches": null
            },
            "effective": {
              "u": false,
              "b": false,
              "c": true
            },
            "limits": {}
          }
        ]
      },
      {
        "companyId": "01950000-0000-7000-8000-000000000503",
        "code": "GT",
        "name": "Gulf Trading",
        "status": "ACTIVE",
        "override": {
          "allowAcrossUsers": null,
          "allowAcrossBranches": null,
          "allowAcrossCompanies": null
        },
        "effective": {
          "u": false,
          "b": false,
          "c": false
        },
        "limits": {},
        "branches": [
          {
            "branchId": "01950000-0000-7000-8000-000000000606",
            "code": "DXB",
            "name": "Dubai",
            "status": "ACTIVE",
            "override": {
              "allowAcrossUsers": null,
              "allowAcrossBranches": null
            },
            "effective": {
              "u": false,
              "b": false,
              "c": false
            },
            "limits": {}
          }
        ]
      }
    ]
  },
  "/settings/modules": {
    "revision": 1,
    "defaults": {
      "leadsEnabled": true,
      "opportunitiesEnabled": true
    },
    "companies": [
      {
        "companyId": "c1",
        "code": "MUT",
        "name": "Mutakamel Trading",
        "status": "ACTIVE",
        "override": {
          "leadsEnabled": null,
          "opportunitiesEnabled": null
        },
        "effective": {
          "leadsEnabled": true,
          "opportunitiesEnabled": true
        }
      },
      {
        "companyId": "c2",
        "code": "MUT",
        "name": "Mutakamel Industries",
        "status": "ACTIVE",
        "override": {
          "leadsEnabled": null,
          "opportunitiesEnabled": null
        },
        "effective": {
          "leadsEnabled": true,
          "opportunitiesEnabled": true
        }
      }
    ]
  },
  "/pipelines/01950000-0000-7000-8000-000000000201/configuration": {
    "id": "01950000-0000-7000-8000-000000000201",
    "code": "DEFAULT",
    "nameAr": "الافتراضي",
    "nameEn": "Default",
    "description": null,
    "isDefault": true,
    "isActive": true,
    "accessMode": "ALL",
    "stages": [
      {
        "id": "ps-def-1",
        "pipelineId": "01950000-0000-7000-8000-000000000201",
        "opportunityStageId": "01950000-0000-7000-8000-000000000421",
        "rank": 1,
        "nameAr": "جديد",
        "nameEn": "New",
        "flag": "NEW",
        "category": "OPEN",
        "isActive": true,
        "isSystem": true
      },
      {
        "id": "ps-def-2",
        "pipelineId": "01950000-0000-7000-8000-000000000201",
        "opportunityStageId": "01950000-0000-7000-8000-000000000423",
        "rank": 2,
        "nameAr": "تأهيل",
        "nameEn": "Qualification",
        "flag": "QUALIFICATION",
        "category": "IN_PROGRESS",
        "isActive": true,
        "isSystem": true
      },
      {
        "id": "ps-def-3",
        "pipelineId": "01950000-0000-7000-8000-000000000201",
        "opportunityStageId": "01950000-0000-7000-8000-000000000424",
        "rank": 3,
        "nameAr": "عرض",
        "nameEn": "Proposal",
        "flag": "PROPOSAL",
        "category": "IN_PROGRESS",
        "isActive": true,
        "isSystem": true
      },
      {
        "id": "ps-def-4",
        "pipelineId": "01950000-0000-7000-8000-000000000201",
        "opportunityStageId": "01950000-0000-7000-8000-000000000425",
        "rank": 4,
        "nameAr": "تفاوض",
        "nameEn": "Negotiation",
        "flag": "NEGOTIATION",
        "category": "IN_PROGRESS",
        "isActive": true,
        "isSystem": true
      },
      {
        "id": "ps-def-5",
        "pipelineId": "01950000-0000-7000-8000-000000000201",
        "opportunityStageId": "01950000-0000-7000-8000-000000000428",
        "rank": 5,
        "nameAr": "تم الفوز",
        "nameEn": "Won",
        "flag": "WON",
        "category": "POSITIVE",
        "isActive": true,
        "isSystem": true
      },
      {
        "id": "ps-def-6",
        "pipelineId": "01950000-0000-7000-8000-000000000201",
        "opportunityStageId": "01950000-0000-7000-8000-000000000429",
        "rank": 6,
        "nameAr": "خسارة",
        "nameEn": "Lost",
        "flag": "LOST",
        "category": "NEGATIVE",
        "isActive": true,
        "isSystem": true
      }
    ],
    "assignments": {
      "accessMode": "ALL",
      "userIds": [],
      "teamIds": []
    },
    "createdAt": "2026-01-12T10:00:00.000Z",
    "updatedAt": "2026-01-12T10:00:00.000Z"
  },
  "/pipelines/assignment-options": {
    "users": [
      {
        "id": "u5",
        "label": "Karim Nabil",
        "status": "ACTIVE"
      },
      {
        "id": "u4",
        "label": "Lina Haddad",
        "status": "ACTIVE"
      },
      {
        "id": "u7",
        "label": "Maha Youssef",
        "status": "ACTIVE"
      },
      {
        "id": "u6",
        "label": "Nour Al-Din",
        "status": "ACTIVE"
      },
      {
        "id": "u3",
        "label": "Omar Hassan",
        "status": "ACTIVE"
      },
      {
        "id": "u2",
        "label": "Sara El-Sayed",
        "status": "ACTIVE"
      },
      {
        "id": "u1",
        "label": "Tariq Al-Mansour",
        "status": "ACTIVE"
      },
      {
        "id": "u8",
        "label": "Yara Adel",
        "status": "INVITED"
      }
    ],
    "teams": [
      {
        "id": "t3",
        "label": "Account Management",
        "code": "ACC-MGT",
        "status": "ACTIVE"
      },
      {
        "id": "t4",
        "label": "Channel Partners",
        "code": "PARTNERS",
        "status": "ACTIVE"
      },
      {
        "id": "t1",
        "label": "Enterprise Sales",
        "code": "ENT-SALES",
        "status": "ACTIVE"
      },
      {
        "id": "t2",
        "label": "SMB Sales",
        "code": "SMB-SALES",
        "status": "ACTIVE"
      }
    ]
  },
  "/opportunity-stages/01950000-0000-7000-8000-000000000429/usage": {
    "01950000-0000-7000-8000-000000000421": [
      {
        "id": "01950000-0000-7000-8000-000000000201",
        "nameAr": "الافتراضي",
        "nameEn": "Default"
      }
    ],
    "01950000-0000-7000-8000-000000000423": [
      {
        "id": "01950000-0000-7000-8000-000000000201",
        "nameAr": "الافتراضي",
        "nameEn": "Default"
      }
    ],
    "01950000-0000-7000-8000-000000000424": [
      {
        "id": "01950000-0000-7000-8000-000000000201",
        "nameAr": "الافتراضي",
        "nameEn": "Default"
      }
    ],
    "01950000-0000-7000-8000-000000000425": [
      {
        "id": "01950000-0000-7000-8000-000000000201",
        "nameAr": "الافتراضي",
        "nameEn": "Default"
      }
    ],
    "01950000-0000-7000-8000-000000000428": [
      {
        "id": "01950000-0000-7000-8000-000000000201",
        "nameAr": "الافتراضي",
        "nameEn": "Default"
      }
    ],
    "01950000-0000-7000-8000-000000000429": [
      {
        "id": "01950000-0000-7000-8000-000000000201",
        "nameAr": "الافتراضي",
        "nameEn": "Default"
      }
    ]
  },
  "/opportunity-stages/01950000-0000-7000-8000-000000000425/usage": {
    "01950000-0000-7000-8000-000000000421": [
      {
        "id": "01950000-0000-7000-8000-000000000201",
        "nameAr": "الافتراضي",
        "nameEn": "Default"
      }
    ],
    "01950000-0000-7000-8000-000000000423": [
      {
        "id": "01950000-0000-7000-8000-000000000201",
        "nameAr": "الافتراضي",
        "nameEn": "Default"
      }
    ],
    "01950000-0000-7000-8000-000000000424": [
      {
        "id": "01950000-0000-7000-8000-000000000201",
        "nameAr": "الافتراضي",
        "nameEn": "Default"
      }
    ],
    "01950000-0000-7000-8000-000000000425": [
      {
        "id": "01950000-0000-7000-8000-000000000201",
        "nameAr": "الافتراضي",
        "nameEn": "Default"
      }
    ],
    "01950000-0000-7000-8000-000000000428": [
      {
        "id": "01950000-0000-7000-8000-000000000201",
        "nameAr": "الافتراضي",
        "nameEn": "Default"
      }
    ],
    "01950000-0000-7000-8000-000000000429": [
      {
        "id": "01950000-0000-7000-8000-000000000201",
        "nameAr": "الافتراضي",
        "nameEn": "Default"
      }
    ]
  },
  "/opportunity-stages/01950000-0000-7000-8000-000000000421/usage": {
    "01950000-0000-7000-8000-000000000421": [
      {
        "id": "01950000-0000-7000-8000-000000000201",
        "nameAr": "الافتراضي",
        "nameEn": "Default"
      }
    ],
    "01950000-0000-7000-8000-000000000423": [
      {
        "id": "01950000-0000-7000-8000-000000000201",
        "nameAr": "الافتراضي",
        "nameEn": "Default"
      }
    ],
    "01950000-0000-7000-8000-000000000424": [
      {
        "id": "01950000-0000-7000-8000-000000000201",
        "nameAr": "الافتراضي",
        "nameEn": "Default"
      }
    ],
    "01950000-0000-7000-8000-000000000425": [
      {
        "id": "01950000-0000-7000-8000-000000000201",
        "nameAr": "الافتراضي",
        "nameEn": "Default"
      }
    ],
    "01950000-0000-7000-8000-000000000428": [
      {
        "id": "01950000-0000-7000-8000-000000000201",
        "nameAr": "الافتراضي",
        "nameEn": "Default"
      }
    ],
    "01950000-0000-7000-8000-000000000429": [
      {
        "id": "01950000-0000-7000-8000-000000000201",
        "nameAr": "الافتراضي",
        "nameEn": "Default"
      }
    ]
  },
  "/opportunity-stages/01950000-0000-7000-8000-000000000424/usage": {
    "01950000-0000-7000-8000-000000000421": [
      {
        "id": "01950000-0000-7000-8000-000000000201",
        "nameAr": "الافتراضي",
        "nameEn": "Default"
      }
    ],
    "01950000-0000-7000-8000-000000000423": [
      {
        "id": "01950000-0000-7000-8000-000000000201",
        "nameAr": "الافتراضي",
        "nameEn": "Default"
      }
    ],
    "01950000-0000-7000-8000-000000000424": [
      {
        "id": "01950000-0000-7000-8000-000000000201",
        "nameAr": "الافتراضي",
        "nameEn": "Default"
      }
    ],
    "01950000-0000-7000-8000-000000000425": [
      {
        "id": "01950000-0000-7000-8000-000000000201",
        "nameAr": "الافتراضي",
        "nameEn": "Default"
      }
    ],
    "01950000-0000-7000-8000-000000000428": [
      {
        "id": "01950000-0000-7000-8000-000000000201",
        "nameAr": "الافتراضي",
        "nameEn": "Default"
      }
    ],
    "01950000-0000-7000-8000-000000000429": [
      {
        "id": "01950000-0000-7000-8000-000000000201",
        "nameAr": "الافتراضي",
        "nameEn": "Default"
      }
    ]
  },
  "/opportunity-stages/01950000-0000-7000-8000-000000000423/usage": {
    "01950000-0000-7000-8000-000000000421": [
      {
        "id": "01950000-0000-7000-8000-000000000201",
        "nameAr": "الافتراضي",
        "nameEn": "Default"
      }
    ],
    "01950000-0000-7000-8000-000000000423": [
      {
        "id": "01950000-0000-7000-8000-000000000201",
        "nameAr": "الافتراضي",
        "nameEn": "Default"
      }
    ],
    "01950000-0000-7000-8000-000000000424": [
      {
        "id": "01950000-0000-7000-8000-000000000201",
        "nameAr": "الافتراضي",
        "nameEn": "Default"
      }
    ],
    "01950000-0000-7000-8000-000000000425": [
      {
        "id": "01950000-0000-7000-8000-000000000201",
        "nameAr": "الافتراضي",
        "nameEn": "Default"
      }
    ],
    "01950000-0000-7000-8000-000000000428": [
      {
        "id": "01950000-0000-7000-8000-000000000201",
        "nameAr": "الافتراضي",
        "nameEn": "Default"
      }
    ],
    "01950000-0000-7000-8000-000000000429": [
      {
        "id": "01950000-0000-7000-8000-000000000201",
        "nameAr": "الافتراضي",
        "nameEn": "Default"
      }
    ]
  },
  "/opportunity-stages/01950000-0000-7000-8000-000000000428/usage": {
    "01950000-0000-7000-8000-000000000421": [
      {
        "id": "01950000-0000-7000-8000-000000000201",
        "nameAr": "الافتراضي",
        "nameEn": "Default"
      }
    ],
    "01950000-0000-7000-8000-000000000423": [
      {
        "id": "01950000-0000-7000-8000-000000000201",
        "nameAr": "الافتراضي",
        "nameEn": "Default"
      }
    ],
    "01950000-0000-7000-8000-000000000424": [
      {
        "id": "01950000-0000-7000-8000-000000000201",
        "nameAr": "الافتراضي",
        "nameEn": "Default"
      }
    ],
    "01950000-0000-7000-8000-000000000425": [
      {
        "id": "01950000-0000-7000-8000-000000000201",
        "nameAr": "الافتراضي",
        "nameEn": "Default"
      }
    ],
    "01950000-0000-7000-8000-000000000428": [
      {
        "id": "01950000-0000-7000-8000-000000000201",
        "nameAr": "الافتراضي",
        "nameEn": "Default"
      }
    ],
    "01950000-0000-7000-8000-000000000429": [
      {
        "id": "01950000-0000-7000-8000-000000000201",
        "nameAr": "الافتراضي",
        "nameEn": "Default"
      }
    ]
  },
  "/custom-fields/values": [
    {
      "id": "val-1",
      "branchId": "b1",
      "fieldDefinitionId": "cf-lead-budget",
      "ownerType": "LEAD",
      "ownerId": "lead-1",
      "value": "50k_200k",
      "updatedAt": "2026-11-18T10:00:00.000Z"
    },
    {
      "id": "val-2",
      "branchId": "b1",
      "fieldDefinitionId": "cf-lead-start",
      "ownerType": "LEAD",
      "ownerId": "lead-1",
      "value": "2026-12-01",
      "updatedAt": "2026-11-18T10:00:00.000Z"
    },
    {
      "id": "val-3",
      "branchId": "b1",
      "fieldDefinitionId": "cf-lead-visits",
      "ownerType": "LEAD",
      "ownerId": "lead-1",
      "value": 14,
      "updatedAt": "2026-11-18T10:00:00.000Z"
    },
    {
      "id": "val-4",
      "branchId": "b1",
      "fieldDefinitionId": "cf-lead-budget",
      "ownerType": "LEAD",
      "ownerId": "lead-2",
      "value": "200k_500k",
      "updatedAt": "2026-11-18T10:00:00.000Z"
    },
    {
      "id": "val-5",
      "branchId": "b1",
      "fieldDefinitionId": "cf-cust-tax",
      "ownerType": "CUSTOMER_PROFILE",
      "ownerId": "cust-1",
      "value": "402-881-910",
      "updatedAt": "2026-11-18T10:00:00.000Z"
    },
    {
      "id": "val-6",
      "branchId": "b1",
      "fieldDefinitionId": "cf-cust-industry",
      "ownerType": "CUSTOMER_PROFILE",
      "ownerId": "cust-1",
      "value": [
        "manufacturing",
        "technology"
      ],
      "updatedAt": "2026-11-18T10:00:00.000Z"
    },
    {
      "id": "val-7",
      "branchId": "b1",
      "fieldDefinitionId": "cf-opp-sponsor",
      "ownerType": "OPPORTUNITY",
      "ownerId": "opp-1",
      "value": true,
      "updatedAt": "2026-11-18T10:00:00.000Z"
    }
  ],
  "/targets": {
    "items": [
      {
        "id": "01934c00-0000-7000-8000-000000000014",
        "branchId": "01934b10-0000-7000-8000-000000000101",
        "subjectType": "USER",
        "subjectId": "01934b10-0000-7000-8000-000000000304",
        "metricKey": "crm.opportunities.won.count.trend",
        "currencyCode": null,
        "revision": 1,
        "periodGrain": "MONTH",
        "periodStart": "2026-12-01",
        "targetValue": "18.00",
        "branchName": "Cairo",
        "subjectName": "Omar Mostafa",
        "periodEndExclusive": "2027-01-01",
        "measureKind": "COUNT",
        "approvalState": "DRAFT",
        "submittedAt": null,
        "submittedByUserId": null,
        "reviewNote": null,
        "createdByUserId": "01934b10-0000-7000-8000-000000000304",
        "updatedByUserId": "01934b10-0000-7000-8000-000000000304",
        "createdAt": "2026-10-14T09:00:00.000Z",
        "updatedAt": "2026-10-14T09:00:00.000Z",
        "latestRelease": null,
        "subjects": [],
        "metricLabel": "Won",
        "metricLabelAr": "اتجاه الفرص الرابحة",
        "unit": "COUNT"
      },
      {
        "id": "01934c00-0000-7000-8000-000000000006",
        "branchId": "01934b10-0000-7000-8000-000000000101",
        "subjectType": "TEAM",
        "subjectId": "01934b10-0000-7000-8000-000000000202",
        "metricKey": "crm.opportunities.won.estimated_value",
        "currencyCode": "EGP",
        "revision": 2,
        "periodGrain": "MONTH",
        "periodStart": "2026-12-01",
        "targetValue": "1400000.00",
        "branchName": "Cairo",
        "subjectName": "Cairo corporate",
        "periodEndExclusive": "2027-01-01",
        "measureKind": "MONEY",
        "approvalState": "SUBMITTED",
        "submittedAt": "2026-11-19T14:05:00.000Z",
        "submittedByUserId": "01934b10-0000-7000-8000-000000000303",
        "reviewNote": null,
        "createdByUserId": "01934b10-0000-7000-8000-000000000304",
        "updatedByUserId": "01934b10-0000-7000-8000-000000000304",
        "createdAt": "2026-10-06T09:00:00.000Z",
        "updatedAt": "2026-10-06T09:00:00.000Z",
        "latestRelease": null,
        "subjects": [],
        "metricLabel": "Won opportunity value",
        "metricLabelAr": "قيمة الفرص الرابحة",
        "unit": "MONEY"
      },
      {
        "id": "01934c00-0000-7000-8000-000000000008",
        "branchId": "01934b10-0000-7000-8000-000000000101",
        "subjectType": "USER",
        "subjectId": "01934b10-0000-7000-8000-000000000303",
        "metricKey": "crm.leads.conversion.rate",
        "currencyCode": null,
        "revision": 2,
        "periodGrain": "MONTH",
        "periodStart": "2026-11-01",
        "targetValue": "28.50",
        "branchName": "Cairo",
        "subjectName": "Sara Kamel",
        "periodEndExclusive": "2026-12-01",
        "measureKind": "RATE",
        "approvalState": "SUBMITTED",
        "submittedAt": "2026-11-03T13:10:00.000Z",
        "submittedByUserId": "01934b10-0000-7000-8000-000000000303",
        "reviewNote": null,
        "createdByUserId": "01934b10-0000-7000-8000-000000000304",
        "updatedByUserId": "01934b10-0000-7000-8000-000000000304",
        "createdAt": "2026-10-08T09:00:00.000Z",
        "updatedAt": "2026-10-08T09:00:00.000Z",
        "latestRelease": null,
        "subjects": [],
        "metricLabel": "Lead conversion rate",
        "metricLabelAr": "معدل تحويل العملاء المحتملين",
        "unit": "PERCENT"
      },
      {
        "id": "01934c00-0000-7000-8000-000000000007",
        "branchId": "01934b10-0000-7000-8000-000000000101",
        "subjectType": "USER",
        "subjectId": "01934b10-0000-7000-8000-000000000302",
        "metricKey": "crm.opportunities.won.count.trend",
        "currencyCode": null,
        "revision": 2,
        "periodGrain": "MONTH",
        "periodStart": "2026-11-01",
        "targetValue": "24.00",
        "branchName": "Cairo",
        "subjectName": "Ali Hassan",
        "periodEndExclusive": "2026-12-01",
        "measureKind": "COUNT",
        "approvalState": "SUBMITTED",
        "submittedAt": "2026-11-02T09:30:00.000Z",
        "submittedByUserId": "01934b10-0000-7000-8000-000000000302",
        "reviewNote": null,
        "createdByUserId": "01934b10-0000-7000-8000-000000000304",
        "updatedByUserId": "01934b10-0000-7000-8000-000000000304",
        "createdAt": "2026-10-07T09:00:00.000Z",
        "updatedAt": "2026-10-07T09:00:00.000Z",
        "latestRelease": null,
        "subjects": [],
        "metricLabel": "Won",
        "metricLabelAr": "اتجاه الفرص الرابحة",
        "unit": "COUNT"
      },
      {
        "id": "01934c00-0000-7000-8000-000000000003",
        "branchId": "01934b10-0000-7000-8000-000000000101",
        "subjectType": "USER",
        "subjectId": "01934b10-0000-7000-8000-000000000301",
        "metricKey": "crm.opportunities.won.estimated_value",
        "currencyCode": "EGP",
        "revision": 2,
        "periodGrain": "MONTH",
        "periodStart": "2026-11-01",
        "targetValue": "320000.00",
        "branchName": "Cairo",
        "subjectName": "Nada Mahmoud",
        "periodEndExclusive": "2026-12-01",
        "measureKind": "MONEY",
        "approvalState": "APPROVED",
        "submittedAt": "2026-10-26T10:00:00.000Z",
        "submittedByUserId": "01934b10-0000-7000-8000-000000000301",
        "reviewNote": null,
        "createdByUserId": "01934b10-0000-7000-8000-000000000304",
        "updatedByUserId": "01934b10-0000-7000-8000-000000000304",
        "createdAt": "2026-10-03T09:00:00.000Z",
        "updatedAt": "2026-10-03T09:00:00.000Z",
        "latestRelease": {
          "id": "01934c10-0000-7000-8000-000000000301",
          "releaseNumber": 1,
          "targetValue": "320000.00",
          "approvalBasis": "REVIEWED",
          "approvedAt": "2026-10-29T16:10:00.000Z"
        },
        "subjects": [],
        "metricLabel": "Won opportunity value",
        "metricLabelAr": "قيمة الفرص الرابحة",
        "unit": "MONEY"
      },
      {
        "id": "01934c00-0000-7000-8000-000000000004",
        "branchId": null,
        "subjectType": "TEAM_SET",
        "subjectId": null,
        "metricKey": "crm.opportunities.won.estimated_value",
        "currencyCode": "USD",
        "revision": 3,
        "periodGrain": "QUARTER",
        "periodStart": "2026-10-01",
        "targetValue": "180000.00",
        "branchName": null,
        "subjectName": "Alexandria sales + Cairo corporate + Cairo sales",
        "periodEndExclusive": "2027-01-01",
        "measureKind": "MONEY",
        "approvalState": "APPROVED",
        "submittedAt": "2026-09-29T12:00:00.000Z",
        "submittedByUserId": "01934b10-0000-7000-8000-000000000303",
        "reviewNote": null,
        "createdByUserId": "01934b10-0000-7000-8000-000000000304",
        "updatedByUserId": "01934b10-0000-7000-8000-000000000304",
        "createdAt": "2026-10-04T09:00:00.000Z",
        "updatedAt": "2026-10-04T09:00:00.000Z",
        "latestRelease": {
          "id": "01934c10-0000-7000-8000-000000000402",
          "releaseNumber": 2,
          "targetValue": "180000.00",
          "approvalBasis": "REVIEWED",
          "approvedAt": "2026-10-01T08:45:00.000Z"
        },
        "subjects": [
          {
            "teamId": "01934b10-0000-7000-8000-000000000203",
            "teamName": "Alexandria sales",
            "branchId": "01934b10-0000-7000-8000-000000000102",
            "branchName": "Alexandria"
          },
          {
            "teamId": "01934b10-0000-7000-8000-000000000202",
            "teamName": "Cairo corporate",
            "branchId": "01934b10-0000-7000-8000-000000000101",
            "branchName": "Cairo"
          },
          {
            "teamId": "01934b10-0000-7000-8000-000000000201",
            "teamName": "Cairo sales",
            "branchId": "01934b10-0000-7000-8000-000000000101",
            "branchName": "Cairo"
          }
        ],
        "metricLabel": "Won opportunity value",
        "metricLabelAr": "قيمة الفرص الرابحة",
        "unit": "MONEY"
      },
      {
        "id": "01934c00-0000-7000-8000-000000000002",
        "branchId": "01934b10-0000-7000-8000-000000000101",
        "subjectType": "TEAM",
        "subjectId": "01934b10-0000-7000-8000-000000000201",
        "metricKey": "crm.opportunities.won.estimated_value",
        "currencyCode": "EGP",
        "revision": 2,
        "periodGrain": "MONTH",
        "periodStart": "2026-10-01",
        "targetValue": "950000.00",
        "branchName": "Cairo",
        "subjectName": "Cairo sales",
        "periodEndExclusive": "2026-11-01",
        "measureKind": "MONEY",
        "approvalState": "APPROVED",
        "submittedAt": "2026-09-25T09:00:00.000Z",
        "submittedByUserId": "01934b10-0000-7000-8000-000000000302",
        "reviewNote": null,
        "createdByUserId": "01934b10-0000-7000-8000-000000000304",
        "updatedByUserId": "01934b10-0000-7000-8000-000000000304",
        "createdAt": "2026-10-02T09:00:00.000Z",
        "updatedAt": "2026-10-02T09:00:00.000Z",
        "latestRelease": {
          "id": "01934c10-0000-7000-8000-000000000201",
          "releaseNumber": 1,
          "targetValue": "950000.00",
          "approvalBasis": "REVIEWED",
          "approvedAt": "2026-09-28T14:20:00.000Z"
        },
        "subjects": [],
        "metricLabel": "Won opportunity value",
        "metricLabelAr": "قيمة الفرص الرابحة",
        "unit": "MONEY"
      },
      {
        "id": "01934c00-0000-7000-8000-000000000001",
        "branchId": "01934b10-0000-7000-8000-000000000101",
        "subjectType": "BRANCH",
        "subjectId": "01934b10-0000-7000-8000-000000000101",
        "metricKey": "crm.opportunities.won.estimated_value",
        "currencyCode": "EGP",
        "revision": 3,
        "periodGrain": "MONTH",
        "periodStart": "2026-09-01",
        "targetValue": "1850000.00",
        "branchName": "Cairo",
        "subjectName": "Cairo",
        "periodEndExclusive": "2026-10-01",
        "measureKind": "MONEY",
        "approvalState": "APPROVED",
        "submittedAt": "2026-08-27T10:15:00.000Z",
        "submittedByUserId": "01934b10-0000-7000-8000-000000000301",
        "reviewNote": null,
        "createdByUserId": "01934b10-0000-7000-8000-000000000304",
        "updatedByUserId": "01934b10-0000-7000-8000-000000000304",
        "createdAt": "2026-10-01T09:00:00.000Z",
        "updatedAt": "2026-10-01T09:00:00.000Z",
        "latestRelease": {
          "id": "01934c10-0000-7000-8000-000000000102",
          "releaseNumber": 2,
          "targetValue": "1850000.00",
          "approvalBasis": "CORRECTION",
          "approvedAt": "2026-10-03T11:30:00.000Z"
        },
        "subjects": [],
        "metricLabel": "Won opportunity value",
        "metricLabelAr": "قيمة الفرص الرابحة",
        "unit": "MONEY"
      },
      {
        "id": "01934c00-0000-7000-8000-000000000016",
        "branchId": "01934b10-0000-7000-8000-000000000101",
        "subjectType": "TEAM",
        "subjectId": "01934b10-0000-7000-8000-000000000201",
        "metricKey": "crm.opportunities.won.count.trend",
        "currencyCode": null,
        "revision": 1,
        "periodGrain": "YEAR",
        "periodStart": "2026-01-01",
        "targetValue": "240.00",
        "branchName": "Cairo",
        "subjectName": "Cairo sales",
        "periodEndExclusive": "2027-01-01",
        "measureKind": "COUNT",
        "approvalState": "DRAFT",
        "submittedAt": null,
        "submittedByUserId": null,
        "reviewNote": null,
        "createdByUserId": "01934b10-0000-7000-8000-000000000304",
        "updatedByUserId": "01934b10-0000-7000-8000-000000000304",
        "createdAt": "2026-10-16T09:00:00.000Z",
        "updatedAt": "2026-10-16T09:00:00.000Z",
        "latestRelease": null,
        "subjects": [],
        "metricLabel": "Won",
        "metricLabelAr": "اتجاه الفرص الرابحة",
        "unit": "COUNT"
      }
    ],
    "total": 9,
    "page": 1,
    "limit": 25,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  },
  "/targets/01934c00-0000-7000-8000-000000000001": {
    "id": "01934c00-0000-7000-8000-000000000001",
    "branchId": "01934b10-0000-7000-8000-000000000101",
    "subjectType": "BRANCH",
    "subjectId": "01934b10-0000-7000-8000-000000000101",
    "metricKey": "crm.opportunities.won.estimated_value",
    "currencyCode": "EGP",
    "revision": 3,
    "periodGrain": "MONTH",
    "periodStart": "2026-09-01",
    "targetValue": "1850000.00",
    "branchName": "Cairo",
    "subjectName": "Cairo",
    "periodEndExclusive": "2026-10-01",
    "measureKind": "MONEY",
    "approvalState": "APPROVED",
    "submittedAt": "2026-08-27T10:15:00.000Z",
    "submittedByUserId": "01934b10-0000-7000-8000-000000000301",
    "reviewNote": null,
    "createdByUserId": "01934b10-0000-7000-8000-000000000304",
    "updatedByUserId": "01934b10-0000-7000-8000-000000000304",
    "createdAt": "2026-10-01T09:00:00.000Z",
    "updatedAt": "2026-10-01T09:00:00.000Z",
    "latestRelease": {
      "id": "01934c10-0000-7000-8000-000000000102",
      "releaseNumber": 2,
      "targetValue": "1850000.00",
      "approvalBasis": "CORRECTION",
      "approvedAt": "2026-10-03T11:30:00.000Z"
    },
    "subjects": [],
    "metricLabel": "Won opportunity value",
    "metricLabelAr": "قيمة الفرص الرابحة",
    "unit": "MONEY"
  },
  "/targets/01934c00-0000-7000-8000-000000000001/releases": {
    "items": [
      {
        "id": "01934c10-0000-7000-8000-000000000102",
        "targetId": "01934c00-0000-7000-8000-000000000001",
        "releaseNumber": 2,
        "targetValue": "1850000.00",
        "measureKind": "MONEY",
        "currencyCode": "EGP",
        "headRevision": 3,
        "approvalBasis": "CORRECTION",
        "correctionReason": "Reallocated Q3 enterprise renewal quota split between Cairo and Giza branches.",
        "submittedByUserId": "01934b10-0000-7000-8000-000000000301",
        "approvedByUserId": "01934b10-0000-7000-8000-000000000304",
        "approvedAt": "2026-10-03T11:30:00.000Z",
        "periodStartAt": "2026-09-01T00:00:00.000Z",
        "periodEndAt": "2026-09-30T23:59:59.999Z",
        "periodTimeZone": "Africa/Cairo",
        "legacyLastEditedAt": null
      },
      {
        "id": "01934c10-0000-7000-8000-000000000101",
        "targetId": "01934c00-0000-7000-8000-000000000001",
        "releaseNumber": 1,
        "targetValue": "1750000.00",
        "measureKind": "MONEY",
        "currencyCode": "EGP",
        "headRevision": 2,
        "approvalBasis": "REVIEWED",
        "correctionReason": null,
        "submittedByUserId": "01934b10-0000-7000-8000-000000000301",
        "approvedByUserId": "01934b10-0000-7000-8000-000000000304",
        "approvedAt": "2026-08-29T13:00:00.000Z",
        "periodStartAt": "2026-09-01T00:00:00.000Z",
        "periodEndAt": "2026-09-30T23:59:59.999Z",
        "periodTimeZone": "Africa/Cairo",
        "legacyLastEditedAt": null
      }
    ],
    "pageInfo": {
      "limit": 25,
      "hasMore": false,
      "nextCursor": null
    }
  },
  "/targets/01934c00-0000-7000-8000-000000000002": {
    "id": "01934c00-0000-7000-8000-000000000002",
    "branchId": "01934b10-0000-7000-8000-000000000101",
    "subjectType": "TEAM",
    "subjectId": "01934b10-0000-7000-8000-000000000201",
    "metricKey": "crm.opportunities.won.estimated_value",
    "currencyCode": "EGP",
    "revision": 2,
    "periodGrain": "MONTH",
    "periodStart": "2026-10-01",
    "targetValue": "950000.00",
    "branchName": "Cairo",
    "subjectName": "Cairo sales",
    "periodEndExclusive": "2026-11-01",
    "measureKind": "MONEY",
    "approvalState": "APPROVED",
    "submittedAt": "2026-09-25T09:00:00.000Z",
    "submittedByUserId": "01934b10-0000-7000-8000-000000000302",
    "reviewNote": null,
    "createdByUserId": "01934b10-0000-7000-8000-000000000304",
    "updatedByUserId": "01934b10-0000-7000-8000-000000000304",
    "createdAt": "2026-10-02T09:00:00.000Z",
    "updatedAt": "2026-10-02T09:00:00.000Z",
    "latestRelease": {
      "id": "01934c10-0000-7000-8000-000000000201",
      "releaseNumber": 1,
      "targetValue": "950000.00",
      "approvalBasis": "REVIEWED",
      "approvedAt": "2026-09-28T14:20:00.000Z"
    },
    "subjects": [],
    "metricLabel": "Won opportunity value",
    "metricLabelAr": "قيمة الفرص الرابحة",
    "unit": "MONEY"
  },
  "/targets/01934c00-0000-7000-8000-000000000002/releases": {
    "items": [
      {
        "id": "01934c10-0000-7000-8000-000000000201",
        "targetId": "01934c00-0000-7000-8000-000000000002",
        "releaseNumber": 1,
        "targetValue": "950000.00",
        "measureKind": "MONEY",
        "currencyCode": "EGP",
        "headRevision": 2,
        "approvalBasis": "REVIEWED",
        "correctionReason": null,
        "submittedByUserId": "01934b10-0000-7000-8000-000000000302",
        "approvedByUserId": "01934b10-0000-7000-8000-000000000304",
        "approvedAt": "2026-09-28T14:20:00.000Z",
        "periodStartAt": "2026-10-01T00:00:00.000Z",
        "periodEndAt": "2026-10-31T23:59:59.999Z",
        "periodTimeZone": "Africa/Cairo",
        "legacyLastEditedAt": null
      }
    ],
    "pageInfo": {
      "limit": 25,
      "hasMore": false,
      "nextCursor": null
    }
  },
  "/targets/01934c00-0000-7000-8000-000000000003": {
    "id": "01934c00-0000-7000-8000-000000000003",
    "branchId": "01934b10-0000-7000-8000-000000000101",
    "subjectType": "USER",
    "subjectId": "01934b10-0000-7000-8000-000000000301",
    "metricKey": "crm.opportunities.won.estimated_value",
    "currencyCode": "EGP",
    "revision": 2,
    "periodGrain": "MONTH",
    "periodStart": "2026-11-01",
    "targetValue": "320000.00",
    "branchName": "Cairo",
    "subjectName": "Nada Mahmoud",
    "periodEndExclusive": "2026-12-01",
    "measureKind": "MONEY",
    "approvalState": "APPROVED",
    "submittedAt": "2026-10-26T10:00:00.000Z",
    "submittedByUserId": "01934b10-0000-7000-8000-000000000301",
    "reviewNote": null,
    "createdByUserId": "01934b10-0000-7000-8000-000000000304",
    "updatedByUserId": "01934b10-0000-7000-8000-000000000304",
    "createdAt": "2026-10-03T09:00:00.000Z",
    "updatedAt": "2026-10-03T09:00:00.000Z",
    "latestRelease": {
      "id": "01934c10-0000-7000-8000-000000000301",
      "releaseNumber": 1,
      "targetValue": "320000.00",
      "approvalBasis": "REVIEWED",
      "approvedAt": "2026-10-29T16:10:00.000Z"
    },
    "subjects": [],
    "metricLabel": "Won opportunity value",
    "metricLabelAr": "قيمة الفرص الرابحة",
    "unit": "MONEY"
  },
  "/targets/01934c00-0000-7000-8000-000000000003/releases": {
    "items": [
      {
        "id": "01934c10-0000-7000-8000-000000000301",
        "targetId": "01934c00-0000-7000-8000-000000000003",
        "releaseNumber": 1,
        "targetValue": "320000.00",
        "measureKind": "MONEY",
        "currencyCode": "EGP",
        "headRevision": 2,
        "approvalBasis": "REVIEWED",
        "correctionReason": null,
        "submittedByUserId": "01934b10-0000-7000-8000-000000000301",
        "approvedByUserId": "01934b10-0000-7000-8000-000000000303",
        "approvedAt": "2026-10-29T16:10:00.000Z",
        "periodStartAt": "2026-11-01T00:00:00.000Z",
        "periodEndAt": "2026-11-30T23:59:59.999Z",
        "periodTimeZone": "Africa/Cairo",
        "legacyLastEditedAt": null
      }
    ],
    "pageInfo": {
      "limit": 25,
      "hasMore": false,
      "nextCursor": null
    }
  },
  "/targets/01934c00-0000-7000-8000-000000000004": {
    "id": "01934c00-0000-7000-8000-000000000004",
    "branchId": null,
    "subjectType": "TEAM_SET",
    "subjectId": null,
    "metricKey": "crm.opportunities.won.estimated_value",
    "currencyCode": "USD",
    "revision": 3,
    "periodGrain": "QUARTER",
    "periodStart": "2026-10-01",
    "targetValue": "180000.00",
    "branchName": null,
    "subjectName": "Alexandria sales + Cairo corporate + Cairo sales",
    "periodEndExclusive": "2027-01-01",
    "measureKind": "MONEY",
    "approvalState": "APPROVED",
    "submittedAt": "2026-09-29T12:00:00.000Z",
    "submittedByUserId": "01934b10-0000-7000-8000-000000000303",
    "reviewNote": null,
    "createdByUserId": "01934b10-0000-7000-8000-000000000304",
    "updatedByUserId": "01934b10-0000-7000-8000-000000000304",
    "createdAt": "2026-10-04T09:00:00.000Z",
    "updatedAt": "2026-10-04T09:00:00.000Z",
    "latestRelease": {
      "id": "01934c10-0000-7000-8000-000000000402",
      "releaseNumber": 2,
      "targetValue": "180000.00",
      "approvalBasis": "REVIEWED",
      "approvedAt": "2026-10-01T08:45:00.000Z"
    },
    "subjects": [
      {
        "teamId": "01934b10-0000-7000-8000-000000000203",
        "teamName": "Alexandria sales",
        "branchId": "01934b10-0000-7000-8000-000000000102",
        "branchName": "Alexandria"
      },
      {
        "teamId": "01934b10-0000-7000-8000-000000000202",
        "teamName": "Cairo corporate",
        "branchId": "01934b10-0000-7000-8000-000000000101",
        "branchName": "Cairo"
      },
      {
        "teamId": "01934b10-0000-7000-8000-000000000201",
        "teamName": "Cairo sales",
        "branchId": "01934b10-0000-7000-8000-000000000101",
        "branchName": "Cairo"
      }
    ],
    "metricLabel": "Won opportunity value",
    "metricLabelAr": "قيمة الفرص الرابحة",
    "unit": "MONEY"
  },
  "/targets/01934c00-0000-7000-8000-000000000004/releases": {
    "items": [
      {
        "id": "01934c10-0000-7000-8000-000000000402",
        "targetId": "01934c00-0000-7000-8000-000000000004",
        "releaseNumber": 2,
        "targetValue": "180000.00",
        "measureKind": "MONEY",
        "currencyCode": "USD",
        "headRevision": 3,
        "approvalBasis": "REVIEWED",
        "correctionReason": null,
        "submittedByUserId": "01934b10-0000-7000-8000-000000000303",
        "approvedByUserId": "01934b10-0000-7000-8000-000000000304",
        "approvedAt": "2026-10-01T08:45:00.000Z",
        "periodStartAt": "2026-10-01T00:00:00.000Z",
        "periodEndAt": "2026-12-31T23:59:59.999Z",
        "periodTimeZone": "Africa/Cairo",
        "legacyLastEditedAt": null
      },
      {
        "id": "01934c10-0000-7000-8000-000000000401",
        "targetId": "01934c00-0000-7000-8000-000000000004",
        "releaseNumber": 1,
        "targetValue": "165000.00",
        "measureKind": "MONEY",
        "currencyCode": "USD",
        "headRevision": 2,
        "approvalBasis": "LEGACY_BACKFILL",
        "correctionReason": null,
        "submittedByUserId": "01934b10-0000-7000-8000-000000000303",
        "approvedByUserId": "01934b10-0000-7000-8000-000000000304",
        "approvedAt": "2026-09-20T10:00:00.000Z",
        "periodStartAt": "2026-10-01T00:00:00.000Z",
        "periodEndAt": "2026-12-31T23:59:59.999Z",
        "periodTimeZone": "Africa/Cairo",
        "legacyLastEditedAt": null
      }
    ],
    "pageInfo": {
      "limit": 25,
      "hasMore": false,
      "nextCursor": null
    }
  },
  "/targets/01934c00-0000-7000-8000-000000000005": {
    "id": "01934c00-0000-7000-8000-000000000005",
    "branchId": "01934b10-0000-7000-8000-000000000102",
    "subjectType": "BRANCH",
    "subjectId": "01934b10-0000-7000-8000-000000000102",
    "metricKey": "crm.opportunities.won.estimated_value",
    "currencyCode": "EGP",
    "revision": 2,
    "periodGrain": "YEAR",
    "periodStart": "2026-01-01",
    "targetValue": "12500000.00",
    "branchName": "Alexandria",
    "subjectName": "Alexandria",
    "periodEndExclusive": "2027-01-01",
    "measureKind": "MONEY",
    "approvalState": "SUBMITTED",
    "submittedAt": "2026-11-18T11:20:00.000Z",
    "submittedByUserId": "01934b10-0000-7000-8000-000000000305",
    "reviewNote": null,
    "createdByUserId": "01934b10-0000-7000-8000-000000000304",
    "updatedByUserId": "01934b10-0000-7000-8000-000000000304",
    "createdAt": "2026-10-05T09:00:00.000Z",
    "updatedAt": "2026-10-05T09:00:00.000Z",
    "latestRelease": null,
    "subjects": [],
    "metricLabel": "Won opportunity value",
    "metricLabelAr": "قيمة الفرص الرابحة",
    "unit": "MONEY"
  },
  "/targets/01934c00-0000-7000-8000-000000000005/releases": {
    "items": [],
    "pageInfo": {
      "limit": 25,
      "hasMore": false,
      "nextCursor": null
    }
  },
  "/targets/01934c00-0000-7000-8000-000000000006": {
    "id": "01934c00-0000-7000-8000-000000000006",
    "branchId": "01934b10-0000-7000-8000-000000000101",
    "subjectType": "TEAM",
    "subjectId": "01934b10-0000-7000-8000-000000000202",
    "metricKey": "crm.opportunities.won.estimated_value",
    "currencyCode": "EGP",
    "revision": 2,
    "periodGrain": "MONTH",
    "periodStart": "2026-12-01",
    "targetValue": "1400000.00",
    "branchName": "Cairo",
    "subjectName": "Cairo corporate",
    "periodEndExclusive": "2027-01-01",
    "measureKind": "MONEY",
    "approvalState": "SUBMITTED",
    "submittedAt": "2026-11-19T14:05:00.000Z",
    "submittedByUserId": "01934b10-0000-7000-8000-000000000303",
    "reviewNote": null,
    "createdByUserId": "01934b10-0000-7000-8000-000000000304",
    "updatedByUserId": "01934b10-0000-7000-8000-000000000304",
    "createdAt": "2026-10-06T09:00:00.000Z",
    "updatedAt": "2026-10-06T09:00:00.000Z",
    "latestRelease": null,
    "subjects": [],
    "metricLabel": "Won opportunity value",
    "metricLabelAr": "قيمة الفرص الرابحة",
    "unit": "MONEY"
  },
  "/targets/01934c00-0000-7000-8000-000000000006/releases": {
    "items": [],
    "pageInfo": {
      "limit": 25,
      "hasMore": false,
      "nextCursor": null
    }
  },
  "/targets/01934c00-0000-7000-8000-000000000007": {
    "id": "01934c00-0000-7000-8000-000000000007",
    "branchId": "01934b10-0000-7000-8000-000000000101",
    "subjectType": "USER",
    "subjectId": "01934b10-0000-7000-8000-000000000302",
    "metricKey": "crm.opportunities.won.count.trend",
    "currencyCode": null,
    "revision": 2,
    "periodGrain": "MONTH",
    "periodStart": "2026-11-01",
    "targetValue": "24.00",
    "branchName": "Cairo",
    "subjectName": "Ali Hassan",
    "periodEndExclusive": "2026-12-01",
    "measureKind": "COUNT",
    "approvalState": "SUBMITTED",
    "submittedAt": "2026-11-02T09:30:00.000Z",
    "submittedByUserId": "01934b10-0000-7000-8000-000000000302",
    "reviewNote": null,
    "createdByUserId": "01934b10-0000-7000-8000-000000000304",
    "updatedByUserId": "01934b10-0000-7000-8000-000000000304",
    "createdAt": "2026-10-07T09:00:00.000Z",
    "updatedAt": "2026-10-07T09:00:00.000Z",
    "latestRelease": null,
    "subjects": [],
    "metricLabel": "Won",
    "metricLabelAr": "اتجاه الفرص الرابحة",
    "unit": "COUNT"
  },
  "/targets/01934c00-0000-7000-8000-000000000007/releases": {
    "items": [],
    "pageInfo": {
      "limit": 25,
      "hasMore": false,
      "nextCursor": null
    }
  },
  "/targets/01934c00-0000-7000-8000-000000000008": {
    "id": "01934c00-0000-7000-8000-000000000008",
    "branchId": "01934b10-0000-7000-8000-000000000101",
    "subjectType": "USER",
    "subjectId": "01934b10-0000-7000-8000-000000000303",
    "metricKey": "crm.leads.conversion.rate",
    "currencyCode": null,
    "revision": 2,
    "periodGrain": "MONTH",
    "periodStart": "2026-11-01",
    "targetValue": "28.50",
    "branchName": "Cairo",
    "subjectName": "Sara Kamel",
    "periodEndExclusive": "2026-12-01",
    "measureKind": "RATE",
    "approvalState": "SUBMITTED",
    "submittedAt": "2026-11-03T13:10:00.000Z",
    "submittedByUserId": "01934b10-0000-7000-8000-000000000303",
    "reviewNote": null,
    "createdByUserId": "01934b10-0000-7000-8000-000000000304",
    "updatedByUserId": "01934b10-0000-7000-8000-000000000304",
    "createdAt": "2026-10-08T09:00:00.000Z",
    "updatedAt": "2026-10-08T09:00:00.000Z",
    "latestRelease": null,
    "subjects": [],
    "metricLabel": "Lead conversion rate",
    "metricLabelAr": "معدل تحويل العملاء المحتملين",
    "unit": "PERCENT"
  },
  "/targets/01934c00-0000-7000-8000-000000000008/releases": {
    "items": [],
    "pageInfo": {
      "limit": 25,
      "hasMore": false,
      "nextCursor": null
    }
  },
  "/targets/01934c00-0000-7000-8000-000000000009": {
    "id": "01934c00-0000-7000-8000-000000000009",
    "branchId": "01934b10-0000-7000-8000-000000000102",
    "subjectType": "TEAM",
    "subjectId": "01934b10-0000-7000-8000-000000000203",
    "metricKey": "crm.opportunities.won.count.trend",
    "currencyCode": null,
    "revision": 2,
    "periodGrain": "QUARTER",
    "periodStart": "2026-10-01",
    "targetValue": "65.00",
    "branchName": "Alexandria",
    "subjectName": "Alexandria sales",
    "periodEndExclusive": "2027-01-01",
    "measureKind": "COUNT",
    "approvalState": "SUBMITTED",
    "submittedAt": "2026-10-05T08:40:00.000Z",
    "submittedByUserId": "01934b10-0000-7000-8000-000000000306",
    "reviewNote": null,
    "createdByUserId": "01934b10-0000-7000-8000-000000000304",
    "updatedByUserId": "01934b10-0000-7000-8000-000000000304",
    "createdAt": "2026-10-09T09:00:00.000Z",
    "updatedAt": "2026-10-09T09:00:00.000Z",
    "latestRelease": null,
    "subjects": [],
    "metricLabel": "Won",
    "metricLabelAr": "اتجاه الفرص الرابحة",
    "unit": "COUNT"
  },
  "/targets/01934c00-0000-7000-8000-000000000009/releases": {
    "items": [],
    "pageInfo": {
      "limit": 25,
      "hasMore": false,
      "nextCursor": null
    }
  },
  "/targets/01934c00-0000-7000-8000-000000000010": {
    "id": "01934c00-0000-7000-8000-000000000010",
    "branchId": "01934b10-0000-7000-8000-000000000102",
    "subjectType": "USER",
    "subjectId": "01934b10-0000-7000-8000-000000000305",
    "metricKey": "crm.opportunities.won.estimated_value",
    "currencyCode": "EGP",
    "revision": 2,
    "periodGrain": "MONTH",
    "periodStart": "2026-10-01",
    "targetValue": "410000.00",
    "branchName": "Alexandria",
    "subjectName": "Mona Adel",
    "periodEndExclusive": "2026-11-01",
    "measureKind": "MONEY",
    "approvalState": "SUBMITTED",
    "submittedAt": "2026-10-02T10:00:00.000Z",
    "submittedByUserId": "01934b10-0000-7000-8000-000000000305",
    "reviewNote": null,
    "createdByUserId": "01934b10-0000-7000-8000-000000000304",
    "updatedByUserId": "01934b10-0000-7000-8000-000000000304",
    "createdAt": "2026-10-10T09:00:00.000Z",
    "updatedAt": "2026-10-10T09:00:00.000Z",
    "latestRelease": null,
    "subjects": [],
    "metricLabel": "Won opportunity value",
    "metricLabelAr": "قيمة الفرص الرابحة",
    "unit": "MONEY"
  },
  "/targets/01934c00-0000-7000-8000-000000000010/releases": {
    "items": [],
    "pageInfo": {
      "limit": 25,
      "hasMore": false,
      "nextCursor": null
    }
  },
  "/targets/01934c00-0000-7000-8000-000000000011": {
    "id": "01934c00-0000-7000-8000-000000000011",
    "branchId": "01934b10-0000-7000-8000-000000000102",
    "subjectType": "BRANCH",
    "subjectId": "01934b10-0000-7000-8000-000000000102",
    "metricKey": "crm.opportunities.won.estimated_value",
    "currencyCode": "USD",
    "revision": 1,
    "periodGrain": "MONTH",
    "periodStart": "2026-12-01",
    "targetValue": "85000.00",
    "branchName": "Alexandria",
    "subjectName": "Alexandria",
    "periodEndExclusive": "2027-01-01",
    "measureKind": "MONEY",
    "approvalState": "DRAFT",
    "submittedAt": null,
    "submittedByUserId": null,
    "reviewNote": "Adjust USD allocation after Q4 enterprise renewal pipeline review.",
    "createdByUserId": "01934b10-0000-7000-8000-000000000304",
    "updatedByUserId": "01934b10-0000-7000-8000-000000000304",
    "createdAt": "2026-10-11T09:00:00.000Z",
    "updatedAt": "2026-10-11T09:00:00.000Z",
    "latestRelease": null,
    "subjects": [],
    "metricLabel": "Won opportunity value",
    "metricLabelAr": "قيمة الفرص الرابحة",
    "unit": "MONEY"
  },
  "/targets/01934c00-0000-7000-8000-000000000011/releases": {
    "items": [],
    "pageInfo": {
      "limit": 25,
      "hasMore": false,
      "nextCursor": null
    }
  },
  "/targets/01934c00-0000-7000-8000-000000000012": {
    "id": "01934c00-0000-7000-8000-000000000012",
    "branchId": "01934b10-0000-7000-8000-000000000103",
    "subjectType": "BRANCH",
    "subjectId": "01934b10-0000-7000-8000-000000000103",
    "metricKey": "crm.opportunities.won.estimated_value",
    "currencyCode": "EGP",
    "revision": 1,
    "periodGrain": "MONTH",
    "periodStart": "2026-11-01",
    "targetValue": "640000.00",
    "branchName": "Giza",
    "subjectName": "Giza",
    "periodEndExclusive": "2026-12-01",
    "measureKind": "MONEY",
    "approvalState": "DRAFT",
    "submittedAt": null,
    "submittedByUserId": null,
    "reviewNote": null,
    "createdByUserId": "01934b10-0000-7000-8000-000000000304",
    "updatedByUserId": "01934b10-0000-7000-8000-000000000304",
    "createdAt": "2026-10-12T09:00:00.000Z",
    "updatedAt": "2026-10-12T09:00:00.000Z",
    "latestRelease": null,
    "subjects": [],
    "metricLabel": "Won opportunity value",
    "metricLabelAr": "قيمة الفرص الرابحة",
    "unit": "MONEY"
  },
  "/targets/01934c00-0000-7000-8000-000000000012/releases": {
    "items": [],
    "pageInfo": {
      "limit": 25,
      "hasMore": false,
      "nextCursor": null
    }
  },
  "/targets/01934c00-0000-7000-8000-000000000013": {
    "id": "01934c00-0000-7000-8000-000000000013",
    "branchId": "01934b10-0000-7000-8000-000000000103",
    "subjectType": "TEAM",
    "subjectId": "01934b10-0000-7000-8000-000000000204",
    "metricKey": "crm.leads.conversion.rate",
    "currencyCode": null,
    "revision": 1,
    "periodGrain": "MONTH",
    "periodStart": "2026-12-01",
    "targetValue": "22.00",
    "branchName": "Giza",
    "subjectName": "Giza sales",
    "periodEndExclusive": "2027-01-01",
    "measureKind": "RATE",
    "approvalState": "DRAFT",
    "submittedAt": null,
    "submittedByUserId": null,
    "reviewNote": null,
    "createdByUserId": "01934b10-0000-7000-8000-000000000304",
    "updatedByUserId": "01934b10-0000-7000-8000-000000000304",
    "createdAt": "2026-10-13T09:00:00.000Z",
    "updatedAt": "2026-10-13T09:00:00.000Z",
    "latestRelease": null,
    "subjects": [],
    "metricLabel": "Lead conversion rate",
    "metricLabelAr": "معدل تحويل العملاء المحتملين",
    "unit": "PERCENT"
  },
  "/targets/01934c00-0000-7000-8000-000000000013/releases": {
    "items": [],
    "pageInfo": {
      "limit": 25,
      "hasMore": false,
      "nextCursor": null
    }
  },
  "/targets/01934c00-0000-7000-8000-000000000014": {
    "id": "01934c00-0000-7000-8000-000000000014",
    "branchId": "01934b10-0000-7000-8000-000000000101",
    "subjectType": "USER",
    "subjectId": "01934b10-0000-7000-8000-000000000304",
    "metricKey": "crm.opportunities.won.count.trend",
    "currencyCode": null,
    "revision": 1,
    "periodGrain": "MONTH",
    "periodStart": "2026-12-01",
    "targetValue": "18.00",
    "branchName": "Cairo",
    "subjectName": "Omar Mostafa",
    "periodEndExclusive": "2027-01-01",
    "measureKind": "COUNT",
    "approvalState": "DRAFT",
    "submittedAt": null,
    "submittedByUserId": null,
    "reviewNote": null,
    "createdByUserId": "01934b10-0000-7000-8000-000000000304",
    "updatedByUserId": "01934b10-0000-7000-8000-000000000304",
    "createdAt": "2026-10-14T09:00:00.000Z",
    "updatedAt": "2026-10-14T09:00:00.000Z",
    "latestRelease": null,
    "subjects": [],
    "metricLabel": "Won",
    "metricLabelAr": "اتجاه الفرص الرابحة",
    "unit": "COUNT"
  },
  "/targets/01934c00-0000-7000-8000-000000000014/releases": {
    "items": [],
    "pageInfo": {
      "limit": 25,
      "hasMore": false,
      "nextCursor": null
    }
  },
  "/targets/01934c00-0000-7000-8000-000000000015": {
    "id": "01934c00-0000-7000-8000-000000000015",
    "branchId": "01934b10-0000-7000-8000-000000000102",
    "subjectType": "USER",
    "subjectId": "01934b10-0000-7000-8000-000000000306",
    "metricKey": "crm.leads.conversion.rate",
    "currencyCode": null,
    "revision": 1,
    "periodGrain": "QUARTER",
    "periodStart": "2026-10-01",
    "targetValue": "24.50",
    "branchName": "Alexandria",
    "subjectName": "Karim Samir",
    "periodEndExclusive": "2027-01-01",
    "measureKind": "RATE",
    "approvalState": "DRAFT",
    "submittedAt": null,
    "submittedByUserId": null,
    "reviewNote": null,
    "createdByUserId": "01934b10-0000-7000-8000-000000000304",
    "updatedByUserId": "01934b10-0000-7000-8000-000000000304",
    "createdAt": "2026-10-15T09:00:00.000Z",
    "updatedAt": "2026-10-15T09:00:00.000Z",
    "latestRelease": null,
    "subjects": [],
    "metricLabel": "Lead conversion rate",
    "metricLabelAr": "معدل تحويل العملاء المحتملين",
    "unit": "PERCENT"
  },
  "/targets/01934c00-0000-7000-8000-000000000015/releases": {
    "items": [],
    "pageInfo": {
      "limit": 25,
      "hasMore": false,
      "nextCursor": null
    }
  },
  "/targets/01934c00-0000-7000-8000-000000000016": {
    "id": "01934c00-0000-7000-8000-000000000016",
    "branchId": "01934b10-0000-7000-8000-000000000101",
    "subjectType": "TEAM",
    "subjectId": "01934b10-0000-7000-8000-000000000201",
    "metricKey": "crm.opportunities.won.count.trend",
    "currencyCode": null,
    "revision": 1,
    "periodGrain": "YEAR",
    "periodStart": "2026-01-01",
    "targetValue": "240.00",
    "branchName": "Cairo",
    "subjectName": "Cairo sales",
    "periodEndExclusive": "2027-01-01",
    "measureKind": "COUNT",
    "approvalState": "DRAFT",
    "submittedAt": null,
    "submittedByUserId": null,
    "reviewNote": null,
    "createdByUserId": "01934b10-0000-7000-8000-000000000304",
    "updatedByUserId": "01934b10-0000-7000-8000-000000000304",
    "createdAt": "2026-10-16T09:00:00.000Z",
    "updatedAt": "2026-10-16T09:00:00.000Z",
    "latestRelease": null,
    "subjects": [],
    "metricLabel": "Won",
    "metricLabelAr": "اتجاه الفرص الرابحة",
    "unit": "COUNT"
  },
  "/targets/01934c00-0000-7000-8000-000000000016/releases": {
    "items": [],
    "pageInfo": {
      "limit": 25,
      "hasMore": false,
      "nextCursor": null
    }
  },
  "/targets/01934c00-0000-7000-8000-000000000017": {
    "id": "01934c00-0000-7000-8000-000000000017",
    "branchId": "01934b10-0000-7000-8000-000000000103",
    "subjectType": "USER",
    "subjectId": "01934b10-0000-7000-8000-000000000307",
    "metricKey": "crm.opportunities.won.count.trend",
    "currencyCode": null,
    "revision": 1,
    "periodGrain": "MONTH",
    "periodStart": "2026-09-01",
    "targetValue": "14.00",
    "branchName": "Giza",
    "subjectName": "Heba Fathy",
    "periodEndExclusive": "2026-10-01",
    "measureKind": "COUNT",
    "approvalState": "DRAFT",
    "submittedAt": null,
    "submittedByUserId": null,
    "reviewNote": null,
    "createdByUserId": "01934b10-0000-7000-8000-000000000304",
    "updatedByUserId": "01934b10-0000-7000-8000-000000000304",
    "createdAt": "2026-10-17T09:00:00.000Z",
    "updatedAt": "2026-10-17T09:00:00.000Z",
    "latestRelease": null,
    "subjects": [],
    "metricLabel": "Won",
    "metricLabelAr": "اتجاه الفرص الرابحة",
    "unit": "COUNT"
  },
  "/targets/01934c00-0000-7000-8000-000000000017/releases": {
    "items": [],
    "pageInfo": {
      "limit": 25,
      "hasMore": false,
      "nextCursor": null
    }
  },
  "/targets/01934c00-0000-7000-8000-000000000018": {
    "id": "01934c00-0000-7000-8000-000000000018",
    "branchId": "01934b10-0000-7000-8000-000000000103",
    "subjectType": "USER",
    "subjectId": "01934b10-0000-7000-8000-000000000308",
    "metricKey": "crm.leads.conversion.rate",
    "currencyCode": null,
    "revision": 1,
    "periodGrain": "MONTH",
    "periodStart": "2026-11-01",
    "targetValue": "19.50",
    "branchName": "Giza",
    "subjectName": "Youssef Nabil",
    "periodEndExclusive": "2026-12-01",
    "measureKind": "RATE",
    "approvalState": "DRAFT",
    "submittedAt": null,
    "submittedByUserId": null,
    "reviewNote": null,
    "createdByUserId": "01934b10-0000-7000-8000-000000000304",
    "updatedByUserId": "01934b10-0000-7000-8000-000000000304",
    "createdAt": "2026-10-18T09:00:00.000Z",
    "updatedAt": "2026-10-18T09:00:00.000Z",
    "latestRelease": null,
    "subjects": [],
    "metricLabel": "Lead conversion rate",
    "metricLabelAr": "معدل تحويل العملاء المحتملين",
    "unit": "PERCENT"
  },
  "/targets/01934c00-0000-7000-8000-000000000018/releases": {
    "items": [],
    "pageInfo": {
      "limit": 25,
      "hasMore": false,
      "nextCursor": null
    }
  },
  "/sla/policies": {
    "items": [
      {
        "id": "01934b20-0000-7000-8000-000000000042",
        "policyKind": "FIRST_RESPONSE",
        "appliesToRecord": "LEAD",
        "branchId": "01934b10-0000-7000-8000-000000000101",
        "clockKind": "WORKING_MINUTES",
        "targetMinutes": 15,
        "requiredTouchCount": null,
        "compliancePct": null,
        "qualifyingTouchBy": "ANYONE",
        "qualifying": {
          "activityTypes": [
            "CALL",
            "EMAIL"
          ],
          "directions": [
            "OUTBOUND"
          ],
          "touchSources": [
            "CORE_ACTIVITY",
            "CRM_ACTIVITY"
          ]
        },
        "nameEn": "Cairo priority first response",
        "nameAr": "الاستجابة الأولى السريعة لفرع القاهرة",
        "effectiveFrom": "2026-09-15T00:00:00.000Z",
        "effectiveTo": null,
        "state": "ACTIVE",
        "versionNumber": 2,
        "startEvent": "ASSIGNMENT",
        "qualifyingFact": "TOUCH",
        "supersedesPolicyId": "01934b20-0000-7000-8000-000000000041",
        "nextPolicyId": null,
        "publishedByUserId": "01934b10-0000-7000-8000-000000000301",
        "publishedAt": "2026-09-15T08:00:00.000Z"
      },
      {
        "id": "01934b20-0000-7000-8000-000000000041",
        "policyKind": "FIRST_RESPONSE",
        "appliesToRecord": "LEAD",
        "branchId": "01934b10-0000-7000-8000-000000000101",
        "clockKind": "WORKING_MINUTES",
        "targetMinutes": 20,
        "requiredTouchCount": null,
        "compliancePct": null,
        "qualifyingTouchBy": "ANYONE",
        "qualifying": {
          "activityTypes": [
            "CALL",
            "EMAIL"
          ],
          "directions": [
            "OUTBOUND"
          ],
          "touchSources": [
            "CORE_ACTIVITY",
            "CRM_ACTIVITY"
          ]
        },
        "nameEn": "Cairo priority first response",
        "nameAr": "الاستجابة الأولى السريعة لفرع القاهرة",
        "effectiveFrom": "2026-04-01T00:00:00.000Z",
        "effectiveTo": "2026-09-15T00:00:00.000Z",
        "state": "ACTIVE",
        "versionNumber": 1,
        "startEvent": "ASSIGNMENT",
        "qualifyingFact": "TOUCH",
        "supersedesPolicyId": null,
        "nextPolicyId": "01934b20-0000-7000-8000-000000000042",
        "publishedByUserId": "01934b10-0000-7000-8000-000000000301",
        "publishedAt": "2026-04-01T08:00:00.000Z"
      },
      {
        "id": "01934b20-0000-7000-8000-000000000032",
        "policyKind": "NEXT_STEP",
        "appliesToRecord": "OPPORTUNITY",
        "branchId": null,
        "clockKind": "WORKING_MINUTES",
        "targetMinutes": 960,
        "requiredTouchCount": null,
        "compliancePct": null,
        "qualifyingTouchBy": "OWNER",
        "qualifying": {
          "activityTypes": [
            "FOLLOW_UP",
            "MEETING",
            "TODO",
            "VISIT"
          ],
          "directions": null,
          "touchSources": null
        },
        "nameEn": "Opportunity next step planning",
        "nameAr": "تخطيط الخطوة التالية للفرص البيعية",
        "effectiveFrom": "2026-09-01T00:00:00.000Z",
        "effectiveTo": null,
        "state": "ACTIVE",
        "versionNumber": 2,
        "startEvent": "STAGE_ENTRY",
        "qualifyingFact": "PLANNED_ACTIVITY",
        "supersedesPolicyId": "01934b20-0000-7000-8000-000000000031",
        "nextPolicyId": null,
        "publishedByUserId": "01934b10-0000-7000-8000-000000000301",
        "publishedAt": "2026-09-01T08:00:00.000Z"
      },
      {
        "id": "01934b20-0000-7000-8000-000000000031",
        "policyKind": "NEXT_STEP",
        "appliesToRecord": "OPPORTUNITY",
        "branchId": null,
        "clockKind": "WORKING_MINUTES",
        "targetMinutes": 1440,
        "requiredTouchCount": null,
        "compliancePct": null,
        "qualifyingTouchBy": "OWNER",
        "qualifying": {
          "activityTypes": [
            "FOLLOW_UP",
            "MEETING",
            "TODO"
          ],
          "directions": null,
          "touchSources": null
        },
        "nameEn": "Opportunity next step planning",
        "nameAr": "تخطيط الخطوة التالية للفرص البيعية",
        "effectiveFrom": "2026-03-01T00:00:00.000Z",
        "effectiveTo": "2026-09-01T00:00:00.000Z",
        "state": "ACTIVE",
        "versionNumber": 1,
        "startEvent": "STAGE_ENTRY",
        "qualifyingFact": "PLANNED_ACTIVITY",
        "supersedesPolicyId": null,
        "nextPolicyId": "01934b20-0000-7000-8000-000000000032",
        "publishedByUserId": "01934b10-0000-7000-8000-000000000301",
        "publishedAt": "2026-03-01T08:00:00.000Z"
      },
      {
        "id": "01934b20-0000-7000-8000-000000000022",
        "policyKind": "FOLLOW_UP_CADENCE",
        "appliesToRecord": "LEAD",
        "branchId": null,
        "clockKind": "CALENDAR_MINUTES",
        "targetMinutes": 10080,
        "requiredTouchCount": 3,
        "compliancePct": 80,
        "qualifyingTouchBy": "OWNER",
        "qualifying": {
          "activityTypes": [
            "CALL",
            "EMAIL",
            "FOLLOW_UP",
            "MEETING"
          ],
          "directions": [
            "OUTBOUND"
          ],
          "touchSources": [
            "CORE_ACTIVITY",
            "CRM_ACTIVITY"
          ]
        },
        "nameEn": "Weekly lead follow-up cadence",
        "nameAr": "وتيرة المتابعة الأسبوعية للعملاء المحتملين",
        "effectiveFrom": "2026-08-01T00:00:00.000Z",
        "effectiveTo": null,
        "state": "ACTIVE",
        "versionNumber": 2,
        "startEvent": "ASSIGNMENT",
        "qualifyingFact": "TOUCH",
        "supersedesPolicyId": "01934b20-0000-7000-8000-000000000021",
        "nextPolicyId": null,
        "publishedByUserId": "01934b10-0000-7000-8000-000000000301",
        "publishedAt": "2026-08-01T08:00:00.000Z"
      },
      {
        "id": "01934b20-0000-7000-8000-000000000021",
        "policyKind": "FOLLOW_UP_CADENCE",
        "appliesToRecord": "LEAD",
        "branchId": null,
        "clockKind": "CALENDAR_MINUTES",
        "targetMinutes": 10080,
        "requiredTouchCount": 2,
        "compliancePct": 75,
        "qualifyingTouchBy": "OWNER",
        "qualifying": {
          "activityTypes": [
            "CALL",
            "EMAIL",
            "FOLLOW_UP"
          ],
          "directions": [
            "OUTBOUND"
          ],
          "touchSources": [
            "CRM_ACTIVITY"
          ]
        },
        "nameEn": "Weekly lead follow-up cadence",
        "nameAr": "وتيرة المتابعة الأسبوعية للعملاء المحتملين",
        "effectiveFrom": "2026-02-01T00:00:00.000Z",
        "effectiveTo": "2026-08-01T00:00:00.000Z",
        "state": "ACTIVE",
        "versionNumber": 1,
        "startEvent": "ASSIGNMENT",
        "qualifyingFact": "TOUCH",
        "supersedesPolicyId": null,
        "nextPolicyId": "01934b20-0000-7000-8000-000000000022",
        "publishedByUserId": "01934b10-0000-7000-8000-000000000301",
        "publishedAt": "2026-02-01T08:00:00.000Z"
      },
      {
        "id": "01934b20-0000-7000-8000-000000000013",
        "policyKind": "FIRST_RESPONSE",
        "appliesToRecord": "LEAD",
        "branchId": null,
        "clockKind": "WORKING_MINUTES",
        "targetMinutes": 30,
        "requiredTouchCount": null,
        "compliancePct": null,
        "qualifyingTouchBy": "ANYONE",
        "qualifying": {
          "activityTypes": [
            "CALL",
            "EMAIL",
            "MEETING"
          ],
          "directions": [
            "OUTBOUND"
          ],
          "touchSources": [
            "CORE_ACTIVITY",
            "CRM_ACTIVITY"
          ]
        },
        "nameEn": "Standard lead first response",
        "nameAr": "الاستجابة الأولى القياسية للعملاء المحتملين",
        "effectiveFrom": "2026-10-01T00:00:00.000Z",
        "effectiveTo": null,
        "state": "ACTIVE",
        "versionNumber": 3,
        "startEvent": "ASSIGNMENT",
        "qualifyingFact": "TOUCH",
        "supersedesPolicyId": "01934b20-0000-7000-8000-000000000012",
        "nextPolicyId": null,
        "publishedByUserId": "01934b10-0000-7000-8000-000000000301",
        "publishedAt": "2026-10-01T08:00:00.000Z"
      },
      {
        "id": "01934b20-0000-7000-8000-000000000012",
        "policyKind": "FIRST_RESPONSE",
        "appliesToRecord": "LEAD",
        "branchId": null,
        "clockKind": "WORKING_MINUTES",
        "targetMinutes": 45,
        "requiredTouchCount": null,
        "compliancePct": null,
        "qualifyingTouchBy": "OWNER",
        "qualifying": {
          "activityTypes": [
            "CALL",
            "EMAIL",
            "MEETING"
          ],
          "directions": [
            "OUTBOUND"
          ],
          "touchSources": [
            "CORE_ACTIVITY",
            "CRM_ACTIVITY"
          ]
        },
        "nameEn": "Standard lead first response",
        "nameAr": "الاستجابة الأولى القياسية للعملاء المحتملين",
        "effectiveFrom": "2026-06-01T00:00:00.000Z",
        "effectiveTo": "2026-10-01T00:00:00.000Z",
        "state": "ACTIVE",
        "versionNumber": 2,
        "startEvent": "ASSIGNMENT",
        "qualifyingFact": "TOUCH",
        "supersedesPolicyId": "01934b20-0000-7000-8000-000000000011",
        "nextPolicyId": "01934b20-0000-7000-8000-000000000013",
        "publishedByUserId": "01934b10-0000-7000-8000-000000000301",
        "publishedAt": "2026-06-01T08:00:00.000Z"
      },
      {
        "id": "01934b20-0000-7000-8000-000000000011",
        "policyKind": "FIRST_RESPONSE",
        "appliesToRecord": "LEAD",
        "branchId": null,
        "clockKind": "WORKING_MINUTES",
        "targetMinutes": 60,
        "requiredTouchCount": null,
        "compliancePct": null,
        "qualifyingTouchBy": "OWNER",
        "qualifying": {
          "activityTypes": [
            "CALL",
            "EMAIL"
          ],
          "directions": [
            "OUTBOUND"
          ],
          "touchSources": [
            "CRM_ACTIVITY"
          ]
        },
        "nameEn": "Standard lead first response",
        "nameAr": "الاستجابة الأولى القياسية للعملاء المحتملين",
        "effectiveFrom": "2026-01-01T00:00:00.000Z",
        "effectiveTo": "2026-06-01T00:00:00.000Z",
        "state": "ACTIVE",
        "versionNumber": 1,
        "startEvent": "ASSIGNMENT",
        "qualifyingFact": "TOUCH",
        "supersedesPolicyId": null,
        "nextPolicyId": "01934b20-0000-7000-8000-000000000012",
        "publishedByUserId": "01934b10-0000-7000-8000-000000000301",
        "publishedAt": "2026-01-01T08:00:00.000Z"
      }
    ],
    "pageInfo": {
      "limit": 100,
      "hasMore": false,
      "nextCursor": null
    }
  },
  "/sla/policies/01934b20-0000-7000-8000-000000000011": {
    "id": "01934b20-0000-7000-8000-000000000011",
    "policyKind": "FIRST_RESPONSE",
    "appliesToRecord": "LEAD",
    "branchId": null,
    "clockKind": "WORKING_MINUTES",
    "targetMinutes": 60,
    "requiredTouchCount": null,
    "compliancePct": null,
    "qualifyingTouchBy": "OWNER",
    "qualifying": {
      "activityTypes": [
        "CALL",
        "EMAIL"
      ],
      "directions": [
        "OUTBOUND"
      ],
      "touchSources": [
        "CRM_ACTIVITY"
      ]
    },
    "nameEn": "Standard lead first response",
    "nameAr": "الاستجابة الأولى القياسية للعملاء المحتملين",
    "effectiveFrom": "2026-01-01T00:00:00.000Z",
    "effectiveTo": "2026-06-01T00:00:00.000Z",
    "state": "ACTIVE",
    "versionNumber": 1,
    "startEvent": "ASSIGNMENT",
    "qualifyingFact": "TOUCH",
    "supersedesPolicyId": null,
    "nextPolicyId": "01934b20-0000-7000-8000-000000000012",
    "publishedByUserId": "01934b10-0000-7000-8000-000000000301",
    "publishedAt": "2026-01-01T08:00:00.000Z"
  },
  "/sla/policies/01934b20-0000-7000-8000-000000000012": {
    "id": "01934b20-0000-7000-8000-000000000012",
    "policyKind": "FIRST_RESPONSE",
    "appliesToRecord": "LEAD",
    "branchId": null,
    "clockKind": "WORKING_MINUTES",
    "targetMinutes": 45,
    "requiredTouchCount": null,
    "compliancePct": null,
    "qualifyingTouchBy": "OWNER",
    "qualifying": {
      "activityTypes": [
        "CALL",
        "EMAIL",
        "MEETING"
      ],
      "directions": [
        "OUTBOUND"
      ],
      "touchSources": [
        "CORE_ACTIVITY",
        "CRM_ACTIVITY"
      ]
    },
    "nameEn": "Standard lead first response",
    "nameAr": "الاستجابة الأولى القياسية للعملاء المحتملين",
    "effectiveFrom": "2026-06-01T00:00:00.000Z",
    "effectiveTo": "2026-10-01T00:00:00.000Z",
    "state": "ACTIVE",
    "versionNumber": 2,
    "startEvent": "ASSIGNMENT",
    "qualifyingFact": "TOUCH",
    "supersedesPolicyId": "01934b20-0000-7000-8000-000000000011",
    "nextPolicyId": "01934b20-0000-7000-8000-000000000013",
    "publishedByUserId": "01934b10-0000-7000-8000-000000000301",
    "publishedAt": "2026-06-01T08:00:00.000Z"
  },
  "/sla/policies/01934b20-0000-7000-8000-000000000013": {
    "id": "01934b20-0000-7000-8000-000000000013",
    "policyKind": "FIRST_RESPONSE",
    "appliesToRecord": "LEAD",
    "branchId": null,
    "clockKind": "WORKING_MINUTES",
    "targetMinutes": 30,
    "requiredTouchCount": null,
    "compliancePct": null,
    "qualifyingTouchBy": "ANYONE",
    "qualifying": {
      "activityTypes": [
        "CALL",
        "EMAIL",
        "MEETING"
      ],
      "directions": [
        "OUTBOUND"
      ],
      "touchSources": [
        "CORE_ACTIVITY",
        "CRM_ACTIVITY"
      ]
    },
    "nameEn": "Standard lead first response",
    "nameAr": "الاستجابة الأولى القياسية للعملاء المحتملين",
    "effectiveFrom": "2026-10-01T00:00:00.000Z",
    "effectiveTo": null,
    "state": "ACTIVE",
    "versionNumber": 3,
    "startEvent": "ASSIGNMENT",
    "qualifyingFact": "TOUCH",
    "supersedesPolicyId": "01934b20-0000-7000-8000-000000000012",
    "nextPolicyId": null,
    "publishedByUserId": "01934b10-0000-7000-8000-000000000301",
    "publishedAt": "2026-10-01T08:00:00.000Z"
  },
  "/sla/policies/01934b20-0000-7000-8000-000000000021": {
    "id": "01934b20-0000-7000-8000-000000000021",
    "policyKind": "FOLLOW_UP_CADENCE",
    "appliesToRecord": "LEAD",
    "branchId": null,
    "clockKind": "CALENDAR_MINUTES",
    "targetMinutes": 10080,
    "requiredTouchCount": 2,
    "compliancePct": 75,
    "qualifyingTouchBy": "OWNER",
    "qualifying": {
      "activityTypes": [
        "CALL",
        "EMAIL",
        "FOLLOW_UP"
      ],
      "directions": [
        "OUTBOUND"
      ],
      "touchSources": [
        "CRM_ACTIVITY"
      ]
    },
    "nameEn": "Weekly lead follow-up cadence",
    "nameAr": "وتيرة المتابعة الأسبوعية للعملاء المحتملين",
    "effectiveFrom": "2026-02-01T00:00:00.000Z",
    "effectiveTo": "2026-08-01T00:00:00.000Z",
    "state": "ACTIVE",
    "versionNumber": 1,
    "startEvent": "ASSIGNMENT",
    "qualifyingFact": "TOUCH",
    "supersedesPolicyId": null,
    "nextPolicyId": "01934b20-0000-7000-8000-000000000022",
    "publishedByUserId": "01934b10-0000-7000-8000-000000000301",
    "publishedAt": "2026-02-01T08:00:00.000Z"
  },
  "/sla/policies/01934b20-0000-7000-8000-000000000022": {
    "id": "01934b20-0000-7000-8000-000000000022",
    "policyKind": "FOLLOW_UP_CADENCE",
    "appliesToRecord": "LEAD",
    "branchId": null,
    "clockKind": "CALENDAR_MINUTES",
    "targetMinutes": 10080,
    "requiredTouchCount": 3,
    "compliancePct": 80,
    "qualifyingTouchBy": "OWNER",
    "qualifying": {
      "activityTypes": [
        "CALL",
        "EMAIL",
        "FOLLOW_UP",
        "MEETING"
      ],
      "directions": [
        "OUTBOUND"
      ],
      "touchSources": [
        "CORE_ACTIVITY",
        "CRM_ACTIVITY"
      ]
    },
    "nameEn": "Weekly lead follow-up cadence",
    "nameAr": "وتيرة المتابعة الأسبوعية للعملاء المحتملين",
    "effectiveFrom": "2026-08-01T00:00:00.000Z",
    "effectiveTo": null,
    "state": "ACTIVE",
    "versionNumber": 2,
    "startEvent": "ASSIGNMENT",
    "qualifyingFact": "TOUCH",
    "supersedesPolicyId": "01934b20-0000-7000-8000-000000000021",
    "nextPolicyId": null,
    "publishedByUserId": "01934b10-0000-7000-8000-000000000301",
    "publishedAt": "2026-08-01T08:00:00.000Z"
  },
  "/sla/policies/01934b20-0000-7000-8000-000000000031": {
    "id": "01934b20-0000-7000-8000-000000000031",
    "policyKind": "NEXT_STEP",
    "appliesToRecord": "OPPORTUNITY",
    "branchId": null,
    "clockKind": "WORKING_MINUTES",
    "targetMinutes": 1440,
    "requiredTouchCount": null,
    "compliancePct": null,
    "qualifyingTouchBy": "OWNER",
    "qualifying": {
      "activityTypes": [
        "FOLLOW_UP",
        "MEETING",
        "TODO"
      ],
      "directions": null,
      "touchSources": null
    },
    "nameEn": "Opportunity next step planning",
    "nameAr": "تخطيط الخطوة التالية للفرص البيعية",
    "effectiveFrom": "2026-03-01T00:00:00.000Z",
    "effectiveTo": "2026-09-01T00:00:00.000Z",
    "state": "ACTIVE",
    "versionNumber": 1,
    "startEvent": "STAGE_ENTRY",
    "qualifyingFact": "PLANNED_ACTIVITY",
    "supersedesPolicyId": null,
    "nextPolicyId": "01934b20-0000-7000-8000-000000000032",
    "publishedByUserId": "01934b10-0000-7000-8000-000000000301",
    "publishedAt": "2026-03-01T08:00:00.000Z"
  },
  "/sla/policies/01934b20-0000-7000-8000-000000000032": {
    "id": "01934b20-0000-7000-8000-000000000032",
    "policyKind": "NEXT_STEP",
    "appliesToRecord": "OPPORTUNITY",
    "branchId": null,
    "clockKind": "WORKING_MINUTES",
    "targetMinutes": 960,
    "requiredTouchCount": null,
    "compliancePct": null,
    "qualifyingTouchBy": "OWNER",
    "qualifying": {
      "activityTypes": [
        "FOLLOW_UP",
        "MEETING",
        "TODO",
        "VISIT"
      ],
      "directions": null,
      "touchSources": null
    },
    "nameEn": "Opportunity next step planning",
    "nameAr": "تخطيط الخطوة التالية للفرص البيعية",
    "effectiveFrom": "2026-09-01T00:00:00.000Z",
    "effectiveTo": null,
    "state": "ACTIVE",
    "versionNumber": 2,
    "startEvent": "STAGE_ENTRY",
    "qualifyingFact": "PLANNED_ACTIVITY",
    "supersedesPolicyId": "01934b20-0000-7000-8000-000000000031",
    "nextPolicyId": null,
    "publishedByUserId": "01934b10-0000-7000-8000-000000000301",
    "publishedAt": "2026-09-01T08:00:00.000Z"
  },
  "/sla/policies/01934b20-0000-7000-8000-000000000041": {
    "id": "01934b20-0000-7000-8000-000000000041",
    "policyKind": "FIRST_RESPONSE",
    "appliesToRecord": "LEAD",
    "branchId": "01934b10-0000-7000-8000-000000000101",
    "clockKind": "WORKING_MINUTES",
    "targetMinutes": 20,
    "requiredTouchCount": null,
    "compliancePct": null,
    "qualifyingTouchBy": "ANYONE",
    "qualifying": {
      "activityTypes": [
        "CALL",
        "EMAIL"
      ],
      "directions": [
        "OUTBOUND"
      ],
      "touchSources": [
        "CORE_ACTIVITY",
        "CRM_ACTIVITY"
      ]
    },
    "nameEn": "Cairo priority first response",
    "nameAr": "الاستجابة الأولى السريعة لفرع القاهرة",
    "effectiveFrom": "2026-04-01T00:00:00.000Z",
    "effectiveTo": "2026-09-15T00:00:00.000Z",
    "state": "ACTIVE",
    "versionNumber": 1,
    "startEvent": "ASSIGNMENT",
    "qualifyingFact": "TOUCH",
    "supersedesPolicyId": null,
    "nextPolicyId": "01934b20-0000-7000-8000-000000000042",
    "publishedByUserId": "01934b10-0000-7000-8000-000000000301",
    "publishedAt": "2026-04-01T08:00:00.000Z"
  },
  "/sla/policies/01934b20-0000-7000-8000-000000000042": {
    "id": "01934b20-0000-7000-8000-000000000042",
    "policyKind": "FIRST_RESPONSE",
    "appliesToRecord": "LEAD",
    "branchId": "01934b10-0000-7000-8000-000000000101",
    "clockKind": "WORKING_MINUTES",
    "targetMinutes": 15,
    "requiredTouchCount": null,
    "compliancePct": null,
    "qualifyingTouchBy": "ANYONE",
    "qualifying": {
      "activityTypes": [
        "CALL",
        "EMAIL"
      ],
      "directions": [
        "OUTBOUND"
      ],
      "touchSources": [
        "CORE_ACTIVITY",
        "CRM_ACTIVITY"
      ]
    },
    "nameEn": "Cairo priority first response",
    "nameAr": "الاستجابة الأولى السريعة لفرع القاهرة",
    "effectiveFrom": "2026-09-15T00:00:00.000Z",
    "effectiveTo": null,
    "state": "ACTIVE",
    "versionNumber": 2,
    "startEvent": "ASSIGNMENT",
    "qualifyingFact": "TOUCH",
    "supersedesPolicyId": "01934b20-0000-7000-8000-000000000041",
    "nextPolicyId": null,
    "publishedByUserId": "01934b10-0000-7000-8000-000000000301",
    "publishedAt": "2026-09-15T08:00:00.000Z"
  },
  "/outbound-emails": {
    "items": [
      {
        "outboundEmailId": "eml-001",
        "activityId": "act-001",
        "sourceType": "LEAD",
        "sourceId": "0193f2a4-6c1e-7b3a-9d42-5e8a1c7f4a11",
        "templateDefinitionId": "tpd-en-1",
        "templateVersionId": "tpl-en-1",
        "templateVersionNumber": 3,
        "recipient": {
          "displayName": "Karim Mansour",
          "maskedAddress": "k***r@alnoor-trading.eg"
        },
        "subjectPreview": "Welcome to Mutakamel CRM onboarding — Al Noor Trading Co.",
        "status": "QUEUED",
        "statusRevision": 1,
        "requestedAt": "2026-11-18T09:00:00.000Z",
        "sentAt": null,
        "failedAt": null,
        "requestedBy": {
          "id": "usr-1",
          "displayName": "Kamal Nabil"
        },
        "retryOfId": null
      },
      {
        "outboundEmailId": "eml-002",
        "activityId": "act-002",
        "sourceType": "LEAD",
        "sourceId": "0193f2a4-71d0-7c55-8e13-2b9d4f6a8c27",
        "templateDefinitionId": "tpd-en-2",
        "templateVersionId": "tpl-en-2",
        "templateVersionNumber": 2,
        "recipient": {
          "displayName": "Tarek Hassan",
          "maskedAddress": "t***n@deltalogistics.com"
        },
        "subjectPreview": "Follow-up on Q4 pricing proposal — Delta Logistics",
        "status": "DISPATCHING",
        "statusRevision": 2,
        "requestedAt": "2026-11-17T08:00:00.000Z",
        "sentAt": null,
        "failedAt": null,
        "requestedBy": {
          "id": "usr-2",
          "displayName": "Nourhan Adel"
        },
        "retryOfId": null
      },
      {
        "outboundEmailId": "eml-003",
        "activityId": "act-003",
        "sourceType": "CUSTOMER_PROFILE",
        "sourceId": "0193f2a5-1f84-7e02-b5c9-3d7a6e8f0b6d",
        "templateDefinitionId": "tpd-ar-1",
        "templateVersionId": "tpl-ar-1",
        "templateVersionNumber": 3,
        "recipient": {
          "displayName": "Omar Suppressed",
          "maskedAddress": "o***r@redseacontracting.com"
        },
        "subjectPreview": "Follow-up on Q4 pricing proposal — Red Sea Contracting",
        "status": "SENT",
        "statusRevision": 3,
        "requestedAt": "2026-11-16T07:00:00.000Z",
        "sentAt": "2026-11-16T07:00:42.000Z",
        "failedAt": null,
        "requestedBy": {
          "id": "usr-3",
          "displayName": "Sherif Gamal"
        },
        "retryOfId": "eml-010"
      },
      {
        "outboundEmailId": "eml-004",
        "activityId": "act-004",
        "sourceType": "CUSTOMER_PROFILE",
        "sourceId": "0193f2a5-1f84-7e02-b5c9-3d7a6e8f0b6d",
        "templateDefinitionId": "tpd-ar-1",
        "templateVersionId": "tpl-ar-1",
        "templateVersionNumber": 3,
        "recipient": {
          "displayName": "Omar Suppressed",
          "maskedAddress": "o***r@redseacontracting.com"
        },
        "subjectPreview": "Requested product specification sheet — Red Sea Contracting",
        "status": "QUEUED",
        "statusRevision": 1,
        "requestedAt": "2026-11-14T06:00:00.000Z",
        "sentAt": null,
        "failedAt": null,
        "requestedBy": {
          "id": "usr-1",
          "displayName": "Kamal Nabil"
        },
        "retryOfId": null
      },
      {
        "outboundEmailId": "eml-005",
        "activityId": "act-005",
        "sourceType": "OPPORTUNITY",
        "sourceId": "0193f2a5-3c27-7a49-8f61-9e4b2c5d7a83",
        "templateDefinitionId": "tpd-ar-2",
        "templateVersionId": "tpl-ar-2",
        "templateVersionNumber": 2,
        "recipient": {
          "displayName": "Youssef Adel",
          "maskedAddress": "y***l@cairocorp.eg"
        },
        "subjectPreview": "Meeting summary and next milestones — Annual ERP Renewal - Cairo",
        "status": "DISPATCHING",
        "statusRevision": 2,
        "requestedAt": "2026-11-13T05:00:00.000Z",
        "sentAt": null,
        "failedAt": null,
        "requestedBy": {
          "id": "usr-2",
          "displayName": "Nourhan Adel"
        },
        "retryOfId": null
      },
      {
        "outboundEmailId": "eml-006",
        "activityId": "act-006",
        "sourceType": "OPPORTUNITY",
        "sourceId": "0193f2a5-4e92-7b8c-9a37-1f6d8e2c4b9e",
        "templateDefinitionId": "tpd-ar-3",
        "templateVersionId": "tpl-ar-3",
        "templateVersionNumber": 1,
        "recipient": {
          "displayName": "Rami Khalil",
          "maskedAddress": "r***l@warehouse-co.com"
        },
        "subjectPreview": "Updated implementation timeline — Warehouse Expansion Rollout",
        "status": "FAILED",
        "statusRevision": 3,
        "requestedAt": "2026-11-11T04:00:00.000Z",
        "sentAt": null,
        "failedAt": "2026-11-11T04:00:55.000Z",
        "requestedBy": {
          "id": "usr-3",
          "displayName": "Sherif Gamal"
        },
        "retryOfId": null
      },
      {
        "outboundEmailId": "eml-007",
        "activityId": "act-007",
        "sourceType": "LEAD",
        "sourceId": "0193f2a4-6c1e-7b3a-9d42-5e8a1c7f4a11",
        "templateDefinitionId": "tpd-en-1",
        "templateVersionId": "tpl-en-1",
        "templateVersionNumber": 3,
        "recipient": {
          "displayName": "Karim Mansour",
          "maskedAddress": "k***r@alnoor-trading.eg"
        },
        "subjectPreview": "Account onboarding checklist — Al Noor Trading Co.",
        "status": "SENT",
        "statusRevision": 3,
        "requestedAt": "2026-11-10T03:00:00.000Z",
        "sentAt": "2026-11-10T03:00:42.000Z",
        "failedAt": null,
        "requestedBy": {
          "id": "usr-1",
          "displayName": "Kamal Nabil"
        },
        "retryOfId": null
      },
      {
        "outboundEmailId": "eml-008",
        "activityId": "act-008",
        "sourceType": "LEAD",
        "sourceId": "0193f2a4-71d0-7c55-8e13-2b9d4f6a8c27",
        "templateDefinitionId": "tpd-en-2",
        "templateVersionId": "tpl-en-2",
        "templateVersionNumber": 2,
        "recipient": {
          "displayName": "Tarek Hassan",
          "maskedAddress": "t***n@deltalogistics.com"
        },
        "subjectPreview": "Quarterly executive review invitation — Delta Logistics",
        "status": "SENT",
        "statusRevision": 4,
        "requestedAt": "2026-11-08T02:00:00.000Z",
        "sentAt": "2026-11-08T02:00:42.000Z",
        "failedAt": null,
        "requestedBy": {
          "id": "usr-2",
          "displayName": "Nourhan Adel"
        },
        "retryOfId": null
      },
      {
        "outboundEmailId": "eml-009",
        "activityId": "act-009",
        "sourceType": "CUSTOMER_PROFILE",
        "sourceId": "0193f2a5-0a3b-7d18-a6f4-7c2e9b1d3e52",
        "templateDefinitionId": "tpd-en-3",
        "templateVersionId": "tpl-en-3",
        "templateVersionNumber": 1,
        "recipient": {
          "displayName": "Salma Ibrahim",
          "maskedAddress": "s***m@niletech.io"
        },
        "subjectPreview": "Welcome to Mutakamel CRM onboarding — Nile Tech Solutions",
        "status": "SENT",
        "statusRevision": 3,
        "requestedAt": "2026-11-07T01:00:00.000Z",
        "sentAt": "2026-11-07T01:00:42.000Z",
        "failedAt": null,
        "requestedBy": {
          "id": "usr-3",
          "displayName": "Sherif Gamal"
        },
        "retryOfId": null
      },
      {
        "outboundEmailId": "eml-010",
        "activityId": "act-010",
        "sourceType": "CUSTOMER_PROFILE",
        "sourceId": "0193f2a5-1f84-7e02-b5c9-3d7a6e8f0b6d",
        "templateDefinitionId": "tpd-ar-1",
        "templateVersionId": "tpl-ar-1",
        "templateVersionNumber": 3,
        "recipient": {
          "displayName": "Omar Suppressed",
          "maskedAddress": "o***r@redseacontracting.com"
        },
        "subjectPreview": "Follow-up on Q4 pricing proposal — Red Sea Contracting",
        "status": "FAILED",
        "statusRevision": 3,
        "requestedAt": "2026-11-05T00:00:00.000Z",
        "sentAt": null,
        "failedAt": "2026-11-05T00:00:55.000Z",
        "requestedBy": {
          "id": "usr-1",
          "displayName": "Kamal Nabil"
        },
        "retryOfId": null
      },
      {
        "outboundEmailId": "eml-011",
        "activityId": "act-011",
        "sourceType": "OPPORTUNITY",
        "sourceId": "0193f2a5-3c27-7a49-8f61-9e4b2c5d7a83",
        "templateDefinitionId": "tpd-ar-2",
        "templateVersionId": "tpl-ar-2",
        "templateVersionNumber": 2,
        "recipient": {
          "displayName": "Youssef Adel",
          "maskedAddress": "y***l@cairocorp.eg"
        },
        "subjectPreview": "Contract renewal schedule for next quarter — Annual ERP Renewal - Cairo",
        "status": "SENT",
        "statusRevision": 3,
        "requestedAt": "2026-11-03T23:00:00.000Z",
        "sentAt": "2026-11-03T23:00:42.000Z",
        "failedAt": null,
        "requestedBy": {
          "id": "usr-2",
          "displayName": "Nourhan Adel"
        },
        "retryOfId": null
      },
      {
        "outboundEmailId": "eml-012",
        "activityId": "act-012",
        "sourceType": "OPPORTUNITY",
        "sourceId": "0193f2a5-4e92-7b8c-9a37-1f6d8e2c4b9e",
        "templateDefinitionId": "tpd-ar-3",
        "templateVersionId": "tpl-ar-3",
        "templateVersionNumber": 1,
        "recipient": {
          "displayName": "Rami Khalil",
          "maskedAddress": "r***l@warehouse-co.com"
        },
        "subjectPreview": "Requested product specification sheet — Warehouse Expansion Rollout",
        "status": "SENT",
        "statusRevision": 3,
        "requestedAt": "2026-11-01T22:00:00.000Z",
        "sentAt": "2026-11-01T22:00:42.000Z",
        "failedAt": null,
        "requestedBy": {
          "id": "usr-3",
          "displayName": "Sherif Gamal"
        },
        "retryOfId": null
      },
      {
        "outboundEmailId": "eml-013",
        "activityId": "act-013",
        "sourceType": "LEAD",
        "sourceId": "0193f2a4-6c1e-7b3a-9d42-5e8a1c7f4a11",
        "templateDefinitionId": "tpd-en-1",
        "templateVersionId": "tpl-en-1",
        "templateVersionNumber": 3,
        "recipient": {
          "displayName": "Karim Mansour",
          "maskedAddress": "k***r@alnoor-trading.eg"
        },
        "subjectPreview": "Meeting summary and next milestones — Al Noor Trading Co.",
        "status": "SENT",
        "statusRevision": 3,
        "requestedAt": "2026-11-01T09:00:00.000Z",
        "sentAt": "2026-11-01T09:00:42.000Z",
        "failedAt": null,
        "requestedBy": {
          "id": "usr-1",
          "displayName": "Kamal Nabil"
        },
        "retryOfId": null
      },
      {
        "outboundEmailId": "eml-014",
        "activityId": "act-014",
        "sourceType": "LEAD",
        "sourceId": "0193f2a4-71d0-7c55-8e13-2b9d4f6a8c27",
        "templateDefinitionId": "tpd-en-2",
        "templateVersionId": "tpl-en-2",
        "templateVersionNumber": 2,
        "recipient": {
          "displayName": "Tarek Hassan",
          "maskedAddress": "t***n@deltalogistics.com"
        },
        "subjectPreview": "Updated implementation timeline — Delta Logistics",
        "status": "SENT",
        "statusRevision": 3,
        "requestedAt": "2026-10-30T08:00:00.000Z",
        "sentAt": "2026-10-30T08:00:42.000Z",
        "failedAt": null,
        "requestedBy": {
          "id": "usr-2",
          "displayName": "Nourhan Adel"
        },
        "retryOfId": null
      },
      {
        "outboundEmailId": "eml-015",
        "activityId": "act-015",
        "sourceType": "CUSTOMER_PROFILE",
        "sourceId": "0193f2a5-0a3b-7d18-a6f4-7c2e9b1d3e52",
        "templateDefinitionId": "tpd-en-3",
        "templateVersionId": "tpl-en-3",
        "templateVersionNumber": 1,
        "recipient": {
          "displayName": "Salma Ibrahim",
          "maskedAddress": "s***m@niletech.io"
        },
        "subjectPreview": "Account onboarding checklist — Nile Tech Solutions",
        "status": "FAILED",
        "statusRevision": 3,
        "requestedAt": "2026-10-29T07:00:00.000Z",
        "sentAt": null,
        "failedAt": "2026-10-29T07:00:55.000Z",
        "requestedBy": {
          "id": "usr-3",
          "displayName": "Sherif Gamal"
        },
        "retryOfId": null
      },
      {
        "outboundEmailId": "eml-016",
        "activityId": "act-016",
        "sourceType": "CUSTOMER_PROFILE",
        "sourceId": "0193f2a5-1f84-7e02-b5c9-3d7a6e8f0b6d",
        "templateDefinitionId": "tpd-ar-1",
        "templateVersionId": "tpl-ar-1",
        "templateVersionNumber": 3,
        "recipient": {
          "displayName": "Omar Suppressed",
          "maskedAddress": "o***r@redseacontracting.com"
        },
        "subjectPreview": "Quarterly executive review invitation — Red Sea Contracting",
        "status": "SENT",
        "statusRevision": 3,
        "requestedAt": "2026-10-27T06:00:00.000Z",
        "sentAt": "2026-10-27T06:00:42.000Z",
        "failedAt": null,
        "requestedBy": {
          "id": "usr-1",
          "displayName": "Kamal Nabil"
        },
        "retryOfId": null
      },
      {
        "outboundEmailId": "eml-017",
        "activityId": "act-017",
        "sourceType": "OPPORTUNITY",
        "sourceId": "0193f2a5-3c27-7a49-8f61-9e4b2c5d7a83",
        "templateDefinitionId": "tpd-ar-2",
        "templateVersionId": "tpl-ar-2",
        "templateVersionNumber": 2,
        "recipient": {
          "displayName": "Youssef Adel",
          "maskedAddress": "y***l@cairocorp.eg"
        },
        "subjectPreview": "Welcome to Mutakamel CRM onboarding — Annual ERP Renewal - Cairo",
        "status": "SENT",
        "statusRevision": 3,
        "requestedAt": "2026-10-26T05:00:00.000Z",
        "sentAt": "2026-10-26T05:00:42.000Z",
        "failedAt": null,
        "requestedBy": {
          "id": "usr-2",
          "displayName": "Nourhan Adel"
        },
        "retryOfId": null
      },
      {
        "outboundEmailId": "eml-018",
        "activityId": "act-018",
        "sourceType": "OPPORTUNITY",
        "sourceId": "0193f2a5-4e92-7b8c-9a37-1f6d8e2c4b9e",
        "templateDefinitionId": "tpd-ar-3",
        "templateVersionId": "tpl-ar-3",
        "templateVersionNumber": 1,
        "recipient": {
          "displayName": "Rami Khalil",
          "maskedAddress": "r***l@warehouse-co.com"
        },
        "subjectPreview": "Follow-up on Q4 pricing proposal — Warehouse Expansion Rollout",
        "status": "SENT",
        "statusRevision": 3,
        "requestedAt": "2026-10-24T04:00:00.000Z",
        "sentAt": "2026-10-24T04:00:42.000Z",
        "failedAt": null,
        "requestedBy": {
          "id": "usr-3",
          "displayName": "Sherif Gamal"
        },
        "retryOfId": null
      },
      {
        "outboundEmailId": "eml-019",
        "activityId": "act-019",
        "sourceType": "LEAD",
        "sourceId": "0193f2a4-6c1e-7b3a-9d42-5e8a1c7f4a11",
        "templateDefinitionId": "tpd-en-1",
        "templateVersionId": "tpl-en-1",
        "templateVersionNumber": 3,
        "recipient": {
          "displayName": "Karim Mansour",
          "maskedAddress": "k***r@alnoor-trading.eg"
        },
        "subjectPreview": "Contract renewal schedule for next quarter — Al Noor Trading Co.",
        "status": "SENT",
        "statusRevision": 4,
        "requestedAt": "2026-10-23T03:00:00.000Z",
        "sentAt": "2026-10-23T03:00:42.000Z",
        "failedAt": null,
        "requestedBy": {
          "id": "usr-1",
          "displayName": "Kamal Nabil"
        },
        "retryOfId": null
      },
      {
        "outboundEmailId": "eml-020",
        "activityId": "act-020",
        "sourceType": "LEAD",
        "sourceId": "0193f2a4-71d0-7c55-8e13-2b9d4f6a8c27",
        "templateDefinitionId": "tpd-en-2",
        "templateVersionId": "tpl-en-2",
        "templateVersionNumber": 2,
        "recipient": {
          "displayName": "Tarek Hassan",
          "maskedAddress": "t***n@deltalogistics.com"
        },
        "subjectPreview": "Requested product specification sheet — Delta Logistics",
        "status": "SENT",
        "statusRevision": 3,
        "requestedAt": "2026-10-21T02:00:00.000Z",
        "sentAt": "2026-10-21T02:00:42.000Z",
        "failedAt": null,
        "requestedBy": {
          "id": "usr-2",
          "displayName": "Nourhan Adel"
        },
        "retryOfId": null
      },
      {
        "outboundEmailId": "eml-021",
        "activityId": "act-021",
        "sourceType": "CUSTOMER_PROFILE",
        "sourceId": "0193f2a5-0a3b-7d18-a6f4-7c2e9b1d3e52",
        "templateDefinitionId": "tpd-en-3",
        "templateVersionId": "tpl-en-3",
        "templateVersionNumber": 1,
        "recipient": {
          "displayName": "Salma Ibrahim",
          "maskedAddress": "s***m@niletech.io"
        },
        "subjectPreview": "Meeting summary and next milestones — Nile Tech Solutions",
        "status": "FAILED",
        "statusRevision": 3,
        "requestedAt": "2026-10-20T01:00:00.000Z",
        "sentAt": null,
        "failedAt": "2026-10-20T01:00:55.000Z",
        "requestedBy": {
          "id": "usr-3",
          "displayName": "Sherif Gamal"
        },
        "retryOfId": null
      },
      {
        "outboundEmailId": "eml-022",
        "activityId": "act-022",
        "sourceType": "CUSTOMER_PROFILE",
        "sourceId": "0193f2a5-1f84-7e02-b5c9-3d7a6e8f0b6d",
        "templateDefinitionId": "tpd-ar-1",
        "templateVersionId": "tpl-ar-1",
        "templateVersionNumber": 3,
        "recipient": {
          "displayName": "Omar Suppressed",
          "maskedAddress": "o***r@redseacontracting.com"
        },
        "subjectPreview": "Updated implementation timeline — Red Sea Contracting",
        "status": "SENT",
        "statusRevision": 3,
        "requestedAt": "2026-10-18T00:00:00.000Z",
        "sentAt": "2026-10-18T00:00:42.000Z",
        "failedAt": null,
        "requestedBy": {
          "id": "usr-1",
          "displayName": "Kamal Nabil"
        },
        "retryOfId": null
      },
      {
        "outboundEmailId": "eml-023",
        "activityId": "act-023",
        "sourceType": "OPPORTUNITY",
        "sourceId": "0193f2a5-3c27-7a49-8f61-9e4b2c5d7a83",
        "templateDefinitionId": "tpd-ar-2",
        "templateVersionId": "tpl-ar-2",
        "templateVersionNumber": 2,
        "recipient": {
          "displayName": "Youssef Adel",
          "maskedAddress": "y***l@cairocorp.eg"
        },
        "subjectPreview": "Account onboarding checklist — Annual ERP Renewal - Cairo",
        "status": "SENT",
        "statusRevision": 3,
        "requestedAt": "2026-10-16T23:00:00.000Z",
        "sentAt": "2026-10-16T23:00:42.000Z",
        "failedAt": null,
        "requestedBy": {
          "id": "usr-2",
          "displayName": "Nourhan Adel"
        },
        "retryOfId": null
      },
      {
        "outboundEmailId": "eml-024",
        "activityId": "act-024",
        "sourceType": "OPPORTUNITY",
        "sourceId": "0193f2a5-4e92-7b8c-9a37-1f6d8e2c4b9e",
        "templateDefinitionId": "tpd-ar-3",
        "templateVersionId": "tpl-ar-3",
        "templateVersionNumber": 1,
        "recipient": {
          "displayName": "Rami Khalil",
          "maskedAddress": "r***l@warehouse-co.com"
        },
        "subjectPreview": "Quarterly executive review invitation — Warehouse Expansion Rollout",
        "status": "SENT",
        "statusRevision": 3,
        "requestedAt": "2026-10-14T22:00:00.000Z",
        "sentAt": "2026-10-14T22:00:42.000Z",
        "failedAt": null,
        "requestedBy": {
          "id": "usr-3",
          "displayName": "Sherif Gamal"
        },
        "retryOfId": null
      },
      {
        "outboundEmailId": "eml-025",
        "activityId": "act-025",
        "sourceType": "LEAD",
        "sourceId": "0193f2a4-6c1e-7b3a-9d42-5e8a1c7f4a11",
        "templateDefinitionId": "tpd-en-1",
        "templateVersionId": "tpl-en-1",
        "templateVersionNumber": 3,
        "recipient": {
          "displayName": "Karim Mansour",
          "maskedAddress": "k***r@alnoor-trading.eg"
        },
        "subjectPreview": "Welcome to Mutakamel CRM onboarding — Al Noor Trading Co.",
        "status": "SENT",
        "statusRevision": 4,
        "requestedAt": "2026-10-14T09:00:00.000Z",
        "sentAt": "2026-10-14T09:00:42.000Z",
        "failedAt": null,
        "requestedBy": {
          "id": "usr-1",
          "displayName": "Kamal Nabil"
        },
        "retryOfId": null
      }
    ],
    "nextCursor": "25",
    "hasNext": true,
    "limit": 25
  },
  "/outbound-emails/eml-001": {
    "outboundEmailId": "eml-001",
    "activityId": "act-001",
    "sourceType": "LEAD",
    "sourceId": "0193f2a4-6c1e-7b3a-9d42-5e8a1c7f4a11",
    "template": {
      "templateDefinitionId": "tpd-en-1",
      "templateVersionId": "tpl-en-1",
      "versionNumber": 3,
      "documentType": "CRM_OUTBOUND_EMAIL",
      "outputChannel": "EMAIL",
      "layoutMode": "EMAIL_FLOW",
      "locale": "en",
      "direction": "LTR",
      "dataSourceKey": "CRM_LEAD_OUTBOUND_EMAIL_V1",
      "dataSourceSchemaVersion": 1,
      "dataSourceSchemaChecksum": "sha256:c1a91195c1a91195c1a91195c1a91195c1a91195c1a91195c1a91195c1a91195",
      "templateContentChecksum": "sha256:90123c2b90123c2b90123c2b90123c2b90123c2b90123c2b90123c2b90123c2b",
      "compiledChecksum": "sha256:da371f13da371f13da371f13da371f13da371f13da371f13da371f13da371f13",
      "compilerFingerprint": "template-compiler/1",
      "lifecycleStatus": "PUBLISHED"
    },
    "recipient": {
      "displayName": "Karim Mansour",
      "maskedAddress": "k***r@alnoor-trading.eg",
      "kind": "TO"
    },
    "sender": {
      "displayName": "Mutakamel Sales",
      "maskedAddress": "s***s@mutakamel.ai",
      "maskedReplyTo": null
    },
    "senderConfigRevision": 3,
    "content": {
      "state": "AVAILABLE",
      "subject": "Welcome to Mutakamel CRM onboarding — Al Noor Trading Co.",
      "preheader": "Update regarding Al Noor Trading Co.",
      "html": "<div style=\"font-family:Arial,sans-serif;color:#12141c;line-height:1.5;padding:16px;\"><h2 style=\"margin:0 0 12px;font-size:16px;color:#0f2f78;\">Welcome to Mutakamel CRM onboarding — Al Noor Trading Co.</h2><p style=\"margin:0 0 10px;\">Hello Karim Mansour,</p><p style=\"margin:0 0 10px;\">Thank you for speaking with our team regarding <strong>Al Noor Trading Co.</strong>. Please find the latest details summarized below.</p><p style=\"margin:0 0 16px;\">Reply directly to this email if you would like to schedule a follow-up call this week.</p><p style=\"margin:0;color:#5b6072;font-size:12px;\">Best regards,<br/>Mutakamel CRM Team</p></div>",
      "text": "Welcome to Mutakamel CRM onboarding — Al Noor Trading Co.\n\nHello Karim Mansour,\n\nThank you for speaking with our team regarding Al Noor Trading Co..\nReply directly if you would like to schedule a follow-up call.\n\nBest regards,\nMutakamel CRM Team",
      "contentChecksum": "sha256:0a90eda20a90eda20a90eda20a90eda20a90eda20a90eda20a90eda20a90eda2"
    },
    "status": "QUEUED",
    "statusRevision": 1,
    "provider": null,
    "failure": null,
    "feedback": [],
    "timeline": [
      {
        "state": "QUEUED",
        "occurredAt": "2026-11-18T09:00:00.000Z"
      }
    ],
    "requestedAt": "2026-11-18T09:00:00.000Z",
    "sentAt": null,
    "failedAt": null,
    "retryOfId": null,
    "retriedById": null,
    "contentRetentionDays": 730,
    "contentRetentionUntil": "2028-11-17T09:00:00.000Z",
    "contentRetentionPolicyRevision": 1
  },
  "/outbound-emails/eml-002": {
    "outboundEmailId": "eml-002",
    "activityId": "act-002",
    "sourceType": "LEAD",
    "sourceId": "0193f2a4-71d0-7c55-8e13-2b9d4f6a8c27",
    "template": {
      "templateDefinitionId": "tpd-en-2",
      "templateVersionId": "tpl-en-2",
      "versionNumber": 2,
      "documentType": "CRM_OUTBOUND_EMAIL",
      "outputChannel": "EMAIL",
      "layoutMode": "EMAIL_FLOW",
      "locale": "en",
      "direction": "LTR",
      "dataSourceKey": "CRM_LEAD_OUTBOUND_EMAIL_V1",
      "dataSourceSchemaVersion": 1,
      "dataSourceSchemaChecksum": "sha256:c1a91195c1a91195c1a91195c1a91195c1a91195c1a91195c1a91195c1a91195",
      "templateContentChecksum": "sha256:90123c2c90123c2c90123c2c90123c2c90123c2c90123c2c90123c2c90123c2c",
      "compiledChecksum": "sha256:da371f14da371f14da371f14da371f14da371f14da371f14da371f14da371f14",
      "compilerFingerprint": "template-compiler/1",
      "lifecycleStatus": "PUBLISHED"
    },
    "recipient": {
      "displayName": "Tarek Hassan",
      "maskedAddress": "t***n@deltalogistics.com",
      "kind": "TO"
    },
    "sender": {
      "displayName": "Mutakamel Sales",
      "maskedAddress": "s***s@mutakamel.ai",
      "maskedReplyTo": "r***y@mutakamel.ai"
    },
    "senderConfigRevision": 3,
    "content": {
      "state": "AVAILABLE",
      "subject": "Follow-up on Q4 pricing proposal — Delta Logistics",
      "preheader": "Update regarding Delta Logistics",
      "html": "<div style=\"font-family:Arial,sans-serif;color:#12141c;line-height:1.5;padding:16px;\"><h2 style=\"margin:0 0 12px;font-size:16px;color:#0f2f78;\">Follow-up on Q4 pricing proposal — Delta Logistics</h2><p style=\"margin:0 0 10px;\">Hello Tarek Hassan,</p><p style=\"margin:0 0 10px;\">Thank you for speaking with our team regarding <strong>Delta Logistics</strong>. Please find the latest details summarized below.</p><p style=\"margin:0 0 16px;\">Reply directly to this email if you would like to schedule a follow-up call this week.</p><p style=\"margin:0;color:#5b6072;font-size:12px;\">Best regards,<br/>Mutakamel CRM Team</p></div>",
      "text": "Follow-up on Q4 pricing proposal — Delta Logistics\n\nHello Tarek Hassan,\n\nThank you for speaking with our team regarding Delta Logistics.\nReply directly if you would like to schedule a follow-up call.\n\nBest regards,\nMutakamel CRM Team",
      "contentChecksum": "sha256:3d70d53a3d70d53a3d70d53a3d70d53a3d70d53a3d70d53a3d70d53a3d70d53a"
    },
    "status": "DISPATCHING",
    "statusRevision": 2,
    "provider": null,
    "failure": null,
    "feedback": [],
    "timeline": [
      {
        "state": "QUEUED",
        "occurredAt": "2026-11-17T08:00:00.000Z"
      },
      {
        "state": "DISPATCHING",
        "occurredAt": "2026-11-17T08:00:18.000Z"
      }
    ],
    "requestedAt": "2026-11-17T08:00:00.000Z",
    "sentAt": null,
    "failedAt": null,
    "retryOfId": null,
    "retriedById": null,
    "contentRetentionDays": 730,
    "contentRetentionUntil": "2028-11-16T08:00:00.000Z",
    "contentRetentionPolicyRevision": 1
  },
  "/outbound-emails/eml-003": {
    "outboundEmailId": "eml-003",
    "activityId": "act-003",
    "sourceType": "CUSTOMER_PROFILE",
    "sourceId": "0193f2a5-1f84-7e02-b5c9-3d7a6e8f0b6d",
    "template": {
      "templateDefinitionId": "tpd-ar-1",
      "templateVersionId": "tpl-ar-1",
      "versionNumber": 3,
      "documentType": "CRM_OUTBOUND_EMAIL",
      "outputChannel": "EMAIL",
      "layoutMode": "EMAIL_FLOW",
      "locale": "ar",
      "direction": "RTL",
      "dataSourceKey": "CRM_CUSTOMER_OUTBOUND_EMAIL_V1",
      "dataSourceSchemaVersion": 1,
      "dataSourceSchemaChecksum": "sha256:ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1",
      "templateContentChecksum": "sha256:901079b3901079b3901079b3901079b3901079b3901079b3901079b3901079b3",
      "compiledChecksum": "sha256:da355c9bda355c9bda355c9bda355c9bda355c9bda355c9bda355c9bda355c9b",
      "compilerFingerprint": "template-compiler/1",
      "lifecycleStatus": "PUBLISHED"
    },
    "recipient": {
      "displayName": "Omar Suppressed",
      "maskedAddress": "o***r@redseacontracting.com",
      "kind": "TO"
    },
    "sender": {
      "displayName": "Mutakamel Sales",
      "maskedAddress": "s***s@mutakamel.ai",
      "maskedReplyTo": "r***y@mutakamel.ai"
    },
    "senderConfigRevision": 3,
    "content": {
      "state": "AVAILABLE",
      "subject": "Follow-up on Q4 pricing proposal — Red Sea Contracting",
      "preheader": "Update regarding Red Sea Contracting",
      "html": "<div style=\"font-family:Arial,sans-serif;color:#12141c;line-height:1.5;padding:16px;\"><h2 style=\"margin:0 0 12px;font-size:16px;color:#0f2f78;\">Follow-up on Q4 pricing proposal — Red Sea Contracting</h2><p style=\"margin:0 0 10px;\">Hello Omar Suppressed,</p><p style=\"margin:0 0 10px;\">Thank you for speaking with our team regarding <strong>Red Sea Contracting</strong>. Please find the latest details summarized below.</p><p style=\"margin:0 0 16px;\">Reply directly to this email if you would like to schedule a follow-up call this week.</p><p style=\"margin:0;color:#5b6072;font-size:12px;\">Best regards,<br/>Mutakamel CRM Team</p></div>",
      "text": "Follow-up on Q4 pricing proposal — Red Sea Contracting\n\nHello Omar Suppressed,\n\nThank you for speaking with our team regarding Red Sea Contracting.\nReply directly if you would like to schedule a follow-up call.\n\nBest regards,\nMutakamel CRM Team",
      "contentChecksum": "sha256:dce4be0adce4be0adce4be0adce4be0adce4be0adce4be0adce4be0adce4be0a"
    },
    "status": "SENT",
    "statusRevision": 3,
    "provider": {
      "kind": "PLATFORM-SHARED",
      "submissionReference": "0100019002a7c4e2f1-eml-003"
    },
    "failure": null,
    "feedback": [],
    "timeline": [
      {
        "state": "RETRY_REQUESTED",
        "occurredAt": "2026-11-16T07:00:00.000Z"
      },
      {
        "state": "DISPATCHING",
        "occurredAt": "2026-11-16T07:00:15.000Z"
      },
      {
        "state": "SENT",
        "occurredAt": "2026-11-16T07:00:42.000Z"
      }
    ],
    "requestedAt": "2026-11-16T07:00:00.000Z",
    "sentAt": "2026-11-16T07:00:42.000Z",
    "failedAt": null,
    "retryOfId": "eml-010",
    "retriedById": null,
    "contentRetentionDays": 730,
    "contentRetentionUntil": "2028-11-15T07:00:00.000Z",
    "contentRetentionPolicyRevision": 1
  },
  "/outbound-emails/eml-004": {
    "outboundEmailId": "eml-004",
    "activityId": "act-004",
    "sourceType": "CUSTOMER_PROFILE",
    "sourceId": "0193f2a5-1f84-7e02-b5c9-3d7a6e8f0b6d",
    "template": {
      "templateDefinitionId": "tpd-ar-1",
      "templateVersionId": "tpl-ar-1",
      "versionNumber": 3,
      "documentType": "CRM_OUTBOUND_EMAIL",
      "outputChannel": "EMAIL",
      "layoutMode": "EMAIL_FLOW",
      "locale": "ar",
      "direction": "RTL",
      "dataSourceKey": "CRM_CUSTOMER_OUTBOUND_EMAIL_V1",
      "dataSourceSchemaVersion": 1,
      "dataSourceSchemaChecksum": "sha256:ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1",
      "templateContentChecksum": "sha256:901079b3901079b3901079b3901079b3901079b3901079b3901079b3901079b3",
      "compiledChecksum": "sha256:da355c9bda355c9bda355c9bda355c9bda355c9bda355c9bda355c9bda355c9b",
      "compilerFingerprint": "template-compiler/1",
      "lifecycleStatus": "PUBLISHED"
    },
    "recipient": {
      "displayName": "Omar Suppressed",
      "maskedAddress": "o***r@redseacontracting.com",
      "kind": "TO"
    },
    "sender": {
      "displayName": "Mutakamel Sales",
      "maskedAddress": "s***s@mutakamel.ai",
      "maskedReplyTo": "r***y@mutakamel.ai"
    },
    "senderConfigRevision": 3,
    "content": {
      "state": "AVAILABLE",
      "subject": "Requested product specification sheet — Red Sea Contracting",
      "preheader": "Update regarding Red Sea Contracting",
      "html": "<div style=\"font-family:Arial,sans-serif;color:#12141c;line-height:1.5;padding:16px;\"><h2 style=\"margin:0 0 12px;font-size:16px;color:#0f2f78;\">Requested product specification sheet — Red Sea Contracting</h2><p style=\"margin:0 0 10px;\">Hello Omar Suppressed,</p><p style=\"margin:0 0 10px;\">Thank you for speaking with our team regarding <strong>Red Sea Contracting</strong>. Please find the latest details summarized below.</p><p style=\"margin:0 0 16px;\">Reply directly to this email if you would like to schedule a follow-up call this week.</p><p style=\"margin:0;color:#5b6072;font-size:12px;\">Best regards,<br/>Mutakamel CRM Team</p></div>",
      "text": "Requested product specification sheet — Red Sea Contracting\n\nHello Omar Suppressed,\n\nThank you for speaking with our team regarding Red Sea Contracting.\nReply directly if you would like to schedule a follow-up call.\n\nBest regards,\nMutakamel CRM Team",
      "contentChecksum": "sha256:0822083808220838082208380822083808220838082208380822083808220838"
    },
    "status": "QUEUED",
    "statusRevision": 1,
    "provider": null,
    "failure": null,
    "feedback": [],
    "timeline": [
      {
        "state": "QUEUED",
        "occurredAt": "2026-11-14T06:00:00.000Z"
      }
    ],
    "requestedAt": "2026-11-14T06:00:00.000Z",
    "sentAt": null,
    "failedAt": null,
    "retryOfId": null,
    "retriedById": null,
    "contentRetentionDays": 730,
    "contentRetentionUntil": "2028-11-13T06:00:00.000Z",
    "contentRetentionPolicyRevision": 1
  },
  "/outbound-emails/eml-005": {
    "outboundEmailId": "eml-005",
    "activityId": "act-005",
    "sourceType": "OPPORTUNITY",
    "sourceId": "0193f2a5-3c27-7a49-8f61-9e4b2c5d7a83",
    "template": {
      "templateDefinitionId": "tpd-ar-2",
      "templateVersionId": "tpl-ar-2",
      "versionNumber": 2,
      "documentType": "CRM_OUTBOUND_EMAIL",
      "outputChannel": "EMAIL",
      "layoutMode": "EMAIL_FLOW",
      "locale": "ar",
      "direction": "RTL",
      "dataSourceKey": "CRM_OPPORTUNITY_OUTBOUND_EMAIL_V1",
      "dataSourceSchemaVersion": 1,
      "dataSourceSchemaChecksum": "sha256:12aebe5a12aebe5a12aebe5a12aebe5a12aebe5a12aebe5a12aebe5a12aebe5a",
      "templateContentChecksum": "sha256:901079b4901079b4901079b4901079b4901079b4901079b4901079b4901079b4",
      "compiledChecksum": "sha256:da355c9cda355c9cda355c9cda355c9cda355c9cda355c9cda355c9cda355c9c",
      "compilerFingerprint": "template-compiler/1",
      "lifecycleStatus": "PUBLISHED"
    },
    "recipient": {
      "displayName": "Youssef Adel",
      "maskedAddress": "y***l@cairocorp.eg",
      "kind": "TO"
    },
    "sender": {
      "displayName": "Mutakamel Sales",
      "maskedAddress": "s***s@mutakamel.ai",
      "maskedReplyTo": null
    },
    "senderConfigRevision": 3,
    "content": {
      "state": "AVAILABLE",
      "subject": "Meeting summary and next milestones — Annual ERP Renewal - Cairo",
      "preheader": "Update regarding Annual ERP Renewal - Cairo",
      "html": "<div style=\"font-family:Arial,sans-serif;color:#12141c;line-height:1.5;padding:16px;\"><h2 style=\"margin:0 0 12px;font-size:16px;color:#0f2f78;\">Meeting summary and next milestones — Annual ERP Renewal - Cairo</h2><p style=\"margin:0 0 10px;\">Hello Youssef Adel,</p><p style=\"margin:0 0 10px;\">Thank you for speaking with our team regarding <strong>Annual ERP Renewal - Cairo</strong>. Please find the latest details summarized below.</p><p style=\"margin:0 0 16px;\">Reply directly to this email if you would like to schedule a follow-up call this week.</p><p style=\"margin:0;color:#5b6072;font-size:12px;\">Best regards,<br/>Mutakamel CRM Team</p></div>",
      "text": "Meeting summary and next milestones — Annual ERP Renewal - Cairo\n\nHello Youssef Adel,\n\nThank you for speaking with our team regarding Annual ERP Renewal - Cairo.\nReply directly if you would like to schedule a follow-up call.\n\nBest regards,\nMutakamel CRM Team",
      "contentChecksum": "sha256:b97f9772b97f9772b97f9772b97f9772b97f9772b97f9772b97f9772b97f9772"
    },
    "status": "DISPATCHING",
    "statusRevision": 2,
    "provider": null,
    "failure": null,
    "feedback": [],
    "timeline": [
      {
        "state": "QUEUED",
        "occurredAt": "2026-11-13T05:00:00.000Z"
      },
      {
        "state": "DISPATCHING",
        "occurredAt": "2026-11-13T05:00:18.000Z"
      }
    ],
    "requestedAt": "2026-11-13T05:00:00.000Z",
    "sentAt": null,
    "failedAt": null,
    "retryOfId": null,
    "retriedById": null,
    "contentRetentionDays": 730,
    "contentRetentionUntil": "2028-11-12T05:00:00.000Z",
    "contentRetentionPolicyRevision": 1
  },
  "/outbound-emails/eml-006": {
    "outboundEmailId": "eml-006",
    "activityId": "act-006",
    "sourceType": "OPPORTUNITY",
    "sourceId": "0193f2a5-4e92-7b8c-9a37-1f6d8e2c4b9e",
    "template": {
      "templateDefinitionId": "tpd-ar-3",
      "templateVersionId": "tpl-ar-3",
      "versionNumber": 1,
      "documentType": "CRM_OUTBOUND_EMAIL",
      "outputChannel": "EMAIL",
      "layoutMode": "EMAIL_FLOW",
      "locale": "ar",
      "direction": "RTL",
      "dataSourceKey": "CRM_OPPORTUNITY_OUTBOUND_EMAIL_V1",
      "dataSourceSchemaVersion": 1,
      "dataSourceSchemaChecksum": "sha256:12aebe5a12aebe5a12aebe5a12aebe5a12aebe5a12aebe5a12aebe5a12aebe5a",
      "templateContentChecksum": "sha256:901079b5901079b5901079b5901079b5901079b5901079b5901079b5901079b5",
      "compiledChecksum": "sha256:da355c9dda355c9dda355c9dda355c9dda355c9dda355c9dda355c9dda355c9d",
      "compilerFingerprint": "template-compiler/1",
      "lifecycleStatus": "PUBLISHED"
    },
    "recipient": {
      "displayName": "Rami Khalil",
      "maskedAddress": "r***l@warehouse-co.com",
      "kind": "TO"
    },
    "sender": {
      "displayName": "Mutakamel Sales",
      "maskedAddress": "s***s@mutakamel.ai",
      "maskedReplyTo": "r***y@mutakamel.ai"
    },
    "senderConfigRevision": 3,
    "content": {
      "state": "AVAILABLE",
      "subject": "Updated implementation timeline — Warehouse Expansion Rollout",
      "preheader": "Update regarding Warehouse Expansion Rollout",
      "html": "<div style=\"font-family:Arial,sans-serif;color:#12141c;line-height:1.5;padding:16px;\"><h2 style=\"margin:0 0 12px;font-size:16px;color:#0f2f78;\">Updated implementation timeline — Warehouse Expansion Rollout</h2><p style=\"margin:0 0 10px;\">Hello Rami Khalil,</p><p style=\"margin:0 0 10px;\">Thank you for speaking with our team regarding <strong>Warehouse Expansion Rollout</strong>. Please find the latest details summarized below.</p><p style=\"margin:0 0 16px;\">Reply directly to this email if you would like to schedule a follow-up call this week.</p><p style=\"margin:0;color:#5b6072;font-size:12px;\">Best regards,<br/>Mutakamel CRM Team</p></div>",
      "text": "Updated implementation timeline — Warehouse Expansion Rollout\n\nHello Rami Khalil,\n\nThank you for speaking with our team regarding Warehouse Expansion Rollout.\nReply directly if you would like to schedule a follow-up call.\n\nBest regards,\nMutakamel CRM Team",
      "contentChecksum": "sha256:e942951ee942951ee942951ee942951ee942951ee942951ee942951ee942951e"
    },
    "status": "FAILED",
    "statusRevision": 3,
    "provider": null,
    "failure": {
      "code": "EMAIL.DELIVERY_FAILED",
      "automaticRetryExhausted": true,
      "failedAt": "2026-11-11T04:00:55.000Z"
    },
    "feedback": [],
    "timeline": [
      {
        "state": "QUEUED",
        "occurredAt": "2026-11-11T04:00:00.000Z"
      },
      {
        "state": "DISPATCHING",
        "occurredAt": "2026-11-11T04:00:14.000Z"
      },
      {
        "state": "FAILED",
        "occurredAt": "2026-11-11T04:00:55.000Z"
      }
    ],
    "requestedAt": "2026-11-11T04:00:00.000Z",
    "sentAt": null,
    "failedAt": "2026-11-11T04:00:55.000Z",
    "retryOfId": null,
    "retriedById": null,
    "contentRetentionDays": 730,
    "contentRetentionUntil": "2028-11-10T04:00:00.000Z",
    "contentRetentionPolicyRevision": 1
  },
  "/outbound-emails/eml-007": {
    "outboundEmailId": "eml-007",
    "activityId": "act-007",
    "sourceType": "LEAD",
    "sourceId": "0193f2a4-6c1e-7b3a-9d42-5e8a1c7f4a11",
    "template": {
      "templateDefinitionId": "tpd-en-1",
      "templateVersionId": "tpl-en-1",
      "versionNumber": 3,
      "documentType": "CRM_OUTBOUND_EMAIL",
      "outputChannel": "EMAIL",
      "layoutMode": "EMAIL_FLOW",
      "locale": "en",
      "direction": "LTR",
      "dataSourceKey": "CRM_LEAD_OUTBOUND_EMAIL_V1",
      "dataSourceSchemaVersion": 1,
      "dataSourceSchemaChecksum": "sha256:c1a91195c1a91195c1a91195c1a91195c1a91195c1a91195c1a91195c1a91195",
      "templateContentChecksum": "sha256:90123c2b90123c2b90123c2b90123c2b90123c2b90123c2b90123c2b90123c2b",
      "compiledChecksum": "sha256:da371f13da371f13da371f13da371f13da371f13da371f13da371f13da371f13",
      "compilerFingerprint": "template-compiler/1",
      "lifecycleStatus": "PUBLISHED"
    },
    "recipient": {
      "displayName": "Karim Mansour",
      "maskedAddress": "k***r@alnoor-trading.eg",
      "kind": "TO"
    },
    "sender": {
      "displayName": "Mutakamel Sales",
      "maskedAddress": "s***s@mutakamel.ai",
      "maskedReplyTo": "r***y@mutakamel.ai"
    },
    "senderConfigRevision": 3,
    "content": {
      "state": "AVAILABLE",
      "subject": "Account onboarding checklist — Al Noor Trading Co.",
      "preheader": "Update regarding Al Noor Trading Co.",
      "html": "<div style=\"font-family:Arial,sans-serif;color:#12141c;line-height:1.5;padding:16px;\"><h2 style=\"margin:0 0 12px;font-size:16px;color:#0f2f78;\">Account onboarding checklist — Al Noor Trading Co.</h2><p style=\"margin:0 0 10px;\">Hello Karim Mansour,</p><p style=\"margin:0 0 10px;\">Thank you for speaking with our team regarding <strong>Al Noor Trading Co.</strong>. Please find the latest details summarized below.</p><p style=\"margin:0 0 16px;\">Reply directly to this email if you would like to schedule a follow-up call this week.</p><p style=\"margin:0;color:#5b6072;font-size:12px;\">Best regards,<br/>Mutakamel CRM Team</p></div>",
      "text": "Account onboarding checklist — Al Noor Trading Co.\n\nHello Karim Mansour,\n\nThank you for speaking with our team regarding Al Noor Trading Co..\nReply directly if you would like to schedule a follow-up call.\n\nBest regards,\nMutakamel CRM Team",
      "contentChecksum": "sha256:1ff7829b1ff7829b1ff7829b1ff7829b1ff7829b1ff7829b1ff7829b1ff7829b"
    },
    "status": "SENT",
    "statusRevision": 3,
    "provider": {
      "kind": "SES",
      "submissionReference": "0100019006a7c4e2f1-eml-007"
    },
    "failure": null,
    "feedback": [],
    "timeline": [
      {
        "state": "QUEUED",
        "occurredAt": "2026-11-10T03:00:00.000Z"
      },
      {
        "state": "DISPATCHING",
        "occurredAt": "2026-11-10T03:00:15.000Z"
      },
      {
        "state": "SENT",
        "occurredAt": "2026-11-10T03:00:42.000Z"
      }
    ],
    "requestedAt": "2026-11-10T03:00:00.000Z",
    "sentAt": "2026-11-10T03:00:42.000Z",
    "failedAt": null,
    "retryOfId": null,
    "retriedById": null,
    "contentRetentionDays": 730,
    "contentRetentionUntil": "2028-11-09T03:00:00.000Z",
    "contentRetentionPolicyRevision": 1
  },
  "/outbound-emails/eml-008": {
    "outboundEmailId": "eml-008",
    "activityId": "act-008",
    "sourceType": "LEAD",
    "sourceId": "0193f2a4-71d0-7c55-8e13-2b9d4f6a8c27",
    "template": {
      "templateDefinitionId": "tpd-en-2",
      "templateVersionId": "tpl-en-2",
      "versionNumber": 2,
      "documentType": "CRM_OUTBOUND_EMAIL",
      "outputChannel": "EMAIL",
      "layoutMode": "EMAIL_FLOW",
      "locale": "en",
      "direction": "LTR",
      "dataSourceKey": "CRM_LEAD_OUTBOUND_EMAIL_V1",
      "dataSourceSchemaVersion": 1,
      "dataSourceSchemaChecksum": "sha256:c1a91195c1a91195c1a91195c1a91195c1a91195c1a91195c1a91195c1a91195",
      "templateContentChecksum": "sha256:90123c2c90123c2c90123c2c90123c2c90123c2c90123c2c90123c2c90123c2c",
      "compiledChecksum": "sha256:da371f14da371f14da371f14da371f14da371f14da371f14da371f14da371f14",
      "compilerFingerprint": "template-compiler/1",
      "lifecycleStatus": "PUBLISHED"
    },
    "recipient": {
      "displayName": "Tarek Hassan",
      "maskedAddress": "t***n@deltalogistics.com",
      "kind": "TO"
    },
    "sender": {
      "displayName": "Mutakamel Sales",
      "maskedAddress": "s***s@mutakamel.ai",
      "maskedReplyTo": "r***y@mutakamel.ai"
    },
    "senderConfigRevision": 3,
    "content": {
      "state": "AVAILABLE",
      "subject": "Quarterly executive review invitation — Delta Logistics",
      "preheader": "Update regarding Delta Logistics",
      "html": "<div style=\"font-family:Arial,sans-serif;color:#12141c;line-height:1.5;padding:16px;\"><h2 style=\"margin:0 0 12px;font-size:16px;color:#0f2f78;\">Quarterly executive review invitation — Delta Logistics</h2><p style=\"margin:0 0 10px;\">Hello Tarek Hassan,</p><p style=\"margin:0 0 10px;\">Thank you for speaking with our team regarding <strong>Delta Logistics</strong>. Please find the latest details summarized below.</p><p style=\"margin:0 0 16px;\">Reply directly to this email if you would like to schedule a follow-up call this week.</p><p style=\"margin:0;color:#5b6072;font-size:12px;\">Best regards,<br/>Mutakamel CRM Team</p></div>",
      "text": "Quarterly executive review invitation — Delta Logistics\n\nHello Tarek Hassan,\n\nThank you for speaking with our team regarding Delta Logistics.\nReply directly if you would like to schedule a follow-up call.\n\nBest regards,\nMutakamel CRM Team",
      "contentChecksum": "sha256:7c0e51097c0e51097c0e51097c0e51097c0e51097c0e51097c0e51097c0e5109"
    },
    "status": "SENT",
    "statusRevision": 4,
    "provider": {
      "kind": "SENDGRID",
      "submissionReference": "0100019007a7c4e2f1-eml-008"
    },
    "failure": null,
    "feedback": [
      {
        "type": "BOUNCE",
        "occurredAt": "2026-11-08T02:03:00.000Z",
        "reasonCode": "HARD_BOUNCE",
        "suppressionApplied": false
      }
    ],
    "timeline": [
      {
        "state": "QUEUED",
        "occurredAt": "2026-11-08T02:00:00.000Z"
      },
      {
        "state": "DISPATCHING",
        "occurredAt": "2026-11-08T02:00:15.000Z"
      },
      {
        "state": "SENT",
        "occurredAt": "2026-11-08T02:00:42.000Z"
      },
      {
        "state": "BOUNCED",
        "occurredAt": "2026-11-08T02:03:00.000Z"
      }
    ],
    "requestedAt": "2026-11-08T02:00:00.000Z",
    "sentAt": "2026-11-08T02:00:42.000Z",
    "failedAt": null,
    "retryOfId": null,
    "retriedById": null,
    "contentRetentionDays": 730,
    "contentRetentionUntil": "2028-11-07T02:00:00.000Z",
    "contentRetentionPolicyRevision": 1
  },
  "/outbound-emails/eml-009": {
    "outboundEmailId": "eml-009",
    "activityId": "act-009",
    "sourceType": "CUSTOMER_PROFILE",
    "sourceId": "0193f2a5-0a3b-7d18-a6f4-7c2e9b1d3e52",
    "template": {
      "templateDefinitionId": "tpd-en-3",
      "templateVersionId": "tpl-en-3",
      "versionNumber": 1,
      "documentType": "CRM_OUTBOUND_EMAIL",
      "outputChannel": "EMAIL",
      "layoutMode": "EMAIL_FLOW",
      "locale": "en",
      "direction": "LTR",
      "dataSourceKey": "CRM_CUSTOMER_OUTBOUND_EMAIL_V1",
      "dataSourceSchemaVersion": 1,
      "dataSourceSchemaChecksum": "sha256:ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1",
      "templateContentChecksum": "sha256:90123c2d90123c2d90123c2d90123c2d90123c2d90123c2d90123c2d90123c2d",
      "compiledChecksum": "sha256:da371f15da371f15da371f15da371f15da371f15da371f15da371f15da371f15",
      "compilerFingerprint": "template-compiler/1",
      "lifecycleStatus": "PUBLISHED"
    },
    "recipient": {
      "displayName": "Salma Ibrahim",
      "maskedAddress": "s***m@niletech.io",
      "kind": "TO"
    },
    "sender": {
      "displayName": "Mutakamel Sales",
      "maskedAddress": "s***s@mutakamel.ai",
      "maskedReplyTo": null
    },
    "senderConfigRevision": 3,
    "content": {
      "state": "AVAILABLE",
      "subject": "Welcome to Mutakamel CRM onboarding — Nile Tech Solutions",
      "preheader": "Update regarding Nile Tech Solutions",
      "html": "<div style=\"font-family:Arial,sans-serif;color:#12141c;line-height:1.5;padding:16px;\"><h2 style=\"margin:0 0 12px;font-size:16px;color:#0f2f78;\">Welcome to Mutakamel CRM onboarding — Nile Tech Solutions</h2><p style=\"margin:0 0 10px;\">Hello Salma Ibrahim,</p><p style=\"margin:0 0 10px;\">Thank you for speaking with our team regarding <strong>Nile Tech Solutions</strong>. Please find the latest details summarized below.</p><p style=\"margin:0 0 16px;\">Reply directly to this email if you would like to schedule a follow-up call this week.</p><p style=\"margin:0;color:#5b6072;font-size:12px;\">Best regards,<br/>Mutakamel CRM Team</p></div>",
      "text": "Welcome to Mutakamel CRM onboarding — Nile Tech Solutions\n\nHello Salma Ibrahim,\n\nThank you for speaking with our team regarding Nile Tech Solutions.\nReply directly if you would like to schedule a follow-up call.\n\nBest regards,\nMutakamel CRM Team",
      "contentChecksum": "sha256:3092f0c53092f0c53092f0c53092f0c53092f0c53092f0c53092f0c53092f0c5"
    },
    "status": "SENT",
    "statusRevision": 3,
    "provider": {
      "kind": "PLATFORM-SHARED",
      "submissionReference": "0100019008a7c4e2f1-eml-009"
    },
    "failure": null,
    "feedback": [],
    "timeline": [
      {
        "state": "QUEUED",
        "occurredAt": "2026-11-07T01:00:00.000Z"
      },
      {
        "state": "DISPATCHING",
        "occurredAt": "2026-11-07T01:00:15.000Z"
      },
      {
        "state": "SENT",
        "occurredAt": "2026-11-07T01:00:42.000Z"
      }
    ],
    "requestedAt": "2026-11-07T01:00:00.000Z",
    "sentAt": "2026-11-07T01:00:42.000Z",
    "failedAt": null,
    "retryOfId": null,
    "retriedById": null,
    "contentRetentionDays": 730,
    "contentRetentionUntil": "2028-11-06T01:00:00.000Z",
    "contentRetentionPolicyRevision": 1
  },
  "/outbound-emails/eml-010": {
    "outboundEmailId": "eml-010",
    "activityId": "act-010",
    "sourceType": "CUSTOMER_PROFILE",
    "sourceId": "0193f2a5-1f84-7e02-b5c9-3d7a6e8f0b6d",
    "template": {
      "templateDefinitionId": "tpd-ar-1",
      "templateVersionId": "tpl-ar-1",
      "versionNumber": 3,
      "documentType": "CRM_OUTBOUND_EMAIL",
      "outputChannel": "EMAIL",
      "layoutMode": "EMAIL_FLOW",
      "locale": "ar",
      "direction": "RTL",
      "dataSourceKey": "CRM_CUSTOMER_OUTBOUND_EMAIL_V1",
      "dataSourceSchemaVersion": 1,
      "dataSourceSchemaChecksum": "sha256:ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1",
      "templateContentChecksum": "sha256:901079b3901079b3901079b3901079b3901079b3901079b3901079b3901079b3",
      "compiledChecksum": "sha256:da355c9bda355c9bda355c9bda355c9bda355c9bda355c9bda355c9bda355c9b",
      "compilerFingerprint": "template-compiler/1",
      "lifecycleStatus": "PUBLISHED"
    },
    "recipient": {
      "displayName": "Omar Suppressed",
      "maskedAddress": "o***r@redseacontracting.com",
      "kind": "TO"
    },
    "sender": {
      "displayName": "Mutakamel Sales",
      "maskedAddress": "s***s@mutakamel.ai",
      "maskedReplyTo": "r***y@mutakamel.ai"
    },
    "senderConfigRevision": 3,
    "content": {
      "state": "AVAILABLE",
      "subject": "Follow-up on Q4 pricing proposal — Red Sea Contracting",
      "preheader": "Update regarding Red Sea Contracting",
      "html": "<div style=\"font-family:Arial,sans-serif;color:#12141c;line-height:1.5;padding:16px;\"><h2 style=\"margin:0 0 12px;font-size:16px;color:#0f2f78;\">Follow-up on Q4 pricing proposal — Red Sea Contracting</h2><p style=\"margin:0 0 10px;\">Hello Omar Suppressed,</p><p style=\"margin:0 0 10px;\">Thank you for speaking with our team regarding <strong>Red Sea Contracting</strong>. Please find the latest details summarized below.</p><p style=\"margin:0 0 16px;\">Reply directly to this email if you would like to schedule a follow-up call this week.</p><p style=\"margin:0;color:#5b6072;font-size:12px;\">Best regards,<br/>Mutakamel CRM Team</p></div>",
      "text": "Follow-up on Q4 pricing proposal — Red Sea Contracting\n\nHello Omar Suppressed,\n\nThank you for speaking with our team regarding Red Sea Contracting.\nReply directly if you would like to schedule a follow-up call.\n\nBest regards,\nMutakamel CRM Team",
      "contentChecksum": "sha256:dce4be0adce4be0adce4be0adce4be0adce4be0adce4be0adce4be0adce4be0a"
    },
    "status": "FAILED",
    "statusRevision": 3,
    "provider": null,
    "failure": {
      "code": "PROVIDER_REJECTED",
      "automaticRetryExhausted": true,
      "failedAt": "2026-11-05T00:00:55.000Z"
    },
    "feedback": [],
    "timeline": [
      {
        "state": "QUEUED",
        "occurredAt": "2026-11-05T00:00:00.000Z"
      },
      {
        "state": "DISPATCHING",
        "occurredAt": "2026-11-05T00:00:14.000Z"
      },
      {
        "state": "FAILED",
        "occurredAt": "2026-11-05T00:00:55.000Z"
      }
    ],
    "requestedAt": "2026-11-05T00:00:00.000Z",
    "sentAt": null,
    "failedAt": "2026-11-05T00:00:55.000Z",
    "retryOfId": null,
    "retriedById": "eml-003",
    "contentRetentionDays": 730,
    "contentRetentionUntil": "2028-11-04T00:00:00.000Z",
    "contentRetentionPolicyRevision": 1
  },
  "/outbound-emails/eml-011": {
    "outboundEmailId": "eml-011",
    "activityId": "act-011",
    "sourceType": "OPPORTUNITY",
    "sourceId": "0193f2a5-3c27-7a49-8f61-9e4b2c5d7a83",
    "template": {
      "templateDefinitionId": "tpd-ar-2",
      "templateVersionId": "tpl-ar-2",
      "versionNumber": 2,
      "documentType": "CRM_OUTBOUND_EMAIL",
      "outputChannel": "EMAIL",
      "layoutMode": "EMAIL_FLOW",
      "locale": "ar",
      "direction": "RTL",
      "dataSourceKey": "CRM_OPPORTUNITY_OUTBOUND_EMAIL_V1",
      "dataSourceSchemaVersion": 1,
      "dataSourceSchemaChecksum": "sha256:12aebe5a12aebe5a12aebe5a12aebe5a12aebe5a12aebe5a12aebe5a12aebe5a",
      "templateContentChecksum": "sha256:901079b4901079b4901079b4901079b4901079b4901079b4901079b4901079b4",
      "compiledChecksum": "sha256:da355c9cda355c9cda355c9cda355c9cda355c9cda355c9cda355c9cda355c9c",
      "compilerFingerprint": "template-compiler/1",
      "lifecycleStatus": "PUBLISHED"
    },
    "recipient": {
      "displayName": "Youssef Adel",
      "maskedAddress": "y***l@cairocorp.eg",
      "kind": "TO"
    },
    "sender": {
      "displayName": "Mutakamel Sales",
      "maskedAddress": "s***s@mutakamel.ai",
      "maskedReplyTo": "r***y@mutakamel.ai"
    },
    "senderConfigRevision": 3,
    "content": {
      "state": "AVAILABLE",
      "subject": "Contract renewal schedule for next quarter — Annual ERP Renewal - Cairo",
      "preheader": "Update regarding Annual ERP Renewal - Cairo",
      "html": "<div style=\"font-family:Arial,sans-serif;color:#12141c;line-height:1.5;padding:16px;\"><h2 style=\"margin:0 0 12px;font-size:16px;color:#0f2f78;\">Contract renewal schedule for next quarter — Annual ERP Renewal - Cairo</h2><p style=\"margin:0 0 10px;\">Hello Youssef Adel,</p><p style=\"margin:0 0 10px;\">Thank you for speaking with our team regarding <strong>Annual ERP Renewal - Cairo</strong>. Please find the latest details summarized below.</p><p style=\"margin:0 0 16px;\">Reply directly to this email if you would like to schedule a follow-up call this week.</p><p style=\"margin:0;color:#5b6072;font-size:12px;\">Best regards,<br/>Mutakamel CRM Team</p></div>",
      "text": "Contract renewal schedule for next quarter — Annual ERP Renewal - Cairo\n\nHello Youssef Adel,\n\nThank you for speaking with our team regarding Annual ERP Renewal - Cairo.\nReply directly if you would like to schedule a follow-up call.\n\nBest regards,\nMutakamel CRM Team",
      "contentChecksum": "sha256:d08e4631d08e4631d08e4631d08e4631d08e4631d08e4631d08e4631d08e4631"
    },
    "status": "SENT",
    "statusRevision": 3,
    "provider": {
      "kind": "SENDGRID",
      "submissionReference": "0100019010a7c4e2f1-eml-011"
    },
    "failure": null,
    "feedback": [],
    "timeline": [
      {
        "state": "QUEUED",
        "occurredAt": "2026-11-03T23:00:00.000Z"
      },
      {
        "state": "DISPATCHING",
        "occurredAt": "2026-11-03T23:00:15.000Z"
      },
      {
        "state": "SENT",
        "occurredAt": "2026-11-03T23:00:42.000Z"
      }
    ],
    "requestedAt": "2026-11-03T23:00:00.000Z",
    "sentAt": "2026-11-03T23:00:42.000Z",
    "failedAt": null,
    "retryOfId": null,
    "retriedById": null,
    "contentRetentionDays": 730,
    "contentRetentionUntil": "2028-11-02T23:00:00.000Z",
    "contentRetentionPolicyRevision": 1
  },
  "/outbound-emails/eml-012": {
    "outboundEmailId": "eml-012",
    "activityId": "act-012",
    "sourceType": "OPPORTUNITY",
    "sourceId": "0193f2a5-4e92-7b8c-9a37-1f6d8e2c4b9e",
    "template": {
      "templateDefinitionId": "tpd-ar-3",
      "templateVersionId": "tpl-ar-3",
      "versionNumber": 1,
      "documentType": "CRM_OUTBOUND_EMAIL",
      "outputChannel": "EMAIL",
      "layoutMode": "EMAIL_FLOW",
      "locale": "ar",
      "direction": "RTL",
      "dataSourceKey": "CRM_OPPORTUNITY_OUTBOUND_EMAIL_V1",
      "dataSourceSchemaVersion": 1,
      "dataSourceSchemaChecksum": "sha256:12aebe5a12aebe5a12aebe5a12aebe5a12aebe5a12aebe5a12aebe5a12aebe5a",
      "templateContentChecksum": "sha256:901079b5901079b5901079b5901079b5901079b5901079b5901079b5901079b5",
      "compiledChecksum": "sha256:da355c9dda355c9dda355c9dda355c9dda355c9dda355c9dda355c9dda355c9d",
      "compilerFingerprint": "template-compiler/1",
      "lifecycleStatus": "PUBLISHED"
    },
    "recipient": {
      "displayName": "Rami Khalil",
      "maskedAddress": "r***l@warehouse-co.com",
      "kind": "TO"
    },
    "sender": {
      "displayName": "Mutakamel Sales",
      "maskedAddress": "s***s@mutakamel.ai",
      "maskedReplyTo": "r***y@mutakamel.ai"
    },
    "senderConfigRevision": 3,
    "content": {
      "state": "AVAILABLE",
      "subject": "Requested product specification sheet — Warehouse Expansion Rollout",
      "preheader": "Update regarding Warehouse Expansion Rollout",
      "html": "<div style=\"font-family:Arial,sans-serif;color:#12141c;line-height:1.5;padding:16px;\"><h2 style=\"margin:0 0 12px;font-size:16px;color:#0f2f78;\">Requested product specification sheet — Warehouse Expansion Rollout</h2><p style=\"margin:0 0 10px;\">Hello Rami Khalil,</p><p style=\"margin:0 0 10px;\">Thank you for speaking with our team regarding <strong>Warehouse Expansion Rollout</strong>. Please find the latest details summarized below.</p><p style=\"margin:0 0 16px;\">Reply directly to this email if you would like to schedule a follow-up call this week.</p><p style=\"margin:0;color:#5b6072;font-size:12px;\">Best regards,<br/>Mutakamel CRM Team</p></div>",
      "text": "Requested product specification sheet — Warehouse Expansion Rollout\n\nHello Rami Khalil,\n\nThank you for speaking with our team regarding Warehouse Expansion Rollout.\nReply directly if you would like to schedule a follow-up call.\n\nBest regards,\nMutakamel CRM Team",
      "contentChecksum": "sha256:fbcfbf33fbcfbf33fbcfbf33fbcfbf33fbcfbf33fbcfbf33fbcfbf33fbcfbf33"
    },
    "status": "SENT",
    "statusRevision": 3,
    "provider": {
      "kind": "PLATFORM-SHARED",
      "submissionReference": "0100019011a7c4e2f1-eml-012"
    },
    "failure": null,
    "feedback": [],
    "timeline": [
      {
        "state": "QUEUED",
        "occurredAt": "2026-11-01T22:00:00.000Z"
      },
      {
        "state": "DISPATCHING",
        "occurredAt": "2026-11-01T22:00:15.000Z"
      },
      {
        "state": "SENT",
        "occurredAt": "2026-11-01T22:00:42.000Z"
      }
    ],
    "requestedAt": "2026-11-01T22:00:00.000Z",
    "sentAt": "2026-11-01T22:00:42.000Z",
    "failedAt": null,
    "retryOfId": null,
    "retriedById": null,
    "contentRetentionDays": 730,
    "contentRetentionUntil": "2028-10-31T22:00:00.000Z",
    "contentRetentionPolicyRevision": 1
  },
  "/outbound-emails/eml-013": {
    "outboundEmailId": "eml-013",
    "activityId": "act-013",
    "sourceType": "LEAD",
    "sourceId": "0193f2a4-6c1e-7b3a-9d42-5e8a1c7f4a11",
    "template": {
      "templateDefinitionId": "tpd-en-1",
      "templateVersionId": "tpl-en-1",
      "versionNumber": 3,
      "documentType": "CRM_OUTBOUND_EMAIL",
      "outputChannel": "EMAIL",
      "layoutMode": "EMAIL_FLOW",
      "locale": "en",
      "direction": "LTR",
      "dataSourceKey": "CRM_LEAD_OUTBOUND_EMAIL_V1",
      "dataSourceSchemaVersion": 1,
      "dataSourceSchemaChecksum": "sha256:c1a91195c1a91195c1a91195c1a91195c1a91195c1a91195c1a91195c1a91195",
      "templateContentChecksum": "sha256:90123c2b90123c2b90123c2b90123c2b90123c2b90123c2b90123c2b90123c2b",
      "compiledChecksum": "sha256:da371f13da371f13da371f13da371f13da371f13da371f13da371f13da371f13",
      "compilerFingerprint": "template-compiler/1",
      "lifecycleStatus": "PUBLISHED"
    },
    "recipient": {
      "displayName": "Karim Mansour",
      "maskedAddress": "k***r@alnoor-trading.eg",
      "kind": "TO"
    },
    "sender": {
      "displayName": "Mutakamel Sales",
      "maskedAddress": "s***s@mutakamel.ai",
      "maskedReplyTo": null
    },
    "senderConfigRevision": 3,
    "content": {
      "state": "AVAILABLE",
      "subject": "Meeting summary and next milestones — Al Noor Trading Co.",
      "preheader": "Update regarding Al Noor Trading Co.",
      "html": "<div style=\"font-family:Arial,sans-serif;color:#12141c;line-height:1.5;padding:16px;\"><h2 style=\"margin:0 0 12px;font-size:16px;color:#0f2f78;\">Meeting summary and next milestones — Al Noor Trading Co.</h2><p style=\"margin:0 0 10px;\">Hello Karim Mansour,</p><p style=\"margin:0 0 10px;\">Thank you for speaking with our team regarding <strong>Al Noor Trading Co.</strong>. Please find the latest details summarized below.</p><p style=\"margin:0 0 16px;\">Reply directly to this email if you would like to schedule a follow-up call this week.</p><p style=\"margin:0;color:#5b6072;font-size:12px;\">Best regards,<br/>Mutakamel CRM Team</p></div>",
      "text": "Meeting summary and next milestones — Al Noor Trading Co.\n\nHello Karim Mansour,\n\nThank you for speaking with our team regarding Al Noor Trading Co..\nReply directly if you would like to schedule a follow-up call.\n\nBest regards,\nMutakamel CRM Team",
      "contentChecksum": "sha256:d65e9c2fd65e9c2fd65e9c2fd65e9c2fd65e9c2fd65e9c2fd65e9c2fd65e9c2f"
    },
    "status": "SENT",
    "statusRevision": 3,
    "provider": {
      "kind": "SES",
      "submissionReference": "0100019012a7c4e2f1-eml-013"
    },
    "failure": null,
    "feedback": [],
    "timeline": [
      {
        "state": "QUEUED",
        "occurredAt": "2026-11-01T09:00:00.000Z"
      },
      {
        "state": "DISPATCHING",
        "occurredAt": "2026-11-01T09:00:15.000Z"
      },
      {
        "state": "SENT",
        "occurredAt": "2026-11-01T09:00:42.000Z"
      }
    ],
    "requestedAt": "2026-11-01T09:00:00.000Z",
    "sentAt": "2026-11-01T09:00:42.000Z",
    "failedAt": null,
    "retryOfId": null,
    "retriedById": null,
    "contentRetentionDays": 730,
    "contentRetentionUntil": "2028-10-31T09:00:00.000Z",
    "contentRetentionPolicyRevision": 1
  },
  "/outbound-emails/eml-014": {
    "outboundEmailId": "eml-014",
    "activityId": "act-014",
    "sourceType": "LEAD",
    "sourceId": "0193f2a4-71d0-7c55-8e13-2b9d4f6a8c27",
    "template": {
      "templateDefinitionId": "tpd-en-2",
      "templateVersionId": "tpl-en-2",
      "versionNumber": 2,
      "documentType": "CRM_OUTBOUND_EMAIL",
      "outputChannel": "EMAIL",
      "layoutMode": "EMAIL_FLOW",
      "locale": "en",
      "direction": "LTR",
      "dataSourceKey": "CRM_LEAD_OUTBOUND_EMAIL_V1",
      "dataSourceSchemaVersion": 1,
      "dataSourceSchemaChecksum": "sha256:c1a91195c1a91195c1a91195c1a91195c1a91195c1a91195c1a91195c1a91195",
      "templateContentChecksum": "sha256:90123c2c90123c2c90123c2c90123c2c90123c2c90123c2c90123c2c90123c2c",
      "compiledChecksum": "sha256:da371f14da371f14da371f14da371f14da371f14da371f14da371f14da371f14",
      "compilerFingerprint": "template-compiler/1",
      "lifecycleStatus": "PUBLISHED"
    },
    "recipient": {
      "displayName": "Tarek Hassan",
      "maskedAddress": "t***n@deltalogistics.com",
      "kind": "TO"
    },
    "sender": {
      "displayName": "Mutakamel Sales",
      "maskedAddress": "s***s@mutakamel.ai",
      "maskedReplyTo": "r***y@mutakamel.ai"
    },
    "senderConfigRevision": 3,
    "content": {
      "state": "AVAILABLE",
      "subject": "Updated implementation timeline — Delta Logistics",
      "preheader": "Update regarding Delta Logistics",
      "html": "<div style=\"font-family:Arial,sans-serif;color:#12141c;line-height:1.5;padding:16px;\"><h2 style=\"margin:0 0 12px;font-size:16px;color:#0f2f78;\">Updated implementation timeline — Delta Logistics</h2><p style=\"margin:0 0 10px;\">Hello Tarek Hassan,</p><p style=\"margin:0 0 10px;\">Thank you for speaking with our team regarding <strong>Delta Logistics</strong>. Please find the latest details summarized below.</p><p style=\"margin:0 0 16px;\">Reply directly to this email if you would like to schedule a follow-up call this week.</p><p style=\"margin:0;color:#5b6072;font-size:12px;\">Best regards,<br/>Mutakamel CRM Team</p></div>",
      "text": "Updated implementation timeline — Delta Logistics\n\nHello Tarek Hassan,\n\nThank you for speaking with our team regarding Delta Logistics.\nReply directly if you would like to schedule a follow-up call.\n\nBest regards,\nMutakamel CRM Team",
      "contentChecksum": "sha256:49f2d24149f2d24149f2d24149f2d24149f2d24149f2d24149f2d24149f2d241"
    },
    "status": "SENT",
    "statusRevision": 3,
    "provider": {
      "kind": "SENDGRID",
      "submissionReference": "0100019013a7c4e2f1-eml-014"
    },
    "failure": null,
    "feedback": [],
    "timeline": [
      {
        "state": "QUEUED",
        "occurredAt": "2026-10-30T08:00:00.000Z"
      },
      {
        "state": "DISPATCHING",
        "occurredAt": "2026-10-30T08:00:15.000Z"
      },
      {
        "state": "SENT",
        "occurredAt": "2026-10-30T08:00:42.000Z"
      }
    ],
    "requestedAt": "2026-10-30T08:00:00.000Z",
    "sentAt": "2026-10-30T08:00:42.000Z",
    "failedAt": null,
    "retryOfId": null,
    "retriedById": null,
    "contentRetentionDays": 730,
    "contentRetentionUntil": "2028-10-29T08:00:00.000Z",
    "contentRetentionPolicyRevision": 1
  },
  "/outbound-emails/eml-015": {
    "outboundEmailId": "eml-015",
    "activityId": "act-015",
    "sourceType": "CUSTOMER_PROFILE",
    "sourceId": "0193f2a5-0a3b-7d18-a6f4-7c2e9b1d3e52",
    "template": {
      "templateDefinitionId": "tpd-en-3",
      "templateVersionId": "tpl-en-3",
      "versionNumber": 1,
      "documentType": "CRM_OUTBOUND_EMAIL",
      "outputChannel": "EMAIL",
      "layoutMode": "EMAIL_FLOW",
      "locale": "en",
      "direction": "LTR",
      "dataSourceKey": "CRM_CUSTOMER_OUTBOUND_EMAIL_V1",
      "dataSourceSchemaVersion": 1,
      "dataSourceSchemaChecksum": "sha256:ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1",
      "templateContentChecksum": "sha256:90123c2d90123c2d90123c2d90123c2d90123c2d90123c2d90123c2d90123c2d",
      "compiledChecksum": "sha256:da371f15da371f15da371f15da371f15da371f15da371f15da371f15da371f15",
      "compilerFingerprint": "template-compiler/1",
      "lifecycleStatus": "PUBLISHED"
    },
    "recipient": {
      "displayName": "Salma Ibrahim",
      "maskedAddress": "s***m@niletech.io",
      "kind": "TO"
    },
    "sender": {
      "displayName": "Mutakamel Sales",
      "maskedAddress": "s***s@mutakamel.ai",
      "maskedReplyTo": "r***y@mutakamel.ai"
    },
    "senderConfigRevision": 3,
    "content": {
      "state": "AVAILABLE",
      "subject": "Account onboarding checklist — Nile Tech Solutions",
      "preheader": "Update regarding Nile Tech Solutions",
      "html": "<div style=\"font-family:Arial,sans-serif;color:#12141c;line-height:1.5;padding:16px;\"><h2 style=\"margin:0 0 12px;font-size:16px;color:#0f2f78;\">Account onboarding checklist — Nile Tech Solutions</h2><p style=\"margin:0 0 10px;\">Hello Salma Ibrahim,</p><p style=\"margin:0 0 10px;\">Thank you for speaking with our team regarding <strong>Nile Tech Solutions</strong>. Please find the latest details summarized below.</p><p style=\"margin:0 0 16px;\">Reply directly to this email if you would like to schedule a follow-up call this week.</p><p style=\"margin:0;color:#5b6072;font-size:12px;\">Best regards,<br/>Mutakamel CRM Team</p></div>",
      "text": "Account onboarding checklist — Nile Tech Solutions\n\nHello Salma Ibrahim,\n\nThank you for speaking with our team regarding Nile Tech Solutions.\nReply directly if you would like to schedule a follow-up call.\n\nBest regards,\nMutakamel CRM Team",
      "contentChecksum": "sha256:45f985be45f985be45f985be45f985be45f985be45f985be45f985be45f985be"
    },
    "status": "FAILED",
    "statusRevision": 3,
    "provider": null,
    "failure": {
      "code": "MAILBOX_FULL",
      "automaticRetryExhausted": true,
      "failedAt": "2026-10-29T07:00:55.000Z"
    },
    "feedback": [],
    "timeline": [
      {
        "state": "QUEUED",
        "occurredAt": "2026-10-29T07:00:00.000Z"
      },
      {
        "state": "DISPATCHING",
        "occurredAt": "2026-10-29T07:00:14.000Z"
      },
      {
        "state": "FAILED",
        "occurredAt": "2026-10-29T07:00:55.000Z"
      }
    ],
    "requestedAt": "2026-10-29T07:00:00.000Z",
    "sentAt": null,
    "failedAt": "2026-10-29T07:00:55.000Z",
    "retryOfId": null,
    "retriedById": null,
    "contentRetentionDays": 730,
    "contentRetentionUntil": "2028-10-28T07:00:00.000Z",
    "contentRetentionPolicyRevision": 1
  },
  "/outbound-emails/eml-016": {
    "outboundEmailId": "eml-016",
    "activityId": "act-016",
    "sourceType": "CUSTOMER_PROFILE",
    "sourceId": "0193f2a5-1f84-7e02-b5c9-3d7a6e8f0b6d",
    "template": {
      "templateDefinitionId": "tpd-ar-1",
      "templateVersionId": "tpl-ar-1",
      "versionNumber": 3,
      "documentType": "CRM_OUTBOUND_EMAIL",
      "outputChannel": "EMAIL",
      "layoutMode": "EMAIL_FLOW",
      "locale": "ar",
      "direction": "RTL",
      "dataSourceKey": "CRM_CUSTOMER_OUTBOUND_EMAIL_V1",
      "dataSourceSchemaVersion": 1,
      "dataSourceSchemaChecksum": "sha256:ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1",
      "templateContentChecksum": "sha256:901079b3901079b3901079b3901079b3901079b3901079b3901079b3901079b3",
      "compiledChecksum": "sha256:da355c9bda355c9bda355c9bda355c9bda355c9bda355c9bda355c9bda355c9b",
      "compilerFingerprint": "template-compiler/1",
      "lifecycleStatus": "PUBLISHED"
    },
    "recipient": {
      "displayName": "Omar Suppressed",
      "maskedAddress": "o***r@redseacontracting.com",
      "kind": "TO"
    },
    "sender": {
      "displayName": "Mutakamel Sales",
      "maskedAddress": "s***s@mutakamel.ai",
      "maskedReplyTo": "r***y@mutakamel.ai"
    },
    "senderConfigRevision": 3,
    "content": {
      "state": "AVAILABLE",
      "subject": "Quarterly executive review invitation — Red Sea Contracting",
      "preheader": "Update regarding Red Sea Contracting",
      "html": "<div style=\"font-family:Arial,sans-serif;color:#12141c;line-height:1.5;padding:16px;\"><h2 style=\"margin:0 0 12px;font-size:16px;color:#0f2f78;\">Quarterly executive review invitation — Red Sea Contracting</h2><p style=\"margin:0 0 10px;\">Hello Omar Suppressed,</p><p style=\"margin:0 0 10px;\">Thank you for speaking with our team regarding <strong>Red Sea Contracting</strong>. Please find the latest details summarized below.</p><p style=\"margin:0 0 16px;\">Reply directly to this email if you would like to schedule a follow-up call this week.</p><p style=\"margin:0;color:#5b6072;font-size:12px;\">Best regards,<br/>Mutakamel CRM Team</p></div>",
      "text": "Quarterly executive review invitation — Red Sea Contracting\n\nHello Omar Suppressed,\n\nThank you for speaking with our team regarding Red Sea Contracting.\nReply directly if you would like to schedule a follow-up call.\n\nBest regards,\nMutakamel CRM Team",
      "contentChecksum": "sha256:dd411adbdd411adbdd411adbdd411adbdd411adbdd411adbdd411adbdd411adb"
    },
    "status": "SENT",
    "statusRevision": 3,
    "provider": {
      "kind": "SES",
      "submissionReference": "0100019015a7c4e2f1-eml-016"
    },
    "failure": null,
    "feedback": [],
    "timeline": [
      {
        "state": "QUEUED",
        "occurredAt": "2026-10-27T06:00:00.000Z"
      },
      {
        "state": "DISPATCHING",
        "occurredAt": "2026-10-27T06:00:15.000Z"
      },
      {
        "state": "SENT",
        "occurredAt": "2026-10-27T06:00:42.000Z"
      }
    ],
    "requestedAt": "2026-10-27T06:00:00.000Z",
    "sentAt": "2026-10-27T06:00:42.000Z",
    "failedAt": null,
    "retryOfId": null,
    "retriedById": null,
    "contentRetentionDays": 730,
    "contentRetentionUntil": "2028-10-26T06:00:00.000Z",
    "contentRetentionPolicyRevision": 1
  },
  "/outbound-emails/eml-017": {
    "outboundEmailId": "eml-017",
    "activityId": "act-017",
    "sourceType": "OPPORTUNITY",
    "sourceId": "0193f2a5-3c27-7a49-8f61-9e4b2c5d7a83",
    "template": {
      "templateDefinitionId": "tpd-ar-2",
      "templateVersionId": "tpl-ar-2",
      "versionNumber": 2,
      "documentType": "CRM_OUTBOUND_EMAIL",
      "outputChannel": "EMAIL",
      "layoutMode": "EMAIL_FLOW",
      "locale": "ar",
      "direction": "RTL",
      "dataSourceKey": "CRM_OPPORTUNITY_OUTBOUND_EMAIL_V1",
      "dataSourceSchemaVersion": 1,
      "dataSourceSchemaChecksum": "sha256:12aebe5a12aebe5a12aebe5a12aebe5a12aebe5a12aebe5a12aebe5a12aebe5a",
      "templateContentChecksum": "sha256:901079b4901079b4901079b4901079b4901079b4901079b4901079b4901079b4",
      "compiledChecksum": "sha256:da355c9cda355c9cda355c9cda355c9cda355c9cda355c9cda355c9cda355c9c",
      "compilerFingerprint": "template-compiler/1",
      "lifecycleStatus": "PUBLISHED"
    },
    "recipient": {
      "displayName": "Youssef Adel",
      "maskedAddress": "y***l@cairocorp.eg",
      "kind": "TO"
    },
    "sender": {
      "displayName": "Mutakamel Sales",
      "maskedAddress": "s***s@mutakamel.ai",
      "maskedReplyTo": null
    },
    "senderConfigRevision": 3,
    "content": {
      "state": "AVAILABLE",
      "subject": "Welcome to Mutakamel CRM onboarding — Annual ERP Renewal - Cairo",
      "preheader": "Update regarding Annual ERP Renewal - Cairo",
      "html": "<div style=\"font-family:Arial,sans-serif;color:#12141c;line-height:1.5;padding:16px;\"><h2 style=\"margin:0 0 12px;font-size:16px;color:#0f2f78;\">Welcome to Mutakamel CRM onboarding — Annual ERP Renewal - Cairo</h2><p style=\"margin:0 0 10px;\">Hello Youssef Adel,</p><p style=\"margin:0 0 10px;\">Thank you for speaking with our team regarding <strong>Annual ERP Renewal - Cairo</strong>. Please find the latest details summarized below.</p><p style=\"margin:0 0 16px;\">Reply directly to this email if you would like to schedule a follow-up call this week.</p><p style=\"margin:0;color:#5b6072;font-size:12px;\">Best regards,<br/>Mutakamel CRM Team</p></div>",
      "text": "Welcome to Mutakamel CRM onboarding — Annual ERP Renewal - Cairo\n\nHello Youssef Adel,\n\nThank you for speaking with our team regarding Annual ERP Renewal - Cairo.\nReply directly if you would like to schedule a follow-up call.\n\nBest regards,\nMutakamel CRM Team",
      "contentChecksum": "sha256:09fa78df09fa78df09fa78df09fa78df09fa78df09fa78df09fa78df09fa78df"
    },
    "status": "SENT",
    "statusRevision": 3,
    "provider": {
      "kind": "SENDGRID",
      "submissionReference": "0100019016a7c4e2f1-eml-017"
    },
    "failure": null,
    "feedback": [],
    "timeline": [
      {
        "state": "QUEUED",
        "occurredAt": "2026-10-26T05:00:00.000Z"
      },
      {
        "state": "DISPATCHING",
        "occurredAt": "2026-10-26T05:00:15.000Z"
      },
      {
        "state": "SENT",
        "occurredAt": "2026-10-26T05:00:42.000Z"
      }
    ],
    "requestedAt": "2026-10-26T05:00:00.000Z",
    "sentAt": "2026-10-26T05:00:42.000Z",
    "failedAt": null,
    "retryOfId": null,
    "retriedById": null,
    "contentRetentionDays": 730,
    "contentRetentionUntil": "2028-10-25T05:00:00.000Z",
    "contentRetentionPolicyRevision": 1
  },
  "/outbound-emails/eml-018": {
    "outboundEmailId": "eml-018",
    "activityId": "act-018",
    "sourceType": "OPPORTUNITY",
    "sourceId": "0193f2a5-4e92-7b8c-9a37-1f6d8e2c4b9e",
    "template": {
      "templateDefinitionId": "tpd-ar-3",
      "templateVersionId": "tpl-ar-3",
      "versionNumber": 1,
      "documentType": "CRM_OUTBOUND_EMAIL",
      "outputChannel": "EMAIL",
      "layoutMode": "EMAIL_FLOW",
      "locale": "ar",
      "direction": "RTL",
      "dataSourceKey": "CRM_OPPORTUNITY_OUTBOUND_EMAIL_V1",
      "dataSourceSchemaVersion": 1,
      "dataSourceSchemaChecksum": "sha256:12aebe5a12aebe5a12aebe5a12aebe5a12aebe5a12aebe5a12aebe5a12aebe5a",
      "templateContentChecksum": "sha256:901079b5901079b5901079b5901079b5901079b5901079b5901079b5901079b5",
      "compiledChecksum": "sha256:da355c9dda355c9dda355c9dda355c9dda355c9dda355c9dda355c9dda355c9d",
      "compilerFingerprint": "template-compiler/1",
      "lifecycleStatus": "PUBLISHED"
    },
    "recipient": {
      "displayName": "Rami Khalil",
      "maskedAddress": "r***l@warehouse-co.com",
      "kind": "TO"
    },
    "sender": {
      "displayName": "Mutakamel Sales",
      "maskedAddress": "s***s@mutakamel.ai",
      "maskedReplyTo": "r***y@mutakamel.ai"
    },
    "senderConfigRevision": 3,
    "content": {
      "state": "AVAILABLE",
      "subject": "Follow-up on Q4 pricing proposal — Warehouse Expansion Rollout",
      "preheader": "Update regarding Warehouse Expansion Rollout",
      "html": "<div style=\"font-family:Arial,sans-serif;color:#12141c;line-height:1.5;padding:16px;\"><h2 style=\"margin:0 0 12px;font-size:16px;color:#0f2f78;\">Follow-up on Q4 pricing proposal — Warehouse Expansion Rollout</h2><p style=\"margin:0 0 10px;\">Hello Rami Khalil,</p><p style=\"margin:0 0 10px;\">Thank you for speaking with our team regarding <strong>Warehouse Expansion Rollout</strong>. Please find the latest details summarized below.</p><p style=\"margin:0 0 16px;\">Reply directly to this email if you would like to schedule a follow-up call this week.</p><p style=\"margin:0;color:#5b6072;font-size:12px;\">Best regards,<br/>Mutakamel CRM Team</p></div>",
      "text": "Follow-up on Q4 pricing proposal — Warehouse Expansion Rollout\n\nHello Rami Khalil,\n\nThank you for speaking with our team regarding Warehouse Expansion Rollout.\nReply directly if you would like to schedule a follow-up call.\n\nBest regards,\nMutakamel CRM Team",
      "contentChecksum": "sha256:08a64a0508a64a0508a64a0508a64a0508a64a0508a64a0508a64a0508a64a05"
    },
    "status": "SENT",
    "statusRevision": 3,
    "provider": {
      "kind": "PLATFORM-SHARED",
      "submissionReference": "0100019017a7c4e2f1-eml-018"
    },
    "failure": null,
    "feedback": [],
    "timeline": [
      {
        "state": "QUEUED",
        "occurredAt": "2026-10-24T04:00:00.000Z"
      },
      {
        "state": "DISPATCHING",
        "occurredAt": "2026-10-24T04:00:15.000Z"
      },
      {
        "state": "SENT",
        "occurredAt": "2026-10-24T04:00:42.000Z"
      }
    ],
    "requestedAt": "2026-10-24T04:00:00.000Z",
    "sentAt": "2026-10-24T04:00:42.000Z",
    "failedAt": null,
    "retryOfId": null,
    "retriedById": null,
    "contentRetentionDays": 730,
    "contentRetentionUntil": "2028-10-23T04:00:00.000Z",
    "contentRetentionPolicyRevision": 1
  },
  "/outbound-emails/eml-019": {
    "outboundEmailId": "eml-019",
    "activityId": "act-019",
    "sourceType": "LEAD",
    "sourceId": "0193f2a4-6c1e-7b3a-9d42-5e8a1c7f4a11",
    "template": {
      "templateDefinitionId": "tpd-en-1",
      "templateVersionId": "tpl-en-1",
      "versionNumber": 3,
      "documentType": "CRM_OUTBOUND_EMAIL",
      "outputChannel": "EMAIL",
      "layoutMode": "EMAIL_FLOW",
      "locale": "en",
      "direction": "LTR",
      "dataSourceKey": "CRM_LEAD_OUTBOUND_EMAIL_V1",
      "dataSourceSchemaVersion": 1,
      "dataSourceSchemaChecksum": "sha256:c1a91195c1a91195c1a91195c1a91195c1a91195c1a91195c1a91195c1a91195",
      "templateContentChecksum": "sha256:90123c2b90123c2b90123c2b90123c2b90123c2b90123c2b90123c2b90123c2b",
      "compiledChecksum": "sha256:da371f13da371f13da371f13da371f13da371f13da371f13da371f13da371f13",
      "compilerFingerprint": "template-compiler/1",
      "lifecycleStatus": "PUBLISHED"
    },
    "recipient": {
      "displayName": "Karim Mansour",
      "maskedAddress": "k***r@alnoor-trading.eg",
      "kind": "TO"
    },
    "sender": {
      "displayName": "Mutakamel Sales",
      "maskedAddress": "s***s@mutakamel.ai",
      "maskedReplyTo": "r***y@mutakamel.ai"
    },
    "senderConfigRevision": 3,
    "content": {
      "state": "AVAILABLE",
      "subject": "Contract renewal schedule for next quarter — Al Noor Trading Co.",
      "preheader": "Update regarding Al Noor Trading Co.",
      "html": "<div style=\"font-family:Arial,sans-serif;color:#12141c;line-height:1.5;padding:16px;\"><h2 style=\"margin:0 0 12px;font-size:16px;color:#0f2f78;\">Contract renewal schedule for next quarter — Al Noor Trading Co.</h2><p style=\"margin:0 0 10px;\">Hello Karim Mansour,</p><p style=\"margin:0 0 10px;\">Thank you for speaking with our team regarding <strong>Al Noor Trading Co.</strong>. Please find the latest details summarized below.</p><p style=\"margin:0 0 16px;\">Reply directly to this email if you would like to schedule a follow-up call this week.</p><p style=\"margin:0;color:#5b6072;font-size:12px;\">Best regards,<br/>Mutakamel CRM Team</p></div>",
      "text": "Contract renewal schedule for next quarter — Al Noor Trading Co.\n\nHello Karim Mansour,\n\nThank you for speaking with our team regarding Al Noor Trading Co..\nReply directly if you would like to schedule a follow-up call.\n\nBest regards,\nMutakamel CRM Team",
      "contentChecksum": "sha256:15ffe31015ffe31015ffe31015ffe31015ffe31015ffe31015ffe31015ffe310"
    },
    "status": "SENT",
    "statusRevision": 4,
    "provider": {
      "kind": "SES",
      "submissionReference": "0100019018a7c4e2f1-eml-019"
    },
    "failure": null,
    "feedback": [
      {
        "type": "BOUNCE",
        "occurredAt": "2026-10-23T03:03:00.000Z",
        "reasonCode": "SOFT_BOUNCE",
        "suppressionApplied": false
      }
    ],
    "timeline": [
      {
        "state": "QUEUED",
        "occurredAt": "2026-10-23T03:00:00.000Z"
      },
      {
        "state": "DISPATCHING",
        "occurredAt": "2026-10-23T03:00:15.000Z"
      },
      {
        "state": "SENT",
        "occurredAt": "2026-10-23T03:00:42.000Z"
      },
      {
        "state": "BOUNCED",
        "occurredAt": "2026-10-23T03:03:00.000Z"
      }
    ],
    "requestedAt": "2026-10-23T03:00:00.000Z",
    "sentAt": "2026-10-23T03:00:42.000Z",
    "failedAt": null,
    "retryOfId": null,
    "retriedById": null,
    "contentRetentionDays": 730,
    "contentRetentionUntil": "2028-10-22T03:00:00.000Z",
    "contentRetentionPolicyRevision": 1
  },
  "/outbound-emails/eml-020": {
    "outboundEmailId": "eml-020",
    "activityId": "act-020",
    "sourceType": "LEAD",
    "sourceId": "0193f2a4-71d0-7c55-8e13-2b9d4f6a8c27",
    "template": {
      "templateDefinitionId": "tpd-en-2",
      "templateVersionId": "tpl-en-2",
      "versionNumber": 2,
      "documentType": "CRM_OUTBOUND_EMAIL",
      "outputChannel": "EMAIL",
      "layoutMode": "EMAIL_FLOW",
      "locale": "en",
      "direction": "LTR",
      "dataSourceKey": "CRM_LEAD_OUTBOUND_EMAIL_V1",
      "dataSourceSchemaVersion": 1,
      "dataSourceSchemaChecksum": "sha256:c1a91195c1a91195c1a91195c1a91195c1a91195c1a91195c1a91195c1a91195",
      "templateContentChecksum": "sha256:90123c2c90123c2c90123c2c90123c2c90123c2c90123c2c90123c2c90123c2c",
      "compiledChecksum": "sha256:da371f14da371f14da371f14da371f14da371f14da371f14da371f14da371f14",
      "compilerFingerprint": "template-compiler/1",
      "lifecycleStatus": "PUBLISHED"
    },
    "recipient": {
      "displayName": "Tarek Hassan",
      "maskedAddress": "t***n@deltalogistics.com",
      "kind": "TO"
    },
    "sender": {
      "displayName": "Mutakamel Sales",
      "maskedAddress": "s***s@mutakamel.ai",
      "maskedReplyTo": "r***y@mutakamel.ai"
    },
    "senderConfigRevision": 3,
    "content": {
      "state": "AVAILABLE",
      "subject": "Requested product specification sheet — Delta Logistics",
      "preheader": "Update regarding Delta Logistics",
      "html": "<div style=\"font-family:Arial,sans-serif;color:#12141c;line-height:1.5;padding:16px;\"><h2 style=\"margin:0 0 12px;font-size:16px;color:#0f2f78;\">Requested product specification sheet — Delta Logistics</h2><p style=\"margin:0 0 10px;\">Hello Tarek Hassan,</p><p style=\"margin:0 0 10px;\">Thank you for speaking with our team regarding <strong>Delta Logistics</strong>. Please find the latest details summarized below.</p><p style=\"margin:0 0 16px;\">Reply directly to this email if you would like to schedule a follow-up call this week.</p><p style=\"margin:0;color:#5b6072;font-size:12px;\">Best regards,<br/>Mutakamel CRM Team</p></div>",
      "text": "Requested product specification sheet — Delta Logistics\n\nHello Tarek Hassan,\n\nThank you for speaking with our team regarding Delta Logistics.\nReply directly if you would like to schedule a follow-up call.\n\nBest regards,\nMutakamel CRM Team",
      "contentChecksum": "sha256:e7dc1bcce7dc1bcce7dc1bcce7dc1bcce7dc1bcce7dc1bcce7dc1bcce7dc1bcc"
    },
    "status": "SENT",
    "statusRevision": 3,
    "provider": {
      "kind": "SENDGRID",
      "submissionReference": "0100019019a7c4e2f1-eml-020"
    },
    "failure": null,
    "feedback": [],
    "timeline": [
      {
        "state": "QUEUED",
        "occurredAt": "2026-10-21T02:00:00.000Z"
      },
      {
        "state": "DISPATCHING",
        "occurredAt": "2026-10-21T02:00:15.000Z"
      },
      {
        "state": "SENT",
        "occurredAt": "2026-10-21T02:00:42.000Z"
      }
    ],
    "requestedAt": "2026-10-21T02:00:00.000Z",
    "sentAt": "2026-10-21T02:00:42.000Z",
    "failedAt": null,
    "retryOfId": null,
    "retriedById": null,
    "contentRetentionDays": 730,
    "contentRetentionUntil": "2028-10-20T02:00:00.000Z",
    "contentRetentionPolicyRevision": 1
  },
  "/outbound-emails/eml-021": {
    "outboundEmailId": "eml-021",
    "activityId": "act-021",
    "sourceType": "CUSTOMER_PROFILE",
    "sourceId": "0193f2a5-0a3b-7d18-a6f4-7c2e9b1d3e52",
    "template": {
      "templateDefinitionId": "tpd-en-3",
      "templateVersionId": "tpl-en-3",
      "versionNumber": 1,
      "documentType": "CRM_OUTBOUND_EMAIL",
      "outputChannel": "EMAIL",
      "layoutMode": "EMAIL_FLOW",
      "locale": "en",
      "direction": "LTR",
      "dataSourceKey": "CRM_CUSTOMER_OUTBOUND_EMAIL_V1",
      "dataSourceSchemaVersion": 1,
      "dataSourceSchemaChecksum": "sha256:ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1",
      "templateContentChecksum": "sha256:90123c2d90123c2d90123c2d90123c2d90123c2d90123c2d90123c2d90123c2d",
      "compiledChecksum": "sha256:da371f15da371f15da371f15da371f15da371f15da371f15da371f15da371f15",
      "compilerFingerprint": "template-compiler/1",
      "lifecycleStatus": "PUBLISHED"
    },
    "recipient": {
      "displayName": "Salma Ibrahim",
      "maskedAddress": "s***m@niletech.io",
      "kind": "TO"
    },
    "sender": {
      "displayName": "Mutakamel Sales",
      "maskedAddress": "s***s@mutakamel.ai",
      "maskedReplyTo": null
    },
    "senderConfigRevision": 3,
    "content": {
      "state": "AVAILABLE",
      "subject": "Meeting summary and next milestones — Nile Tech Solutions",
      "preheader": "Update regarding Nile Tech Solutions",
      "html": "<div style=\"font-family:Arial,sans-serif;color:#12141c;line-height:1.5;padding:16px;\"><h2 style=\"margin:0 0 12px;font-size:16px;color:#0f2f78;\">Meeting summary and next milestones — Nile Tech Solutions</h2><p style=\"margin:0 0 10px;\">Hello Salma Ibrahim,</p><p style=\"margin:0 0 10px;\">Thank you for speaking with our team regarding <strong>Nile Tech Solutions</strong>. Please find the latest details summarized below.</p><p style=\"margin:0 0 16px;\">Reply directly to this email if you would like to schedule a follow-up call this week.</p><p style=\"margin:0;color:#5b6072;font-size:12px;\">Best regards,<br/>Mutakamel CRM Team</p></div>",
      "text": "Meeting summary and next milestones — Nile Tech Solutions\n\nHello Salma Ibrahim,\n\nThank you for speaking with our team regarding Nile Tech Solutions.\nReply directly if you would like to schedule a follow-up call.\n\nBest regards,\nMutakamel CRM Team",
      "contentChecksum": "sha256:fc609f52fc609f52fc609f52fc609f52fc609f52fc609f52fc609f52fc609f52"
    },
    "status": "FAILED",
    "statusRevision": 3,
    "provider": null,
    "failure": {
      "code": "DOMAIN_LOOKUP_FAILED",
      "automaticRetryExhausted": true,
      "failedAt": "2026-10-20T01:00:55.000Z"
    },
    "feedback": [],
    "timeline": [
      {
        "state": "QUEUED",
        "occurredAt": "2026-10-20T01:00:00.000Z"
      },
      {
        "state": "DISPATCHING",
        "occurredAt": "2026-10-20T01:00:14.000Z"
      },
      {
        "state": "FAILED",
        "occurredAt": "2026-10-20T01:00:55.000Z"
      }
    ],
    "requestedAt": "2026-10-20T01:00:00.000Z",
    "sentAt": null,
    "failedAt": "2026-10-20T01:00:55.000Z",
    "retryOfId": null,
    "retriedById": null,
    "contentRetentionDays": 730,
    "contentRetentionUntil": "2028-10-19T01:00:00.000Z",
    "contentRetentionPolicyRevision": 1
  },
  "/outbound-emails/eml-022": {
    "outboundEmailId": "eml-022",
    "activityId": "act-022",
    "sourceType": "CUSTOMER_PROFILE",
    "sourceId": "0193f2a5-1f84-7e02-b5c9-3d7a6e8f0b6d",
    "template": {
      "templateDefinitionId": "tpd-ar-1",
      "templateVersionId": "tpl-ar-1",
      "versionNumber": 3,
      "documentType": "CRM_OUTBOUND_EMAIL",
      "outputChannel": "EMAIL",
      "layoutMode": "EMAIL_FLOW",
      "locale": "ar",
      "direction": "RTL",
      "dataSourceKey": "CRM_CUSTOMER_OUTBOUND_EMAIL_V1",
      "dataSourceSchemaVersion": 1,
      "dataSourceSchemaChecksum": "sha256:ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1",
      "templateContentChecksum": "sha256:901079b3901079b3901079b3901079b3901079b3901079b3901079b3901079b3",
      "compiledChecksum": "sha256:da355c9bda355c9bda355c9bda355c9bda355c9bda355c9bda355c9bda355c9b",
      "compilerFingerprint": "template-compiler/1",
      "lifecycleStatus": "PUBLISHED"
    },
    "recipient": {
      "displayName": "Omar Suppressed",
      "maskedAddress": "o***r@redseacontracting.com",
      "kind": "TO"
    },
    "sender": {
      "displayName": "Mutakamel Sales",
      "maskedAddress": "s***s@mutakamel.ai",
      "maskedReplyTo": "r***y@mutakamel.ai"
    },
    "senderConfigRevision": 3,
    "content": {
      "state": "AVAILABLE",
      "subject": "Updated implementation timeline — Red Sea Contracting",
      "preheader": "Update regarding Red Sea Contracting",
      "html": "<div style=\"font-family:Arial,sans-serif;color:#12141c;line-height:1.5;padding:16px;\"><h2 style=\"margin:0 0 12px;font-size:16px;color:#0f2f78;\">Updated implementation timeline — Red Sea Contracting</h2><p style=\"margin:0 0 10px;\">Hello Omar Suppressed,</p><p style=\"margin:0 0 10px;\">Thank you for speaking with our team regarding <strong>Red Sea Contracting</strong>. Please find the latest details summarized below.</p><p style=\"margin:0 0 16px;\">Reply directly to this email if you would like to schedule a follow-up call this week.</p><p style=\"margin:0;color:#5b6072;font-size:12px;\">Best regards,<br/>Mutakamel CRM Team</p></div>",
      "text": "Updated implementation timeline — Red Sea Contracting\n\nHello Omar Suppressed,\n\nThank you for speaking with our team regarding Red Sea Contracting.\nReply directly if you would like to schedule a follow-up call.\n\nBest regards,\nMutakamel CRM Team",
      "contentChecksum": "sha256:6c0e26a36c0e26a36c0e26a36c0e26a36c0e26a36c0e26a36c0e26a36c0e26a3"
    },
    "status": "SENT",
    "statusRevision": 3,
    "provider": {
      "kind": "SES",
      "submissionReference": "0100019021a7c4e2f1-eml-022"
    },
    "failure": null,
    "feedback": [],
    "timeline": [
      {
        "state": "QUEUED",
        "occurredAt": "2026-10-18T00:00:00.000Z"
      },
      {
        "state": "DISPATCHING",
        "occurredAt": "2026-10-18T00:00:15.000Z"
      },
      {
        "state": "SENT",
        "occurredAt": "2026-10-18T00:00:42.000Z"
      }
    ],
    "requestedAt": "2026-10-18T00:00:00.000Z",
    "sentAt": "2026-10-18T00:00:42.000Z",
    "failedAt": null,
    "retryOfId": null,
    "retriedById": null,
    "contentRetentionDays": 730,
    "contentRetentionUntil": "2028-10-17T00:00:00.000Z",
    "contentRetentionPolicyRevision": 1
  },
  "/outbound-emails/eml-023": {
    "outboundEmailId": "eml-023",
    "activityId": "act-023",
    "sourceType": "OPPORTUNITY",
    "sourceId": "0193f2a5-3c27-7a49-8f61-9e4b2c5d7a83",
    "template": {
      "templateDefinitionId": "tpd-ar-2",
      "templateVersionId": "tpl-ar-2",
      "versionNumber": 2,
      "documentType": "CRM_OUTBOUND_EMAIL",
      "outputChannel": "EMAIL",
      "layoutMode": "EMAIL_FLOW",
      "locale": "ar",
      "direction": "RTL",
      "dataSourceKey": "CRM_OPPORTUNITY_OUTBOUND_EMAIL_V1",
      "dataSourceSchemaVersion": 1,
      "dataSourceSchemaChecksum": "sha256:12aebe5a12aebe5a12aebe5a12aebe5a12aebe5a12aebe5a12aebe5a12aebe5a",
      "templateContentChecksum": "sha256:901079b4901079b4901079b4901079b4901079b4901079b4901079b4901079b4",
      "compiledChecksum": "sha256:da355c9cda355c9cda355c9cda355c9cda355c9cda355c9cda355c9cda355c9c",
      "compilerFingerprint": "template-compiler/1",
      "lifecycleStatus": "PUBLISHED"
    },
    "recipient": {
      "displayName": "Youssef Adel",
      "maskedAddress": "y***l@cairocorp.eg",
      "kind": "TO"
    },
    "sender": {
      "displayName": "Mutakamel Sales",
      "maskedAddress": "s***s@mutakamel.ai",
      "maskedReplyTo": "r***y@mutakamel.ai"
    },
    "senderConfigRevision": 3,
    "content": {
      "state": "AVAILABLE",
      "subject": "Account onboarding checklist — Annual ERP Renewal - Cairo",
      "preheader": "Update regarding Annual ERP Renewal - Cairo",
      "html": "<div style=\"font-family:Arial,sans-serif;color:#12141c;line-height:1.5;padding:16px;\"><h2 style=\"margin:0 0 12px;font-size:16px;color:#0f2f78;\">Account onboarding checklist — Annual ERP Renewal - Cairo</h2><p style=\"margin:0 0 10px;\">Hello Youssef Adel,</p><p style=\"margin:0 0 10px;\">Thank you for speaking with our team regarding <strong>Annual ERP Renewal - Cairo</strong>. Please find the latest details summarized below.</p><p style=\"margin:0 0 16px;\">Reply directly to this email if you would like to schedule a follow-up call this week.</p><p style=\"margin:0;color:#5b6072;font-size:12px;\">Best regards,<br/>Mutakamel CRM Team</p></div>",
      "text": "Account onboarding checklist — Annual ERP Renewal - Cairo\n\nHello Youssef Adel,\n\nThank you for speaking with our team regarding Annual ERP Renewal - Cairo.\nReply directly if you would like to schedule a follow-up call.\n\nBest regards,\nMutakamel CRM Team",
      "contentChecksum": "sha256:539d8086539d8086539d8086539d8086539d8086539d8086539d8086539d8086"
    },
    "status": "SENT",
    "statusRevision": 3,
    "provider": {
      "kind": "SENDGRID",
      "submissionReference": "0100019022a7c4e2f1-eml-023"
    },
    "failure": null,
    "feedback": [],
    "timeline": [
      {
        "state": "QUEUED",
        "occurredAt": "2026-10-16T23:00:00.000Z"
      },
      {
        "state": "DISPATCHING",
        "occurredAt": "2026-10-16T23:00:15.000Z"
      },
      {
        "state": "SENT",
        "occurredAt": "2026-10-16T23:00:42.000Z"
      }
    ],
    "requestedAt": "2026-10-16T23:00:00.000Z",
    "sentAt": "2026-10-16T23:00:42.000Z",
    "failedAt": null,
    "retryOfId": null,
    "retriedById": null,
    "contentRetentionDays": 730,
    "contentRetentionUntil": "2028-10-15T23:00:00.000Z",
    "contentRetentionPolicyRevision": 1
  },
  "/outbound-emails/eml-024": {
    "outboundEmailId": "eml-024",
    "activityId": "act-024",
    "sourceType": "OPPORTUNITY",
    "sourceId": "0193f2a5-4e92-7b8c-9a37-1f6d8e2c4b9e",
    "template": {
      "templateDefinitionId": "tpd-ar-3",
      "templateVersionId": "tpl-ar-3",
      "versionNumber": 1,
      "documentType": "CRM_OUTBOUND_EMAIL",
      "outputChannel": "EMAIL",
      "layoutMode": "EMAIL_FLOW",
      "locale": "ar",
      "direction": "RTL",
      "dataSourceKey": "CRM_OPPORTUNITY_OUTBOUND_EMAIL_V1",
      "dataSourceSchemaVersion": 1,
      "dataSourceSchemaChecksum": "sha256:12aebe5a12aebe5a12aebe5a12aebe5a12aebe5a12aebe5a12aebe5a12aebe5a",
      "templateContentChecksum": "sha256:901079b5901079b5901079b5901079b5901079b5901079b5901079b5901079b5",
      "compiledChecksum": "sha256:da355c9dda355c9dda355c9dda355c9dda355c9dda355c9dda355c9dda355c9d",
      "compilerFingerprint": "template-compiler/1",
      "lifecycleStatus": "PUBLISHED"
    },
    "recipient": {
      "displayName": "Rami Khalil",
      "maskedAddress": "r***l@warehouse-co.com",
      "kind": "TO"
    },
    "sender": {
      "displayName": "Mutakamel Sales",
      "maskedAddress": "s***s@mutakamel.ai",
      "maskedReplyTo": "r***y@mutakamel.ai"
    },
    "senderConfigRevision": 3,
    "content": {
      "state": "AVAILABLE",
      "subject": "Quarterly executive review invitation — Warehouse Expansion Rollout",
      "preheader": "Update regarding Warehouse Expansion Rollout",
      "html": "<div style=\"font-family:Arial,sans-serif;color:#12141c;line-height:1.5;padding:16px;\"><h2 style=\"margin:0 0 12px;font-size:16px;color:#0f2f78;\">Quarterly executive review invitation — Warehouse Expansion Rollout</h2><p style=\"margin:0 0 10px;\">Hello Rami Khalil,</p><p style=\"margin:0 0 10px;\">Thank you for speaking with our team regarding <strong>Warehouse Expansion Rollout</strong>. Please find the latest details summarized below.</p><p style=\"margin:0 0 16px;\">Reply directly to this email if you would like to schedule a follow-up call this week.</p><p style=\"margin:0;color:#5b6072;font-size:12px;\">Best regards,<br/>Mutakamel CRM Team</p></div>",
      "text": "Quarterly executive review invitation — Warehouse Expansion Rollout\n\nHello Rami Khalil,\n\nThank you for speaking with our team regarding Warehouse Expansion Rollout.\nReply directly if you would like to schedule a follow-up call.\n\nBest regards,\nMutakamel CRM Team",
      "contentChecksum": "sha256:2e50f5562e50f5562e50f5562e50f5562e50f5562e50f5562e50f5562e50f556"
    },
    "status": "SENT",
    "statusRevision": 3,
    "provider": {
      "kind": "PLATFORM-SHARED",
      "submissionReference": "0100019023a7c4e2f1-eml-024"
    },
    "failure": null,
    "feedback": [],
    "timeline": [
      {
        "state": "QUEUED",
        "occurredAt": "2026-10-14T22:00:00.000Z"
      },
      {
        "state": "DISPATCHING",
        "occurredAt": "2026-10-14T22:00:15.000Z"
      },
      {
        "state": "SENT",
        "occurredAt": "2026-10-14T22:00:42.000Z"
      }
    ],
    "requestedAt": "2026-10-14T22:00:00.000Z",
    "sentAt": "2026-10-14T22:00:42.000Z",
    "failedAt": null,
    "retryOfId": null,
    "retriedById": null,
    "contentRetentionDays": 730,
    "contentRetentionUntil": "2028-10-13T22:00:00.000Z",
    "contentRetentionPolicyRevision": 1
  },
  "/outbound-emails/eml-025": {
    "outboundEmailId": "eml-025",
    "activityId": "act-025",
    "sourceType": "LEAD",
    "sourceId": "0193f2a4-6c1e-7b3a-9d42-5e8a1c7f4a11",
    "template": {
      "templateDefinitionId": "tpd-en-1",
      "templateVersionId": "tpl-en-1",
      "versionNumber": 3,
      "documentType": "CRM_OUTBOUND_EMAIL",
      "outputChannel": "EMAIL",
      "layoutMode": "EMAIL_FLOW",
      "locale": "en",
      "direction": "LTR",
      "dataSourceKey": "CRM_LEAD_OUTBOUND_EMAIL_V1",
      "dataSourceSchemaVersion": 1,
      "dataSourceSchemaChecksum": "sha256:c1a91195c1a91195c1a91195c1a91195c1a91195c1a91195c1a91195c1a91195",
      "templateContentChecksum": "sha256:90123c2b90123c2b90123c2b90123c2b90123c2b90123c2b90123c2b90123c2b",
      "compiledChecksum": "sha256:da371f13da371f13da371f13da371f13da371f13da371f13da371f13da371f13",
      "compilerFingerprint": "template-compiler/1",
      "lifecycleStatus": "PUBLISHED"
    },
    "recipient": {
      "displayName": "Karim Mansour",
      "maskedAddress": "k***r@alnoor-trading.eg",
      "kind": "TO"
    },
    "sender": {
      "displayName": "Mutakamel Sales",
      "maskedAddress": "s***s@mutakamel.ai",
      "maskedReplyTo": null
    },
    "senderConfigRevision": 3,
    "content": {
      "state": "AVAILABLE",
      "subject": "Welcome to Mutakamel CRM onboarding — Al Noor Trading Co.",
      "preheader": "Update regarding Al Noor Trading Co.",
      "html": "<div style=\"font-family:Arial,sans-serif;color:#12141c;line-height:1.5;padding:16px;\"><h2 style=\"margin:0 0 12px;font-size:16px;color:#0f2f78;\">Welcome to Mutakamel CRM onboarding — Al Noor Trading Co.</h2><p style=\"margin:0 0 10px;\">Hello Karim Mansour,</p><p style=\"margin:0 0 10px;\">Thank you for speaking with our team regarding <strong>Al Noor Trading Co.</strong>. Please find the latest details summarized below.</p><p style=\"margin:0 0 16px;\">Reply directly to this email if you would like to schedule a follow-up call this week.</p><p style=\"margin:0;color:#5b6072;font-size:12px;\">Best regards,<br/>Mutakamel CRM Team</p></div>",
      "text": "Welcome to Mutakamel CRM onboarding — Al Noor Trading Co.\n\nHello Karim Mansour,\n\nThank you for speaking with our team regarding Al Noor Trading Co..\nReply directly if you would like to schedule a follow-up call.\n\nBest regards,\nMutakamel CRM Team",
      "contentChecksum": "sha256:0a90eda20a90eda20a90eda20a90eda20a90eda20a90eda20a90eda20a90eda2"
    },
    "status": "SENT",
    "statusRevision": 4,
    "provider": {
      "kind": "SES",
      "submissionReference": "0100019024a7c4e2f1-eml-025"
    },
    "failure": null,
    "feedback": [
      {
        "type": "COMPLAINT",
        "occurredAt": "2026-10-14T09:03:00.000Z",
        "reasonCode": "COMPLAINT",
        "suppressionApplied": false
      }
    ],
    "timeline": [
      {
        "state": "QUEUED",
        "occurredAt": "2026-10-14T09:00:00.000Z"
      },
      {
        "state": "DISPATCHING",
        "occurredAt": "2026-10-14T09:00:15.000Z"
      },
      {
        "state": "SENT",
        "occurredAt": "2026-10-14T09:00:42.000Z"
      },
      {
        "state": "COMPLAINED",
        "occurredAt": "2026-10-14T09:03:00.000Z"
      }
    ],
    "requestedAt": "2026-10-14T09:00:00.000Z",
    "sentAt": "2026-10-14T09:00:42.000Z",
    "failedAt": null,
    "retryOfId": null,
    "retriedById": null,
    "contentRetentionDays": 730,
    "contentRetentionUntil": "2028-10-13T09:00:00.000Z",
    "contentRetentionPolicyRevision": 1
  },
  "/outbound-emails/eml-026": {
    "outboundEmailId": "eml-026",
    "activityId": "act-026",
    "sourceType": "LEAD",
    "sourceId": "0193f2a4-71d0-7c55-8e13-2b9d4f6a8c27",
    "template": {
      "templateDefinitionId": "tpd-en-2",
      "templateVersionId": "tpl-en-2",
      "versionNumber": 2,
      "documentType": "CRM_OUTBOUND_EMAIL",
      "outputChannel": "EMAIL",
      "layoutMode": "EMAIL_FLOW",
      "locale": "en",
      "direction": "LTR",
      "dataSourceKey": "CRM_LEAD_OUTBOUND_EMAIL_V1",
      "dataSourceSchemaVersion": 1,
      "dataSourceSchemaChecksum": "sha256:c1a91195c1a91195c1a91195c1a91195c1a91195c1a91195c1a91195c1a91195",
      "templateContentChecksum": "sha256:90123c2c90123c2c90123c2c90123c2c90123c2c90123c2c90123c2c90123c2c",
      "compiledChecksum": "sha256:da371f14da371f14da371f14da371f14da371f14da371f14da371f14da371f14",
      "compilerFingerprint": "template-compiler/1",
      "lifecycleStatus": "PUBLISHED"
    },
    "recipient": {
      "displayName": "Tarek Hassan",
      "maskedAddress": "t***n@deltalogistics.com",
      "kind": "TO"
    },
    "sender": {
      "displayName": "Mutakamel Sales",
      "maskedAddress": "s***s@mutakamel.ai",
      "maskedReplyTo": "r***y@mutakamel.ai"
    },
    "senderConfigRevision": 3,
    "content": {
      "state": "AVAILABLE",
      "subject": "Follow-up on Q4 pricing proposal — Delta Logistics",
      "preheader": "Update regarding Delta Logistics",
      "html": "<div style=\"font-family:Arial,sans-serif;color:#12141c;line-height:1.5;padding:16px;\"><h2 style=\"margin:0 0 12px;font-size:16px;color:#0f2f78;\">Follow-up on Q4 pricing proposal — Delta Logistics</h2><p style=\"margin:0 0 10px;\">Hello Tarek Hassan,</p><p style=\"margin:0 0 10px;\">Thank you for speaking with our team regarding <strong>Delta Logistics</strong>. Please find the latest details summarized below.</p><p style=\"margin:0 0 16px;\">Reply directly to this email if you would like to schedule a follow-up call this week.</p><p style=\"margin:0;color:#5b6072;font-size:12px;\">Best regards,<br/>Mutakamel CRM Team</p></div>",
      "text": "Follow-up on Q4 pricing proposal — Delta Logistics\n\nHello Tarek Hassan,\n\nThank you for speaking with our team regarding Delta Logistics.\nReply directly if you would like to schedule a follow-up call.\n\nBest regards,\nMutakamel CRM Team",
      "contentChecksum": "sha256:3d70d53a3d70d53a3d70d53a3d70d53a3d70d53a3d70d53a3d70d53a3d70d53a"
    },
    "status": "SENT",
    "statusRevision": 3,
    "provider": {
      "kind": "SENDGRID",
      "submissionReference": "0100019025a7c4e2f1-eml-026"
    },
    "failure": null,
    "feedback": [],
    "timeline": [
      {
        "state": "QUEUED",
        "occurredAt": "2026-10-12T08:00:00.000Z"
      },
      {
        "state": "DISPATCHING",
        "occurredAt": "2026-10-12T08:00:15.000Z"
      },
      {
        "state": "SENT",
        "occurredAt": "2026-10-12T08:00:42.000Z"
      }
    ],
    "requestedAt": "2026-10-12T08:00:00.000Z",
    "sentAt": "2026-10-12T08:00:42.000Z",
    "failedAt": null,
    "retryOfId": null,
    "retriedById": null,
    "contentRetentionDays": 730,
    "contentRetentionUntil": "2028-10-11T08:00:00.000Z",
    "contentRetentionPolicyRevision": 1
  },
  "/outbound-emails/eml-027": {
    "outboundEmailId": "eml-027",
    "activityId": "act-027",
    "sourceType": "CUSTOMER_PROFILE",
    "sourceId": "0193f2a5-0a3b-7d18-a6f4-7c2e9b1d3e52",
    "template": {
      "templateDefinitionId": "tpd-en-3",
      "templateVersionId": "tpl-en-3",
      "versionNumber": 1,
      "documentType": "CRM_OUTBOUND_EMAIL",
      "outputChannel": "EMAIL",
      "layoutMode": "EMAIL_FLOW",
      "locale": "en",
      "direction": "LTR",
      "dataSourceKey": "CRM_CUSTOMER_OUTBOUND_EMAIL_V1",
      "dataSourceSchemaVersion": 1,
      "dataSourceSchemaChecksum": "sha256:ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1",
      "templateContentChecksum": "sha256:90123c2d90123c2d90123c2d90123c2d90123c2d90123c2d90123c2d90123c2d",
      "compiledChecksum": "sha256:da371f15da371f15da371f15da371f15da371f15da371f15da371f15da371f15",
      "compilerFingerprint": "template-compiler/1",
      "lifecycleStatus": "PUBLISHED"
    },
    "recipient": {
      "displayName": "Salma Ibrahim",
      "maskedAddress": "s***m@niletech.io",
      "kind": "TO"
    },
    "sender": {
      "displayName": "Mutakamel Sales",
      "maskedAddress": "s***s@mutakamel.ai",
      "maskedReplyTo": "r***y@mutakamel.ai"
    },
    "senderConfigRevision": 3,
    "content": {
      "state": "AVAILABLE",
      "subject": "Contract renewal schedule for next quarter — Nile Tech Solutions",
      "preheader": "Update regarding Nile Tech Solutions",
      "html": "<div style=\"font-family:Arial,sans-serif;color:#12141c;line-height:1.5;padding:16px;\"><h2 style=\"margin:0 0 12px;font-size:16px;color:#0f2f78;\">Contract renewal schedule for next quarter — Nile Tech Solutions</h2><p style=\"margin:0 0 10px;\">Hello Salma Ibrahim,</p><p style=\"margin:0 0 10px;\">Thank you for speaking with our team regarding <strong>Nile Tech Solutions</strong>. Please find the latest details summarized below.</p><p style=\"margin:0 0 16px;\">Reply directly to this email if you would like to schedule a follow-up call this week.</p><p style=\"margin:0;color:#5b6072;font-size:12px;\">Best regards,<br/>Mutakamel CRM Team</p></div>",
      "text": "Contract renewal schedule for next quarter — Nile Tech Solutions\n\nHello Salma Ibrahim,\n\nThank you for speaking with our team regarding Nile Tech Solutions.\nReply directly if you would like to schedule a follow-up call.\n\nBest regards,\nMutakamel CRM Team",
      "contentChecksum": "sha256:3c01e6333c01e6333c01e6333c01e6333c01e6333c01e6333c01e6333c01e633"
    },
    "status": "FAILED",
    "statusRevision": 3,
    "provider": null,
    "failure": {
      "code": "PROVIDER_THROTTLED",
      "automaticRetryExhausted": true,
      "failedAt": "2026-10-11T07:00:55.000Z"
    },
    "feedback": [],
    "timeline": [
      {
        "state": "QUEUED",
        "occurredAt": "2026-10-11T07:00:00.000Z"
      },
      {
        "state": "DISPATCHING",
        "occurredAt": "2026-10-11T07:00:14.000Z"
      },
      {
        "state": "FAILED",
        "occurredAt": "2026-10-11T07:00:55.000Z"
      }
    ],
    "requestedAt": "2026-10-11T07:00:00.000Z",
    "sentAt": null,
    "failedAt": "2026-10-11T07:00:55.000Z",
    "retryOfId": null,
    "retriedById": null,
    "contentRetentionDays": 730,
    "contentRetentionUntil": "2028-10-10T07:00:00.000Z",
    "contentRetentionPolicyRevision": 1
  },
  "/outbound-emails/eml-028": {
    "outboundEmailId": "eml-028",
    "activityId": "act-028",
    "sourceType": "CUSTOMER_PROFILE",
    "sourceId": "0193f2a5-1f84-7e02-b5c9-3d7a6e8f0b6d",
    "template": {
      "templateDefinitionId": "tpd-ar-1",
      "templateVersionId": "tpl-ar-1",
      "versionNumber": 3,
      "documentType": "CRM_OUTBOUND_EMAIL",
      "outputChannel": "EMAIL",
      "layoutMode": "EMAIL_FLOW",
      "locale": "ar",
      "direction": "RTL",
      "dataSourceKey": "CRM_CUSTOMER_OUTBOUND_EMAIL_V1",
      "dataSourceSchemaVersion": 1,
      "dataSourceSchemaChecksum": "sha256:ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1",
      "templateContentChecksum": "sha256:901079b3901079b3901079b3901079b3901079b3901079b3901079b3901079b3",
      "compiledChecksum": "sha256:da355c9bda355c9bda355c9bda355c9bda355c9bda355c9bda355c9bda355c9b",
      "compilerFingerprint": "template-compiler/1",
      "lifecycleStatus": "PUBLISHED"
    },
    "recipient": {
      "displayName": "Omar Suppressed",
      "maskedAddress": "o***r@redseacontracting.com",
      "kind": "TO"
    },
    "sender": {
      "displayName": "Mutakamel Sales",
      "maskedAddress": "s***s@mutakamel.ai",
      "maskedReplyTo": "r***y@mutakamel.ai"
    },
    "senderConfigRevision": 3,
    "content": {
      "state": "AVAILABLE",
      "subject": "Requested product specification sheet — Red Sea Contracting",
      "preheader": "Update regarding Red Sea Contracting",
      "html": "<div style=\"font-family:Arial,sans-serif;color:#12141c;line-height:1.5;padding:16px;\"><h2 style=\"margin:0 0 12px;font-size:16px;color:#0f2f78;\">Requested product specification sheet — Red Sea Contracting</h2><p style=\"margin:0 0 10px;\">Hello Omar Suppressed,</p><p style=\"margin:0 0 10px;\">Thank you for speaking with our team regarding <strong>Red Sea Contracting</strong>. Please find the latest details summarized below.</p><p style=\"margin:0 0 16px;\">Reply directly to this email if you would like to schedule a follow-up call this week.</p><p style=\"margin:0;color:#5b6072;font-size:12px;\">Best regards,<br/>Mutakamel CRM Team</p></div>",
      "text": "Requested product specification sheet — Red Sea Contracting\n\nHello Omar Suppressed,\n\nThank you for speaking with our team regarding Red Sea Contracting.\nReply directly if you would like to schedule a follow-up call.\n\nBest regards,\nMutakamel CRM Team",
      "contentChecksum": "sha256:0822083808220838082208380822083808220838082208380822083808220838"
    },
    "status": "SENT",
    "statusRevision": 3,
    "provider": {
      "kind": "SES",
      "submissionReference": "0100019027a7c4e2f1-eml-028"
    },
    "failure": null,
    "feedback": [],
    "timeline": [
      {
        "state": "QUEUED",
        "occurredAt": "2026-10-09T06:00:00.000Z"
      },
      {
        "state": "DISPATCHING",
        "occurredAt": "2026-10-09T06:00:15.000Z"
      },
      {
        "state": "SENT",
        "occurredAt": "2026-10-09T06:00:42.000Z"
      }
    ],
    "requestedAt": "2026-10-09T06:00:00.000Z",
    "sentAt": "2026-10-09T06:00:42.000Z",
    "failedAt": null,
    "retryOfId": null,
    "retriedById": null,
    "contentRetentionDays": 730,
    "contentRetentionUntil": "2028-10-08T06:00:00.000Z",
    "contentRetentionPolicyRevision": 1
  },
  "/outbound-emails/eml-029": {
    "outboundEmailId": "eml-029",
    "activityId": "act-029",
    "sourceType": "OPPORTUNITY",
    "sourceId": "0193f2a5-3c27-7a49-8f61-9e4b2c5d7a83",
    "template": {
      "templateDefinitionId": "tpd-ar-2",
      "templateVersionId": "tpl-ar-2",
      "versionNumber": 2,
      "documentType": "CRM_OUTBOUND_EMAIL",
      "outputChannel": "EMAIL",
      "layoutMode": "EMAIL_FLOW",
      "locale": "ar",
      "direction": "RTL",
      "dataSourceKey": "CRM_OPPORTUNITY_OUTBOUND_EMAIL_V1",
      "dataSourceSchemaVersion": 1,
      "dataSourceSchemaChecksum": "sha256:12aebe5a12aebe5a12aebe5a12aebe5a12aebe5a12aebe5a12aebe5a12aebe5a",
      "templateContentChecksum": "sha256:901079b4901079b4901079b4901079b4901079b4901079b4901079b4901079b4",
      "compiledChecksum": "sha256:da355c9cda355c9cda355c9cda355c9cda355c9cda355c9cda355c9cda355c9c",
      "compilerFingerprint": "template-compiler/1",
      "lifecycleStatus": "PUBLISHED"
    },
    "recipient": {
      "displayName": "Youssef Adel",
      "maskedAddress": "y***l@cairocorp.eg",
      "kind": "TO"
    },
    "sender": {
      "displayName": "Mutakamel Sales",
      "maskedAddress": "s***s@mutakamel.ai",
      "maskedReplyTo": null
    },
    "senderConfigRevision": 3,
    "content": {
      "state": "AVAILABLE",
      "subject": "Meeting summary and next milestones — Annual ERP Renewal - Cairo",
      "preheader": "Update regarding Annual ERP Renewal - Cairo",
      "html": "<div style=\"font-family:Arial,sans-serif;color:#12141c;line-height:1.5;padding:16px;\"><h2 style=\"margin:0 0 12px;font-size:16px;color:#0f2f78;\">Meeting summary and next milestones — Annual ERP Renewal - Cairo</h2><p style=\"margin:0 0 10px;\">Hello Youssef Adel,</p><p style=\"margin:0 0 10px;\">Thank you for speaking with our team regarding <strong>Annual ERP Renewal - Cairo</strong>. Please find the latest details summarized below.</p><p style=\"margin:0 0 16px;\">Reply directly to this email if you would like to schedule a follow-up call this week.</p><p style=\"margin:0;color:#5b6072;font-size:12px;\">Best regards,<br/>Mutakamel CRM Team</p></div>",
      "text": "Meeting summary and next milestones — Annual ERP Renewal - Cairo\n\nHello Youssef Adel,\n\nThank you for speaking with our team regarding Annual ERP Renewal - Cairo.\nReply directly if you would like to schedule a follow-up call.\n\nBest regards,\nMutakamel CRM Team",
      "contentChecksum": "sha256:b97f9772b97f9772b97f9772b97f9772b97f9772b97f9772b97f9772b97f9772"
    },
    "status": "SENT",
    "statusRevision": 3,
    "provider": {
      "kind": "SENDGRID",
      "submissionReference": "0100019028a7c4e2f1-eml-029"
    },
    "failure": null,
    "feedback": [],
    "timeline": [
      {
        "state": "QUEUED",
        "occurredAt": "2026-10-08T05:00:00.000Z"
      },
      {
        "state": "DISPATCHING",
        "occurredAt": "2026-10-08T05:00:15.000Z"
      },
      {
        "state": "SENT",
        "occurredAt": "2026-10-08T05:00:42.000Z"
      }
    ],
    "requestedAt": "2026-10-08T05:00:00.000Z",
    "sentAt": "2026-10-08T05:00:42.000Z",
    "failedAt": null,
    "retryOfId": null,
    "retriedById": null,
    "contentRetentionDays": 730,
    "contentRetentionUntil": "2028-10-07T05:00:00.000Z",
    "contentRetentionPolicyRevision": 1
  },
  "/outbound-emails/eml-030": {
    "outboundEmailId": "eml-030",
    "activityId": "act-030",
    "sourceType": "OPPORTUNITY",
    "sourceId": "0193f2a5-4e92-7b8c-9a37-1f6d8e2c4b9e",
    "template": {
      "templateDefinitionId": "tpd-ar-3",
      "templateVersionId": "tpl-ar-3",
      "versionNumber": 1,
      "documentType": "CRM_OUTBOUND_EMAIL",
      "outputChannel": "EMAIL",
      "layoutMode": "EMAIL_FLOW",
      "locale": "ar",
      "direction": "RTL",
      "dataSourceKey": "CRM_OPPORTUNITY_OUTBOUND_EMAIL_V1",
      "dataSourceSchemaVersion": 1,
      "dataSourceSchemaChecksum": "sha256:12aebe5a12aebe5a12aebe5a12aebe5a12aebe5a12aebe5a12aebe5a12aebe5a",
      "templateContentChecksum": "sha256:901079b5901079b5901079b5901079b5901079b5901079b5901079b5901079b5",
      "compiledChecksum": "sha256:da355c9dda355c9dda355c9dda355c9dda355c9dda355c9dda355c9dda355c9d",
      "compilerFingerprint": "template-compiler/1",
      "lifecycleStatus": "PUBLISHED"
    },
    "recipient": {
      "displayName": "Rami Khalil",
      "maskedAddress": "r***l@warehouse-co.com",
      "kind": "TO"
    },
    "sender": {
      "displayName": "Mutakamel Sales",
      "maskedAddress": "s***s@mutakamel.ai",
      "maskedReplyTo": "r***y@mutakamel.ai"
    },
    "senderConfigRevision": 3,
    "content": {
      "state": "AVAILABLE",
      "subject": "Updated implementation timeline — Warehouse Expansion Rollout",
      "preheader": "Update regarding Warehouse Expansion Rollout",
      "html": "<div style=\"font-family:Arial,sans-serif;color:#12141c;line-height:1.5;padding:16px;\"><h2 style=\"margin:0 0 12px;font-size:16px;color:#0f2f78;\">Updated implementation timeline — Warehouse Expansion Rollout</h2><p style=\"margin:0 0 10px;\">Hello Rami Khalil,</p><p style=\"margin:0 0 10px;\">Thank you for speaking with our team regarding <strong>Warehouse Expansion Rollout</strong>. Please find the latest details summarized below.</p><p style=\"margin:0 0 16px;\">Reply directly to this email if you would like to schedule a follow-up call this week.</p><p style=\"margin:0;color:#5b6072;font-size:12px;\">Best regards,<br/>Mutakamel CRM Team</p></div>",
      "text": "Updated implementation timeline — Warehouse Expansion Rollout\n\nHello Rami Khalil,\n\nThank you for speaking with our team regarding Warehouse Expansion Rollout.\nReply directly if you would like to schedule a follow-up call.\n\nBest regards,\nMutakamel CRM Team",
      "contentChecksum": "sha256:e942951ee942951ee942951ee942951ee942951ee942951ee942951ee942951e"
    },
    "status": "SENT",
    "statusRevision": 3,
    "provider": {
      "kind": "PLATFORM-SHARED",
      "submissionReference": "0100019029a7c4e2f1-eml-030"
    },
    "failure": null,
    "feedback": [],
    "timeline": [
      {
        "state": "QUEUED",
        "occurredAt": "2026-10-06T04:00:00.000Z"
      },
      {
        "state": "DISPATCHING",
        "occurredAt": "2026-10-06T04:00:15.000Z"
      },
      {
        "state": "SENT",
        "occurredAt": "2026-10-06T04:00:42.000Z"
      }
    ],
    "requestedAt": "2026-10-06T04:00:00.000Z",
    "sentAt": "2026-10-06T04:00:42.000Z",
    "failedAt": null,
    "retryOfId": null,
    "retriedById": null,
    "contentRetentionDays": 730,
    "contentRetentionUntil": "2028-10-05T04:00:00.000Z",
    "contentRetentionPolicyRevision": 1
  },
  "/outbound-emails/eml-031": {
    "outboundEmailId": "eml-031",
    "activityId": "act-031",
    "sourceType": "LEAD",
    "sourceId": "0193f2a4-6c1e-7b3a-9d42-5e8a1c7f4a11",
    "template": {
      "templateDefinitionId": "tpd-en-1",
      "templateVersionId": "tpl-en-1",
      "versionNumber": 3,
      "documentType": "CRM_OUTBOUND_EMAIL",
      "outputChannel": "EMAIL",
      "layoutMode": "EMAIL_FLOW",
      "locale": "en",
      "direction": "LTR",
      "dataSourceKey": "CRM_LEAD_OUTBOUND_EMAIL_V1",
      "dataSourceSchemaVersion": 1,
      "dataSourceSchemaChecksum": "sha256:c1a91195c1a91195c1a91195c1a91195c1a91195c1a91195c1a91195c1a91195",
      "templateContentChecksum": "sha256:90123c2b90123c2b90123c2b90123c2b90123c2b90123c2b90123c2b90123c2b",
      "compiledChecksum": "sha256:da371f13da371f13da371f13da371f13da371f13da371f13da371f13da371f13",
      "compilerFingerprint": "template-compiler/1",
      "lifecycleStatus": "PUBLISHED"
    },
    "recipient": {
      "displayName": "Karim Mansour",
      "maskedAddress": "k***r@alnoor-trading.eg",
      "kind": "TO"
    },
    "sender": {
      "displayName": "Mutakamel Sales",
      "maskedAddress": "s***s@mutakamel.ai",
      "maskedReplyTo": "r***y@mutakamel.ai"
    },
    "senderConfigRevision": 3,
    "content": {
      "state": "AVAILABLE",
      "subject": "Account onboarding checklist — Al Noor Trading Co.",
      "preheader": "Update regarding Al Noor Trading Co.",
      "html": "<div style=\"font-family:Arial,sans-serif;color:#12141c;line-height:1.5;padding:16px;\"><h2 style=\"margin:0 0 12px;font-size:16px;color:#0f2f78;\">Account onboarding checklist — Al Noor Trading Co.</h2><p style=\"margin:0 0 10px;\">Hello Karim Mansour,</p><p style=\"margin:0 0 10px;\">Thank you for speaking with our team regarding <strong>Al Noor Trading Co.</strong>. Please find the latest details summarized below.</p><p style=\"margin:0 0 16px;\">Reply directly to this email if you would like to schedule a follow-up call this week.</p><p style=\"margin:0;color:#5b6072;font-size:12px;\">Best regards,<br/>Mutakamel CRM Team</p></div>",
      "text": "Account onboarding checklist — Al Noor Trading Co.\n\nHello Karim Mansour,\n\nThank you for speaking with our team regarding Al Noor Trading Co..\nReply directly if you would like to schedule a follow-up call.\n\nBest regards,\nMutakamel CRM Team",
      "contentChecksum": "sha256:1ff7829b1ff7829b1ff7829b1ff7829b1ff7829b1ff7829b1ff7829b1ff7829b"
    },
    "status": "SENT",
    "statusRevision": 3,
    "provider": {
      "kind": "SES",
      "submissionReference": "0100019030a7c4e2f1-eml-031"
    },
    "failure": null,
    "feedback": [],
    "timeline": [
      {
        "state": "QUEUED",
        "occurredAt": "2026-10-05T03:00:00.000Z"
      },
      {
        "state": "DISPATCHING",
        "occurredAt": "2026-10-05T03:00:15.000Z"
      },
      {
        "state": "SENT",
        "occurredAt": "2026-10-05T03:00:42.000Z"
      }
    ],
    "requestedAt": "2026-10-05T03:00:00.000Z",
    "sentAt": "2026-10-05T03:00:42.000Z",
    "failedAt": null,
    "retryOfId": null,
    "retriedById": null,
    "contentRetentionDays": 730,
    "contentRetentionUntil": "2028-10-04T03:00:00.000Z",
    "contentRetentionPolicyRevision": 1
  },
  "/outbound-emails/eml-032": {
    "outboundEmailId": "eml-032",
    "activityId": "act-032",
    "sourceType": "LEAD",
    "sourceId": "0193f2a4-71d0-7c55-8e13-2b9d4f6a8c27",
    "template": {
      "templateDefinitionId": "tpd-en-2",
      "templateVersionId": "tpl-en-2",
      "versionNumber": 2,
      "documentType": "CRM_OUTBOUND_EMAIL",
      "outputChannel": "EMAIL",
      "layoutMode": "EMAIL_FLOW",
      "locale": "en",
      "direction": "LTR",
      "dataSourceKey": "CRM_LEAD_OUTBOUND_EMAIL_V1",
      "dataSourceSchemaVersion": 1,
      "dataSourceSchemaChecksum": "sha256:c1a91195c1a91195c1a91195c1a91195c1a91195c1a91195c1a91195c1a91195",
      "templateContentChecksum": "sha256:90123c2c90123c2c90123c2c90123c2c90123c2c90123c2c90123c2c90123c2c",
      "compiledChecksum": "sha256:da371f14da371f14da371f14da371f14da371f14da371f14da371f14da371f14",
      "compilerFingerprint": "template-compiler/1",
      "lifecycleStatus": "PUBLISHED"
    },
    "recipient": {
      "displayName": "Tarek Hassan",
      "maskedAddress": "t***n@deltalogistics.com",
      "kind": "TO"
    },
    "sender": {
      "displayName": "Mutakamel Sales",
      "maskedAddress": "s***s@mutakamel.ai",
      "maskedReplyTo": "r***y@mutakamel.ai"
    },
    "senderConfigRevision": 3,
    "content": {
      "state": "AVAILABLE",
      "subject": "Quarterly executive review invitation — Delta Logistics",
      "preheader": "Update regarding Delta Logistics",
      "html": "<div style=\"font-family:Arial,sans-serif;color:#12141c;line-height:1.5;padding:16px;\"><h2 style=\"margin:0 0 12px;font-size:16px;color:#0f2f78;\">Quarterly executive review invitation — Delta Logistics</h2><p style=\"margin:0 0 10px;\">Hello Tarek Hassan,</p><p style=\"margin:0 0 10px;\">Thank you for speaking with our team regarding <strong>Delta Logistics</strong>. Please find the latest details summarized below.</p><p style=\"margin:0 0 16px;\">Reply directly to this email if you would like to schedule a follow-up call this week.</p><p style=\"margin:0;color:#5b6072;font-size:12px;\">Best regards,<br/>Mutakamel CRM Team</p></div>",
      "text": "Quarterly executive review invitation — Delta Logistics\n\nHello Tarek Hassan,\n\nThank you for speaking with our team regarding Delta Logistics.\nReply directly if you would like to schedule a follow-up call.\n\nBest regards,\nMutakamel CRM Team",
      "contentChecksum": "sha256:7c0e51097c0e51097c0e51097c0e51097c0e51097c0e51097c0e51097c0e5109"
    },
    "status": "SENT",
    "statusRevision": 3,
    "provider": {
      "kind": "SENDGRID",
      "submissionReference": "0100019031a7c4e2f1-eml-032"
    },
    "failure": null,
    "feedback": [],
    "timeline": [
      {
        "state": "QUEUED",
        "occurredAt": "2026-10-03T02:00:00.000Z"
      },
      {
        "state": "DISPATCHING",
        "occurredAt": "2026-10-03T02:00:15.000Z"
      },
      {
        "state": "SENT",
        "occurredAt": "2026-10-03T02:00:42.000Z"
      }
    ],
    "requestedAt": "2026-10-03T02:00:00.000Z",
    "sentAt": "2026-10-03T02:00:42.000Z",
    "failedAt": null,
    "retryOfId": null,
    "retriedById": null,
    "contentRetentionDays": 730,
    "contentRetentionUntil": "2028-10-02T02:00:00.000Z",
    "contentRetentionPolicyRevision": 1
  },
  "/outbound-emails/eml-033": {
    "outboundEmailId": "eml-033",
    "activityId": "act-033",
    "sourceType": "CUSTOMER_PROFILE",
    "sourceId": "0193f2a5-0a3b-7d18-a6f4-7c2e9b1d3e52",
    "template": {
      "templateDefinitionId": "tpd-en-3",
      "templateVersionId": "tpl-en-3",
      "versionNumber": 1,
      "documentType": "CRM_OUTBOUND_EMAIL",
      "outputChannel": "EMAIL",
      "layoutMode": "EMAIL_FLOW",
      "locale": "en",
      "direction": "LTR",
      "dataSourceKey": "CRM_CUSTOMER_OUTBOUND_EMAIL_V1",
      "dataSourceSchemaVersion": 1,
      "dataSourceSchemaChecksum": "sha256:ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1",
      "templateContentChecksum": "sha256:90123c2d90123c2d90123c2d90123c2d90123c2d90123c2d90123c2d90123c2d",
      "compiledChecksum": "sha256:da371f15da371f15da371f15da371f15da371f15da371f15da371f15da371f15",
      "compilerFingerprint": "template-compiler/1",
      "lifecycleStatus": "PUBLISHED"
    },
    "recipient": {
      "displayName": "Salma Ibrahim",
      "maskedAddress": "s***m@niletech.io",
      "kind": "TO"
    },
    "sender": {
      "displayName": "Mutakamel Sales",
      "maskedAddress": "s***s@mutakamel.ai",
      "maskedReplyTo": null
    },
    "senderConfigRevision": 3,
    "content": {
      "state": "AVAILABLE",
      "subject": "Welcome to Mutakamel CRM onboarding — Nile Tech Solutions",
      "preheader": "Update regarding Nile Tech Solutions",
      "html": "<div style=\"font-family:Arial,sans-serif;color:#12141c;line-height:1.5;padding:16px;\"><h2 style=\"margin:0 0 12px;font-size:16px;color:#0f2f78;\">Welcome to Mutakamel CRM onboarding — Nile Tech Solutions</h2><p style=\"margin:0 0 10px;\">Hello Salma Ibrahim,</p><p style=\"margin:0 0 10px;\">Thank you for speaking with our team regarding <strong>Nile Tech Solutions</strong>. Please find the latest details summarized below.</p><p style=\"margin:0 0 16px;\">Reply directly to this email if you would like to schedule a follow-up call this week.</p><p style=\"margin:0;color:#5b6072;font-size:12px;\">Best regards,<br/>Mutakamel CRM Team</p></div>",
      "text": "Welcome to Mutakamel CRM onboarding — Nile Tech Solutions\n\nHello Salma Ibrahim,\n\nThank you for speaking with our team regarding Nile Tech Solutions.\nReply directly if you would like to schedule a follow-up call.\n\nBest regards,\nMutakamel CRM Team",
      "contentChecksum": "sha256:3092f0c53092f0c53092f0c53092f0c53092f0c53092f0c53092f0c53092f0c5"
    },
    "status": "FAILED",
    "statusRevision": 3,
    "provider": null,
    "failure": {
      "code": "TLS_HANDSHAKE_FAILED",
      "automaticRetryExhausted": true,
      "failedAt": "2026-10-02T01:00:55.000Z"
    },
    "feedback": [],
    "timeline": [
      {
        "state": "QUEUED",
        "occurredAt": "2026-10-02T01:00:00.000Z"
      },
      {
        "state": "DISPATCHING",
        "occurredAt": "2026-10-02T01:00:14.000Z"
      },
      {
        "state": "FAILED",
        "occurredAt": "2026-10-02T01:00:55.000Z"
      }
    ],
    "requestedAt": "2026-10-02T01:00:00.000Z",
    "sentAt": null,
    "failedAt": "2026-10-02T01:00:55.000Z",
    "retryOfId": null,
    "retriedById": null,
    "contentRetentionDays": 730,
    "contentRetentionUntil": "2028-10-01T01:00:00.000Z",
    "contentRetentionPolicyRevision": 1
  },
  "/outbound-emails/eml-038": {
    "outboundEmailId": "eml-038",
    "activityId": "act-038",
    "sourceType": "LEAD",
    "sourceId": "0193f2a4-71d0-7c55-8e13-2b9d4f6a8c27",
    "template": {
      "templateDefinitionId": "tpd-en-2",
      "templateVersionId": "tpl-en-2",
      "versionNumber": 2,
      "documentType": "CRM_OUTBOUND_EMAIL",
      "outputChannel": "EMAIL",
      "layoutMode": "EMAIL_FLOW",
      "locale": "en",
      "direction": "LTR",
      "dataSourceKey": "CRM_LEAD_OUTBOUND_EMAIL_V1",
      "dataSourceSchemaVersion": 1,
      "dataSourceSchemaChecksum": "sha256:c1a91195c1a91195c1a91195c1a91195c1a91195c1a91195c1a91195c1a91195",
      "templateContentChecksum": "sha256:90123c2c90123c2c90123c2c90123c2c90123c2c90123c2c90123c2c90123c2c",
      "compiledChecksum": "sha256:da371f14da371f14da371f14da371f14da371f14da371f14da371f14da371f14",
      "compilerFingerprint": "template-compiler/1",
      "lifecycleStatus": "PUBLISHED"
    },
    "recipient": {
      "displayName": "Tarek Hassan",
      "maskedAddress": "t***n@deltalogistics.com",
      "kind": "TO"
    },
    "sender": {
      "displayName": "Mutakamel Sales",
      "maskedAddress": "s***s@mutakamel.ai",
      "maskedReplyTo": "r***y@mutakamel.ai"
    },
    "senderConfigRevision": 3,
    "content": {
      "state": "REDACTED_BY_RETENTION",
      "redactedAt": "2026-10-30T08:00:00.000Z"
    },
    "status": "SENT",
    "statusRevision": 3,
    "provider": {
      "kind": "SENDGRID",
      "submissionReference": "0100019037a7c4e2f1-eml-038"
    },
    "failure": null,
    "feedback": [],
    "timeline": [
      {
        "state": "QUEUED",
        "occurredAt": "2026-09-30T08:00:00.000Z"
      },
      {
        "state": "DISPATCHING",
        "occurredAt": "2026-09-30T08:00:15.000Z"
      },
      {
        "state": "SENT",
        "occurredAt": "2026-09-30T08:00:42.000Z"
      }
    ],
    "requestedAt": "2026-09-30T08:00:00.000Z",
    "sentAt": "2026-09-30T08:00:42.000Z",
    "failedAt": null,
    "retryOfId": null,
    "retriedById": null,
    "contentRetentionDays": 30,
    "contentRetentionUntil": "2026-10-30T08:00:00.000Z",
    "contentRetentionPolicyRevision": 1
  },
  "/outbound-emails/eml-034": {
    "outboundEmailId": "eml-034",
    "activityId": "act-034",
    "sourceType": "CUSTOMER_PROFILE",
    "sourceId": "0193f2a5-1f84-7e02-b5c9-3d7a6e8f0b6d",
    "template": {
      "templateDefinitionId": "tpd-ar-1",
      "templateVersionId": "tpl-ar-1",
      "versionNumber": 3,
      "documentType": "CRM_OUTBOUND_EMAIL",
      "outputChannel": "EMAIL",
      "layoutMode": "EMAIL_FLOW",
      "locale": "ar",
      "direction": "RTL",
      "dataSourceKey": "CRM_CUSTOMER_OUTBOUND_EMAIL_V1",
      "dataSourceSchemaVersion": 1,
      "dataSourceSchemaChecksum": "sha256:ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1",
      "templateContentChecksum": "sha256:901079b3901079b3901079b3901079b3901079b3901079b3901079b3901079b3",
      "compiledChecksum": "sha256:da355c9bda355c9bda355c9bda355c9bda355c9bda355c9bda355c9bda355c9b",
      "compilerFingerprint": "template-compiler/1",
      "lifecycleStatus": "PUBLISHED"
    },
    "recipient": {
      "displayName": "Omar Suppressed",
      "maskedAddress": "o***r@redseacontracting.com",
      "kind": "TO"
    },
    "sender": {
      "displayName": "Mutakamel Sales",
      "maskedAddress": "s***s@mutakamel.ai",
      "maskedReplyTo": "r***y@mutakamel.ai"
    },
    "senderConfigRevision": 3,
    "content": {
      "state": "AVAILABLE",
      "subject": "Follow-up on Q4 pricing proposal — Red Sea Contracting",
      "preheader": "Update regarding Red Sea Contracting",
      "html": "<div style=\"font-family:Arial,sans-serif;color:#12141c;line-height:1.5;padding:16px;\"><h2 style=\"margin:0 0 12px;font-size:16px;color:#0f2f78;\">Follow-up on Q4 pricing proposal — Red Sea Contracting</h2><p style=\"margin:0 0 10px;\">Hello Omar Suppressed,</p><p style=\"margin:0 0 10px;\">Thank you for speaking with our team regarding <strong>Red Sea Contracting</strong>. Please find the latest details summarized below.</p><p style=\"margin:0 0 16px;\">Reply directly to this email if you would like to schedule a follow-up call this week.</p><p style=\"margin:0;color:#5b6072;font-size:12px;\">Best regards,<br/>Mutakamel CRM Team</p></div>",
      "text": "Follow-up on Q4 pricing proposal — Red Sea Contracting\n\nHello Omar Suppressed,\n\nThank you for speaking with our team regarding Red Sea Contracting.\nReply directly if you would like to schedule a follow-up call.\n\nBest regards,\nMutakamel CRM Team",
      "contentChecksum": "sha256:dce4be0adce4be0adce4be0adce4be0adce4be0adce4be0adce4be0adce4be0a"
    },
    "status": "SENT",
    "statusRevision": 3,
    "provider": {
      "kind": "SES",
      "submissionReference": "0100019033a7c4e2f1-eml-034"
    },
    "failure": null,
    "feedback": [],
    "timeline": [
      {
        "state": "QUEUED",
        "occurredAt": "2026-09-30T00:00:00.000Z"
      },
      {
        "state": "DISPATCHING",
        "occurredAt": "2026-09-30T00:00:15.000Z"
      },
      {
        "state": "SENT",
        "occurredAt": "2026-09-30T00:00:42.000Z"
      }
    ],
    "requestedAt": "2026-09-30T00:00:00.000Z",
    "sentAt": "2026-09-30T00:00:42.000Z",
    "failedAt": null,
    "retryOfId": null,
    "retriedById": null,
    "contentRetentionDays": 730,
    "contentRetentionUntil": "2028-09-29T00:00:00.000Z",
    "contentRetentionPolicyRevision": 1
  },
  "/outbound-emails/eml-035": {
    "outboundEmailId": "eml-035",
    "activityId": "act-035",
    "sourceType": "OPPORTUNITY",
    "sourceId": "0193f2a5-3c27-7a49-8f61-9e4b2c5d7a83",
    "template": {
      "templateDefinitionId": "tpd-ar-2",
      "templateVersionId": "tpl-ar-2",
      "versionNumber": 2,
      "documentType": "CRM_OUTBOUND_EMAIL",
      "outputChannel": "EMAIL",
      "layoutMode": "EMAIL_FLOW",
      "locale": "ar",
      "direction": "RTL",
      "dataSourceKey": "CRM_OPPORTUNITY_OUTBOUND_EMAIL_V1",
      "dataSourceSchemaVersion": 1,
      "dataSourceSchemaChecksum": "sha256:12aebe5a12aebe5a12aebe5a12aebe5a12aebe5a12aebe5a12aebe5a12aebe5a",
      "templateContentChecksum": "sha256:901079b4901079b4901079b4901079b4901079b4901079b4901079b4901079b4",
      "compiledChecksum": "sha256:da355c9cda355c9cda355c9cda355c9cda355c9cda355c9cda355c9cda355c9c",
      "compilerFingerprint": "template-compiler/1",
      "lifecycleStatus": "PUBLISHED"
    },
    "recipient": {
      "displayName": "Youssef Adel",
      "maskedAddress": "y***l@cairocorp.eg",
      "kind": "TO"
    },
    "sender": {
      "displayName": "Mutakamel Sales",
      "maskedAddress": "s***s@mutakamel.ai",
      "maskedReplyTo": "r***y@mutakamel.ai"
    },
    "senderConfigRevision": 3,
    "content": {
      "state": "AVAILABLE",
      "subject": "Contract renewal schedule for next quarter — Annual ERP Renewal - Cairo",
      "preheader": "Update regarding Annual ERP Renewal - Cairo",
      "html": "<div style=\"font-family:Arial,sans-serif;color:#12141c;line-height:1.5;padding:16px;\"><h2 style=\"margin:0 0 12px;font-size:16px;color:#0f2f78;\">Contract renewal schedule for next quarter — Annual ERP Renewal - Cairo</h2><p style=\"margin:0 0 10px;\">Hello Youssef Adel,</p><p style=\"margin:0 0 10px;\">Thank you for speaking with our team regarding <strong>Annual ERP Renewal - Cairo</strong>. Please find the latest details summarized below.</p><p style=\"margin:0 0 16px;\">Reply directly to this email if you would like to schedule a follow-up call this week.</p><p style=\"margin:0;color:#5b6072;font-size:12px;\">Best regards,<br/>Mutakamel CRM Team</p></div>",
      "text": "Contract renewal schedule for next quarter — Annual ERP Renewal - Cairo\n\nHello Youssef Adel,\n\nThank you for speaking with our team regarding Annual ERP Renewal - Cairo.\nReply directly if you would like to schedule a follow-up call.\n\nBest regards,\nMutakamel CRM Team",
      "contentChecksum": "sha256:d08e4631d08e4631d08e4631d08e4631d08e4631d08e4631d08e4631d08e4631"
    },
    "status": "SENT",
    "statusRevision": 3,
    "provider": {
      "kind": "SENDGRID",
      "submissionReference": "0100019034a7c4e2f1-eml-035"
    },
    "failure": null,
    "feedback": [],
    "timeline": [
      {
        "state": "QUEUED",
        "occurredAt": "2026-09-28T23:00:00.000Z"
      },
      {
        "state": "DISPATCHING",
        "occurredAt": "2026-09-28T23:00:15.000Z"
      },
      {
        "state": "SENT",
        "occurredAt": "2026-09-28T23:00:42.000Z"
      }
    ],
    "requestedAt": "2026-09-28T23:00:00.000Z",
    "sentAt": "2026-09-28T23:00:42.000Z",
    "failedAt": null,
    "retryOfId": null,
    "retriedById": null,
    "contentRetentionDays": 730,
    "contentRetentionUntil": "2028-09-27T23:00:00.000Z",
    "contentRetentionPolicyRevision": 1
  },
  "/outbound-emails/eml-036": {
    "outboundEmailId": "eml-036",
    "activityId": "act-036",
    "sourceType": "OPPORTUNITY",
    "sourceId": "0193f2a5-4e92-7b8c-9a37-1f6d8e2c4b9e",
    "template": {
      "templateDefinitionId": "tpd-ar-3",
      "templateVersionId": "tpl-ar-3",
      "versionNumber": 1,
      "documentType": "CRM_OUTBOUND_EMAIL",
      "outputChannel": "EMAIL",
      "layoutMode": "EMAIL_FLOW",
      "locale": "ar",
      "direction": "RTL",
      "dataSourceKey": "CRM_OPPORTUNITY_OUTBOUND_EMAIL_V1",
      "dataSourceSchemaVersion": 1,
      "dataSourceSchemaChecksum": "sha256:12aebe5a12aebe5a12aebe5a12aebe5a12aebe5a12aebe5a12aebe5a12aebe5a",
      "templateContentChecksum": "sha256:901079b5901079b5901079b5901079b5901079b5901079b5901079b5901079b5",
      "compiledChecksum": "sha256:da355c9dda355c9dda355c9dda355c9dda355c9dda355c9dda355c9dda355c9d",
      "compilerFingerprint": "template-compiler/1",
      "lifecycleStatus": "PUBLISHED"
    },
    "recipient": {
      "displayName": "Rami Khalil",
      "maskedAddress": "r***l@warehouse-co.com",
      "kind": "TO"
    },
    "sender": {
      "displayName": "Mutakamel Sales",
      "maskedAddress": "s***s@mutakamel.ai",
      "maskedReplyTo": "r***y@mutakamel.ai"
    },
    "senderConfigRevision": 3,
    "content": {
      "state": "AVAILABLE",
      "subject": "Requested product specification sheet — Warehouse Expansion Rollout",
      "preheader": "Update regarding Warehouse Expansion Rollout",
      "html": "<div style=\"font-family:Arial,sans-serif;color:#12141c;line-height:1.5;padding:16px;\"><h2 style=\"margin:0 0 12px;font-size:16px;color:#0f2f78;\">Requested product specification sheet — Warehouse Expansion Rollout</h2><p style=\"margin:0 0 10px;\">Hello Rami Khalil,</p><p style=\"margin:0 0 10px;\">Thank you for speaking with our team regarding <strong>Warehouse Expansion Rollout</strong>. Please find the latest details summarized below.</p><p style=\"margin:0 0 16px;\">Reply directly to this email if you would like to schedule a follow-up call this week.</p><p style=\"margin:0;color:#5b6072;font-size:12px;\">Best regards,<br/>Mutakamel CRM Team</p></div>",
      "text": "Requested product specification sheet — Warehouse Expansion Rollout\n\nHello Rami Khalil,\n\nThank you for speaking with our team regarding Warehouse Expansion Rollout.\nReply directly if you would like to schedule a follow-up call.\n\nBest regards,\nMutakamel CRM Team",
      "contentChecksum": "sha256:fbcfbf33fbcfbf33fbcfbf33fbcfbf33fbcfbf33fbcfbf33fbcfbf33fbcfbf33"
    },
    "status": "SENT",
    "statusRevision": 3,
    "provider": {
      "kind": "PLATFORM-SHARED",
      "submissionReference": "0100019035a7c4e2f1-eml-036"
    },
    "failure": null,
    "feedback": [],
    "timeline": [
      {
        "state": "QUEUED",
        "occurredAt": "2026-09-26T22:00:00.000Z"
      },
      {
        "state": "DISPATCHING",
        "occurredAt": "2026-09-26T22:00:15.000Z"
      },
      {
        "state": "SENT",
        "occurredAt": "2026-09-26T22:00:42.000Z"
      }
    ],
    "requestedAt": "2026-09-26T22:00:00.000Z",
    "sentAt": "2026-09-26T22:00:42.000Z",
    "failedAt": null,
    "retryOfId": null,
    "retriedById": null,
    "contentRetentionDays": 730,
    "contentRetentionUntil": "2028-09-25T22:00:00.000Z",
    "contentRetentionPolicyRevision": 1
  },
  "/outbound-emails/eml-037": {
    "outboundEmailId": "eml-037",
    "activityId": "act-037",
    "sourceType": "LEAD",
    "sourceId": "0193f2a4-6c1e-7b3a-9d42-5e8a1c7f4a11",
    "template": {
      "templateDefinitionId": "tpd-en-1",
      "templateVersionId": "tpl-en-1",
      "versionNumber": 3,
      "documentType": "CRM_OUTBOUND_EMAIL",
      "outputChannel": "EMAIL",
      "layoutMode": "EMAIL_FLOW",
      "locale": "en",
      "direction": "LTR",
      "dataSourceKey": "CRM_LEAD_OUTBOUND_EMAIL_V1",
      "dataSourceSchemaVersion": 1,
      "dataSourceSchemaChecksum": "sha256:c1a91195c1a91195c1a91195c1a91195c1a91195c1a91195c1a91195c1a91195",
      "templateContentChecksum": "sha256:90123c2b90123c2b90123c2b90123c2b90123c2b90123c2b90123c2b90123c2b",
      "compiledChecksum": "sha256:da371f13da371f13da371f13da371f13da371f13da371f13da371f13da371f13",
      "compilerFingerprint": "template-compiler/1",
      "lifecycleStatus": "PUBLISHED"
    },
    "recipient": {
      "displayName": "Karim Mansour",
      "maskedAddress": "k***r@alnoor-trading.eg",
      "kind": "TO"
    },
    "sender": {
      "displayName": "Mutakamel Sales",
      "maskedAddress": "s***s@mutakamel.ai",
      "maskedReplyTo": null
    },
    "senderConfigRevision": 3,
    "content": {
      "state": "AVAILABLE",
      "subject": "Meeting summary and next milestones — Al Noor Trading Co.",
      "preheader": "Update regarding Al Noor Trading Co.",
      "html": "<div style=\"font-family:Arial,sans-serif;color:#12141c;line-height:1.5;padding:16px;\"><h2 style=\"margin:0 0 12px;font-size:16px;color:#0f2f78;\">Meeting summary and next milestones — Al Noor Trading Co.</h2><p style=\"margin:0 0 10px;\">Hello Karim Mansour,</p><p style=\"margin:0 0 10px;\">Thank you for speaking with our team regarding <strong>Al Noor Trading Co.</strong>. Please find the latest details summarized below.</p><p style=\"margin:0 0 16px;\">Reply directly to this email if you would like to schedule a follow-up call this week.</p><p style=\"margin:0;color:#5b6072;font-size:12px;\">Best regards,<br/>Mutakamel CRM Team</p></div>",
      "text": "Meeting summary and next milestones — Al Noor Trading Co.\n\nHello Karim Mansour,\n\nThank you for speaking with our team regarding Al Noor Trading Co..\nReply directly if you would like to schedule a follow-up call.\n\nBest regards,\nMutakamel CRM Team",
      "contentChecksum": "sha256:d65e9c2fd65e9c2fd65e9c2fd65e9c2fd65e9c2fd65e9c2fd65e9c2fd65e9c2f"
    },
    "status": "SENT",
    "statusRevision": 3,
    "provider": {
      "kind": "SES",
      "submissionReference": "0100019036a7c4e2f1-eml-037"
    },
    "failure": null,
    "feedback": [],
    "timeline": [
      {
        "state": "QUEUED",
        "occurredAt": "2026-09-26T09:00:00.000Z"
      },
      {
        "state": "DISPATCHING",
        "occurredAt": "2026-09-26T09:00:15.000Z"
      },
      {
        "state": "SENT",
        "occurredAt": "2026-09-26T09:00:42.000Z"
      }
    ],
    "requestedAt": "2026-09-26T09:00:00.000Z",
    "sentAt": "2026-09-26T09:00:42.000Z",
    "failedAt": null,
    "retryOfId": null,
    "retriedById": null,
    "contentRetentionDays": 730,
    "contentRetentionUntil": "2028-09-25T09:00:00.000Z",
    "contentRetentionPolicyRevision": 1
  },
  "/outbound-emails/eml-039": {
    "outboundEmailId": "eml-039",
    "activityId": "act-039",
    "sourceType": "CUSTOMER_PROFILE",
    "sourceId": "0193f2a5-0a3b-7d18-a6f4-7c2e9b1d3e52",
    "template": {
      "templateDefinitionId": "tpd-en-3",
      "templateVersionId": "tpl-en-3",
      "versionNumber": 1,
      "documentType": "CRM_OUTBOUND_EMAIL",
      "outputChannel": "EMAIL",
      "layoutMode": "EMAIL_FLOW",
      "locale": "en",
      "direction": "LTR",
      "dataSourceKey": "CRM_CUSTOMER_OUTBOUND_EMAIL_V1",
      "dataSourceSchemaVersion": 1,
      "dataSourceSchemaChecksum": "sha256:ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1",
      "templateContentChecksum": "sha256:90123c2d90123c2d90123c2d90123c2d90123c2d90123c2d90123c2d90123c2d",
      "compiledChecksum": "sha256:da371f15da371f15da371f15da371f15da371f15da371f15da371f15da371f15",
      "compilerFingerprint": "template-compiler/1",
      "lifecycleStatus": "PUBLISHED"
    },
    "recipient": {
      "displayName": "Salma Ibrahim",
      "maskedAddress": "s***m@niletech.io",
      "kind": "TO"
    },
    "sender": {
      "displayName": "Mutakamel Sales",
      "maskedAddress": "s***s@mutakamel.ai",
      "maskedReplyTo": "r***y@mutakamel.ai"
    },
    "senderConfigRevision": 3,
    "content": {
      "state": "REDACTED_BY_RETENTION",
      "redactedAt": "2026-10-26T07:00:00.000Z"
    },
    "status": "SENT",
    "statusRevision": 3,
    "provider": {
      "kind": "PLATFORM-SHARED",
      "submissionReference": "0100019038a7c4e2f1-eml-039"
    },
    "failure": null,
    "feedback": [],
    "timeline": [
      {
        "state": "QUEUED",
        "occurredAt": "2026-09-26T07:00:00.000Z"
      },
      {
        "state": "DISPATCHING",
        "occurredAt": "2026-09-26T07:00:15.000Z"
      },
      {
        "state": "SENT",
        "occurredAt": "2026-09-26T07:00:42.000Z"
      }
    ],
    "requestedAt": "2026-09-26T07:00:00.000Z",
    "sentAt": "2026-09-26T07:00:42.000Z",
    "failedAt": null,
    "retryOfId": null,
    "retriedById": null,
    "contentRetentionDays": 30,
    "contentRetentionUntil": "2026-10-26T07:00:00.000Z",
    "contentRetentionPolicyRevision": 1
  },
  "/outbound-emails/eml-040": {
    "outboundEmailId": "eml-040",
    "activityId": "act-040",
    "sourceType": "CUSTOMER_PROFILE",
    "sourceId": "0193f2a5-1f84-7e02-b5c9-3d7a6e8f0b6d",
    "template": {
      "templateDefinitionId": "tpd-ar-1",
      "templateVersionId": "tpl-ar-1",
      "versionNumber": 3,
      "documentType": "CRM_OUTBOUND_EMAIL",
      "outputChannel": "EMAIL",
      "layoutMode": "EMAIL_FLOW",
      "locale": "ar",
      "direction": "RTL",
      "dataSourceKey": "CRM_CUSTOMER_OUTBOUND_EMAIL_V1",
      "dataSourceSchemaVersion": 1,
      "dataSourceSchemaChecksum": "sha256:ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1ae755ae1",
      "templateContentChecksum": "sha256:901079b3901079b3901079b3901079b3901079b3901079b3901079b3901079b3",
      "compiledChecksum": "sha256:da355c9bda355c9bda355c9bda355c9bda355c9bda355c9bda355c9bda355c9b",
      "compilerFingerprint": "template-compiler/1",
      "lifecycleStatus": "PUBLISHED"
    },
    "recipient": {
      "displayName": "Omar Suppressed",
      "maskedAddress": "o***r@redseacontracting.com",
      "kind": "TO"
    },
    "sender": {
      "displayName": "Mutakamel Sales",
      "maskedAddress": "s***s@mutakamel.ai",
      "maskedReplyTo": "r***y@mutakamel.ai"
    },
    "senderConfigRevision": 3,
    "content": {
      "state": "REDACTED_BY_RETENTION",
      "redactedAt": "2026-10-22T06:00:00.000Z"
    },
    "status": "SENT",
    "statusRevision": 3,
    "provider": {
      "kind": "SES",
      "submissionReference": "0100019039a7c4e2f1-eml-040"
    },
    "failure": null,
    "feedback": [],
    "timeline": [
      {
        "state": "QUEUED",
        "occurredAt": "2026-09-22T06:00:00.000Z"
      },
      {
        "state": "DISPATCHING",
        "occurredAt": "2026-09-22T06:00:15.000Z"
      },
      {
        "state": "SENT",
        "occurredAt": "2026-09-22T06:00:42.000Z"
      }
    ],
    "requestedAt": "2026-09-22T06:00:00.000Z",
    "sentAt": "2026-09-22T06:00:42.000Z",
    "failedAt": null,
    "retryOfId": null,
    "retriedById": null,
    "contentRetentionDays": 30,
    "contentRetentionUntil": "2026-10-22T06:00:00.000Z",
    "contentRetentionPolicyRevision": 1
  },
  "/targets/working-calendars/01934b10-0000-7000-8000-000000000101/2026": {
    "branchId": "01934b10-0000-7000-8000-000000000101",
    "calendarYear": 2026,
    "revision": 2,
    "workingDays": "10011101001111100111110011111001111100111110011111001111100111110011111001111100111110011111001111100111110011111001111100111110011111001111100111110011111001111100111110011111001101100111110011111001111100111110011111001111100111110011111001111100111110011111001111100111110011011001111100111110011111001111100111110011111001111100111110011111001111100111110011111",
    "publishedAt": "2026-01-05T08:00:00.000Z",
    "workdayStartMinute": 540,
    "workdayEndMinute": 1020,
    "timeZone": "Africa/Cairo",
    "windows": [
      {
        "windowNo": 1,
        "layer": 1,
        "validFrom": "2026-02-18",
        "validTo": "2026-03-19",
        "weekdayMask": 31,
        "startMinute": 540,
        "endMinute": 870,
        "label": "Ramadan hours"
      }
    ]
  },
  "/targets/working-calendars/01934b10-0000-7000-8000-000000000102/2026": {
    "branchId": "01934b10-0000-7000-8000-000000000102",
    "calendarYear": 2026,
    "revision": 1,
    "workingDays": "10011101001111100111110011111001111100111110011111001111100111110011111001111100111110011111001111100111110011111001111100111110011111001111100111110011111001111100111110011111001101100111110011111001111100111110011111001111100111110011111001111100111110011111001111100111110011011001111100111110011111001111100111110011111001111100111110011111001111100111110011111",
    "publishedAt": "2026-01-10T09:30:00.000Z",
    "workdayStartMinute": 540,
    "workdayEndMinute": 1020,
    "timeZone": "Africa/Cairo",
    "windows": []
  }
};
