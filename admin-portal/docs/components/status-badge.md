# Component Specification: `StatusBadge` (Lifecycle Status Badges)

The `StatusBadge` maps all backend status enums across the platform into consistent, accessible visual badge tones.

---

## 🎨 Unified Enum-to-Tone Mapping Matrix

| Backend Enum | Status Value | Tone / Color | Arabic Label | English Label |
|:---|:---|:---|:---|:---|
| **`TenantStatusEnum`** | `ACTIVE` | `green` | نشط | Active |
| | `PROVISIONING` | `blue` (animated pulse) | جاري التجهيز | Provisioning |
| | `PROVISIONING_FAILED` | `red` | فشل التجهيز | Provisioning Failed |
| | `SUSPENDED` | `amber` | معلق | Suspended |
| | `DELETED` | `neutral` | محذوف | Deleted |
| **`UserStatusEnum`** | `ACTIVE` | `green` | نشط | Active |
| | `INVITED` | `blue` | مدعو | Invited |
| | `SUSPENDED` | `amber` | معلق | Suspended |
| | `DEACTIVATED` | `neutral` | معطل | Deactivated |
| **`SubscriptionStatusEnum`** | `ACTIVE` | `green` | نشط | Active |
| | `TRIAL` | `blue` | تجريبي | Trial |
| | `PENDING_ACTIVATION` | `amber` | قيد التفعيل | Pending Activation |
| | `PAST_DUE` | `red` | متأخر الدفع | Past Due |
| | `CANCELLED` | `neutral` | ملغى | Cancelled |
| **`InvoiceStatusEnum`** | `PAID` | `green` | مدفوع | Paid |
| | `PARTIALLY_PAID` | `blue` | مدفوع جزئياً | Partially Paid |
| | `ISSUED` | `amber` | صادر | Issued |
| | `DRAFT` | `neutral` | مسودة | Draft |
| | `OVERDUE` | `red` | متأخر | Overdue |
| | `VOID` | `neutral` (line-through) | ملغى | Void |
| **`DatabaseServerStatusEnum`**| `ACTIVE` | `green` | نشط | Active |
| | `DRAINING` | `amber` | جاري التفريغ | Draining |
| | `OFFLINE` | `red` | غير متصل | Offline |
| | `DELETED` | `neutral` | محذوف | Deleted |

---

## ⚙️ Component API

```typescript
export interface StatusBadgeProps {
  status: string;
  enumType?: 'tenant' | 'user' | 'subscription' | 'invoice' | 'operation' | 'db-server';
  customLabelEn?: string;
  customLabelAr?: string;
  showDot?: boolean;
  size?: 'sm' | 'md';
}
```
