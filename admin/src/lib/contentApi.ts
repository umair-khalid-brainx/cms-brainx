import { resolveContactFieldNames, type ContactFormField } from 'cms-blocks';
import type { Data } from '@puckeditor/core';
import { parseVideoUrl } from 'cms-blocks';
import type { EditorComponents } from '../puck/config';
import { ApiError, apiDelete, apiGet, apiSend } from './api';
import { getSession } from './auth';
import { readSeo, type Seo } from './seo';
import type { TermRef } from './terms';

// Replaces the old localStorage-backed pagesStore.ts (D-019) now that CNT-01
// is real: content lives in Postgres via `api`, reached over `/content`.
//
// Puck's native save shape (`{ type: 'Hero', props: { id, ...fields } }`) is
// never sent to or stored by the API — `content.blocks` stores the flat
// `{ type: 'hero', ...fields }` contract from cms-blocks/types.ts (invariant
// 7). Translating between the two shapes here, at the admin/API boundary, is
// exactly what D-015 already decided and documented; this is the first place
// that decision is actually implemented, not just planned.

export type PageStatus = 'draft' | 'published' | 'archived';

export type PageSummary = {
  id: string;
  /** Search and sharing settings (SEO-01). */
  seo: Seo;
  /** The page this one sits under (CNT-05); null at the top level and for entries. */
  parentId: string | null;
  slug: string;
  title: string;
  path: string;
  status: PageStatus;
  archivedAt: string | null;
  /** An entry's categories and tags, of the kinds its type uses (TAX-01); empty for pages. */
  categories: TermRef[];
  tags: TermRef[];
};

// What `GET /content/:slug/checks` and a refused publish (422) return —
// the rules themselves live only in the API (CNT-12, D-036).
export type PublishProblem = {
  blockIndex: number | null;
  blockType: string | null;
  blockLabel: string | null;
  field: string | null;
  message: string;
};

export type PublishChecks = { errors: PublishProblem[]; warnings: PublishProblem[] };

export type Page = PageSummary & {
  data: Data<EditorComponents>;
  /** The content type this is an entry of; null for an ordinary page (TYP-01). */
  typeId: string | null;
};

type FlatBlock = { type: string } & Record<string, unknown>;

type ContentRecord = {
  id: string;
  seo?: unknown;
  parentId: string | null;
  slug: string;
  title: string;
  path: string;
  status: PageStatus;
  blocks: FlatBlock[];
  archivedAt: string | null;
  typeId: string | null;
  /** Values of the type's custom fields, by key (TYP-02). */
  data: Record<string, unknown>;
  categories?: TermRef[];
  tags?: TermRef[];
};

