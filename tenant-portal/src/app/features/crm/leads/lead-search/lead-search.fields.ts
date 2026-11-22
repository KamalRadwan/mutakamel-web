import { FieldOption, QueryField, rememberFieldOptions } from '../../../../shared/query-builder/query.model';
import { CARD_COLORS, CardColor, LeadProfileType, LeadStage, LeadStatus, LeadTag, StageFlag, nameIn } from '../leads.model';

export interface LeadSearchSourceOption {
  id: string;
  nameAr: string;
  nameEn: string;
  iconUrl?: string;
}

export interface LeadSearchFieldsContext {
  t: (k: string) => string;
  stages: LeadStage[];
  sources: LeadSearchSourceOption[];
  tags: LeadTag[] | null;
  owners: (term: string) => Promise<FieldOption[]>;
  ownerOptions?: FieldOption[];
  language: 'ar' | 'en';
}

const LEAD_TYPES: readonly LeadProfileType[] = ['INDIVIDUAL', 'CORPORATE'];
const STAGE_FLAGS: readonly StageFlag[] = [
  'NEW',
  'CONTACTED',
  'QUALIFYING',
  'QUALIFIED',
  'DISQUALIFIED',
  'CONVERTED',
  'NURTURING',
  'ON_HOLD',
];
const LEAD_STATUSES: readonly LeadStatus[] = ['OPEN', 'ON_HOLD', 'CONVERTED', 'DISQUALIFIED'];
const CARD_COLOR_ORDER: readonly CardColor[] = [
  'RED',
  'ORANGE',
  'AMBER',
  'YELLOW',
  'GREEN',
  'TEAL',
  'BLUE',
  'INDIGO',
  'PURPLE',
  'PINK',
  'SLATE',
];

const TEXT_SEARCH_IDS = ['lead', 'customer', 'email', 'phone'] as const;

const EN_LABELS: Record<string, string> = {
  'groups.contactAndText': 'Contact and text',
  'groups.classification': 'Classification',
  'groups.people': 'People',
  'groups.dates': 'Dates',
  'groups.activityAndTags': 'Activity and tags',
  'fields.lead': 'Lead name',
  'fields.customer': 'Contact name',
  'fields.email': 'Email',
  'fields.phone': 'Phone',
  'fields.tag': 'Tags',
  'fields.overdue': 'Overdue activity',
  'fields.leadType': 'Lead type',
  'fields.source': 'Source',
  'fields.stage': 'Stage',
  'fields.stageFlag': 'Stage meaning',
  'fields.status': 'Status',
  'fields.owner': 'Owner',
  'fields.createdBy': 'Created by',
  'fields.rating': 'Rating',
  'fields.cardColor': 'Card colour',
  'fields.createdAt': 'Created on',
  'fields.updatedAt': 'Updated on',
  'fields.convertedAt': 'Converted on',
  'fields.description': 'Description',
  'fields.interestSummary': 'Interest summary',
  'fields.expectedNeed': 'Expected need',
  'hints.lead': "Matches the lead's name and its notes.",
  'hints.customer': 'Matches the person or company name and linked contacts.',
  'hints.email': 'Matches any email of the lead or its contacts.',
  'hints.phone': 'Matches mobile and phone numbers, digits only.',
  'hints.tag': 'Leads with at least one of the chosen tags.',
  'hints.overdue': 'Yes = has an open activity past its due time. No = has no overdue activity (it may still have none at all).',
  'hints.leadType': 'Individual or company.',
  'hints.source': 'Where the lead came from.',
  'hints.stage': "The lead's current stage.",
  'hints.stageFlag': 'What the stage means, across all stage names.',
  'hints.status': 'Open, on hold, converted or disqualified.',
  'hints.owner': 'The person responsible. "Unassigned" leads are visible only to users who can see all leads.',
  'hints.createdBy': 'The person who added the lead.',
  'hints.rating': 'From 0 to 3 stars.',
  'hints.cardColor': 'The colour marked on the lead card.',
  'hints.createdAt': 'Dates use the workspace time zone.',
  'hints.updatedAt': 'Dates use the workspace time zone.',
  'hints.convertedAt': 'Dates use the workspace time zone.',
  'hints.description': 'Text search inside this note; can be slow on large lists.',
  'hints.interestSummary': 'Text search inside this note; can be slow on large lists.',
  'hints.expectedNeed': 'Text search inside this note; can be slow on large lists.',
  'leadTypes.INDIVIDUAL': 'Individual',
  'leadTypes.CORPORATE': 'Company',
  'stageFlags.NEW': 'New',
  'stageFlags.CONTACTED': 'Contacted',
  'stageFlags.QUALIFYING': 'Qualifying',
  'stageFlags.QUALIFIED': 'Qualified',
  'stageFlags.DISQUALIFIED': 'Disqualified',
  'stageFlags.CONVERTED': 'Converted',
  'stageFlags.NURTURING': 'Nurturing',
  'stageFlags.ON_HOLD': 'On hold',
  'statuses.OPEN': 'Open',
  'statuses.ON_HOLD': 'On hold',
  'statuses.CONVERTED': 'Converted',
  'statuses.DISQUALIFIED': 'Disqualified',
  'cardColors.RED': 'Red',
  'cardColors.ORANGE': 'Orange',
  'cardColors.AMBER': 'Amber',
  'cardColors.YELLOW': 'Yellow',
  'cardColors.GREEN': 'Green',
  'cardColors.TEAL': 'Teal',
  'cardColors.BLUE': 'Blue',
  'cardColors.INDIGO': 'Indigo',
  'cardColors.PURPLE': 'Purple',
  'cardColors.PINK': 'Pink',
  'cardColors.SLATE': 'Slate',
  'nullLabels.source.isNull': 'No source',
  'nullLabels.source.isNotNull': 'Has a source',
  'nullLabels.owner.isNull': 'Unassigned',
  'nullLabels.owner.isNotNull': 'Assigned',
  'nullLabels.createdBy.isNull': 'Unknown',
  'nullLabels.createdBy.isNotNull': 'Known',
  'nullLabels.cardColor.isNull': 'No colour',
  'nullLabels.cardColor.isNotNull': 'Has a colour',
  'nullLabels.convertedAt.isNull': 'Not converted',
  'nullLabels.convertedAt.isNotNull': 'Converted',
  textReplaces: 'Replaces the current text search.',
  me: 'Me',
};

