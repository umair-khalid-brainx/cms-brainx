import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { API_URL, ApiError } from '../lib/api';
import { updatePageSettings, type PageSummary } from '../lib/contentApi';
import { siteUrl } from '../data/site';
import {
  CANONICAL_MAX,
  DESCRIPTION_ADVICE,
  DESCRIPTION_MAX,
  EMPTY_SEO,
  TITLE_ADVICE,
  TITLE_MAX,
  lengthOf,
  sameSeo,
  searchTitle,
  socialDescription,
  socialTitle,
  type Length,
  type Seo,
} from '../lib/seo';
import MediaLibraryModal from './MediaLibraryModal';
import './PageSeoSection.css';

type Props = {
  page: PageSummary;
  siteName: string;
  onSaved: (page: PageSummary) => void;
  /** Said to screen readers when a save lands, in the panel's one live region. */
  announce: (message: string) => void;
  /** Reports whether the section holds an edit that isn't saved yet (the group header's "Unsaved" marker). */
  onDirty?: (dirty: boolean) => void;
};

/** A library file's address as a browser can load it: the saved short form has no host. */
const fileSrc = (value: string): string => (value.startsWith('/') ? `${API_URL}${value}` : value);

/**
 * "Search and sharing" in Page settings (SEO-01): what a search engine and a shared link
 * show for this page, with a preview of each and a count against the length they usually
 * show. Empty fields fall back to the page's own title and text on the public site, so a
 * page works without any of this. One save for the whole section.
 */
