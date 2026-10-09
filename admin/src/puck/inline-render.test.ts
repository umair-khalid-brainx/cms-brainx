import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { config } from './config';

// In the canvas, Puck hands a block an editable node, not a string, for every
// field with `contentEditable: true` (BLK-07). TypeScript can't see this (the
// block types say `string`), so a block that uses such a prop as a string
// (an attribute, `.trim()`, a template literal) would only break in the editor.
// This renders every block that way.
type Component = {
  fields?: Record<string, { type: string; contentEditable?: boolean }>;
  defaultProps?: Record<string, unknown>;
  render: (props: Record<string, unknown>) => ReactElement;
};

const components = Object.entries(config.components) as [string, Component][];

// Blocks whose defaults render a placeholder instead of the real block.
const REAL_CONTENT: Record<string, Record<string, unknown>> = {
  VideoEmbed: { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
};

describe('blocks render with editable nodes in place of their text (BLK-07)', () => {
  it.each(components)('%s', (name, component) => {
    const props: Record<string, unknown> = { id: `${name}-test`, ...component.defaultProps, ...REAL_CONTENT[name] };
    const markers: string[] = [];
    for (const [field, def] of Object.entries(component.fields ?? {})) {
      if (!def.contentEditable) continue;
      const marker = `EDIT-${name}-${field}`;
      markers.push(marker);
      props[field] = createElement('span', { 'data-inline-field': field }, marker);
    }

    const html = renderToStaticMarkup(component.render(props));

    expect(html).not.toContain('[object Object]');
    // Each editable value must actually be drawn by the block, or it could
    // never be clicked on the canvas.
    for (const marker of markers) expect(html).toContain(marker);
  });
});
