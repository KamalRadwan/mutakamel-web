export type CustomFieldType =
  | 'TEXT'
  | 'TEXTAREA'
  | 'NUMBER'
  | 'DATE'
  | 'DATETIME'
  | 'BOOLEAN'
  | 'SELECT'
  | 'MULTI_SELECT'
  | 'URL'
  | 'EMAIL'
  | 'PHONE';

export interface CustomFieldOption {
  key: string;
  nameAr: string;
  nameEn: string;
}

export interface CustomFieldDef {
  id: string;
  fieldKey: string;
  nameAr: string;
  nameEn: string;
  type: CustomFieldType;
  placeholderAr: string | null;
  placeholderEn: string | null;
  options: CustomFieldOption[];
  requiredOnCreate: boolean;
  requiredOnUpdate: boolean;
  sortOrder: number;
}
