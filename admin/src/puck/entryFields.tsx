import type { Config, Field } from '@puckeditor/core'
import { DateField } from '../components/DateField'
import { MediaField } from '../components/MediaField'
import { RichTextToolbar } from '../components/RichTextToolbar'
import type { ContentField } from '../lib/typesApi'
import { config, type EditorComponents, richTextOptions } from './config'

// An entry's custom fields (TYP-02) go in the editor's side panel, the one Puck
// shows when no block is selected. One editor for every type: the type only
// decides which fields that panel holds. The panel is built here from the type's
// field list, one Puck field per kind; the API checks every value again on save.

function fieldFor(field: ContentField): Field {
  const label = field.required ? `${field.label} (required)` : field.label
  switch (field.kind) {
    case 'text':
      return { type: 'text', label }
    case 'richText':
      return {
        type: 'richtext',
        label,
        options: richTextOptions,
        renderMenu: RichTextToolbar,
        initialHeight: 200,
      }
    case 'date':
      return { type: 'custom', label, render: DateField }
    case 'media':
      return { type: 'custom', label, render: MediaField }
    case 'select':
      return {
        type: 'select',
        label,
        // The empty choice lets a person clear it again.
        options: [{ label: '—', value: '' }, ...(field.options ?? []).map((option) => ({ label: option, value: option }))],
      }
    case 'link':
      return {
        type: 'object',
        label,
        objectFields: {
          label: { type: 'text', label: 'Link text' },
          href: { type: 'text', label: 'Link (URL or /path)' },
        },
      }
  }
}

/** The editor config for a page (no fields) or for an entry of a type with `fields`. */
export function configFor(fields: readonly ContentField[]): Config<EditorComponents> {
  const rootFields: Record<string, Field> = {}
  for (const field of fields) rootFields[field.key] = fieldFor(field)
  return { ...config, root: { ...config.root, fields: rootFields } } as Config<EditorComponents>
}
