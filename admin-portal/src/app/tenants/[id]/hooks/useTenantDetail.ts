"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/I18nContext";

export type TenantDetailTabKey = "details" | "subscriptions" | "wallet" | "fqdns" | "users" | "operations";

export interface WalletLedgerItem {
  id: string;
  txRef: string;
  direction: "CREDIT" | "DEBIT";
  reason: "MANUAL_CREDIT" | "MANUAL_DEBIT" | "SUBSCRIPTION_PAYMENT" | "DEPOSIT" | "REFUND" | "PRORATION_ADJUSTMENT";
  sourceAmount: number;
  sourceCurrencyCode: string;
  ratePerUsd: number;
  amountUsd: number;
  balanceAfterUsd: number;
  actorName: string;
  note: string;
  createdAt: string;
}

export function useTenantDetail(id: string) {
  const router = useRouter();
  const { t } = useI18n();

  const [activeTab, setActiveTab] = useState<TenantDetailTabKey>("details");
  const [isSaved, setIsSaved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Tenant Editing State
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // Modal / Drawer States
  const [isInviteUserOpen, setIsInviteUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false); // NEW
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isWebphoneConfigOpen, setIsWebphoneConfigOpen] = useState(false);
  const [isAddCreditOpen, setIsAddCreditOpen] = useState(false);
  const [isAddDebitOpen, setIsAddDebitOpen] = useState(false);
  const [isAddFqdnOpen, setIsAddFqdnOpen] = useState(false);
  const [isRoleAssignmentOpen, setIsRoleAssignmentOpen] = useState(false);
  const [isOperationDagOpen, setIsOperationDagOpen] = useState(false);

  // User Actions State
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  
  // FQDN States
  const [newFqdnInput, setNewFqdnInput] = useState("");
  
  // Destructive States
  const [destroySubscriptionsToggle, setDestroySubscriptionsToggle] = useState(false);
  const [selectedOperationId, setSelectedOperationId] = useState<string | null>(null);

  // Wallet Adjustment Form States
  const [adjAmount, setAdjAmount] = useState("");
  const [adjCurrency, setAdjCurrency] = useState("USD");
  const [adjNote, setAdjNote] = useState("");
  const [adjReason, setAdjReason] = useState<"MANUAL_CREDIT" | "MANUAL_DEBIT">("MANUAL_CREDIT");

  // Ledger Filters
  const [ledgerDirectionFilter, setLedgerDirectionFilter] = useState<string>("ALL");
  const [ledgerReasonFilter, setLedgerReasonFilter] = useState<string>("ALL");

  // Users Filters (NEW)
  const [userStatusFilter, setUserStatusFilter] = useState<string>("ALL");
  const [userRoleFilter, setUserRoleFilter] = useState<string>("ALL");
  const [showDeletedUsers, setShowDeletedUsers] = useState(false);

  // Mock Tenant Detail Record
  const [tenant, setTenant] = useState({
    id,
    expectedUpdatedAt: "2026-07-23T20:00:00.000Z",
    name: "acme-retail",
    code: "ACME-EG",
    companyName: "Acme Retail LLC",
    primaryFqdn: "acme-retail.mutakamel.ai",
    industry: "تجارة التجزئة والتجارة الإلكترونية",
    countryName: "مصر",
    countryIsoCode: "EG",
    timezone: "Africa/Cairo",
    phoneCountryCode: "+20",
    phone: "1001234567",
    taxNumber: "123-456-789",
    commercialRegistrationNumber: "CR-998877",
    status: "ACTIVE" as "ACTIVE" | "PROVISIONING" | "FAILED" | "SUSPENDED" | "DELETED",
    databaseServerName: "DB-PRIMARY-EG-01",
    databaseServerId: "srv-eg-01",
    createdAt: "2026-06-20 10:00:00",
    updatedAt: "2026-07-20 14:30:00",

    address: {
      street1: "123 كورنيش النيل",
      street2: "مبنى البنك التجاري",
      buildingNo: "12B",
      district: "حي المعادي",
      city: "القاهرة",
      state: "محافظة القاهرة",
      postalCode: "11511",
      landmark: "بجوار برج الكورنيش",
      formattedAddress: "12B كورنيش النيل، حي المعادي، القاهرة، مصر",
    },

    ownerEmail: "mona.ali@acme.test",
    ownerFirstName: "منى",
    ownerLastName: "علي",
    ownerJobTitle: "الرئيس التنفيذي",
  });

  const [editProfileData, setEditProfileData] = useState({
    companyName: tenant.companyName,
    industry: tenant.industry,
    taxNumber: tenant.taxNumber,
    commercialRegistrationNumber: tenant.commercialRegistrationNumber,
    phoneCountryCode: tenant.phoneCountryCode,
    phone: tenant.phone,
    address: { ...tenant.address },
  });

  // Mock Subscription Data
  const [subscription, setSubscription] = useState({
    id: "sub-9901",
    status: "ACTIVE",
    planName: "Enterprise Pro Suite",
    billingCycle: "MONTHLY",
    currencyCode: "USD",
    totalPrice: 400,
    allowedUsers: 50,
    startedAt: "2026-06-20",
    currentPeriodEnd: "2026-12-31",
    cancelAt: null as string | null,
    items: [
      { id: "item-1", moduleKey: "core", moduleName: "النواة الأساسية (Core)", tierKey: "enterprise", seats: 50, lineTotal: 150 },
      { id: "item-2", moduleKey: "crm", moduleName: "إدارة العملاء (CRM)", tierKey: "pro", seats: 50, lineTotal: 120 },
      { id: "item-3", moduleKey: "trade", moduleName: "محرك التجارة (Trade)", tierKey: "pro", seats: 50, lineTotal: 130 },
    ],
  });

  // Mock Wallet Data
  const [wallet, setWallet] = useState({
    id: "wal-8801",
    currencyCode: "USD",
    balanceUsd: 2500.0,
    reservedBalanceUsd: 150.0,
    availableBalanceUsd: 2350.0,
    lifetimeCreditUsd: 5000.0,
    lifetimeDebitUsd: 2500.0,
  });

  // Mock Wallet Ledger Entries
  const [ledger, setLedger] = useState<WalletLedgerItem[]>([
    { id: "led-101", txRef: "TX-99081", direction: "CREDIT", reason: "DEPOSIT", sourceAmount: 25000.0, sourceCurrencyCode: "EGP", ratePerUsd: 50.0, amountUsd: 500.0, balanceAfterUsd: 2500.0, actorName: "منى علي (Super Admin)", note: "إيداع محفظة عبر التحويل البنكي المباشر", createdAt: "2026-07-20 11:00:00" },
    { id: "led-102", txRef: "TX-99082", direction: "DEBIT", reason: "SUBSCRIPTION_PAYMENT", sourceAmount: 400.0, sourceCurrencyCode: "USD", ratePerUsd: 1.0, amountUsd: 400.0, balanceAfterUsd: 2100.0, actorName: "System Billing", note: "تجديد اشتراك باقة Enterprise Pro لشهر 7", createdAt: "2026-07-01 00:00:00" },
  ]);

  // Mock FQDNs
  const [fqdns, setFqdns] = useState([
    { id: "fqdn-1", domain: "acme-retail.mutakamel.ai", type: "PRIMARY", status: "VERIFIED", createdAt: "2026-06-20 10:00:00" },
    { id: "fqdn-2", domain: "portal.acme-retail.com", type: "SECONDARY", status: "VERIFIED", createdAt: "2026-06-22 14:00:00" },
    { id: "fqdn-3", domain: "app.acme.eg", type: "SECONDARY", status: "PENDING", createdAt: "2026-07-20 09:15:00" },
  ]);

  // Users Summary
  const usersSummary = {
    total: 24,
    invited: 2,
    active: 18,
    suspended: 2,
    deactivated: 1,
    deleted: 1,
    owners: 1,
    webphoneEnabled: 6,
  };

  // Mock Tenant Users
  const [tenantUsers, setTenantUsers] = useState<Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    jobTitle: string;
    status: string;
    isTenantOwner: boolean;
    lastLoginAt: string | null;
    roles: string[];
    departmentId: string;
    departmentName: string;
    webphoneEnabled: boolean;
    deletedAt: string | null;
  }>>([
    {
      id: "usr-01",
      email: "mona.ali@acme.test",
      firstName: "منى",
      lastName: "علي",
      jobTitle: "الرئيس التنفيذي",
      status: "ACTIVE",
      isTenantOwner: true,
      lastLoginAt: "2026-07-23 09:30:00",
      roles: ["Super Admin"],
      departmentId: "d-exec",
      departmentName: "الإدارة التنفيذية",
      webphoneEnabled: true,
      deletedAt: null as string | null,
    },
    {
      id: "usr-02",
      email: "samer.sales@acme.test",
      firstName: "سامر",
      lastName: "أحمد",
      jobTitle: "مدير مبيعات",
      status: "ACTIVE",
      isTenantOwner: false,
      lastLoginAt: "2026-07-22 15:45:00",
      roles: ["Sales Manager", "CRM User"],
      departmentId: "d-sales",
      departmentName: "المبيعات المركزية",
      webphoneEnabled: true,
      deletedAt: null,
    },
    {
      id: "usr-03",
      email: "omar.it@acme.test",
      firstName: "عمر",
      lastName: "محمود",
      jobTitle: "دعم فني",
      status: "SUSPENDED",
      isTenantOwner: false,
      lastLoginAt: "2026-06-30 11:20:00",
      roles: ["IT Support"],
      departmentId: "d-it",
      departmentName: "تقنية المعلومات",
      webphoneEnabled: false,
      deletedAt: null,
    },
    {
      id: "usr-04",
      email: "layla.hr@acme.test",
      firstName: "ليلى",
      lastName: "كمال",
      jobTitle: "موظف موارد بشرية",
      status: "INVITED",
      isTenantOwner: false,
      lastLoginAt: null,
      roles: ["HR Rep"],
      departmentId: "d-hr",
      departmentName: "الموارد البشرية",
      webphoneEnabled: false,
      deletedAt: null,
    },
    {
      id: "usr-05",
      email: "deleted.user@acme.test",
      firstName: "مستخدم",
      lastName: "محذوف",
      jobTitle: "مبيعات سابقة",
      status: "DELETED",
      isTenantOwner: false,
      lastLoginAt: "2026-01-10 10:00:00",
      roles: [],
      departmentId: "d-sales",
      departmentName: "المبيعات المركزية",
      webphoneEnabled: false,
      deletedAt: "2026-02-01 12:00:00",
    },
  ]);

  // Advanced User Filtering
  const filteredTenantUsers = tenantUsers.filter((u) => {
    if (!showDeletedUsers && u.deletedAt !== null) return false;
    if (userStatusFilter !== "ALL" && u.status !== userStatusFilter) return false;
    // Mock role filter logic
    if (userRoleFilter !== "ALL" && !u.roles.includes(userRoleFilter)) return false;
    return true;
  });

  // Mock Org Catalogues
  const mockBranches = [
    { id: "b-cairo", name: "الفرع الرئيسي - القاهرة", code: "CAI" },
    { id: "b-alex", name: "فرع الإسكندرية", code: "ALX" },
  ];
  const mockDepartments = [
    { id: "d-exec", name: "الإدارة التنفيذية", code: "EXEC", branchId: "b-cairo" },
    { id: "d-sales", name: "المبيعات المركزية", code: "SALES", branchId: "b-cairo" },
    { id: "d-it", name: "تقنية المعلومات", code: "IT", branchId: "b-cairo" },
    { id: "d-hr", name: "الموارد البشرية", code: "HR", branchId: "b-cairo" },
  ];
  const mockTeams = [
    { id: "t-b2b", name: "مبيعات الشركات", code: "B2B", departmentId: "d-sales" },
    { id: "t-b2c", name: "مبيعات التجزئة", code: "B2C", departmentId: "d-sales" },
  ];
  const mockRoles = [
    { id: "r-super", name: "Super Admin", description: "وصول كامل للنظام" },
    { id: "r-sales", name: "Sales Manager", description: "إدارة فريق المبيعات" },
    { id: "r-crm", name: "CRM User", description: "مستخدم لنظام العملاء" },
    { id: "r-hr", name: "HR Rep", description: "إدارة شؤون الموظفين" },
  ];

  // Mock Operations
  const [operations, setOperations] = useState([
    { id: "op-1", type: "TENANT_PROVISIONING", status: "COMPLETED", percent: 100, createdAt: "2026-06-20 10:00:00", completedAt: "2026-06-20 10:05:00" },
    { id: "op-2", type: "MODULE_ENABLEMENT", status: "COMPLETED", percent: 100, createdAt: "2026-06-21 09:00:00", completedAt: "2026-06-21 09:02:00" },
  ]);

  // Handlers
  const handleUpdateTenantProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await new Promise((res) => setTimeout(res, 600));
    setTenant({ ...tenant, ...editProfileData });
    setIsEditingProfile(false);
    setIsSubmitting(false);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleUpdateSubmit = async () => {
    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setIsSubmitting(false);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  // Lifecycle
  const handleActivate = () => setTenant({ ...tenant, status: "ACTIVE" });
  const handleSuspend = () => setTenant({ ...tenant, status: "SUSPENDED" });
  const handleDelete = () => setTenant({ ...tenant, status: "DELETED" });
  const handleDestroyConfirm = () => {
    // API Call to /admin/tenants/:id/destroy?destroySubscriptions=true|false
    router.push("/tenants"); // Destroy redirects to list
  };
  const handleCancelProvisioning = () => {
    setTenant({ ...tenant, status: "FAILED" });
  };
  const handleReprovision = () => {
    setTenant({ ...tenant, status: "PROVISIONING" });
  };

  // User Lifecycle
  const handleSuspendUser = (userId: string) => {
    setTenantUsers(prev => prev.map(u => u.id === userId ? { ...u, status: "SUSPENDED" } : u));
  };
  const handleActivateUser = (userId: string) => {
    setTenantUsers(prev => prev.map(u => u.id === userId ? { ...u, status: "ACTIVE" } : u));
  };
  const handleDeleteUser = (userId: string) => {
    setTenantUsers(prev => prev.map(u => u.id === userId ? { ...u, status: "DELETED", deletedAt: new Date().toISOString() } : u));
  };
  const handleRestoreUser = (userId: string) => {
    setTenantUsers(prev => prev.map(u => u.id === userId ? { ...u, status: "SUSPENDED", deletedAt: null } : u));
  };
  const handleResendInvite = (userId: string) => {
    // API Call: POST /users/:id/resend-invite
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  // FQDN
  const handleAddFqdnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFqdnInput) return;
    setFqdns([
      ...fqdns,
      { id: `fqdn-${Date.now()}`, domain: newFqdnInput, type: "SECONDARY", status: "PENDING", createdAt: new Date().toISOString() },
    ]);
    setNewFqdnInput("");
    setIsAddFqdnOpen(false);
  };

  const handleRemoveFqdn = (fqdnId: string) => {
    setFqdns(fqdns.filter((f) => f.id !== fqdnId));
  };

  const handleSetPrimaryFqdn = (fqdnId: string) => {
    setFqdns(prev => prev.map(f => ({
      ...f,
      type: f.id === fqdnId ? "PRIMARY" : "SECONDARY",
      status: f.id === fqdnId ? "VERIFIED" : f.status
    })));
  };

  // Wallet/Subscriptions
  const handleCancelSubscription = () => setSubscription({ ...subscription, status: "CANCELED" });

  const submitCreditAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    setIsAddCreditOpen(false);
  };

  const submitDebitAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    setIsAddDebitOpen(false);
  };

  return {
    t,
    tenant,
    setTenant,
    activeTab,
    setActiveTab,
    subscription,
    wallet,
    ledger,
    ledgerDirectionFilter,
    setLedgerDirectionFilter,
    ledgerReasonFilter,
    setLedgerReasonFilter,
    fqdns,
    usersSummary,
    tenantUsers: filteredTenantUsers,
    userStatusFilter,
    setUserStatusFilter,
    userRoleFilter,
    setUserRoleFilter,
    showDeletedUsers,
    setShowDeletedUsers,
    operations,
    isSubmitting,
    isSaved,
    setIsSaved,
    
    // Edit Profile
    isEditingProfile,
    setIsEditingProfile,
    editProfileData,
    setEditProfileData,
    handleUpdateTenantProfile,

    // Modals
    isInviteUserOpen,
    setIsInviteUserOpen,
    isEditUserOpen,
    setIsEditUserOpen,
    isResetPasswordOpen,
    setIsResetPasswordOpen,
    isChangePasswordOpen,
    setIsChangePasswordOpen,
    isWebphoneConfigOpen,
    setIsWebphoneConfigOpen,
    isAddCreditOpen,
    setIsAddCreditOpen,
    isAddDebitOpen,
    setIsAddDebitOpen,
    isAddFqdnOpen,
    setIsAddFqdnOpen,
    isRoleAssignmentOpen,
    setIsRoleAssignmentOpen,
    isOperationDagOpen,
    setIsOperationDagOpen,
    
    selectedUserId,
    setSelectedUserId,
    selectedOperationId,
    setSelectedOperationId,
    newFqdnInput,
    setNewFqdnInput,
    destroySubscriptionsToggle,
    setDestroySubscriptionsToggle,

    adjAmount,
    setAdjAmount,
    adjCurrency,
    setAdjCurrency,
    adjNote,
    setAdjNote,
    adjReason,
    setAdjReason,

    // Organization Catalogs
    mockBranches,
    mockDepartments,
    mockTeams,
    mockRoles,

    // Handlers
    handleUpdateSubmit,
    handleActivate,
    handleSuspend,
    handleDelete,
    handleDestroyConfirm,
    handleCancelProvisioning,
    handleReprovision,
    handleAddFqdnSubmit,
    handleRemoveFqdn,
    handleSetPrimaryFqdn,
    handleCancelSubscription,
    submitCreditAdjustment,
    submitDebitAdjustment,
    handleSuspendUser,
    handleActivateUser,
    handleDeleteUser,
    handleRestoreUser,
    handleResendInvite,
    onBack: () => router.push("/tenants"),
  };
}
