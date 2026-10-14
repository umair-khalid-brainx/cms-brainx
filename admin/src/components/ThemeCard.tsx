import { useEffect, useId, useState, type FormEvent } from 'react'
import { getActiveMembership } from '../lib/activeSite'
import { SiteThemeRoot, type SiteTheme } from 'cms-blocks'
import { ApiError } from '../lib/api'
import { canManageSite } from '../lib/roles'
import { getSiteDetails, updateSiteTheme } from '../lib/siteApi'
import { readSiteTheme } from '../lib/siteTheme'
import {
  COLOUR_FIELDS,
  DENSITY_OPTIONS,
  SHAPE_OPTIONS,
  TEXTURE_OPTIONS,
  THEME_PRESETS,
  TYPE_SET_OPTIONS,
  contrastProblems,
  drawable,
  isHex,
  presetOf,
  sameTheme,
  type PaletteKey,
} from '../lib/themeEdit'
import ThemePreview from './ThemePreview'
import './ThemeCard.css'

type Status = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved' } | { kind: 'error'; problems: string[] }

type ChoiceKey = 'typeSet' | 'shape' | 'density' | 'texture'
const CHOICES: { key: ChoiceKey; legend: string; options: readonly { value: string; label: string; hint: string }[] }[] = [
  { key: 'typeSet', legend: 'Type', options: TYPE_SET_OPTIONS },
  { key: 'shape', legend: 'Corners', options: SHAPE_OPTIONS },
  { key: 'density', legend: 'Spacing', options: DENSITY_OPTIONS },
  { key: 'texture', legend: 'Texture', options: TEXTURE_OPTIONS },
]

/**
 * "Site Theme" on the Settings screen: the look every page of the public site wears. Start from a preset, then
 * change the type, corners, spacing, texture and the 8 colours; the preview redraws as you go, in the site's own
 * theme root, so what you see is what the site will be. The API checks it again and refuses a theme whose text
 * can't be read. Anyone can see it; only owners and administrators can change it.
 */
