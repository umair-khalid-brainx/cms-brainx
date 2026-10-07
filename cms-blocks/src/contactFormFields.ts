import type { ContactFormField } from './types';

/**
 * Gives every contact form field a usable, unique `name` — the key its answer
 * is stored under (D-034). An empty name is made from the label ("Phone
 * number" → `phone_number`); a repeated name gets a number (`phone_2`).
 * Names the editor typed are kept, only trimmed. Run when a page is saved, so
 * the stored block always satisfies the API's "every field has a name".
 */
export function resolveContactFieldNames(fields: ContactFormField[]): ContactFormField[] {
  const taken = new Set<string>();
  return fields.map((field, index) => {
    const base = field.name.trim() || slugify(field.label) || `field_${index + 1}`;
    let name = base;
    for (let n = 2; taken.has(name); n++) name = `${base}_${n}`;
    taken.add(name);
    return { ...field, name };
  });
}

function slugify(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}
