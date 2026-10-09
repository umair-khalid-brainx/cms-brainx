import { documentKind } from '../lib/mediaApi'
import './FileTile.css'

// What a document looks like in the library, where an image would show its
// picture (MED-04): a page with a folded corner and the file's type written on
// it. The type is spelled out and the colour only groups, so nobody has to tell
// red from green to know which is the spreadsheet.
export function FileTile({ mimetype, size = 'card' }: { mimetype: string; size?: 'card' | 'large' }) {
  const { extension, label, tone } = documentKind(mimetype)
  return (
    <span className={`file-tile file-tile--${tone ?? 'plain'} file-tile--${size}`} role="img" aria-label={label}>
      <svg className="file-tile-page" viewBox="0 0 48 60" aria-hidden="true">
        <path d="M4 2h28l12 12v44H4z" />
        <path d="M32 2v12h12" />
      </svg>
      <span className="file-tile-ext" aria-hidden="true">
        {extension}
      </span>
    </span>
  )
}
