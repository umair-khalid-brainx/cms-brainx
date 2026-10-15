import { useEffect, useId, useState, type FormEvent } from 'react';
import { API_URL, ApiError } from '../lib/api';
import { BOTTOM_TEXT_MAX, PRESET_NAME_MAX, updatePreset, type ChromePreset } from '../lib/chromeApi';
import type { MenuLocation } from '../lib/menusApi';
import { FOOTER_NOTE_MAX, TAGLINE_MAX, getSiteDetails, updateSiteSettings } from '../lib/siteApi';
import MediaLibraryModal from './MediaLibraryModal';
import '../pages/SettingsPage.css';

type Draft = { name: string; tagline: string; logo: string; note: string; bottomText: string };

type Props = {
  location: MenuLocation;
  /** The saved header or footer being edited; null for the site's own. */
  preset: ChromePreset | null;
  canEdit: boolean;
  /** A saved one was changed (its new state), so the screen's list stays current. */
  onPresetSaved: (preset: ChromePreset) => void;
};

type Status = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved' } | { kind: 'error'; problems: string[] };

/** A library file's address as a browser can load it: the saved short form has no host. */
const fileSrc = (value: string): string => (value.startsWith('/') ? `${API_URL}${value}` : value);

/**
 * The words and picture of one header or footer, above its links: a header's tagline and logo, a footer's
 * note (beside the name) and bottom line (under the rule). It edits the site's own, or one saved header or
 * footer. Empty fields in a saved one fall back to the site's where the hints say so.
 */
