import { useEffect, useId, useRef, type ReactNode } from 'react';
import type { PublishChecks, PublishProblem } from '../lib/contentApi';
import './PublishChecksPanel.css';

type Props = {
  checks: PublishChecks;
  /** Named in the title where the page isn't obvious from context (the Pages list). */
  pageTitle?: string;
  onClose: () => void;
  /** Offered only when there are warnings and no errors — warnings never block (CNT-12). */
  onPublishAnyway?: () => void;
  /** Extra action, e.g. a link to the editor from the Pages list. */
  children?: ReactNode;
};

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

function where(problem: PublishProblem): string {
  if (problem.blockIndex === null) return 'Page';
  const label = problem.blockLabel ?? 'Unknown block';
  return `${label}, block ${problem.blockIndex + 1}`;
}

function ProblemList({ problems, kind }: { problems: PublishProblem[]; kind: 'error' | 'warning' }) {
  return (
    <ul className="publish-checks-list">
      {problems.map((problem) => (
        <li key={`${problem.blockIndex}-${problem.field}-${problem.message}`} className={`publish-checks-item publish-checks-item-${kind}`}>
          <svg className="publish-checks-icon" viewBox="0 0 16 16" aria-hidden="true">
            {kind === 'error' ? (
              <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm2.8 8.8-1 1L8 9l-1.8 1.8-1-1L7 8 5.2 6.2l1-1L8 7l1.8-1.8 1 1L9 8l1.8 1.8Z" />
            ) : (
              <path d="M8.9 1.6a1 1 0 0 0-1.8 0L.6 13.3A1 1 0 0 0 1.5 15h13a1 1 0 0 0 .9-1.7L8.9 1.6ZM8.8 12H7.2v-1.6h1.6V12Zm0-3H7.2V5h1.6v4Z" />
            )}
          </svg>
          <span className="publish-checks-where">{where(problem)}</span>
          <span>{problem.message}.</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The publish checks the API ran (CNT-12): errors block, warnings don't.
 * Focuses itself when it appears so keyboard and screen-reader users land
 * on the list instead of on a Publish button that silently did nothing. A
 * labelled region rather than `role="alert"`: moving focus already reads
 * it out, and an alert on top would announce it twice.
 */
function PublishChecksPanel({ checks, pageTitle, onClose, onPublishAnyway, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const blocked = checks.errors.length > 0;

  useEffect(() => {
    ref.current?.focus();
  }, [checks]);

  const page = pageTitle ? ` in “${pageTitle}”` : '';
  const title = blocked
    ? `Fix ${plural(checks.errors.length, 'problem', 'problems')}${page} before publishing`
    : `${plural(checks.warnings.length, 'thing', 'things')} worth checking${page} before publishing`;

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="region"
      aria-labelledby={titleId}
      className={`publish-checks ${blocked ? 'publish-checks-blocked' : 'publish-checks-warn'}`}
    >
      <p id={titleId} className="publish-checks-title">
        {title}
      </p>
      {blocked && <ProblemList problems={checks.errors} kind="error" />}
      {checks.warnings.length > 0 && (
        <>
          {blocked && <p className="publish-checks-subtitle">Also worth checking</p>}
          <ProblemList problems={checks.warnings} kind="warning" />
        </>
      )}
      <div className="publish-checks-actions">
        {!blocked && onPublishAnyway && (
          <button type="button" className="publish-checks-primary" onClick={onPublishAnyway}>
            Publish anyway
          </button>
        )}
        {children}
        <button type="button" className="publish-checks-secondary" onClick={onClose}>
          {blocked ? 'Close' : 'Keep editing'}
        </button>
      </div>
    </div>
  );
}

export default PublishChecksPanel;
