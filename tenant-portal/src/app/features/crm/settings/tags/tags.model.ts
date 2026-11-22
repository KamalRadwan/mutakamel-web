export const MAX_TAGS = 500;
export const MAX_TAG_NAME_LENGTH = 60;
export const MAX_DETACH_LEADS = 100;
export const MIN_CONTRAST_RATIO = 4.5;

export interface Tag {
  id: string;
  name: string;
  backgroundColor: string | null;
  textColor: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTagInput {
  name: string;
  backgroundColor?: string | null;
  textColor?: string | null;
}

export interface UpdateTagInput {
  name?: string;
  backgroundColor?: string | null;
  textColor?: string | null;
}
