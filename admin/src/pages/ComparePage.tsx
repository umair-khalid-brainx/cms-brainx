import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { getActiveMembership } from '../lib/activeSite'
import { useParams, useSearchParams } from 'react-router';
import { Link, useNavigate } from '../lib/siteRouter';
import RestoreConfirm from '../components/RestoreConfirm';
import {
  blockProps,
  diffBlocks,
  diffDetails,
  summarize,
  type BlockRow,
  type DetailRow,
  type PropChange,
  type Snapshot,
  type WordSegment,
} from '../lib/diffBlocks';
import { canPublishContent } from '../lib/roles';
import { restoredNotice, revisionOptionLabel, STATUS_LABEL, whenLabel, type RevisionSummary } from '../lib/revisions';
import { getCurrentPage, getRevision, listRevisions, type CurrentPage, type RevisionDetail } from '../lib/revisionsApi';
import { listContentTypes } from '../lib/typesApi';
import './ComparePage.css';

const CURRENT = 'current';

type Loaded = { revisions: RevisionSummary[]; page: CurrentPage; fieldLabels: Record<string, string> };
type Load = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: Loaded };
type Side = { status: 'loading' } | { status: 'error' } | { status: 'ready'; snapshot: Snapshot };

const toSnapshot = (source: Pick<CurrentPage | RevisionDetail, 'title' | 'blocks' | 'data' | 'seo' | 'terms'>): Snapshot => ({
  title: source.title,
  blocks: source.blocks ?? [],
  data: source.data ?? {},
  seo: source.seo ?? {},
  terms: source.terms ?? [],
});

/** Words with the differences marked by more than colour: deletions struck through, additions underlined, each with a +/- mark. */
function Words({ segments }: { segments: WordSegment[] }) {
  return (
    <p className="cmp-words">
      {segments.map((segment, index) => (
        <Fragment key={index}>
          {index > 0 && ' '}
          {segment.type === 'same' ? (
            segment.text
          ) : segment.type === 'add' ? (
            <ins className="cmp-ins">
              <span aria-hidden="true">+</span>
              {segment.text}
            </ins>
          ) : (
            <del className="cmp-del">
              <span aria-hidden="true">−</span>
              {segment.text}
            </del>
          )}
        </Fragment>
      ))}
    </p>
  );
}

function Value({ value }: { value: string | null }) {
  return value === null ? <em className="cmp-empty">(empty)</em> : <>{value}</>;
}

/** Before and after of one changed value: word-level where it was computed, otherwise old then new. */
function Change({ change }: { change: Pick<PropChange, 'before' | 'after' | 'words'> }) {
  if (change.words) return <Words segments={change.words} />;
  return (
    <p className="cmp-values">
      <del className="cmp-del">
        <span className="cmp-sr">Before: </span>
        <Value value={change.before} />
      </del>
      <span className="cmp-arrow" aria-hidden="true">
        {' '}
        →{' '}
      </span>
      <ins className="cmp-ins">
        <span className="cmp-sr">After: </span>
        <Value value={change.after} />
      </ins>
    </p>
  );
}

