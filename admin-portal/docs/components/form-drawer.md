# Component Specification: `FormDrawer` (Slide-Over Sheet)

A standardized right-to-left / left-to-right sliding drawer for create and edit forms (Invite Admin User, Edit Admin User, Create Role, Add Tenant FQDN, Edit System Setting).

---

## ⚙️ Component API

```typescript
export interface FormDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  titleEn: string;
  titleAr: string;
  subtitleEn?: string;
  subtitleAr?: string;
  children: React.ReactNode;
  footerActions?: React.ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl'; // sm: 400px, md: 540px, lg: 720px
  isSubmitting?: boolean;
}
```

---

## 🎨 Features & Navigation

1. **Slide Animation**: Enters smoothly from the `end` edge (`end-0`), sliding out on close.
2. **Backdrop Blur**: Semi-transparent backdrop with backdrop blur (`backdrop-blur-sm bg-slate-900/40`).
3. **Dirty State Guard**: Displays warning dialog if user attempts to close the drawer while form fields have unsaved modifications.
