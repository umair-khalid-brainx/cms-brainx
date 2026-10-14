import { useEffect, useId, useState, type FormEvent } from 'react';
import { getActiveMembership } from '../lib/activeSite'
import { API_URL, ApiError } from '../lib/api';
import { canManageSite } from '../lib/roles';
import {
  FOOTER_NOTE_MAX,
  SITE_NAME_MAX,
  TAGLINE_MAX,
  getSiteDetails,
  updateSiteSettings,
  type SiteDetails,
} from '../lib/siteApi';
import MediaLibraryModal from './MediaLibraryModal';

type Draft = Pick<SiteDetails, 'name' | 'tagline' | 'footerNote' | 'logo'>;

const toDraft = (site: SiteDetails): Draft => ({
  name: site.name,
  tagline: site.tagline,
  footerNote: site.footerNote,
  logo: site.logo,
});
const same = (a: Draft, b: Draft) =>
  a.name === b.name && a.tagline === b.tagline && a.footerNote === b.footerNote && a.logo === b.logo;

/** A library file's address as a browser can load it: the saved short form has no host. */
const fileSrc = (value: string): string => (value.startsWith('/') ? `${API_URL}${value}` : value);

type Status = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved' } | { kind: 'error'; problems: string[] };

/**
 * "Site Identity" on the Settings screen (GOV-04): the title, tagline, footer note and logo that
 * the public site's header and footer show. Saved through the API, which names every problem.
 * Anyone can see it; only owners and administrators can change it, as the API enforces.
 */
function SiteIdentityCard() {
  const id = useId();
  const canEdit = canManageSite(getActiveMembership()?.role);
  const [saved, setSaved] = useState<Draft | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [picking, setPicking] = useState(false);
  const [brokenLogo, setBrokenLogo] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  useEffect(() => {
    let cancelled = false;
    getSiteDetails()
      .then((site) => {
        if (cancelled) return;
        setSaved(toDraft(site));
        setDraft(toDraft(site));
      })
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  if (loadError) {
    return (
      <section className="settings-card">
        <h2 className="settings-card-title">Site Identity</h2>
        <p className="settings-error-note" role="alert">
          Couldn’t load the site’s settings. Reload the page to try again.
        </p>
      </section>
    );
  }
  if (!saved || !draft) {
    return (
      <section className="settings-card">
        <h2 className="settings-card-title">Site Identity</h2>
        <p className="settings-help">Loading…</p>
      </section>
    );
  }

  const changed = !same(saved, draft);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => current && { ...current, [key]: value });
    setStatus({ kind: 'idle' });
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || !changed || status.kind === 'saving') return;
    setStatus({ kind: 'saving' });
    try {
      const site = await updateSiteSettings(draft);
      setSaved(toDraft(site));
      setDraft(toDraft(site));
      setStatus({ kind: 'saved' });
    } catch (error) {
      // A 400 lists what it refused, one sentence each; anything else is a connection problem.
      if (error instanceof ApiError && error.status === 400) {
        const body = error.body as { message?: string | string[] } | null;
        setStatus({ kind: 'error', problems: Array.isArray(body?.message) ? body.message : [error.message] });
      } else if (error instanceof ApiError && error.status === 403) {
        setStatus({ kind: 'error', problems: ['Only owners and administrators can change the site’s identity.'] });
      } else {
        setStatus({ kind: 'error', problems: ['Couldn’t save. Check your connection and try again.'] });
      }
    }
  }

  const busy = status.kind === 'saving';

  return (
    <section className="settings-card">
      <h2 className="settings-card-title">Site Identity</h2>
      <form className="settings-form" onSubmit={handleSubmit} noValidate>
        <label htmlFor={`${id}-name`}>Site Title</label>
        <input
          id={`${id}-name`}
          value={draft.name}
          maxLength={SITE_NAME_MAX}
          disabled={!canEdit || busy}
          autoComplete="off"
          onChange={(event) => set('name', event.target.value)}
        />

        <label htmlFor={`${id}-tagline`}>Tagline</label>
        <input
          id={`${id}-tagline`}
          value={draft.tagline}
          maxLength={TAGLINE_MAX}
          disabled={!canEdit || busy}
          autoComplete="off"
          aria-describedby={`${id}-tagline-help`}
          onChange={(event) => set('tagline', event.target.value)}
        />
        <p id={`${id}-tagline-help`} className="settings-help">
          Shown beside the name in the header of your site.
        </p>

        <label htmlFor={`${id}-note`}>Footer note</label>
        <textarea
          id={`${id}-note`}
          value={draft.footerNote}
          maxLength={FOOTER_NOTE_MAX}
          rows={3}
          disabled={!canEdit || busy}
          aria-describedby={`${id}-note-help`}
          onChange={(event) => set('footerNote', event.target.value)}
        />
        <p id={`${id}-note-help`} className="settings-help">
          A line or two at the bottom of every page, under the name.
        </p>

        <span className="settings-label" id={`${id}-logo-label`}>
          Logo
        </span>
        <div className="settings-logo-row" role="group" aria-labelledby={`${id}-logo-label`}>
          <span className="settings-logo-preview">
            {draft.logo && brokenLogo !== draft.logo ? (
              <img src={fileSrc(draft.logo)} alt="" onError={() => setBrokenLogo(draft.logo)} />
            ) : (
              <span className="settings-logo-empty">{draft.logo ? 'Can’t be loaded' : 'No logo'}</span>
            )}
          </span>
          {canEdit ? (
            <span className="settings-logo-actions">
              <button
                type="button"
                className="settings-secondary"
                disabled={busy}
                // The visible words are inside the accessible name (WCAG 2.5.3), and the name says what it changes.
                aria-label={draft.logo ? 'Change logo' : 'Choose logo from library'}
                onClick={() => setPicking(true)}
              >
                {draft.logo ? 'Change' : 'Choose from library'}
              </button>
              {draft.logo ? (
                <button
                  type="button"
                  className="settings-secondary"
                  disabled={busy}
                  aria-label="Remove logo"
                  onClick={() => set('logo', '')}
                >
                  Remove
                </button>
              ) : null}
            </span>
          ) : null}
        </div>
        <p className="settings-help">
          Replaces the name in the header of your site. When a page is shared with no picture of its own, the logo is used.
        </p>

        {canEdit ? (
          <button type="submit" className="settings-save" disabled={!changed || busy}>
            {busy ? 'Saving…' : 'Save Changes'}
          </button>
        ) : (
          <p className="settings-help">Only owners and administrators can change the site’s identity.</p>
        )}

        {status.kind === 'saved' ? (
          <p className="settings-saved-note" role="status">
            Saved. Every page of your site shows the change now.
          </p>
        ) : null}
        {status.kind === 'error' ? (
          <ul className="settings-error-note settings-error-list" role="alert">
            {status.problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        ) : null}
      </form>

      {picking ? (
        <MediaLibraryModal
          noun="logo"
          onSelect={(url) => {
            set('logo', url);
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </section>
  );
}

export default SiteIdentityCard;
