import { apiDelete, apiGet, apiSend } from './api';
import { getSession } from './auth';

export type FieldKind = 'text' | 'richText' | 'date' | 'media' | 'select' | 'link';

/** One custom field of a content type. A new one has no `key` yet; the API makes it from the name. */
export type ContentField = {
  key: string;
  label: string;
  kind: FieldKind;
  required: boolean;
  options?: string[];
};

export type ContentFieldInput = Omit<ContentField, 'key'> & { key?: string };

export type ContentType = {
  id: string;
  /** Plural, shown in the sidebar: "Events". */
  name: string;
  /** For buttons: "Add Event". */
  singularName: string;
  /** The first part of every entry's address: `events` for /events/summer-fair. */
  prefix: string;
  isBuiltIn: boolean;
  fields: ContentField[];
  /** Entries that aren't archived. */
  entryCount: number;
  /** The address can't change: the type is built in or already has entries. */
  locked: boolean;
};

export type ContentTypeInput = { name: string; singularName: string; prefix: string; fields?: ContentFieldInput[] };

function requireToken(): string {
  const token = getSession()?.accessToken;
  if (!token) throw new Error('Not signed in');
  return token;
}

export function listContentTypes(): Promise<ContentType[]> {
  return apiGet('/content-types', requireToken());
}

export function createContentType(input: ContentTypeInput): Promise<ContentType> {
  return apiSend('POST', '/content-types', input, requireToken());
}

export function updateContentType(id: string, input: Partial<ContentTypeInput>): Promise<ContentType> {
  return apiSend('PATCH', `/content-types/${id}`, input, requireToken());
}

export function deleteContentType(id: string): Promise<void> {
  return apiDelete(`/content-types/${id}`, requireToken());
}