function ThemeCard() {
  const id = useId()
  const canEdit = canManageSite(getActiveMembership()?.role)
  const [siteName, setSiteName] = useState('')
  const [tagline, setTagline] = useState('')
  // `saved` is null for a site with no whole theme yet: the card starts from a preset and Save is open at once.
  const [saved, setSaved] = useState<SiteTheme | null>(null)
  const [draft, setDraft] = useState<SiteTheme | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  useEffect(() => {
    let cancelled = false
    getSiteDetails()
      .then((site) => {
        if (cancelled) return
        const theme = readSiteTheme(site.theme)
        setSiteName(site.name)
        setTagline(site.tagline)
        setSaved(theme)
        setDraft(theme ?? THEME_PRESETS[0].theme)
      })
      .catch(() => !cancelled && setLoadError(true))
    return () => {
      cancelled = true
    }
  }, [])

  if (loadError) {
    return (
      <section className="settings-card theme-card">
        <h2 className="settings-card-title">Site Theme</h2>
        <p className="settings-error-note" role="alert">
          Couldn’t load the site’s theme. Reload the page to try again.
        </p>
      </section>
    )
  }
  if (!draft) {
    return (
      <section className="settings-card theme-card">
        <h2 className="settings-card-title">Site Theme</h2>
        <p className="settings-help">Loading…</p>
      </section>
    )
  }

  const change = (next: SiteTheme) => {
    setDraft(next)
    setStatus({ kind: 'idle' })
  }
  const setChoice = (key: ChoiceKey, value: string) => change({ ...draft, [key]: value } as SiteTheme)
  const setColour = (key: PaletteKey, value: string) => change({ ...draft, palette: { ...draft.palette, [key]: value } })

  const badColours = COLOUR_FIELDS.filter(({ key }) => !isHex(draft.palette[key]))
  const problems = contrastProblems(draft)
  const changed = saved === null || !sameTheme(saved, draft)
  const busy = status.kind === 'saving'
  const canSave = canEdit && changed && badColours.length === 0 && problems.length === 0 && !busy
  const current = presetOf(draft)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft || !canSave) return
    setStatus({ kind: 'saving' })
    try {
      const site = await updateSiteTheme(draft)
      const theme = readSiteTheme(site.theme) ?? draft
      setSaved(theme)
      setDraft(theme)
      setStatus({ kind: 'saved' })
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        const body = error.body as { message?: string | string[] } | null
        setStatus({ kind: 'error', problems: Array.isArray(body?.message) ? body.message : [error.message] })
      } else if (error instanceof ApiError && error.status === 403) {
        setStatus({ kind: 'error', problems: ['Only owners and administrators can change the site’s theme.'] })
      } else {
        setStatus({ kind: 'error', problems: ['Couldn’t save. Check your connection and try again.'] })
      }
    }
  }

  return (
    <section className="settings-card theme-card">
      <h2 className="settings-card-title">Site Theme</h2>
      <div className="theme-layout">
        <form className="theme-controls" onSubmit={handleSubmit} noValidate>
          <fieldset className="theme-group" disabled={!canEdit || busy}>
            <legend>Start from a preset</legend>
            <div className="theme-presets">
              {THEME_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className="theme-preset"
                  aria-pressed={current?.id === preset.id}
                  onClick={() => change(preset.theme)}
                >
                  <span className="theme-preset-dots" aria-hidden="true">
                    {(['paper', 'ink', 'brand', 'accent'] as const).map((key) => (
                      <span key={key} style={{ background: preset.theme.palette[key] }} />
                    ))}
                  </span>
                  <span className="theme-preset-name">{preset.name}</span>
                  <span className="theme-preset-note">{preset.note}</span>
                </button>
              ))}
            </div>
          </fieldset>

          {CHOICES.map(({ key, legend, options }) => (
            <fieldset key={key} className="theme-group" disabled={!canEdit || busy}>
              <legend>{legend}</legend>
              <div className="theme-choices">
                {options.map((option) => (
                  <label key={option.value} className="theme-choice">
                    <input
                      type="radio"
                      name={`${id}-${key}`}
                      value={option.value}
                      checked={draft[key] === option.value}
                      onChange={() => setChoice(key, option.value)}
                    />
                    <span className="theme-choice-label">{option.label}</span>
                    <span className="theme-choice-hint">{option.hint}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}

          <fieldset className="theme-group" disabled={!canEdit || busy}>
            <legend>Colours</legend>
            <ul className="theme-colours">
              {COLOUR_FIELDS.map(({ key, label, hint }) => {
                const value = draft.palette[key]
                const valid = isHex(value)
                return (
                  <li key={key} className="theme-colour">
                    <input
                      type="color"
                      className="theme-colour-swatch"
                      aria-label={`${label}, pick a colour`}
                      value={valid ? value.toLowerCase() : (saved ?? THEME_PRESETS[0].theme).palette[key].toLowerCase()}
                      onChange={(event) => setColour(key, event.target.value.toUpperCase())}
                    />
                    <span className="theme-colour-text">
                      <label htmlFor={`${id}-${key}`}>{label}</label>
                      <span id={`${id}-${key}-hint`} className="theme-colour-hint">
                        {hint}
                      </span>
                    </span>
                    <input
                      id={`${id}-${key}`}
                      className="theme-colour-hex"
                      value={value}
                      maxLength={7}
                      spellCheck={false}
                      autoComplete="off"
                      aria-describedby={`${id}-${key}-hint`}
                      aria-invalid={!valid}
                      onChange={(event) => setColour(key, event.target.value.startsWith('#') ? event.target.value : `#${event.target.value}`)}
                    />
                  </li>
                )
              })}
            </ul>
          </fieldset>

          {badColours.length > 0 ? (
            <p className="settings-error-note" role="status">
              {badColours.map(({ label }) => label).join(', ')} {badColours.length === 1 ? 'needs' : 'need'} a full colour like #2E4A3E.
            </p>
          ) : null}
          {problems.length > 0 ? (
            <ul className="settings-error-note settings-error-list" role="status">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          ) : null}

          {saved === null ? (
            <p className="settings-help">This site has no theme yet, so it shows a plain default. Choose a look and save it.</p>
          ) : null}

          {canEdit ? (
            <div className="theme-actions">
              <button type="submit" className="settings-save" disabled={!canSave}>
                {busy ? 'Saving…' : 'Save Changes'}
              </button>
              {changed && saved ? (
                <button type="button" className="settings-secondary" disabled={busy} onClick={() => change(saved)}>
                  Discard
                </button>
              ) : null}
            </div>
          ) : (
            <p className="settings-help">Only owners and administrators can change the site’s theme.</p>
          )}

          {status.kind === 'saved' ? (
            <p className="settings-saved-note" role="status">
              Saved. Every page of your site wears the new theme now.
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

        <div className="theme-preview-pane">
          <p className="theme-preview-title" id={`${id}-preview`}>
            Preview {changed ? <span className="theme-unsaved">Not saved yet</span> : null}
          </p>
          <div className="theme-preview-frame" role="img" aria-labelledby={`${id}-preview`} aria-describedby={`${id}-preview-note`}>
            <SiteThemeRoot theme={drawable(draft, saved ?? THEME_PRESETS[0].theme)}>
              <ThemePreview name={siteName} tagline={tagline} />
            </SiteThemeRoot>
          </div>
          <p id={`${id}-preview-note`} className="settings-help">
            A sample page in your colours and type. Your own pages use the same theme.
          </p>
        </div>
      </div>
    </section>
  )
}

export default ThemeCard
