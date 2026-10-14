import { useId, type ReactNode } from 'react';
import './SettingsSection.css';

type Props = {
  title: string;
  open: boolean;
  onToggle: () => void;
  /** Something in the group is edited and not yet saved. */
  unsaved?: boolean;
  /** One short line under the title while the group is shut: what is in it. */
  summary?: string;
  children: ReactNode;
};

/**
 * One collapsible group of Page settings (ADM-07). The body stays mounted while shut (`hidden`), so a
 * half-typed field survives a collapse; the header says "Unsaved" so a shut group can't hide an edit.
 * A plain button, not a <form> or <details>: the Puck field panel is one form (no nesting, Enter must not submit).
 */
function SettingsSection({ title, open, onToggle, unsaved = false, summary, children }: Props) {
  const id = useId();
  return (
    <section className="settings-section" data-open={open}>
      <h3 className="settings-section-heading">
        <button type="button" className="settings-section-toggle" aria-expanded={open} aria-controls={`${id}-body`} onClick={onToggle}>
          <svg className="settings-section-chevron" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="m7.5 5.5 4.5 4.5-4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="settings-section-text">
            <span className="settings-section-title">{title}</span>
            {!open && summary ? <span className="settings-section-summary">{summary}</span> : null}
          </span>
          {unsaved ? <span className="settings-section-unsaved">Unsaved</span> : null}
        </button>
      </h3>
      <div id={`${id}-body`} className="settings-section-body" hidden={!open}>
        {children}
      </div>
    </section>
  );
}

export default SettingsSection;
