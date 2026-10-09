import { FieldLabel, type CustomFieldRender } from '@puckeditor/core'
import './ImageUploadField.css'

// A "date" field of a content type (TYP-02). The browser's own date picker gives
// a value like 2026-10-09, which is exactly what the API stores. Puck doesn't print a
// custom field's name, so the field wraps itself in Puck's own `FieldLabel`.
export const DateField: CustomFieldRender<string> = ({ field, value, onChange, readOnly }) => (
  <FieldLabel label={field.label ?? ''} readOnly={readOnly}>
    <div className="image-upload-field">
      <input
        type="date"
        className="image-upload-input"
        value={value ?? ''}
        disabled={readOnly}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  </FieldLabel>
)