function ChromeTextCard({ location, preset, canEdit, onPresetSaved }: Props) {
  const id = useId();
  const [saved, setSaved] = useState<Draft | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [picking, setPicking] = useState(false);
  const [brokenLogo, setBrokenLogo] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  // A different header or footer starts clean; saving this one must not clear its own "Saved" note.
  useEffect(() => {
    setStatus({ kind: 'idle' });
  }, [preset?.id, location]);

  useEffect(() => {
    let cancelled = false;
    if (preset) {
      const from: Draft = { name: preset.name, tagline: preset.tagline, logo: preset.logo, note: preset.note, bottomText: preset.bottomText };
      setSaved(from);
      setDraft(from);
      return;
    }
    getSiteDetails()
      .then((site) => {
        if (cancelled) return;
        const from: Draft = { name: '', tagline: site.tagline, logo: site.logo, note: site.footerNote, bottomText: site.footerBottom };
        setSaved(from);
        setDraft(from);
      })
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
    // Only a different set (or a freshly saved one) starts the fields over; the `preset` object itself changes on every save.
  }, [preset?.id, preset?.name, preset?.tagline, preset?.logo, preset?.note, preset?.bottomText, location]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loadError) {
    return (
      <p className="settings-error-note" role="alert">
        Couldn’t load the site’s settings. Reload the page to try again.
      </p>
    );
  }
  if (!saved || !draft) return <p className="settings-help">Loading…</p>;

  const header = location === 'header';
  const fields = (header ? ['tagline', 'logo'] : ['note', 'bottomText']) as (keyof Draft)[];
  const changed = (preset ? (['name', ...fields] as (keyof Draft)[]) : fields).some((key) => saved[key] !== draft[key]);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => current && { ...current, [key]: value });
    setStatus({ kind: 'idle' });
  };
  const busy = status.kind === 'saving';
  const disabled = !canEdit || busy;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || !changed || busy) return;
    setStatus({ kind: 'saving' });
    try {
      if (preset) {
        const next = await updatePreset(preset.id, header
          ? { name: draft.name, tagline: draft.tagline, logo: draft.logo }
          : { name: draft.name, note: draft.note, bottomText: draft.bottomText });
        onPresetSaved(next);
      } else {
        await updateSiteSettings(header ? { tagline: draft.tagline, logo: draft.logo } : { footerNote: draft.note, footerBottom: draft.bottomText });
        setSaved(draft);
      }
      setStatus({ kind: 'saved' });
    } catch (error) {
      if (error instanceof ApiError && (error.status === 400 || error.status === 409)) {
        const body = error.body as { message?: string | string[] } | null;
        setStatus({ kind: 'error', problems: Array.isArray(body?.message) ? body.message : [error.message] });
      } else {
        setStatus({ kind: 'error', problems: ['Couldn’t save. Check your connection and try again.'] });
      }
    }
  }

  return (
    <form className="settings-form chrome-text" onSubmit={submit} noValidate>
      {preset ? (
        <>
          <label htmlFor={`${id}-name`}>Name</label>
          <input id={`${id}-name`} value={draft.name} maxLength={PRESET_NAME_MAX} disabled={disabled} autoComplete="off" onChange={(event) => set('name', event.target.value)} />
          <p className="settings-help">Only you see this name. Pages pick this {location} by it.</p>
        </>
      ) : null}

      {header ? (
        <>
          <label htmlFor={`${id}-tagline`}>Tagline</label>
          <input id={`${id}-tagline`} value={draft.tagline} maxLength={TAGLINE_MAX} disabled={disabled} autoComplete="off" onChange={(event) => set('tagline', event.target.value)} />
          <p className="settings-help">Shown beside the name in the header. Leave empty for none.</p>

          <span className="settings-label" id={`${id}-logo-label`}>
            Logo
          </span>
          <div className="settings-logo-row" role="group" aria-labelledby={`${id}-logo-label`}>
            <span className="settings-logo-preview">
              {draft.logo && brokenLogo !== draft.logo ? (
                <img src={fileSrc(draft.logo)} alt="" onError={() => setBrokenLogo(draft.logo)} />
              ) : (
                <span className="settings-logo-empty">{draft.logo ? 'Can’t be loaded' : preset ? 'Site logo' : 'No logo'}</span>
              )}
            </span>
            {canEdit ? (
              <span className="settings-logo-actions">
                <button type="button" className="settings-secondary" disabled={busy} aria-label={draft.logo ? 'Change logo' : 'Choose logo from library'} onClick={() => setPicking(true)}>
                  {draft.logo ? 'Change' : 'Choose from library'}
                </button>
                {draft.logo ? (
                  <button type="button" className="settings-secondary" disabled={busy} aria-label="Remove logo" onClick={() => set('logo', '')}>
                    Remove
                  </button>
                ) : null}
              </span>
            ) : null}
          </div>
          {preset ? <p className="settings-help">With no logo of its own, this header uses the site’s logo.</p> : null}
        </>
      ) : (
        <>
          <label htmlFor={`${id}-note`}>Text beside the name</label>
          <textarea id={`${id}-note`} value={draft.note} maxLength={FOOTER_NOTE_MAX} rows={3} disabled={disabled} onChange={(event) => set('note', event.target.value)} />
          <p className="settings-help">A line or two under the site name, at the left of the footer. Leave empty for none.</p>

          <label htmlFor={`${id}-bottom`}>Bottom line</label>
          <input id={`${id}-bottom`} value={draft.bottomText} maxLength={BOTTOM_TEXT_MAX} disabled={disabled} autoComplete="off" onChange={(event) => set('bottomText', event.target.value)} />
          <p className="settings-help">
            The small text under the footer’s line. {'{year}'} becomes the current year. Left empty, it reads “© year, site title”
            {preset ? ' (or the site footer’s bottom line)' : ''}.
          </p>
        </>
      )}

      {canEdit ? (
        <button type="submit" className="settings-save" disabled={!changed || busy}>
          {busy ? 'Saving…' : `Save ${header ? 'header' : 'footer'} text`}
        </button>
      ) : null}
      {status.kind === 'saved' ? (
        <p className="settings-saved-note" role="status">
          Saved. {preset ? 'Every page using it shows the change now.' : 'Every page showing the site’s own shows it now.'}
        </p>
      ) : null}
      {status.kind === 'error' ? (
        <ul className="settings-error-note settings-error-list" role="alert">
          {status.problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      ) : null}

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
    </form>
  );
}

export default ChromeTextCard;
