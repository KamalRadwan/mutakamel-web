"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/I18nContext";
import { useToast } from "@/components/ui/ToastContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { buildUpdateTenantProfileDto } from "../../lib/tenant-profile-update";
import { sanitizeTenantStoragePlacement } from "../../lib/storage-placement";

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
  const { t, lang } = useI18n();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<TenantDetailTabKey>("details");
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

type LooseType = ReturnType<typeof JSON.parse>;

type TenantUser = LooseType;
type Fqdn = LooseType;
type Tenant = LooseType;
type Subscription = LooseType;
type Wallet = LooseType;

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [ledger, setLedger] = useState<WalletLedgerItem[]>([]);
  const [fqdns, setFqdns] = useState<Fqdn[]>([]);
  const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([]);
  const [operations, setOperations] = useState<LooseType[]>([]);
  const [editProfileData, setEditProfileData] = useState<LooseType>({});

  const [isLoadingDetails, setIsLoadingDetails] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchInitialData = async () => {
      try {
        setIsLoadingDetails(true);
        const [tenantRes, subRes, walletRes, fqdnRes, usersRes] = await Promise.allSettled([
          axiosClient.get(`/api/admin/core/v1/tenants/${id}`),
          axiosClient.get(`/api/admin/core/v1/tenants/${id}/subscription`),
          axiosClient.get(`/api/admin/core/v1/tenants/${id}/wallet`),
          axiosClient.get(`/api/admin/core/v1/tenants/${id}/fqdns`),
          axiosClient.get(`/api/admin/core/v1/tenants/${id}/users`)
        ]);

        if (!isMounted) return;

        if (tenantRes.status === "fulfilled" && tenantRes.value.data?.success) {
          const tenantData = sanitizeTenantStoragePlacement(
            tenantRes.value.data.data,
          );
          setTenant(tenantData);
          setEditProfileData({
            companyName: tenantData.companyName,
            industry: tenantData.industry,
            taxNumber: tenantData.taxNumber,
            commercialRegistrationNumber:
              tenantData.commercialRegistrationNumber,
            phoneCountryCode: tenantData.phoneCountryCode,
            phone: tenantData.phone,
            address: { ...((tenantData.address as object | null) || {}) },
          });
        }
        if (subRes.status === "fulfilled" && subRes.value.data?.success) {
          setSubscription(subRes.value.data.data);
        }
        if (walletRes.status === "fulfilled" && walletRes.value.data?.success) {
          setWallet(walletRes.value.data.data);
        }
        if (fqdnRes.status === "fulfilled" && fqdnRes.value.data?.success) {
          setFqdns(fqdnRes.value.data.data || []);
        }
        if (usersRes.status === "fulfilled" && usersRes.value.data?.success) {
          setTenantUsers(usersRes.value.data.data || []);
        }
      } catch (err) {
        console.error("Error loading tenant details:", err);
      } finally {
        if (isMounted) setIsLoadingDetails(false);
      }
    };
    fetchInitialData();
    return () => { isMounted = false; };
  }, [id]);

  useEffect(() => {
    if (activeTab === "wallet" && tenant) {
      axiosClient.get(`/api/admin/core/v1/tenants/${id}/wallet/ledger`).then(res => {
        if (res.data?.success) setLedger(res.data.data || []);
      }).catch(console.error);
    }
    if (activeTab === "operations" && tenant) {
      axiosClient.get(`/api/admin/core/v1/tenants/${id}/operations`).then(res => {
        if (res.data?.success) setOperations(res.data.data || []);
      }).catch(console.error);
    }
  }, [activeTab, id, tenant]);

  // Users Summary
  const usersSummary = {
    total: tenantUsers.length,
    invited: tenantUsers.filter((u) => u.status === "INVITED").length,
    active: tenantUsers.filter((u) => u.status === "ACTIVE").length,
    suspended: tenantUsers.filter((u) => u.status === "SUSPENDED").length,
    deactivated: tenantUsers.filter((u) => u.status === "DEACTIVATED").length,
    deleted: tenantUsers.filter((u) => u.deletedAt).length,
    owners: tenantUsers.filter((u) => u.isTenantOwner).length,
    webphoneEnabled: tenantUsers.filter((u) => u.webphoneEnabled).length,
  };

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


  // Handlers
  const handleUpdateTenantProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const updateDto = buildUpdateTenantProfileDto({
        ...editProfileData,
        updatedAt: tenant.updatedAt,
      });
      const res = await axiosClient.patch(
        `/api/admin/core/v1/tenants/${id}`,
        updateDto,
      );
      if (res.data?.success) {
        const tenantData = sanitizeTenantStoragePlacement(res.data.data);
        setTenant(tenantData);
        setEditProfileData({
          companyName: tenantData.companyName,
          industry: tenantData.industry,
          taxNumber: tenantData.taxNumber,
          commercialRegistrationNumber:
            tenantData.commercialRegistrationNumber,
          phoneCountryCode: tenantData.phoneCountryCode,
          phone: tenantData.phone,
          address: { ...((tenantData.address as object | null) || {}) },
        });
        toast.success(
          lang === "ar" ? "تم تحديث المستأجر" : "Tenant Updated",
          lang === "ar" ? "تم حفظ بيانات المستأجر بنجاح." : "Tenant details were saved successfully.",
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
      setIsEditingProfile(false);
    }
  };

  // Lifecycle
  const handleActivate = () => setTenant(tenant ? { ...tenant, status: "ACTIVE" } : null);
  const handleSuspend = () => setTenant(tenant ? { ...tenant, status: "SUSPENDED" } : null);
  const handleDelete = () => setTenant(tenant ? { ...tenant, status: "DELETED" } : null);
  const handleDestroyConfirm = () => {
    // API Call to /admin/tenants/:id/destroy?destroySubscriptions=true|false
    router.push("/tenants"); // Destroy redirects to list
  };
  const handleCancelProvisioning = () => {
    setTenant(tenant ? { ...tenant, status: "FAILED" } : null);
  };
  const handleReprovision = () => {
    setTenant(tenant ? { ...tenant, status: "PROVISIONING" } : null);
  };

  // User Lifecycle
  const handleSuspendUser = async (userId: string) => {
    try {
      await axiosClient.patch(`/api/admin/core/v1/tenants/${id}/users/${userId}/suspend`);
      setTenantUsers(prev => prev.map(u => u.id === userId ? { ...u, status: "SUSPENDED" } : u));
    } catch (err) { console.error(err); }
  };
  const handleActivateUser = async (userId: string) => {
    try {
      await axiosClient.patch(`/api/admin/core/v1/tenants/${id}/users/${userId}/activate`);
      setTenantUsers(prev => prev.map(u => u.id === userId ? { ...u, status: "ACTIVE" } : u));
    } catch (err) { console.error(err); }
  };
  const handleDeleteUser = async (userId: string) => {
    try {
      await axiosClient.delete(`/api/admin/core/v1/tenants/${id}/users/${userId}`);
      setTenantUsers(prev => prev.map(u => u.id === userId ? { ...u, status: "DELETED", deletedAt: new Date().toISOString() } : u));
    } catch (err) { console.error(err); }
  };
  const handleRestoreUser = async (userId: string) => {
    try {
      await axiosClient.patch(`/api/admin/core/v1/tenants/${id}/users/${userId}/restore`);
      setTenantUsers(prev => prev.map(u => u.id === userId ? { ...u, status: "SUSPENDED", deletedAt: null } : u));
    } catch (err) { console.error(err); }
  };
  const handleResendInvite = async (userId: string) => {
    try {
      await axiosClient.post(`/api/admin/core/v1/tenants/${id}/users/${userId}/resend-invite`);
      toast.success(
        lang === "ar" ? "تم إرسال الدعوة" : "Invitation Sent",
        lang === "ar" ? "تمت إعادة إرسال دعوة المستخدم." : "The user invitation was resent.",
      );
    } catch (err) { console.error(err); }
  };

  // FQDN
  const handleAddFqdnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFqdnInput) return;
    try {
      const res = await axiosClient.post(`/api/admin/core/v1/tenants/${id}/fqdns`, { domain: newFqdnInput });
      if (res.data?.success) {
        setFqdns([...fqdns, { id: res.data.data.id || `fqdn-${Date.now()}`, domain: newFqdnInput, type: "SECONDARY", status: "PENDING", createdAt: new Date().toISOString() }]);
        setNewFqdnInput("");
        setIsAddFqdnOpen(false);
      }
    } catch (err) { console.error(err); }
  };

  const handleRemoveFqdn = async (fqdnId: string) => {
    try {
      await axiosClient.delete(`/api/admin/core/v1/tenants/${id}/fqdns/${fqdnId}`);
      setFqdns(fqdns.filter((f) => f.id !== fqdnId));
    } catch (err) { console.error(err); }
  };

  const handleSetPrimaryFqdn = async (fqdnId: string) => {
    try {
      const res = await axiosClient.patch(`/api/admin/core/v1/tenants/${id}/fqdns/${fqdnId}/primary`);
      if (res.data?.success) {
        setFqdns(prev => prev.map(f => ({
          ...f,
          type: f.id === fqdnId ? "PRIMARY" : "SECONDARY",
          status: f.id === fqdnId ? "VERIFIED" : f.status
        })));
        toast.success(
          lang === "ar" ? "تم تحديث النطاق" : "Domain Updated",
          lang === "ar" ? "تم تعيين النطاق الأساسي بنجاح." : "The primary domain was updated successfully.",
        );
      }
    } catch (err) {
      console.error("Failed to set primary FQDN", err);
    }
  };

  // Wallet/Subscriptions
  const handleCancelSubscription = async () => {
    try {
      await axiosClient.post(`/api/admin/core/v1/tenants/${id}/subscription/cancel`);
      setSubscription(subscription ? { ...subscription, status: "CANCELED" } : null);
    } catch (err) { console.error(err); }
  };

  const submitCreditAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axiosClient.post(`/api/admin/core/v1/tenants/${id}/wallet/credit`, { amount: adjAmount, currency: adjCurrency, note: adjNote });
      setIsAddCreditOpen(false);
      toast.success(
        lang === "ar" ? "تمت إضافة الرصيد" : "Credit Added",
        lang === "ar" ? "تم تسجيل إضافة الرصيد بنجاح." : "The credit adjustment was recorded successfully.",
      );
    } catch (err) { console.error(err); }
  };

  const submitDebitAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axiosClient.post(`/api/admin/core/v1/tenants/${id}/wallet/debit`, { amount: adjAmount, currency: adjCurrency, note: adjNote });
      setIsAddDebitOpen(false);
      toast.success(
        lang === "ar" ? "تم خصم الرصيد" : "Debit Added",
        lang === "ar" ? "تم تسجيل خصم الرصيد بنجاح." : "The debit adjustment was recorded successfully.",
      );
    } catch (err) { console.error(err); }
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
    isLoadingDetails,
    operations,
    isSubmitting,

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
