import { useEffect, useId, useState, type FormEvent } from 'react';
import { ApiError } from '../lib/api';
import { choiceOptions, listPresets, sameChrome, type ChromePreset, type PageChrome } from '../lib/chromeApi';
import { updatePageSettings, type PageSummary } from '../lib/contentApi';
import { Link } from '../lib/siteRouter';
import Select from './Select';

type Props = {
  page: PageSummary;
  /** "Page", or the entry's singular name ("Post"). */
  kind: string;
  onSaved: (page: PageSummary) => void;
  /** Said to screen readers when a save lands, in the panel's one live region. */
  announce: (message: string) => void;
  /** Reports whether the section holds an edit that isn't saved yet (the group header's "Unsaved" marker). */
  onDirty?: (dirty: boolean) => void;
};

/**
 * "Header and footer" in Page settings: for this page or post, keep the site's own header and footer, use
 * a saved one (made on the Menus screen, shared with every page that picks it), or show none. One save for
 * the section.
 */
function PageChromeSection({ page, kind, onSaved, announce, onDirty }: Props) {
  const id = useId();
  const [presets, setPresets] = useState<ChromePreset[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [chrome, setChrome] = useState<PageChrome>(page.chrome);
  const [saving, setSaving] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const changed = !sameChrome(chrome, page.chrome);

  useEffect(() => {
    onDirty?.(changed);
    return () => onDirty?.(false);
  }, [changed, onDirty]);

  useEffect(() => {
    let cancelled = false;
    listPresets()
      .then((list) => !cancelled && setPresets(list))
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const set = (part: keyof PageChrome, value: string) => {
    setChrome((current) => ({ ...current, [part]: value }));
    setProblems([]);
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!changed || saving) return;
    setSaving(true);
    setProblems([]);
    try {
      const saved = await updatePageSettings(page.slug, {
        // Only what was changed: a part still naming a since-deleted saved one must not block saving the other.
        chrome: Object.fromEntries((['header', 'footer'] as const).filter((part) => chrome[part] !== page.chrome[part]).map((part) => [part, chrome[part]])),
      });
      setChrome(saved.chrome);
      announce('Header and footer saved.');
      onSaved(saved);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 400) {
        const body = caught.body as { message?: string | string[] } | null;
        setProblems(Array.isArray(body?.message) ? body.message : [caught.message]);
      } else if (caught instanceof ApiError && caught.status === 409) {
        setProblems([caught.message]);
      } else {
        setProblems(['Couldn’t save. Check your connection and try again.']);
      }
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <p className="page-settings-error" role="alert">
        Couldn’t load the saved headers and footers. Close and reopen the settings to try again.
      </p>
    );
  }
  if (!presets) return <p className="page-settings-hint">Loading…</p>;

  return (
    <form onSubmit={submit} noValidate>
      <p className="page-settings-hint">
        Use the site’s own, one saved for reuse, or none at all on this {kind.toLowerCase()}.{' '}
        <Link to="/menus">Edit or add saved headers and footers</Link>
      </p>

      {(['header', 'footer'] as const).map((part) => (
        <div className="page-settings-field" key={part}>
          <label className="page-settings-label" htmlFor={`${id}-${part}`}>
            {part === 'header' ? 'Header' : 'Footer'}
          </label>
          <Select
            id={`${id}-${part}`}
            value={chrome[part]}
            onChange={(value) => set(part, value)}
            options={choiceOptions(presets, part)}
            // A saved one that was deleted since: shown as the site's own, which is what visitors get.
            placeholder="Site default"
          />
        </div>
      ))}

      {problems.length > 0 ? (
        <ul className="page-settings-error" role="alert">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      ) : null}

      <div className="page-settings-actions">
        <button type="submit" className="page-settings-button page-settings-button-primary" disabled={!changed || saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {changed ? (
          <button type="button" className="page-settings-button page-settings-button-quiet" onClick={() => setChrome(page.chrome)}>
            Undo changes
          </button>
        ) : null}
      </div>
    </form>
  );
}

export default PageChromeSection;
