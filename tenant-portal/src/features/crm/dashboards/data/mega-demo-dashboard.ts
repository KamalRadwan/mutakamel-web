import type { CrmDashboard, DashboardRunResult } from "../models/dashboard-types";

// Widget Definitions & Placements for the Mega Fake CRM Dashboard
export const megaDemoDashboard: CrmDashboard = {
  id: "mega-crm-dashboard",
  name: "لوحة التحليلات الشاملة وجميع الأشكال البيانية (Mega CRM Analytics)",
  description: "لوحة تحكم فائقة الأداء تضم كافة أنواع الأدوات والرسومات البيانية والمؤشرات لتقييم أداء CRM بكل تفاصيله",
  isFavorite: true,
  accessLevel: "EDIT",
  revision: 1,
  defaultFilters: {
    datePreset: "CURRENT_MONTH",
    compare: "PREVIOUS_PERIOD",
  },
  placements: [
    // --- ROW 1: METRIC CARDS (Height: 2, Width: 3 each) ---
    {
      id: "p-metric-1",
      dashboardId: "mega-crm-dashboard",
      widgetId: "w-metric-1",
      x: 0, y: 0, width: 3, height: 2,
      widget: {
        id: "w-metric-1",
        name: "إجمالي الإيرادات (Total Revenue)",
        visualizationType: "METRIC_CARD",
        querySpec: { series: [] },
        displaySpec: { numberFormat: "currency" },
      },
    },
    {
      id: "p-metric-2",
      dashboardId: "mega-crm-dashboard",
      widgetId: "w-metric-2",
      x: 3, y: 0, width: 3, height: 2,
      widget: {
        id: "w-metric-2",
        name: "الفرص البيعية النشطة (Active Deals)",
        visualizationType: "METRIC_CARD",
        querySpec: { series: [] },
        displaySpec: { numberFormat: "compact" },
      },
    },
    {
      id: "p-metric-3",
      dashboardId: "mega-crm-dashboard",
      widgetId: "w-metric-3",
      x: 6, y: 0, width: 3, height: 2,
      widget: {
        id: "w-metric-3",
        name: "معدل تحويل الفرص (Win Rate)",
        visualizationType: "METRIC_CARD",
        querySpec: { series: [] },
        displaySpec: { numberFormat: "percent" },
      },
    },
    {
      id: "p-metric-4",
      dashboardId: "mega-crm-dashboard",
      widgetId: "w-metric-4",
      x: 9, y: 0, width: 3, height: 2,
      widget: {
        id: "w-metric-4",
        name: "متوسط فترة الإغلاق (Avg Sales Cycle)",
        visualizationType: "METRIC_CARD",
        querySpec: { series: [] },
        displaySpec: { numberFormat: "compact" },
      },
    },

    // --- ROW 2: PROGRESS CARDS (Height: 2, Width: 6 each) ---
    {
      id: "p-prog-1",
      dashboardId: "mega-crm-dashboard",
      widgetId: "w-prog-1",
      x: 0, y: 2, width: 6, height: 2,
      widget: {
        id: "w-prog-1",
        name: "تحقيق هدف المبيعات الربع سنوي (Q3 Revenue Quota)",
        visualizationType: "PROGRESS_CARD",
        querySpec: { series: [] },
        displaySpec: { numberFormat: "compact" },
      },
    },
    {
      id: "p-prog-2",
      dashboardId: "mega-crm-dashboard",
      widgetId: "w-prog-2",
      x: 6, y: 2, width: 6, height: 2,
      widget: {
        id: "w-prog-2",
        name: "معدل استقطاب العملاء الجدد (Lead Gen Target)",
        visualizationType: "PROGRESS_CARD",
        querySpec: { series: [] },
        displaySpec: { numberFormat: "compact" },
      },
    },

    // --- ROW 3: MAIN CHARTS (Height: 4, Width: 6 each) ---
    {
      id: "p-line-1",
      dashboardId: "mega-crm-dashboard",
      widgetId: "w-line-1",
      x: 0, y: 4, width: 6, height: 4,
      widget: {
        id: "w-line-1",
        name: "مسار الإيرادات الشهرية 2025-2026 (Monthly Revenue Trend)",
        visualizationType: "LINE",
        querySpec: { series: [] },
        displaySpec: { title: "Monthly Revenue Trend" },
      },
    },
    {
      id: "p-combo-1",
      dashboardId: "mega-crm-dashboard",
      widgetId: "w-combo-1",
      x: 6, y: 4, width: 6, height: 4,
      widget: {
        id: "w-combo-1",
        name: "حجم الصفقة مقابل تحقيق Target (Sales Volume vs Target)",
        visualizationType: "COMBO",
        querySpec: { series: [] },
        displaySpec: { title: "Sales Volume vs Target" },
      },
    },

    // --- ROW 4: STACKED BAR & AREA (Height: 4, Width: 6 each) ---
    {
      id: "p-stacked-1",
      dashboardId: "mega-crm-dashboard",
      widgetId: "w-stacked-1",
      x: 0, y: 8, width: 6, height: 4,
      widget: {
        id: "w-stacked-1",
        name: "توزيع خط المبيعات حسب المناطق (Pipeline by Region)",
        visualizationType: "STACKED_BAR",
        querySpec: { series: [] },
        displaySpec: { title: "Pipeline Distribution" },
      },
    },
    {
      id: "p-area-1",
      dashboardId: "mega-crm-dashboard",
      widgetId: "w-area-1",
      x: 6, y: 8, width: 6, height: 4,
      widget: {
        id: "w-area-1",
        name: "النمو التراكمي في قاعدة المشتركين (Subscriber Growth)",
        visualizationType: "AREA",
        querySpec: { series: [] },
        displaySpec: { title: "Cumulative Subscribers" },
      },
    },

    // --- ROW 5: PIE, DONUT & 100% STACKED BAR (Height: 4, Width: 4 each) ---
    {
      id: "p-pie-1",
      dashboardId: "mega-crm-dashboard",
      widgetId: "w-pie-1",
      x: 0, y: 12, width: 4, height: 4,
      widget: {
        id: "w-pie-1",
        name: "الحصة السوقية حسب شرائح العملاء (Market Share)",
        visualizationType: "PIE",
        querySpec: { series: [] },
        displaySpec: { title: "Customer Segments" },
      },
    },
    {
      id: "p-donut-1",
      dashboardId: "mega-crm-dashboard",
      widgetId: "w-donut-1",
      x: 4, y: 12, width: 4, height: 4,
      widget: {
        id: "w-donut-1",
        name: "توزيع الإيرادات حسب خطة الاشتراك (Revenue by Plan)",
        visualizationType: "DONUT",
        querySpec: { series: [] },
        displaySpec: { title: "Subscription Plans" },
      },
    },
    {
      id: "p-stacked100-1",
      dashboardId: "mega-crm-dashboard",
      widgetId: "w-stacked100-1",
      x: 8, y: 12, width: 4, height: 4,
      widget: {
        id: "w-stacked100-1",
        name: "نسبة الفوز والخسارة حسب القطاع (Win/Loss % by Sector)",
        visualizationType: "STACKED_BAR_100",
        querySpec: { series: [] },
        displaySpec: { title: "Win/Loss Percentage" },
      },
    },

    // --- ROW 6: FUNNEL, COLUMN & BAR (Height: 4, Width: 4 each) ---
    {
      id: "p-funnel-1",
      dashboardId: "mega-crm-dashboard",
      widgetId: "w-funnel-1",
      x: 0, y: 16, width: 4, height: 4,
      widget: {
        id: "w-funnel-1",
        name: "مسار التحويل الكامل للعملاء (Sales Conversion Funnel)",
        visualizationType: "FUNNEL",
        querySpec: { series: [] },
        displaySpec: { title: "Conversion Funnel" },
      },
    },
    {
      id: "p-column-1",
      dashboardId: "mega-crm-dashboard",
      widgetId: "w-column-1",
      x: 4, y: 16, width: 4, height: 4,
      widget: {
        id: "w-column-1",
        name: "الصفقات المغلقة حسب المرحلة (Deals by Stage)",
        visualizationType: "COLUMN",
        querySpec: { series: [] },
        displaySpec: { title: "Closed Deals" },
      },
    },
    {
      id: "p-bar-1",
      dashboardId: "mega-crm-dashboard",
      widgetId: "w-bar-1",
      x: 8, y: 16, width: 4, height: 4,
      widget: {
        id: "w-bar-1",
        name: "الإيرادات حسب مصدر العملاء (Revenue by Lead Source)",
        visualizationType: "BAR",
        querySpec: { series: [] },
        displaySpec: { title: "Lead Source Breakdown" },
      },
    },

    // --- ROW 7: SCATTER & BUBBLE (Height: 4, Width: 6 each) ---
    {
      id: "p-scatter-1",
      dashboardId: "mega-crm-dashboard",
      widgetId: "w-scatter-1",
      x: 0, y: 20, width: 6, height: 4,
      widget: {
        id: "w-scatter-1",
        name: "حجم الصفقة vs طول دورة المبيعات (Deal Size vs Cycle)",
        visualizationType: "SCATTER",
        querySpec: { series: [] },
        displaySpec: { title: "Deal Size Correlation" },
      },
    },
    {
      id: "p-bubble-1",
      dashboardId: "mega-crm-dashboard",
      widgetId: "w-bubble-1",
      x: 6, y: 20, width: 6, height: 4,
      widget: {
        id: "w-bubble-1",
        name: "قيمة الحساب vs رضا العملاء (Account Value vs CSAT)",
        visualizationType: "BUBBLE",
        querySpec: { series: [] },
        displaySpec: { title: "Account Portfolio Analysis" },
      },
    },

    // --- ROW 8: LINE_AREA & HEATMAP (Height: 4, Width: 6 each) ---
    {
      id: "p-linearea-1",
      dashboardId: "mega-crm-dashboard",
      widgetId: "w-linearea-1",
      x: 0, y: 24, width: 6, height: 4,
      widget: {
        id: "w-linearea-1",
        name: "العملاء المحتملون vs العملاء المؤهلون (Leads vs MQLs)",
        visualizationType: "LINE_AREA",
        querySpec: { series: [] },
        displaySpec: { title: "Lead Generation Comparison" },
      },
    },
    {
      id: "p-heatmap-1",
      dashboardId: "mega-crm-dashboard",
      widgetId: "w-heatmap-1",
      x: 6, y: 24, width: 6, height: 4,
      widget: {
        id: "w-heatmap-1",
        name: "خريطة تفاعل العملاء خلال ساعات العمل (Engagement Heatmap)",
        visualizationType: "HEATMAP",
        querySpec: { series: [] },
        displaySpec: { title: "Activity Heatmap" },
      },
    },

    // --- ROW 9: GAUGES & SPEEDOMETERS (Height: 3, Width: 3 each) ---
    {
      id: "p-gauge-1",
      dashboardId: "mega-crm-dashboard",
      widgetId: "w-gauge-1",
      x: 0, y: 28, width: 3, height: 3,
      widget: {
        id: "w-gauge-1",
        name: "نسبة تحقيق المستهدف السنوي (Annual Quota)",
        visualizationType: "SEMI_CIRCLE_GAUGE",
        querySpec: { series: [] },
        displaySpec: { title: "Semi-Circle Gauge" },
      },
    },
    {
      id: "p-gauge-2",
      dashboardId: "mega-crm-dashboard",
      widgetId: "w-gauge-2",
      x: 3, y: 28, width: 3, height: 3,
      widget: {
        id: "w-gauge-2",
        name: "مؤشر رضا العملاء CSAT (Customer Satisfaction)",
        visualizationType: "THREE_QUARTER_GAUGE",
        querySpec: { series: [] },
        displaySpec: { title: "3/4 Gauge" },
      },
    },
    {
      id: "p-gauge-3",
      dashboardId: "mega-crm-dashboard",
      widgetId: "w-gauge-3",
      x: 6, y: 28, width: 3, height: 3,
      widget: {
        id: "w-gauge-3",
        name: "معدل الالتزام باتفاقية الخدمة (SLA Compliance)",
        visualizationType: "CIRCULAR_PROGRESS_GAUGE",
        querySpec: { series: [] },
        displaySpec: { title: "Circular Gauge" },
      },
    },
    {
      id: "p-gauge-4",
      dashboardId: "mega-crm-dashboard",
      widgetId: "w-gauge-4",
      x: 9, y: 28, width: 3, height: 3,
      widget: {
        id: "w-gauge-4",
        name: "سرعة تدفق المبيعات (Sales Velocity Index)",
        visualizationType: "DETAILED_SPEEDOMETER",
        querySpec: { series: [] },
        displaySpec: { title: "Speedometer" },
      },
    },

    // --- ROW 10: DATA TABLE & LEADERBOARD (Height: 5, Width: 8 & 4) ---
    {
      id: "p-table-1",
      dashboardId: "mega-crm-dashboard",
      widgetId: "w-table-1",
      x: 0, y: 31, width: 8, height: 5,
      widget: {
        id: "w-table-1",
        name: "قائمة أكبر الفرص البيعية النشطة (Top Deals Table)",
        visualizationType: "TABLE",
        querySpec: { series: [] },
        displaySpec: { title: "High Value Deals" },
      },
    },
    {
      id: "p-leaderboard-1",
      dashboardId: "mega-crm-dashboard",
      widgetId: "w-leaderboard-1",
      x: 8, y: 31, width: 4, height: 5,
      widget: {
        id: "w-leaderboard-1",
        name: "أفضل ممثلي المبيعات أداءً (Sales Leaderboard)",
        visualizationType: "LEADERBOARD",
        querySpec: { series: [] },
        displaySpec: { title: "Top Reps" },
      },
    },
  ],
};

