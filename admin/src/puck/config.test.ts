import { describe, expect, it } from 'vitest';
import { config } from './config';

type Field = { type: string; contentEditable?: boolean; renderMenu?: unknown; renderInlineMenu?: unknown; options?: Record<string, unknown> };

const components = Object.entries(config.components).map(
  ([name, component]) => [name, (component as { fields?: Record<string, Field> }).fields ?? {}] as const,
);

// Top-level text that is deliberately NOT editable on the canvas (BLK-07):
// it is not text a visitor reads in a heading or paragraph.
const SIDEBAR_ONLY = new Set([
  'ContactForm.submitLabel', // the text inside a <button>, which can't be edited in place
  'VideoEmbed.url', // an address, never rendered as text
]);

describe('inline editing on the canvas (BLK-07)', () => {
  it('every top-level text field is editable in place, apart from the documented exceptions', () => {
    const missing: string[] = [];
    for (const [name, fields] of components) {
      for (const [field, def] of Object.entries(fields)) {
        const isText = def.type === 'text' || def.type === 'textarea' || def.type === 'richtext';
        if (isText && !def.contentEditable && !SIDEBAR_ONLY.has(`${name}.${field}`)) missing.push(`${name}.${field}`);
      }
    }
    // A new text field that isn't listed here is a mistake, not a decision: set
    // `contentEditable: true`, or add it to SIDEBAR_ONLY with a reason.
    expect(missing).toEqual([]);
  });

  it('the documented exceptions still exist, so the list cannot go stale', () => {
    const all = new Set(components.flatMap(([name, fields]) => Object.keys(fields).map((field) => `${name}.${field}`)));
    for (const entry of SIDEBAR_ONLY) expect(all.has(entry)).toBe(true);
  });
});

describe('rich text field (BLK-05, BLK-07)', () => {
  const html = (components.find(([name]) => name === 'RichText')?.[1] ?? {}).html;

  it('uses the same controls in the sidebar and on the canvas, and no unsupported ones', () => {
    expect(html?.type).toBe('richtext');
    expect(html?.renderMenu).toBeTypeOf('function');
    expect(html?.renderInlineMenu).toBeTypeOf('function');
  });

  it('switches off every extension the toolbar, the sanitiser and the requirements leave out', () => {
    for (const off of ['code', 'codeBlock', 'horizontalRule', 'strike', 'underline', 'textAlign']) {
      expect(html?.options?.[off]).toBe(false);
    }
  });
});
