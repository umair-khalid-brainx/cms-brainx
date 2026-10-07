import { resolveContactFieldNames, type ContactFormField } from 'cms-blocks';
import type { Data } from '@puckeditor/core';
import type { EditorComponents } from '../puck/config';
import { ApiError, apiDelete, apiGet, apiSend } from './api';
import { getSession } from './auth';

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
  slug: string;
  title: string;
  path: string;
  status: PageStatus;
  archivedAt: string | null;
};

export type Page = PageSummary & {
  data: Data<EditorComponents>;
};

type FlatBlock = { type: string } & Record<string, unknown>;

type ContentRecord = {
  slug: string;
  title: string;
  path: string;
  status: PageStatus;
  blocks: FlatBlock[];
  archivedAt: string | null;
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
  return { type: puckType, props };
}

function blocksToPuckData(blocks: FlatBlock[]): Data<EditorComponents> {
  return { root: {}, content: blocks.map(blockToPuckItem) } as Data<EditorComponents>;
}

function puckDataToBlocks(data: Data<EditorComponents>): FlatBlock[] {
  return (data.content ?? []).map((item) => puckItemToBlock(item as { type: string; props: Record<string, unknown> }));
}

function toSummary(record: ContentRecord): PageSummary {
  return { slug: record.slug, title: record.title, path: record.path, status: record.status, archivedAt: record.archivedAt };
}

function requireSession() {
  const session = getSession();
  if (!session) throw new Error('Not authenticated');
  return session;
}

export async function listPages(): Promise<PageSummary[]> {
  const session = requireSession();
  const records = await apiGet<ContentRecord[]>('/content', session.accessToken);
  return records.map(toSummary);
}

export async function listArchivedPages(): Promise<PageSummary[]> {
  const session = requireSession();
  const records = await apiGet<ContentRecord[]>('/content/archived', session.accessToken);
  return records.map(toSummary);
}

export async function getPage(slug: string): Promise<Page | undefined> {
  const session = requireSession();
  try {
    const record = await apiGet<ContentRecord>(`/content/${slug}`, session.accessToken);
    return { ...toSummary(record), data: blocksToPuckData(record.blocks) };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return undefined;
    throw error;
  }
}

export async function saveDraft(slug: string, data: Data<EditorComponents>): Promise<void> {
  const session = requireSession();
  await apiSend('PATCH', `/content/${slug}`, { blocks: puckDataToBlocks(data) }, session.accessToken);
}

export async function publishPage(slug: string, data: Data<EditorComponents>): Promise<void> {
  const session = requireSession();
  await apiSend('PATCH', `/content/${slug}`, { blocks: puckDataToBlocks(data), status: 'published' }, session.accessToken);
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

// Used by both Dashboard's Quick Draft (title + body text, wrapped as one
// RichText block) and the "New Page" flow (title only, body '' -> no
// blocks, straight into an empty page in the editor).
export async function createPage(title: string, body = ''): Promise<PageSummary> {
  const session = requireSession();
  const blocks: FlatBlock[] = body.trim() ? [{ type: 'richText', html: `<p>${escapeHtml(body.trim())}</p>` }] : [];
  const record = await apiSend<ContentRecord>(
    'POST',
    '/content',
    { title: title.trim() || 'Untitled', blocks },
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

export async function deletePage(slug: string): Promise<void> {
  const session = requireSession();
  await apiDelete(`/content/${slug}`, session.accessToken);
}