function DetailList({ rows }: { rows: DetailRow[] }) {
  return (
    <dl className="cmp-details">
      {rows.map((row) => (
        <div key={`${row.group}:${row.key}`} className="cmp-detail">
          <dt>
            {row.group !== row.label && <span className="cmp-group">{row.group}</span>}
            {row.label}
          </dt>
          <dd>
            {row.termsAdded || row.termsRemoved ? (
              <p className="cmp-values">
                {row.termsRemoved?.map((name) => (
                  <del key={`d${name}`} className="cmp-del cmp-chip">
                    <span aria-hidden="true">−</span>
                    <span className="cmp-sr">Removed: </span>
                    {name}
                  </del>
                ))}
                {row.termsAdded?.map((name) => (
                  <ins key={`a${name}`} className="cmp-ins cmp-chip">
                    <span aria-hidden="true">+</span>
                    <span className="cmp-sr">Added: </span>
                    {name}
                  </ins>
                ))}
              </p>
            ) : (
              <Change change={row} />
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

const TAG_TEXT: Record<BlockRow['tag'], string> = {
  added: 'Added',
  removed: 'Removed',
  changed: 'Changed',
  unchanged: 'Unchanged',
};
const TAG_MARK: Record<BlockRow['tag'], string> = { added: '+', removed: '−', changed: '~', unchanged: '=' };

function position(row: BlockRow): string {
  const { oldIndex, newIndex } = row;
  if (oldIndex === null) return `Block ${newIndex! + 1} in the newer version`;
  if (newIndex === null) return `Block ${oldIndex + 1} in the older version`;
  return oldIndex === newIndex ? `Block ${newIndex + 1}` : `Block ${oldIndex + 1} before, ${newIndex + 1} now`;
}

function BlockItem({ row, from, to }: { row: BlockRow; from: Snapshot; to: Snapshot }) {
  const head = (
    <>
      <span className={`cmp-tag cmp-tag-${row.tag}`}>
        <span aria-hidden="true">{TAG_MARK[row.tag]}</span> {TAG_TEXT[row.tag]}
      </span>
      <span className="cmp-block-name">{row.label}</span>
      {row.preview && <span className="cmp-block-preview">“{row.preview}”</span>}
      <span className="cmp-block-pos">{position(row)}</span>
    </>
  );
  if (row.tag === 'changed') {
    return (
      <li className={`cmp-block cmp-block-${row.tag}`}>
        <div className="cmp-block-head">{head}</div>
        <dl className="cmp-changes">
          {row.changes.map((change) => (
            <div key={change.path} className="cmp-change">
              <dt>{change.label}</dt>
              <dd>
                <Change change={change} />
              </dd>
            </div>
          ))}
        </dl>
      </li>
    );
  }
  const source = row.tag === 'removed' ? from.blocks[row.oldIndex!] : to.blocks[row.newIndex!];
  const lines = blockProps(source);
  return (
    <li className={`cmp-block cmp-block-${row.tag}`}>
      <details open={row.tag !== 'unchanged'}>
        <summary className="cmp-block-head">{head}</summary>
        {lines.length === 0 ? (
          <p className="cmp-none">No settings on this block.</p>
        ) : (
          <dl className="cmp-changes">
            {lines.map((line, index) => (
              <div key={index} className="cmp-change">
                <dt>{line.label}</dt>
                <dd>
                  <p className="cmp-values">{line.value}</p>
                </dd>
              </div>
            ))}
          </dl>
        )}
      </details>
    </li>
  );
}

/** Blocks in order; each run of unchanged blocks folds into one expandable group. */
function Blocks({ rows, from, to }: { rows: BlockRow[]; from: Snapshot; to: Snapshot }) {
  const groups: ({ kind: 'row'; row: BlockRow } | { kind: 'unchanged'; rows: BlockRow[] })[] = [];
  for (const row of rows) {
    const last = groups.at(-1);
    if (row.tag !== 'unchanged') groups.push({ kind: 'row', row });
    else if (last?.kind === 'unchanged') last.rows.push(row);
    else groups.push({ kind: 'unchanged', rows: [row] });
  }
  return (
    <ol className="cmp-blocks">
      {groups.map((group, index) =>
        group.kind === 'row' ? (
          <BlockItem key={index} row={group.row} from={from} to={to} />
        ) : (
          <li key={index} className="cmp-block cmp-block-unchanged cmp-group-unchanged">
            <details>
              <summary className="cmp-block-head">
                <span className="cmp-tag cmp-tag-unchanged">
                  <span aria-hidden="true">=</span> Unchanged
                </span>
                <span className="cmp-block-name">
                  {group.rows.length} unchanged block{group.rows.length === 1 ? '' : 's'}
                </span>
              </summary>
              <ol className="cmp-blocks cmp-blocks-nested">
                {group.rows.map((row) => (
                  <BlockItem key={row.newIndex} row={row} from={from} to={to} />
                ))}
              </ol>
            </details>
          </li>
        ),
      )}
    </ol>
  );
}

/**
 * The Compare screen (GOV-02, D-063): two versions of one page side by side as a list of what changed. The
 * versions come from the URL (`?from=<id>&to=<id|current>`), so a comparison can be linked and survives a reload.
 * "Current" is the page as the API has it now, treated like one more version.
 */
function ComparePage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [fromSide, setFromSide] = useState<Side>({ status: 'loading' });
  const [toSide, setToSide] = useState<Side>({ status: 'loading' });
  const [sideAttempt, setSideAttempt] = useState(0);
  const [confirming, setConfirming] = useState<RevisionSummary | null>(null);
  const cache = useRef(new Map<string, RevisionDetail>());
  const role = getActiveMembership()?.role;

  useEffect(() => {
    let cancelled = false;
    cache.current.clear();
    Promise.all([listRevisions(slug), getCurrentPage(slug)])
      .then(async ([revisions, page]) => {
        const types = page.typeId ? await listContentTypes().catch(() => []) : [];
        const fields = types.find((type) => type.id === page.typeId)?.fields ?? [];
        if (!cancelled) {
          setLoad({
            status: 'ready',
            data: { revisions, page, fieldLabels: Object.fromEntries(fields.map((field) => [field.key, field.label])) },
          });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoad({
            status: 'error',
            message: error instanceof Error && error.message ? error.message : 'Couldn’t load this page’s history.',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [slug, attempt]);

  const data = load.status === 'ready' ? load.data : null;
  const revisions = useMemo(() => data?.revisions ?? [], [data]);
  const known = (id: string | null) => id !== null && (id === CURRENT || revisions.some((revision) => revision.id === id));
  // Defaults: the version you chose, against the page as it is now. Without a choice, the one before the latest.
  const fromId = known(params.get('from')) ? params.get('from')! : (revisions[1]?.id ?? revisions[0]?.id ?? CURRENT);
  const toId = known(params.get('to')) ? params.get('to')! : CURRENT;
  // A link to a version that isn't in the list (too old, or deleted): say so instead of silently showing others.
  const ignoredLink =
    (params.get('from') !== null && !known(params.get('from'))) || (params.get('to') !== null && !known(params.get('to')));

  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    const fetchSide = async (id: string, set: (side: Side) => void) => {
      set({ status: 'loading' });
      try {
        if (id === CURRENT) {
          if (!cancelled) set({ status: 'ready', snapshot: toSnapshot(data.page) });
          return;
        }
        let detail = cache.current.get(id);
        if (!detail) {
          detail = await getRevision(slug, id);
          cache.current.set(id, detail);
        }
        if (!cancelled) set({ status: 'ready', snapshot: toSnapshot(detail) });
      } catch {
        if (!cancelled) set({ status: 'error' });
      }
    };
    void fetchSide(fromId, setFromSide);
    void fetchSide(toId, setToSide);
    return () => {
      cancelled = true;
    };
  }, [data, fromId, toId, slug, sideAttempt]);

  const result = useMemo(() => {
    if (fromSide.status !== 'ready' || toSide.status !== 'ready') return null;
    const blocks = diffBlocks(fromSide.snapshot.blocks, toSide.snapshot.blocks);
    const details = diffDetails(fromSide.snapshot, toSide.snapshot, data?.fieldLabels);
    return { blocks, details, summary: summarize(blocks, details.length) };
  }, [fromSide, toSide, data]);

  function choose(next: { from?: string; to?: string }) {
    setParams({ from: next.from ?? fromId, to: next.to ?? toId }, { replace: true });
  }

  // The older side can be restored, when it is a saved version (the current page can't be).
  const byId = (id: string) => revisions.find((revision) => revision.id === id);
  const olderId = (() => {
    if (fromId === toId) return null;
    // The newest saved version is what the page holds now: restoring it would change nothing.
    if (toId === CURRENT) return fromId === revisions[0]?.id ? null : fromId;
    if (fromId === CURRENT) return toId === revisions[0]?.id ? null : toId;
    return new Date(byId(fromId)!.savedAt) <= new Date(byId(toId)!.savedAt) ? fromId : toId;
  })();
  const older = olderId && olderId !== CURRENT ? (byId(olderId) ?? null) : null;
  const status = data?.page.status ?? 'draft';
  const needsPublishRight = status === 'published' && !canPublishContent(role);

  const options = (
    <>
      <option value={CURRENT}>Current version</option>
      {revisions.map((revision) => (
        <option key={revision.id} value={revision.id}>
          {revisionOptionLabel(revision)}
        </option>
      ))}
    </>
  );

  return (
    <div className="compare">
      <header className="compare-topbar">
        <Link to={`/editor/${encodeURIComponent(slug)}`} className="compare-back">
          &larr; Back to the editor
        </Link>
        <span className="compare-heading-top">Compare versions{data ? `: ${data.page.title}` : ''}</span>
        <span className="compare-site">{getActiveMembership()?.siteName ?? ''}</span>
      </header>

      <main className="compare-main">
        <h1 className="compare-h1">Compare versions</h1>

        {load.status === 'loading' && (
          <p className="compare-state" role="status">
            Loading versions…
          </p>
        )}
        {load.status === 'error' && (
          <div className="compare-state" role="alert">
            <p>{load.message}</p>
            <button
              type="button"
              className="history-button"
              onClick={() => {
                setLoad({ status: 'loading' });
                setAttempt((count) => count + 1);
              }}
            >
              Try again
            </button>
          </div>
        )}

        {data && (
          <>
            <form className="compare-controls" onSubmit={(event) => event.preventDefault()}>
              <label className="compare-field">
                <span>From</span>
                <select value={fromId} onChange={(event) => choose({ from: event.target.value })}>
                  {options}
                </select>
              </label>
              <button
                type="button"
                className="history-button compare-swap"
                onClick={() => choose({ from: toId, to: fromId })}
                aria-label="Swap the two versions"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path
                    d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Swap
              </button>
              <label className="compare-field">
                <span>To</span>
                <select value={toId} onChange={(event) => choose({ to: event.target.value })}>
                  {options}
                </select>
              </label>
            </form>

            {ignoredLink && (
              <p className="compare-state" role="alert">
                One of the versions in this link isn’t in the history any more, so these are the versions shown instead.
              </p>
            )}
            <div className="compare-summary" role="status" aria-live="polite">
              {fromId === toId ? (
                <p>These are the same version, so there is nothing to compare. Pick two different versions.</p>
              ) : result ? (
                <p>
                  <strong>{result.summary}</strong>
                </p>
              ) : fromSide.status === 'error' || toSide.status === 'error' ? null : (
                <p>Comparing…</p>
              )}
            </div>
            {(fromSide.status === 'error' || toSide.status === 'error') && (
              <div className="compare-state" role="alert">
                <p>Couldn’t load one of the versions. It may have been removed from the history.</p>
                <button type="button" className="history-button" onClick={() => setSideAttempt((count) => count + 1)}>
                  Try again
                </button>
              </div>
            )}

            {older && (
              <div className="compare-restore">
                <p>
                  The older version is the one from {whenLabel(older.savedAt)} ({STATUS_LABEL[older.status]}).
                  {needsPublishRight && ' This page is live. Only people who can publish can restore a version of it.'}
                </p>
                <button
                  type="button"
                  className="history-button history-button-primary"
                  disabled={needsPublishRight}
                  onClick={() => setConfirming(older)}
                >
                  Restore this version
                </button>
              </div>
            )}

            {result && fromSide.status === 'ready' && toSide.status === 'ready' && fromId !== toId && (
              <>
                <section aria-labelledby="cmp-details-h" className="compare-section">
                  <h2 id="cmp-details-h">Details</h2>
                  {result.details.length === 0 ? (
                    <p className="cmp-none">No changes to the title, fields, search settings, categories or tags.</p>
                  ) : (
                    <DetailList rows={result.details} />
                  )}
                </section>
                <section aria-labelledby="cmp-blocks-h" className="compare-section">
                  <h2 id="cmp-blocks-h">Blocks</h2>
                  {result.blocks.length === 0 ? (
                    <p className="cmp-none">Neither version has any blocks.</p>
                  ) : (
                    <Blocks rows={result.blocks} from={fromSide.snapshot} to={toSide.snapshot} />
                  )}
                </section>
              </>
            )}
          </>
        )}
      </main>

      <RestoreConfirm
        revision={confirming}
        slug={slug}
        status={status}
        unsaved={false}
        flushPending={() => Promise.resolve()}
        onCancel={() => setConfirming(null)}
        onRestored={(restored, revision) => {
          setConfirming(null);
          // The editor loads the page fresh, which is the reload a restore from its own History panel does.
          navigate(`/editor/${encodeURIComponent(slug)}`, { state: { notice: restoredNotice(restored.droppedTerms, revision) } });
        }}
      />
    </div>
  );
}

export default ComparePage;