function decapitalize(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// PricingTable is the one block whose editor-facing shape isn't a straight
// `Omit<Block, 'type'>` — see puck/config.tsx's PricingTableFields comment.
// Puck edits each feature as `{ text }` (no "array of plain strings" field);
// the stored contract wants `features: string[]`.
function plansToFlat(plans: unknown): unknown {
  if (!Array.isArray(plans)) return plans;
  return plans.map((plan) => {
    const { features, ...rest } = plan as { features: { text: string }[] };
    return { ...rest, features: features.map((f) => f.text) };
  });
}

function plansToPuck(plans: unknown): unknown {
  if (!Array.isArray(plans)) return plans;
  return plans.map((plan) => {
    const { features, ...rest } = plan as { features: string[] };
    return { ...rest, features: features.map((text) => ({ text })) };
  });
}

function puckItemToBlock(item: { type: string; props: Record<string, unknown> }): FlatBlock {
  const { id: _id, ...fields } = item.props;
  const type = decapitalize(item.type);
  if (item.type === 'PricingTable' && 'plans' in fields) {
    return { type, ...fields, plans: plansToFlat(fields.plans) };
  }
  if (item.type === 'VideoEmbed') {
    // The editor only holds the pasted link; the stored contract also carries
    // the parsed provider + ID the block renders from (D-040). An unparseable
    // link saves without them.
    const url = typeof fields.url === 'string' ? fields.url : '';
    return { type, ...fields, url, ...parseVideoUrl(url) };
  }
  // A field left without a name gets one from its label, so the live form
  // can always be submitted (the API refuses a form with a nameless field).
  if (item.type === 'ContactForm' && Array.isArray(fields.fields)) {
    return { type, ...fields, fields: resolveContactFieldNames(fields.fields as ContactFormField[]) };
  }
  return { type, ...fields };
}

function blockToPuckItem(block: FlatBlock): { type: string; props: Record<string, unknown> } {
  const { type, ...fields } = block;
  const puckType = capitalize(type);
  const props = { id: `${type}-${crypto.randomUUID()}`, ...fields };
  if (puckType === 'PricingTable' && 'plans' in props) {
    return { type: puckType, props: { ...props, plans: plansToPuck(props.plans) } };
  }
  if (puckType === 'VideoEmbed') {
    // Re-derived from `url` on every save, so not kept as editable props.
    const { provider: _provider, videoId: _videoId, ...editable } = fields as Record<string, unknown>;
    return { type: puckType, props: { id: props.id, ...editable } };
  }
  return { type: puckType, props };
}

// An entry's custom field values sit in Puck's root props, which is what the side
// panel edits when no block is selected (puck/entryFields.tsx).
function blocksToPuckData(blocks: FlatBlock[], values: Record<string, unknown> = {}): Data<EditorComponents> {
  return { root: { props: values }, content: blocks.map(blockToPuckItem) } as unknown as Data<EditorComponents>;
}

/** The custom field values in the editor's data, for the keys the type has. */
function fieldValues(data: Data<EditorComponents>, keys: readonly string[]): Record<string, unknown> {
  const props = ((data.root as { props?: Record<string, unknown> }).props ?? {}) as Record<string, unknown>;
  const values: Record<string, unknown> = {};
  for (const key of keys) if (key in props) values[key] = props[key];
  return values;
}

function puckDataToBlocks(data: Data<EditorComponents>): FlatBlock[] {
  return (data.content ?? []).map((item) => puckItemToBlock(item as { type: string; props: Record<string, unknown> }));
}

function toSummary(record: ContentRecord): PageSummary {
  return {
    id: record.id,
    seo: readSeo(record.seo),
    parentId: record.parentId,
    slug: record.slug,
    title: record.title,
    path: record.path,
    status: record.status,
    archivedAt: record.archivedAt,
    categories: record.categories ?? [],
    tags: record.tags ?? [],
  };
}

function requireSession() {
  const session = getSession();
  if (!session) throw new Error('Not authenticated');
  return session;
}

// With a content type's address prefix, the entries of that type instead of the
// pages (TYP-01): the two lists never overlap.
const typeQuery = (type?: string) => (type ? `?type=${encodeURIComponent(type)}` : '');

export async function listPages(type?: string): Promise<PageSummary[]> {
  const session = requireSession();
  const records = await apiGet<ContentRecord[]>(`/content${typeQuery(type)}`, session.accessToken);
  return records.map(toSummary);
}

export async function listArchivedPages(type?: string): Promise<PageSummary[]> {
  const session = requireSession();
  const records = await apiGet<ContentRecord[]>(`/content/archived${typeQuery(type)}`, session.accessToken);
  return records.map(toSummary);
}

export async function getPage(slug: string): Promise<Page | undefined> {
  const session = requireSession();
  try {
    const record = await apiGet<ContentRecord>(`/content/${slug}`, session.accessToken);
    return { ...toSummary(record), data: blocksToPuckData(record.blocks, record.data), typeId: record.typeId };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return undefined;
    throw error;
  }
}

// The blocks and the custom field values are saved by separate requests, so a value
// the API refuses (a half-typed link, say) never costs the person their blocks. A
// refused value comes back as a FieldValuesError with the API's own message.
export class FieldValuesError extends Error {}

export async function saveDraft(slug: string, data: Data<EditorComponents>, fieldKeys: readonly string[] = []): Promise<void> {
  const session = requireSession();
  await apiSend('PATCH', `/content/${slug}`, { blocks: puckDataToBlocks(data) }, session.accessToken);
  if (fieldKeys.length === 0) return;
  try {
    await apiSend('PATCH', `/content/${slug}`, { data: fieldValues(data, fieldKeys) }, session.accessToken);
  } catch (error) {
    if (error instanceof ApiError && error.status === 400) throw new FieldValuesError(error.message);
    throw error;
  }
}

export async function publishPage(slug: string, data: Data<EditorComponents>, fieldKeys: readonly string[] = []): Promise<void> {
  const session = requireSession();
  await apiSend(
    'PATCH',
    `/content/${slug}`,
    { blocks: puckDataToBlocks(data), status: 'published', ...(fieldKeys.length > 0 && { data: fieldValues(data, fieldKeys) }) },
    session.accessToken,
  );
}

export async function getPublishChecks(slug: string): Promise<PublishChecks> {
  const session = requireSession();
  return apiGet<PublishChecks>(`/content/${slug}/checks`, session.accessToken);
}

/** The problem list from a publish the API refused (422), or `null` for any other error. */
export function publishChecksFromError(error: unknown): PublishChecks | null {
  if (!(error instanceof ApiError) || error.status !== 422) return null;
  const body = error.body as Partial<PublishChecks> | null;
  if (!Array.isArray(body?.errors)) return null;
  return { errors: body.errors, warnings: Array.isArray(body.warnings) ? body.warnings : [] };
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

// Used by both Dashboard's Quick Draft (title + body text, wrapped as one
// RichText block) and the "New Page" flow (title only, body '' -> no
// blocks, straight into an empty page in the editor).
export type StarterLayout = { key: string; name: string; description: string; blocks: { type: string }[] };

/** The platform's four starter arrangements (TYP-05) offered when creating a page (TYP-04). */
export async function listStarterLayouts(): Promise<StarterLayout[]> {
  return apiGet('/starter-layouts', requireSession().accessToken);
}

export async function createPage(title: string, body = '', type?: string, layout?: string): Promise<PageSummary> {
  const session = requireSession();
  const blocks: FlatBlock[] = body.trim() ? [{ type: 'richText', html: `<p>${escapeHtml(body.trim())}</p>` }] : [];
  const record = await apiSend<ContentRecord>(
    'POST',
    '/content',
    { title: title.trim() || 'Untitled', blocks, ...(type && { type }), ...(layout && { layout }) },
    session.accessToken,
  );
  return toSummary(record);
}

// One call for every status move the pages list offers — publish, unpublish,
// archive and restore. The API decides what each move needs (D-032).
export async function setPageStatus(slug: string, status: PageStatus): Promise<PageSummary> {
  const session = requireSession();
  const record = await apiSend<ContentRecord>('PATCH', `/content/${slug}`, { status }, session.accessToken);
  return toSummary(record);
}

// A page's title and address, from the editor's Page settings (CNT-04). The API
// normalises the slug and refuses one that's taken or reserved, with a message
// for the person; the record that comes back has the slug actually saved.
export async function updatePageSettings(
  slug: string,
  changes: { title?: string; slug?: string; parentId?: string | null; seo?: Seo; categoryIds?: string[]; tags?: string[] },
): Promise<PageSummary> {
  const session = requireSession();
  const record = await apiSend<ContentRecord>('PATCH', `/content/${slug}`, changes, session.accessToken);
  return toSummary(record);
}

// The API decides the copy's slug (`<slug>-copy`, `-copy-2`, ...) and always
// makes it a draft (CNT-10).
export async function duplicatePage(slug: string): Promise<PageSummary> {
  const session = requireSession();
  const record = await apiSend<ContentRecord>('POST', `/content/${slug}/duplicate`, {}, session.accessToken);
  return toSummary(record);
}

// One preview link per page, no expiry, until revoked (CNT-09). The API
// returns only the token; where `web` serves it is admin's to know.
export type PreviewLink = { token: string; createdAt: string };

export async function getPreviewLink(slug: string): Promise<PreviewLink | null> {
  const session = requireSession();
  try {
    return await apiGet<PreviewLink>(`/content/${slug}/preview-link`, session.accessToken);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/** Creates the page's link, or returns the one it already has. */
export async function createPreviewLink(slug: string): Promise<PreviewLink> {
  const session = requireSession();
  return apiSend<PreviewLink>('POST', `/content/${slug}/preview-link`, {}, session.accessToken);
}

export async function revokePreviewLink(slug: string): Promise<void> {
  const session = requireSession();
  await apiDelete(`/content/${slug}/preview-link`, session.accessToken);
}

export async function deletePage(slug: string): Promise<void> {
  const session = requireSession();
  await apiDelete(`/content/${slug}`, session.accessToken);
}