// Rich Run Result containing detailed mock data for all 22 widgets
export const megaDemoRunResult: DashboardRunResult = {
  dashboardId: "mega-crm-dashboard",
  generatedAt: new Date().toISOString(),
  widgets: {
    // 1. Metric Cards
    "w-metric-1": {
      widgetId: "w-metric-1",
      shape: "SCALAR",
      value: 4850000,
      previousValue: 4240000,
      meta: { unit: "MONEY", currency: "USD" },
      series: [],
    },
    "w-metric-2": {
      widgetId: "w-metric-2",
      shape: "SCALAR",
      value: 1240,
      previousValue: 1142,
      meta: { unit: "COUNT" },
      series: [],
    },
    "w-metric-3": {
      widgetId: "w-metric-3",
      shape: "SCALAR",
      value: 68.4,
      previousValue: 65.3,
      meta: { unit: "PERCENT" },
      series: [],
    },
    "w-metric-4": {
      widgetId: "w-metric-4",
      shape: "SCALAR",
      value: 18,
      previousValue: 21,
      meta: { unit: "DURATION" },
      series: [],
    },

    // 2. Progress Cards
    "w-prog-1": {
      widgetId: "w-prog-1",
      shape: "SCALAR",
      value: 4850000,
      target: 6000000,
      meta: { unit: "MONEY", currency: "USD" },
      series: [],
    },
    "w-prog-2": {
      widgetId: "w-prog-2",
      shape: "SCALAR",
      value: 2150,
      target: 2500,
      meta: { unit: "COUNT" },
      series: [],
    },

    // 3. Line Chart (Monthly Revenue Trend)
    "w-line-1": {
      widgetId: "w-line-1",
      shape: "TIME_SERIES",
      series: [
        {
          key: "s-rev-2026",
          label: "2026 Revenue ($)",
          currency: "USD",
          points: [
            { key: "Jan", label: "Jan", value: 380000 },
            { key: "Feb", label: "Feb", value: 420000 },
            { key: "Mar", label: "Mar", value: 490000 },
            { key: "Apr", label: "Apr", value: 460000 },
            { key: "May", label: "May", value: 530000 },
            { key: "Jun", label: "Jun", value: 610000 },
            { key: "Jul", label: "Jul", value: 680000 },
            { key: "Aug", label: "Aug", value: 720000 },
            { key: "Sep", label: "Sep", value: 790000 },
            { key: "Oct", label: "Oct", value: 850000 },
            { key: "Nov", label: "Nov", value: 910000 },
            { key: "Dec", label: "Dec", value: 980000 },
          ],
        },
        {
          key: "s-rev-previous",
          label: "2025 Revenue ($)",
          currency: "USD",
          points: [
            { key: "Jan", label: "Jan", value: 310000 },
            { key: "Feb", label: "Feb", value: 350000 },
            { key: "Mar", label: "Mar", value: 390000 },
            { key: "Apr", label: "Apr", value: 400000 },
            { key: "May", label: "May", value: 440000 },
            { key: "Jun", label: "Jun", value: 500000 },
            { key: "Jul", label: "Jul", value: 520000 },
            { key: "Aug", label: "Aug", value: 580000 },
            { key: "Sep", label: "Sep", value: 620000 },
            { key: "Oct", label: "Oct", value: 670000 },
            { key: "Nov", label: "Nov", value: 710000 },
            { key: "Dec", label: "Dec", value: 760000 },
          ],
        },
      ],
    },

    // 4. Combo Chart (Sales Volume & Target)
    "w-combo-1": {
      widgetId: "w-combo-1",
      shape: "TIME_SERIES",
      series: [
        {
          key: "s-volume",
          label: "Actual Volume ($k)",
          currency: "USD",
          points: [
            { key: "Q1", label: "Q1", value: 1290 },
            { key: "Q2", label: "Q2", value: 1600 },
            { key: "Q3", label: "Q3", value: 2190 },
            { key: "Q4", label: "Q4", value: 2640 },
          ],
        },
        {
          key: "s-target",
          label: "Target Quota ($k)",
          axis: "RIGHT",
          currency: "USD",
          points: [
            { key: "Q1", label: "Q1", value: 1100 },
            { key: "Q2", label: "Q2", value: 1500 },
            { key: "Q3", label: "Q3", value: 2000 },
            { key: "Q4", label: "Q4", value: 2400 },
          ],
        },
      ],
    },

    // 5. Stacked Bar Chart (Pipeline by Region)
    "w-stacked-1": {
      widgetId: "w-stacked-1",
      shape: "CATEGORY",
      series: [
        {
          key: "s-enterprise",
          label: "Enterprise Solutions",
          points: [
            { key: "NA", label: "North America", value: 450000 },
            { key: "EU", label: "Europe", value: 380000 },
            { key: "ME", label: "Middle East (الشرق الأوسط)", value: 620000 },
            { key: "APAC", label: "Asia Pacific", value: 290000 },
          ],
        },
        {
          key: "s-midmarket",
          label: "Mid-Market Products",
          points: [
            { key: "NA", label: "North America", value: 280000 },
            { key: "EU", label: "Europe", value: 210000 },
            { key: "ME", label: "Middle East (الشرق الأوسط)", value: 410000 },
            { key: "APAC", label: "Asia Pacific", value: 180000 },
          ],
        },
        {
          key: "s-smb",
          label: "SMB Packages",
          points: [
            { key: "NA", label: "North America", value: 150000 },
            { key: "EU", label: "Europe", value: 130000 },
            { key: "ME", label: "Middle East (الشرق الأوسط)", value: 240000 },
            { key: "APAC", label: "Asia Pacific", value: 95000 },
          ],
        },
      ],
    },

    // 6. Area Chart (Subscriber Growth)
    "w-area-1": {
      widgetId: "w-area-1",
      shape: "TIME_SERIES",
      series: [
        {
          key: "s-subscribers",
          label: "Active SaaS Accounts",
          points: [
            { key: "Jan", label: "Jan", value: 1200 },
            { key: "Feb", label: "Feb", value: 1450 },
            { key: "Mar", label: "Mar", value: 1800 },
            { key: "Apr", label: "Apr", value: 2150 },
            { key: "May", label: "May", value: 2600 },
            { key: "Jun", label: "Jun", value: 3100 },
            { key: "Jul", label: "Jul", value: 3750 },
            { key: "Aug", label: "Aug", value: 4400 },
          ],
        },
      ],
    },

    // 7. Pie Chart (Market Share)
    "w-pie-1": {
      widgetId: "w-pie-1",
      shape: "CATEGORY",
      series: [
        {
          key: "s-segments",
          label: "Customer Tiers",
          points: [
            { key: "ent", label: "Enterprise (الشركات الكبرى)", value: 42 },
            { key: "mid", label: "Mid-Market (الشركات المتوسطة)", value: 28 },
            { key: "smb", label: "SMB (الأعمال الصغيرة)", value: 18 },
            { key: "gov", label: "Government (القطاع الحكومي)", value: 12 },
          ],
        },
      ],
    },

    // 8. Donut Chart (Revenue by Plan)
    "w-donut-1": {
      widgetId: "w-donut-1",
      shape: "CATEGORY",
      series: [
        {
          key: "s-plans",
          label: "Subscription Tiers",
          points: [
            { key: "plat", label: "Platinum Unlimited", value: 1850000 },
            { key: "gold", label: "Gold Enterprise", value: 1420000 },
            { key: "silver", label: "Silver Business", value: 980000 },
            { key: "bronze", label: "Bronze Starter", value: 600000 },
          ],
        },
      ],
    },

    // 9. 100% Stacked Bar (Win/Loss by Sector)
    "w-stacked100-1": {
      widgetId: "w-stacked100-1",
      shape: "CATEGORY",
      series: [
        {
          key: "s-won",
          label: "Deals Won (%)",
          points: [
            { key: "fin", label: "Banking & Finance", value: 78 },
            { key: "tech", label: "Technology", value: 72 },
            { key: "health", label: "Healthcare", value: 64 },
            { key: "retail", label: "Retail & Commerce", value: 55 },
          ],
        },
        {
          key: "s-lost",
          label: "Deals Lost (%)",
          points: [
            { key: "fin", label: "Banking & Finance", value: 22 },
            { key: "tech", label: "Technology", value: 28 },
            { key: "health", label: "Healthcare", value: 36 },
            { key: "retail", label: "Retail & Commerce", value: 45 },
          ],
        },
      ],
    },

    // 10. Funnel Chart (Conversion Funnel)
    "w-funnel-1": {
      widgetId: "w-funnel-1",
      shape: "CATEGORY",
      series: [
        {
          key: "s-funnel",
          label: "Sales Conversion Stages",
          points: [
            { key: "f1", label: "1. Lead Inquiries (10,000)", value: 10000 },
            { key: "f2", label: "2. Qualified MQLs (4,200)", value: 4200 },
            { key: "f3", label: "3. Demos & Proposals (1,850)", value: 1850 },
            { key: "f4", label: "4. Contract Negotiation (920)", value: 920 },
            { key: "f5", label: "5. Closed-Won Deals (640)", value: 640 },
          ],
        },
      ],
    },

    // 11. Column Chart (Deals by Stage)
    "w-column-1": {
      widgetId: "w-column-1",
      shape: "CATEGORY",
      series: [
        {
          key: "s-deals-stage",
          label: "Deal Count",
          points: [
            { key: "stg1", label: "Prospecting", value: 480 },
            { key: "stg2", label: "Qualification", value: 320 },
            { key: "stg3", label: "Proposal", value: 210 },
            { key: "stg4", label: "Negotiation", value: 140 },
            { key: "stg5", label: "Closed-Won", value: 390 },
          ],
        },
      ],
    },

    // 12. Bar Chart (Revenue by Lead Source)
    "w-bar-1": {
      widgetId: "w-bar-1",
      shape: "CATEGORY",
      series: [
        {
          key: "s-sources",
          label: "Revenue Contribution ($)",
          currency: "USD",
          points: [
            { key: "src1", label: "Direct Inbound", value: 1450000 },
            { key: "src2", label: "Partner Referrals", value: 1120000 },
            { key: "src3", label: "Outbound SDRs", value: 940000 },
            { key: "src4", label: "Events & Expos", value: 780000 },
            { key: "src5", label: "Organic Search / SEO", value: 560000 },
          ],
        },
      ],
    },

    // 13. Scatter Chart (Deal Size vs Cycle Duration)
    "w-scatter-1": {
      widgetId: "w-scatter-1",
      shape: "XY",
      series: [
        {
          key: "s-scatter-deals",
          label: "Enterprise Accounts",
          points: [
            { key: "d1", label: "Deal A", value: 120000, secondaryValue: 14 },
            { key: "d2", label: "Deal B", value: 250000, secondaryValue: 28 },
            { key: "d3", label: "Deal C", value: 85000, secondaryValue: 10 },
            { key: "d4", label: "Deal D", value: 420000, secondaryValue: 45 },
            { key: "d5", label: "Deal E", value: 190000, secondaryValue: 21 },
            { key: "d6", label: "Deal F", value: 310000, secondaryValue: 35 },
            { key: "d7", label: "Deal G", value: 500000, secondaryValue: 60 },
          ],
        },
      ],
    },

    // 14. Bubble Chart (Account Size vs CSAT vs Volume)
    "w-bubble-1": {
      widgetId: "w-bubble-1",
      shape: "XY",
      series: [
        {
          key: "s-bubbles",
          label: "Key Accounts Portfolio",
          points: [
            { key: "b1", label: "Saudi Telecom Co", value: 85, secondaryValue: 750000, size: 45 },
            { key: "b2", label: "Aramco Digital", value: 92, secondaryValue: 1200000, size: 65 },
            { key: "b3", label: "Neom Tech Hub", value: 88, secondaryValue: 950000, size: 55 },
            { key: "b4", label: "Al Rajhi Bank", value: 79, secondaryValue: 600000, size: 35 },
            { key: "b5", label: "Sabic Industries", value: 94, secondaryValue: 1100000, size: 60 },
          ],
        },
      ],
    },

    // 15. Line-Area Chart (Leads vs MQLs)
    "w-linearea-1": {
      widgetId: "w-linearea-1",
      shape: "TIME_SERIES",
      series: [
        {
          key: "s-total-leads",
          label: "Raw Inbound Leads",
          points: [
            { key: "W1", label: "Week 1", value: 650 },
            { key: "W2", label: "Week 2", value: 720 },
            { key: "W3", label: "Week 3", value: 810 },
            { key: "W4", label: "Week 4", value: 940 },
          ],
        },
        {
          key: "s-mqls",
          label: "Marketing Qualified MQLs",
          points: [
            { key: "W1", label: "Week 1", value: 380 },
            { key: "W2", label: "Week 2", value: 430 },
            { key: "W3", label: "Week 3", value: 510 },
            { key: "W4", label: "Week 4", value: 620 },
          ],
        },
      ],
    },

    // 16. Heatmap Chart (Engagement Activity)
    "w-heatmap-1": {
      widgetId: "w-heatmap-1",
      shape: "CATEGORY",
      series: [
        {
          key: "Sun", label: "Sun (الأحد)",
          points: [
            { key: "h9", label: "9 AM", value: 45 },
            { key: "h12", label: "12 PM", value: 80 },
            { key: "h15", label: "3 PM", value: 95 },
            { key: "h18", label: "6 PM", value: 30 },
          ],
        },
        {
          key: "Mon", label: "Mon (الإثنين)",
          points: [
            { key: "h9", label: "9 AM", value: 60 },
            { key: "h12", label: "12 PM", value: 110 },
            { key: "h15", label: "3 PM", value: 140 },
            { key: "h18", label: "6 PM", value: 50 },
          ],
        },
        {
          key: "Tue", label: "Tue (الثلاثاء)",
          points: [
            { key: "h9", label: "9 AM", value: 75 },
            { key: "h12", label: "12 PM", value: 130 },
            { key: "h15", label: "3 PM", value: 165 },
            { key: "h18", label: "6 PM", value: 55 },
          ],
        },
        {
          key: "Wed", label: "Wed (الأربعاء)",
          points: [
            { key: "h9", label: "9 AM", value: 70 },
            { key: "h12", label: "12 PM", value: 125 },
            { key: "h15", label: "3 PM", value: 150 },
            { key: "h18", label: "6 PM", value: 40 },
          ],
        },
      ],
    },

    // 17. Gauges & Speedometers
    "w-gauge-1": {
      widgetId: "w-gauge-1",
      shape: "SCALAR",
      value: 84.5,
      target: 100,
      meta: { unit: "PERCENT" },
      series: [],
    },
    "w-gauge-2": {
      widgetId: "w-gauge-2",
      shape: "SCALAR",
      value: 4.8,
      target: 5.0,
      meta: { unit: "SCORE" },
      series: [],
    },
    "w-gauge-3": {
      widgetId: "w-gauge-3",
      shape: "SCALAR",
      value: 94.2,
      target: 95.0,
      meta: { unit: "PERCENT" },
      series: [],
    },
    "w-gauge-4": {
      widgetId: "w-gauge-4",
      shape: "SCALAR",
      value: 142.8,
      target: 150,
      meta: { unit: "COUNT" },
      series: [],
    },

    // 18. Data Table
    "w-table-1": {
      widgetId: "w-table-1",
      shape: "ROWS",
      series: [],
      result: {
        shape: "ROWS",
        rowKind: "ALERT",
        partialAccess: false,
        rows: [
          {
            id: "t1",
            title: "مشروع التحديث الرقمي - البنك الأهلي ($850,000)",
            severity: "SUCCESS",
            reasonCode: "HIGH_VALUE_WIN",
            occurredAt: "2026-07-26T00:00:00.000Z",
            entityRef: { type: "OPPORTUNITY", id: "opp-1" },
          },
          {
            id: "t2",
            title: "منظومة الاتصالات السحابية - شركة موبايلي ($620,000)",
            severity: "WARNING",
            reasonCode: "NEGOTIATION_PENDING",
            occurredAt: "2026-07-25T00:00:00.000Z",
            entityRef: { type: "OPPORTUNITY", id: "opp-2" },
          },
          {
            id: "t3",
            title: "بوابة خدمات العملاء - وزارة الصحة ($1,200,000)",
            severity: "INFO",
            reasonCode: "PROPOSAL_SUBMITTED",
            occurredAt: "2026-07-24T00:00:00.000Z",
            entityRef: { type: "OPPORTUNITY", id: "opp-3" },
          },
          {
            id: "t4",
            title: "منصة الذكاء الاصطناعي - سدايا ($940,000)",
            severity: "SUCCESS",
            reasonCode: "CONTRACT_SIGNED",
            occurredAt: "2026-07-23T00:00:00.000Z",
            entityRef: { type: "OPPORTUNITY", id: "opp-4" },
          },
          {
            id: "t5",
            title: "حلول الأمن السيبراني - شركة علم ($430,000)",
            severity: "INFO",
            reasonCode: "QUALIFICATION_IN_PROGRESS",
            occurredAt: "2026-07-22T00:00:00.000Z",
            entityRef: { type: "OPPORTUNITY", id: "opp-5" },
          },
        ],
      },
    },

    // 19. Leaderboard
    "w-leaderboard-1": {
      widgetId: "w-leaderboard-1",
      shape: "ROWS",
      series: [],
      result: {
        shape: "ROWS",
        rowKind: "RANKED",
        rows: [
          {
            id: "l1",
            rank: 1,
            label: "أحمد بن يوسف Al-Youssef",
            primaryMeasure: { key: "sales", label: "Sales Volume", unit: "MONEY", currencyCode: "USD", value: 1850000 },
            secondaryMeasures: [],
          },
          {
            id: "l2",
            rank: 2,
            label: "سارة خالد Al-Khaled",
            primaryMeasure: { key: "sales", label: "Sales Volume", unit: "MONEY", currencyCode: "USD", value: 1420000 },
            secondaryMeasures: [],
          },
          {
            id: "l3",
            rank: 3,
            label: "محمد العتيبي Al-Otaibi",
            primaryMeasure: { key: "sales", label: "Sales Volume", unit: "MONEY", currencyCode: "USD", value: 1180000 },
            secondaryMeasures: [],
          },
          {
            id: "l4",
            rank: 4,
            label: "فاطمة الشمري Al-Shammari",
            primaryMeasure: { key: "sales", label: "Sales Volume", unit: "MONEY", currencyCode: "USD", value: 950000 },
            secondaryMeasures: [],
          },
          {
            id: "l5",
            rank: 5,
            label: "عمر الدوسري Al-Dossary",
            primaryMeasure: { key: "sales", label: "Sales Volume", unit: "MONEY", currencyCode: "USD", value: 820000 },
            secondaryMeasures: [],
          },
        ],
      },
    },
  },
};