function PageSeoSection({ page, siteName, onSaved, announce, onDirty }: Props) {
  const id = useId();
  const [seo, setSeo] = useState<Seo>(page.seo);
  const sectionRef = useRef<HTMLDivElement>(null);
  const [picking, setPicking] = useState(false);
  // The picture that failed to load, so a deleted file shows a message instead of a broken icon.
  const [brokenImage, setBrokenImage] = useState('');
  const [saving, setSaving] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [failed, setFailed] = useState<string | null>(null);
  const changed = !sameSeo(seo, page.seo);
  useEffect(() => {
    onDirty?.(changed);
    return () => onDirty?.(false);
  }, [changed, onDirty]);

  // While the media picker is open, Esc closes it and not the whole panel around it: the key's
  // default is stopped, and so is the dialog's own cancel, which a browser can raise on its own.
  useEffect(() => {
    if (!picking) return;
    const dialog = sectionRef.current?.closest('dialog');
    const stopKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') event.preventDefault();
    };
    const stopCancel = (event: Event) => event.preventDefault();
    document.addEventListener('keydown', stopKey, true);
    dialog?.addEventListener('cancel', stopCancel);
    return () => {
      document.removeEventListener('keydown', stopKey, true);
      dialog?.removeEventListener('cancel', stopCancel);
    };
  }, [picking]);

  const set = <K extends keyof Seo>(key: K, value: Seo[K]) => {
    setSeo((current) => ({ ...current, [key]: value }));
    setProblems([]);
    setFailed(null);
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!changed || saving) return;
    setSaving(true);
    setProblems([]);
    setFailed(null);
    try {
      const saved = await updatePageSettings(page.slug, { seo });
      setSeo(saved.seo);
      announce('Search and sharing settings saved.');
      onSaved(saved);
    } catch (caught) {
      // The API names every field it refused; a 400's message is one sentence or a list of them.
      if (caught instanceof ApiError && caught.status === 400) {
        const body = caught.body as { message?: string | string[] } | null;
        setProblems(Array.isArray(body?.message) ? body.message : [caught.message]);
      } else {
        setFailed('Couldn’t save. Check your connection and try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  const address = siteUrl(page.path);
  const title = searchTitle(seo, page, siteName);
  const description = seo.metaDescription.trim();
  const shareTitle = socialTitle(seo, page, siteName);
  const shareDescription = socialDescription(seo);
  const host = (() => {
    try {
      return new URL(address).host;
    } catch {
      return address;
    }
  })();

  return (
    <div ref={sectionRef}>
      <p className="page-settings-hint seo-intro">
        What search engines and shared links show for this page. Anything left empty uses the page’s own title and text.
      </p>

      <form onSubmit={submit} noValidate>
        {/* What a search result will look like, updating as you type. */}
        <div className="seo-result" role="group" aria-label="Search result preview">
          <span className="seo-result-url">{address}</span>
          <span className="seo-result-title">{title}</span>
          <span className={description ? 'seo-result-text' : 'seo-result-text seo-muted'}>
            {description || 'No description. Search engines will pick text from the page.'}
          </span>
        </div>

        <Field id={`${id}-title`} label="Meta title" length={lengthOf(seo.metaTitle, TITLE_ADVICE)}>
          <input
            id={`${id}-title`}
            value={seo.metaTitle}
            maxLength={TITLE_MAX}
            placeholder={searchTitle(EMPTY_SEO, page, siteName)}
            autoComplete="off"
            aria-describedby={`${id}-title-count`}
            onChange={(event) => set('metaTitle', event.target.value)}
          />
        </Field>

        <Field id={`${id}-description`} label="Meta description" length={lengthOf(seo.metaDescription, DESCRIPTION_ADVICE)}>
          <textarea
            id={`${id}-description`}
            value={seo.metaDescription}
            rows={3}
            maxLength={DESCRIPTION_MAX}
            aria-describedby={`${id}-description-count`}
            onChange={(event) => set('metaDescription', event.target.value)}
          />
        </Field>

        <div className="seo-field">
          <label htmlFor={`${id}-canonical`}>Canonical address</label>
          <input
            id={`${id}-canonical`}
            type="url"
            value={seo.canonicalUrl}
            maxLength={CANONICAL_MAX}
            placeholder={address}
            autoComplete="off"
            spellCheck={false}
            aria-describedby={`${id}-canonical-hint`}
            onChange={(event) => set('canonicalUrl', event.target.value)}
          />
          <p id={`${id}-canonical-hint`} className="page-settings-hint">
            Only if another address is the main one for this content. Empty means this page’s own.
          </p>
        </div>

        <fieldset className="seo-share">
          <legend>When this page is shared</legend>

          {/* The card a link turns into on social networks and in messages. */}
          <div className="seo-card" role="group" aria-label="Shared link preview">
            {seo.ogImage && brokenImage !== seo.ogImage ? (
              <img className="seo-card-image" src={fileSrc(seo.ogImage)} alt="" onError={() => setBrokenImage(seo.ogImage)} />
            ) : (
              <span className="seo-card-image seo-card-empty">{seo.ogImage ? 'This picture can’t be loaded' : 'No picture'}</span>
            )}
            <span className="seo-card-body">
              <span className="seo-card-host">{host}</span>
              <span className="seo-card-title">{shareTitle}</span>
              {shareDescription ? <span className="seo-card-text">{shareDescription}</span> : null}
            </span>
          </div>

          <Field id={`${id}-og-title`} label="Social title" length={lengthOf(seo.ogTitle, TITLE_ADVICE)}>
            <input
              id={`${id}-og-title`}
              value={seo.ogTitle}
              maxLength={TITLE_MAX}
              placeholder={searchTitle(seo, page, siteName)}
              autoComplete="off"
              aria-describedby={`${id}-og-title-count`}
              onChange={(event) => set('ogTitle', event.target.value)}
            />
          </Field>

          <Field id={`${id}-og-description`} label="Social description" length={lengthOf(seo.ogDescription, DESCRIPTION_ADVICE)}>
            <textarea
              id={`${id}-og-description`}
              value={seo.ogDescription}
              rows={3}
              maxLength={DESCRIPTION_MAX}
              placeholder={seo.metaDescription}
              aria-describedby={`${id}-og-description-count`}
              onChange={(event) => set('ogDescription', event.target.value)}
            />
          </Field>

          <div className="seo-field">
            <span className="seo-label" id={`${id}-image-label`}>
              Social image
            </span>
            <div className="seo-image-row">
              <button
                type="button"
                className="page-settings-button"
                aria-label={seo.ogImage ? 'Change social image' : 'Choose social image'}
                onClick={() => setPicking(true)}
              >
                {seo.ogImage ? 'Change image' : 'Choose image'}
              </button>
              {seo.ogImage ? (
                <button
                  type="button"
                  className="page-settings-button page-settings-button-quiet"
                  onClick={() => set('ogImage', '')}
                >
                  Remove
                </button>
              ) : null}
            </div>
            <p className="page-settings-hint">From the media library. Empty uses the page’s featured image, if it has one.</p>
          </div>
        </fieldset>

        <label className="seo-check">
          <input type="checkbox" checked={seo.noindex} onChange={(event) => set('noindex', event.target.checked)} />
          <span>
            <strong>Hide this page from search engines</strong>
            <span className="page-settings-hint">It stays online for anyone with the link, and leaves the sitemap.</span>
          </span>
        </label>

        {problems.length > 0 ? (
          <ul className="page-settings-error seo-problems" role="alert">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        ) : null}
        {failed ? (
          <p className="page-settings-error" role="alert">
            {failed}
          </p>
        ) : null}

        <div className="page-settings-actions">
          <button type="submit" className="page-settings-button page-settings-button-primary" disabled={!changed || saving}>
            {saving ? 'Saving…' : 'Save search and sharing'}
          </button>
          {changed && !saving ? (
            <button type="button" className="page-settings-button page-settings-button-quiet" onClick={() => setSeo(page.seo)}>
              Undo changes
            </button>
          ) : null}
        </div>
      </form>

      {picking ? (
        <MediaLibraryModal
          noun="image"
          onSelect={(url) => {
            set('ogImage', url);
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </div>
  );
}

/** A label, its control, and a count against the length search engines usually show. */
function Field({ id, label, length, children }: { id: string; label: string; length: Length; children: ReactNode }) {
  return (
    <div className="seo-field">
      <label htmlFor={id}>{label}</label>
      {children}
      <p
        id={`${id}-count`}
        className={length.over ? 'page-settings-hint seo-count seo-count-over' : 'page-settings-hint seo-count'}
      >
        {length.count} of about {length.advice} characters
        {length.over ? '. Longer than search engines usually show; the end may be cut off.' : ''}
      </p>
    </div>
  );
}

export default PageSeoSection;