const AR_LABELS: Record<string, string> = {
  'groups.contactAndText': 'الاتصال والنص',
  'groups.classification': 'التصنيف',
  'groups.people': 'الأشخاص',
  'groups.dates': 'التواريخ',
  'groups.activityAndTags': 'النشاط والوسوم',
  'fields.lead': 'اسم العميل المحتمل',
  'fields.customer': 'اسم جهة الاتصال',
  'fields.email': 'البريد الإلكتروني',
  'fields.phone': 'الهاتف',
  'fields.tag': 'الوسوم',
  'fields.overdue': 'نشاط متأخر',
  'fields.leadType': 'نوع العميل المحتمل',
  'fields.source': 'المصدر',
  'fields.stage': 'المرحلة',
  'fields.stageFlag': 'دلالة المرحلة',
  'fields.status': 'الحالة',
  'fields.owner': 'المسؤول',
  'fields.createdBy': 'أنشأه',
  'fields.rating': 'التقييم',
  'fields.cardColor': 'لون البطاقة',
  'fields.createdAt': 'تاريخ الإنشاء',
  'fields.updatedAt': 'تاريخ آخر تحديث',
  'fields.convertedAt': 'تاريخ التحويل',
  'fields.description': 'الوصف',
  'fields.interestSummary': 'ملخص الاهتمام',
  'fields.expectedNeed': 'الاحتياج المتوقع',
  'hints.lead': 'يطابق اسم العميل المحتمل وملاحظاته.',
  'hints.customer': 'يطابق اسم الشخص أو الشركة وجهات الاتصال المرتبطة.',
  'hints.email': 'يطابق أي بريد إلكتروني للعميل المحتمل أو لجهات اتصاله.',
  'hints.phone': 'يطابق أرقام الجوال والهاتف بالأرقام فقط.',
  'hints.tag': 'العملاء المحتملون الذين يحملون وسمًا واحدًا على الأقل من الوسوم المختارة.',
  'hints.overdue': 'نعم = لديه نشاط مفتوح تجاوز موعده، لا = ليس لديه نشاط متأخر (وقد لا يكون لديه أي نشاط).',
  'hints.leadType': 'فرد أو شركة.',
  'hints.source': 'الجهة التي جاء منها العميل المحتمل.',
  'hints.stage': 'المرحلة الحالية للعميل المحتمل.',
  'hints.stageFlag': 'دلالة المرحلة بغض النظر عن اسمها.',
  'hints.status': 'مفتوح أو معلّق أو محوَّل أو غير مؤهل.',
  'hints.owner': 'الشخص المسؤول، والعملاء المحتملون غير المُسندين لا يراهم إلا من يملك صلاحية عرض الجميع.',
  'hints.createdBy': 'الشخص الذي أضاف العميل المحتمل.',
  'hints.rating': 'من 0 إلى 3 نجوم.',
  'hints.cardColor': 'اللون المحدد على بطاقة العميل المحتمل.',
  'hints.createdAt': 'تعتمد التواريخ على المنطقة الزمنية لمساحة العمل.',
  'hints.updatedAt': 'تعتمد التواريخ على المنطقة الزمنية لمساحة العمل.',
  'hints.convertedAt': 'تعتمد التواريخ على المنطقة الزمنية لمساحة العمل.',
  'hints.description': 'بحث نصي داخل هذه الملاحظة، وقد يكون بطيئًا في القوائم الكبيرة.',
  'hints.interestSummary': 'بحث نصي داخل هذه الملاحظة، وقد يكون بطيئًا في القوائم الكبيرة.',
  'hints.expectedNeed': 'بحث نصي داخل هذه الملاحظة، وقد يكون بطيئًا في القوائم الكبيرة.',
  'leadTypes.INDIVIDUAL': 'فرد',
  'leadTypes.CORPORATE': 'شركة',
  'stageFlags.NEW': 'جديد',
  'stageFlags.CONTACTED': 'تم التواصل',
  'stageFlags.QUALIFYING': 'قيد التأهيل',
  'stageFlags.QUALIFIED': 'مؤهل',
  'stageFlags.DISQUALIFIED': 'غير مؤهل',
  'stageFlags.CONVERTED': 'تم التحويل',
  'stageFlags.NURTURING': 'قيد المتابعة',
  'stageFlags.ON_HOLD': 'معلّق',
  'statuses.OPEN': 'مفتوح',
  'statuses.ON_HOLD': 'معلّق',
  'statuses.CONVERTED': 'تم التحويل',
  'statuses.DISQUALIFIED': 'غير مؤهل',
  'cardColors.RED': 'أحمر',
  'cardColors.ORANGE': 'برتقالي',
  'cardColors.AMBER': 'كهرماني',
  'cardColors.YELLOW': 'أصفر',
  'cardColors.GREEN': 'أخضر',
  'cardColors.TEAL': 'أزرق مخضر',
  'cardColors.BLUE': 'أزرق',
  'cardColors.INDIGO': 'نيلي',
  'cardColors.PURPLE': 'بنفسجي',
  'cardColors.PINK': 'وردي',
  'cardColors.SLATE': 'رمادي مزرق',
  'nullLabels.source.isNull': 'بلا مصدر',
  'nullLabels.source.isNotNull': 'له مصدر',
  'nullLabels.owner.isNull': 'غير مُسند',
  'nullLabels.owner.isNotNull': 'مُسند',
  'nullLabels.createdBy.isNull': 'غير معروف',
  'nullLabels.createdBy.isNotNull': 'معروف',
  'nullLabels.cardColor.isNull': 'بلا لون',
  'nullLabels.cardColor.isNotNull': 'له لون',
  'nullLabels.convertedAt.isNull': 'لم يُحوَّل',
  'nullLabels.convertedAt.isNotNull': 'تم تحويله',
  textReplaces: 'يستبدل البحث النصي الحالي.',
  me: 'أنا',
};

