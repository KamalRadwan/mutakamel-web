# Component Specification: `ConfirmActionModal` (Action Confirmation Dialog)

A standardized modal dialog for confirming critical or destructive actions (Suspend User/Tenant, Delete User, Destroy Tenant, Void Invoice, Cancel Subscription).

---

## ⚙️ Component API

```typescript
export interface ConfirmActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  confirmTextEn?: string;
  confirmTextAr?: string;
  variant?: 'danger' | 'warning' | 'info';
  /** If set, user must type this exact string (e.g. tenant name) before confirm button enables */
  requiredConfirmationText?: string;
  isLoading?: boolean;
}
```

---

## 🎨 Features

1. **Typed Confirmation**: For irreversible destructive actions (e.g. Destroy Tenant), requires the operator to type the exact entity name before the confirm button is enabled.
2. **Keyboard Accessibility**: Supports `Escape` key to cancel and focus trapping inside the modal.