function tr(ctx: LeadSearchFieldsContext, key: string): string {
  const scopedKey = `leadSearch.${key}`;
  const scoped = ctx.t(scopedKey);
  if (scoped && scoped !== scopedKey) return scoped;
  const direct = ctx.t(key);
  if (direct && direct !== key) return direct;
  const fallbacks = ctx.language === 'ar' ? AR_LABELS : EN_LABELS;
  return fallbacks[key] ?? key;
}

function exclusiveOtherTextSearches(id: (typeof TEXT_SEARCH_IDS)[number]): string[] {
  return TEXT_SEARCH_IDS.filter((item) => item !== id);
}

/** Build the 21 lead search field definitions (tags hidden when ctx.tags is null). */
export function leadSearchFields(ctx: LeadSearchFieldsContext): QueryField[] {
  const contactAndText = tr(ctx, 'groups.contactAndText');
  const classification = tr(ctx, 'groups.classification');
  const people = tr(ctx, 'groups.people');
  const dates = tr(ctx, 'groups.dates');
  const activityAndTags = tr(ctx, 'groups.activityAndTags');
  const meOption: FieldOption = { value: '$me', label: tr(ctx, 'me') };
  const textReplacesHint = tr(ctx, 'textReplaces');
  const ownerOptions = ctx.ownerOptions && ctx.ownerOptions.length > 0 ? ctx.ownerOptions : undefined;
  if (ownerOptions) {
    rememberFieldOptions('owner', ownerOptions);
    rememberFieldOptions('createdBy', ownerOptions);
  }

  const fields: QueryField[] = [
    {
      id: 'lead',
      label: tr(ctx, 'fields.lead'),
      kind: 'textSearch',
      hint: tr(ctx, 'hints.lead'),
      group: contactAndText,
      placement: 'root',
      singleton: true,
      exclusiveWith: exclusiveOtherTextSearches('lead'),
      maxLength: 200,
      inputMode: 'text',
      chip: true,
      chipHint: textReplacesHint,
    },
    {
      id: 'customer',
      label: tr(ctx, 'fields.customer'),
      kind: 'textSearch',
      hint: tr(ctx, 'hints.customer'),
      group: contactAndText,
      placement: 'root',
      singleton: true,
      exclusiveWith: exclusiveOtherTextSearches('customer'),
      maxLength: 200,
      inputMode: 'text',
    },
    {
      id: 'email',
      label: tr(ctx, 'fields.email'),
      kind: 'textSearch',
      hint: tr(ctx, 'hints.email'),
      group: contactAndText,
      placement: 'root',
      singleton: true,
      exclusiveWith: exclusiveOtherTextSearches('email'),
      maxLength: 200,
      inputMode: 'email',
      chip: true,
      chipHint: textReplacesHint,
    },
    {
      id: 'phone',
      label: tr(ctx, 'fields.phone'),
      kind: 'textSearch',
      hint: tr(ctx, 'hints.phone'),
      group: contactAndText,
      placement: 'root',
      singleton: true,
      exclusiveWith: exclusiveOtherTextSearches('phone'),
      maxLength: 200,
      inputMode: 'tel',
      chip: true,
      chipHint: textReplacesHint,
    },
  ];

  if (ctx.tags !== null) {
    fields.push({
      id: 'tag',
      label: tr(ctx, 'fields.tag'),
      kind: 'tags',
      hint: tr(ctx, 'hints.tag'),
      group: activityAndTags,
      placement: 'root',
      singleton: true,
      options: ctx.tags.map((tag) => ({ value: tag.id, label: tag.name })),
      chip: true,
    });
  }

  fields.push(
    {
      id: 'overdue',
      label: tr(ctx, 'fields.overdue'),
      kind: 'boolean',
      hint: tr(ctx, 'hints.overdue'),
      group: activityAndTags,
      placement: 'root',
      singleton: true,
    },
    {
      id: 'leadType',
      label: tr(ctx, 'fields.leadType'),
      kind: 'enum',
      hint: tr(ctx, 'hints.leadType'),
      group: classification,
      placement: 'tree',
      options: LEAD_TYPES.map((value) => ({ value, label: tr(ctx, `leadTypes.${value}`) })),
      chip: true,
    },
    {
      id: 'source',
      label: tr(ctx, 'fields.source'),
      kind: 'lookup',
      hint: tr(ctx, 'hints.source'),
      group: classification,
      placement: 'tree',
      nullable: true,
      nullLabels: {
        isNull: tr(ctx, 'nullLabels.source.isNull'),
        isNotNull: tr(ctx, 'nullLabels.source.isNotNull'),
      },
      options: ctx.sources.map((source) => ({
        value: source.id,
        label: nameIn(source, ctx.language),
        ...(source.iconUrl ? { icon: source.iconUrl } : {}),
      })),
      chip: true,
    },
    {
      id: 'stage',
      label: tr(ctx, 'fields.stage'),
      kind: 'lookup',
      hint: tr(ctx, 'hints.stage'),
      group: classification,
      placement: 'tree',
      options: [...ctx.stages]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((stage) => ({ value: stage.id, label: nameIn(stage, ctx.language) })),
      chip: true,
    },
    {
      id: 'stageFlag',
      label: tr(ctx, 'fields.stageFlag'),
      kind: 'enum',
      hint: tr(ctx, 'hints.stageFlag'),
      group: classification,
      placement: 'tree',
      options: STAGE_FLAGS.map((value) => ({ value, label: tr(ctx, `stageFlags.${value}`) })),
      chip: true,
    },
    {
      id: 'status',
      label: tr(ctx, 'fields.status'),
      kind: 'enum',
      hint: tr(ctx, 'hints.status'),
      group: classification,
      placement: 'tree',
      options: LEAD_STATUSES.map((value) => ({ value, label: tr(ctx, `statuses.${value}`) })),
      chip: true,
    },
    {
      id: 'owner',
      label: tr(ctx, 'fields.owner'),
      kind: 'lookup',
      hint: tr(ctx, 'hints.owner'),
      group: people,
      placement: 'tree',
      nullable: true,
      nullLabels: {
        isNull: tr(ctx, 'nullLabels.owner.isNull'),
        isNotNull: tr(ctx, 'nullLabels.owner.isNotNull'),
      },
      ...(ownerOptions ? { options: ownerOptions } : {}),
      searchOptions: ctx.owners,
      specialOptions: [meOption],
    },
    {
      id: 'createdBy',
      label: tr(ctx, 'fields.createdBy'),
      kind: 'lookup',
      hint: tr(ctx, 'hints.createdBy'),
      group: people,
      placement: 'tree',
      nullable: true,
      nullLabels: {
        isNull: tr(ctx, 'nullLabels.createdBy.isNull'),
        isNotNull: tr(ctx, 'nullLabels.createdBy.isNotNull'),
      },
      ...(ownerOptions ? { options: ownerOptions } : {}),
      searchOptions: ctx.owners,
      specialOptions: [meOption],
    },
    {
      id: 'rating',
      label: tr(ctx, 'fields.rating'),
      kind: 'rating',
      hint: tr(ctx, 'hints.rating'),
      group: classification,
      placement: 'tree',
      min: 0,
      max: 3,
    },
    {
      id: 'cardColor',
      label: tr(ctx, 'fields.cardColor'),
      kind: 'enum',
      hint: tr(ctx, 'hints.cardColor'),
      group: classification,
      placement: 'tree',
      nullable: true,
      nullLabels: {
        isNull: tr(ctx, 'nullLabels.cardColor.isNull'),
        isNotNull: tr(ctx, 'nullLabels.cardColor.isNotNull'),
      },
      options: CARD_COLOR_ORDER.map((value) => ({
        value,
        label: tr(ctx, `cardColors.${value}`),
        colorClass: CARD_COLORS[value],
      })),
    },
    {
      id: 'createdAt',
      label: tr(ctx, 'fields.createdAt'),
      kind: 'date',
      hint: tr(ctx, 'hints.createdAt'),
      group: dates,
      placement: 'tree',
    },
    {
      id: 'updatedAt',
      label: tr(ctx, 'fields.updatedAt'),
      kind: 'date',
      hint: tr(ctx, 'hints.updatedAt'),
      group: dates,
      placement: 'tree',
    },
    {
      id: 'convertedAt',
      label: tr(ctx, 'fields.convertedAt'),
      kind: 'date',
      hint: tr(ctx, 'hints.convertedAt'),
      group: dates,
      placement: 'tree',
      nullable: true,
      nullLabels: {
        isNull: tr(ctx, 'nullLabels.convertedAt.isNull'),
        isNotNull: tr(ctx, 'nullLabels.convertedAt.isNotNull'),
      },
    },
    {
      id: 'description',
      label: tr(ctx, 'fields.description'),
      kind: 'text',
      hint: tr(ctx, 'hints.description'),
      group: contactAndText,
      placement: 'tree',
      nullable: true,
      maxLength: 200,
    },
    {
      id: 'interestSummary',
      label: tr(ctx, 'fields.interestSummary'),
      kind: 'text',
      hint: tr(ctx, 'hints.interestSummary'),
      group: contactAndText,
      placement: 'tree',
      nullable: true,
      maxLength: 200,
    },
    {
      id: 'expectedNeed',
      label: tr(ctx, 'fields.expectedNeed'),
      kind: 'text',
      hint: tr(ctx, 'hints.expectedNeed'),
      group: contactAndText,
      placement: 'tree',
      nullable: true,
      maxLength: 200,
    },
  );

  return fields;
}
