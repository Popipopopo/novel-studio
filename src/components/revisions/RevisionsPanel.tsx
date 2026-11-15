import { useLiveQuery } from 'dexie-react-hooks';
import { Check, X, AlertTriangle } from 'lucide-react';
import { db } from '../../db/database';
import type { Editor } from '@tiptap/core';
import type { ProposedRevision } from '../../models/types';
import {
  acceptRevision,
  rejectRevision,
  findRevisionRanges,
} from '../editor/revisionOps';
import {
  createSnapshot,
  deleteRevision,
  saveChapterContent,
  updateRevision,
} from '../../db/repo';
import { useAppStore } from '../../store/useAppStore';
import { fastHash } from '../../utils/id';
import { docToPlainText } from '../../utils/wordCount';

interface Props {
  chapterId: string;
  editor: Editor | null;
}

export default function RevisionsPanel({ chapterId, editor }: Props) {
  const revisions =
    useLiveQuery(
      () =>
        db.revisions.where('chapterId').equals(chapterId).toArray(),
      [chapterId]
    ) ?? [];
  const activeRevisionId = useAppStore((s) => s.activeRevisionId);
  const setActiveRevisionId = useAppStore((s) => s.setActiveRevisionId);

  const pending = revisions
    .filter((r) => r.state === 'pending' || r.state === 'conflict')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const resolved = revisions
    .filter((r) => r.state === 'accepted' || r.state === 'rejected')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const persist = async () => {
    if (!editor) return;
    await saveChapterContent(chapterId, editor.getJSON());
  };

  const onAccept = async (r: ProposedRevision) => {
    if (!editor) return;
    // Conflict check: does the "original" portion still exist in doc?
    const loc = findRevisionRanges(editor).get(r.id);
    if (!loc) {
      await updateRevision(r.id, { state: 'conflict' });
      return;
    }
    await createSnapshot(chapterId, '接受修订前快照');
    acceptRevision(editor, r.id);
    await persist();
    await updateRevision(r.id, { state: 'accepted', resolvedAt: new Date().toISOString() });
  };
  const onReject = async (r: ProposedRevision) => {
    if (!editor) return;
    rejectRevision(editor, r.id);
    await persist();
    await updateRevision(r.id, { state: 'rejected', resolvedAt: new Date().toISOString() });
  };
  const onAcceptAll = async () => {
    for (const r of pending) await onAccept(r);
  };
  const onRejectAll = async () => {
    for (const r of pending) await onReject(r);
  };

  // Simple conflict heuristic: if base hash no longer matches current manuscript
  // text AND the revision's inline marks are gone, mark as conflict.
  const flagConflicts = async () => {
    if (!editor) return;
    const plain = docToPlainText(editor.getJSON());
    const hash = fastHash(plain);
    const locs = findRevisionRanges(editor);
    for (const r of pending) {
      if (r.state !== 'pending') continue;
      const loc = locs.get(r.id);
      if (!loc && r.baseManuscriptHash !== hash) {
        await updateRevision(r.id, { state: 'conflict' });
      }
    }
  };

  return (
    <div className="p-4 space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <h4 className="font-serif text-ink-500 dark:text-ink-50">
          修订 · {pending.length} 待审
        </h4>
        {pending.length > 0 && (
          <div className="flex gap-1">
            <button
              className="text-[11px] px-2 py-0.5 rounded bg-accent-500 text-white hover:bg-accent-400"
              onClick={onAcceptAll}
            >
              全部接受
            </button>
            <button
              className="text-[11px] px-2 py-0.5 rounded border border-paper-300 dark:border-ink-500 hover:bg-paper-100 dark:hover:bg-ink-600"
              onClick={onRejectAll}
            >
              全部拒绝
            </button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {pending.map((r) => (
          <RevCard
            key={r.id}
            r={r}
            active={activeRevisionId === r.id}
            onSelect={() => {
              setActiveRevisionId(r.id);
              if (editor) {
                const loc = findRevisionRanges(editor).get(r.id);
                if (loc) {
                  const pos = loc.insertFrom ?? loc.deleteFrom ?? 1;
                  editor.chain().focus().setTextSelection(pos).scrollIntoView().run();
                }
              }
            }}
            onAccept={() => onAccept(r)}
            onReject={() => onReject(r)}
          />
        ))}
        {pending.length === 0 && (
          <div className="text-xs text-ink-300">当前章节没有待审修订。</div>
        )}
      </div>

      {resolved.length > 0 && (
        <div className="pt-3 border-t border-paper-200 dark:border-ink-500">
          <div className="text-[11px] text-ink-300 mb-1">历史修订</div>
          <div className="space-y-1">
            {resolved.slice(0, 20).map((r) => (
              <div
                key={r.id}
                className="rounded border border-paper-200 dark:border-ink-500 p-1.5 text-[11px] text-ink-300 flex items-center gap-1"
              >
                {r.state === 'accepted' ? (
                  <Check size={11} className="text-accent-500" />
                ) : (
                  <X size={11} />
                )}
                <span className="line-through text-red-600 flex-1 truncate">
                  {r.originalText.slice(0, 20)}
                </span>
                <span className="text-accent-500 flex-1 truncate">
                  {r.proposedText.slice(0, 20)}
                </span>
                <button
                  className="ghost"
                  title="删除记录"
                  onClick={() => deleteRevision(r.id)}
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <button className="hidden" onClick={flagConflicts} />
    </div>
  );
}

function RevCard({
  r,
  active,
  onSelect,
  onAccept,
  onReject,
}: {
  r: ProposedRevision;
  active: boolean;
  onSelect: () => void;
  onAccept: () => void;
  onReject: () => void;
}) {
  const conflict = r.state === 'conflict';
  return (
    <div
      onClick={onSelect}
      className={
        'rounded border p-2 cursor-pointer transition ' +
        (active
          ? 'border-accent-300 bg-accent-50 dark:bg-accent-600/20'
          : conflict
          ? 'border-amber-300 bg-amber-50 dark:bg-amber-900/20'
          : 'border-paper-200 dark:border-ink-500 bg-white dark:bg-ink-800 hover:border-accent-200')
      }
    >
      <div className="flex items-center gap-1 text-[11px] text-ink-300">
        <span>{new Date(r.createdAt).toLocaleString('zh-CN')}</span>
        {conflict && (
          <span className="text-amber-700 flex items-center gap-0.5">
            <AlertTriangle size={11} /> 冲突：原文已被改动
          </span>
        )}
      </div>
      {r.reason && (
        <div className="text-[12px] italic text-ink-400 dark:text-ink-100 mt-0.5">
          {r.reason}
        </div>
      )}
      <div className="mt-1 font-serif text-[12.5px] text-red-700 dark:text-red-300 line-through whitespace-pre-wrap line-clamp-3">
        {r.originalText || '（无原文）'}
      </div>
      <div className="mt-1 font-serif text-[12.5px] text-accent-500 whitespace-pre-wrap line-clamp-3">
        {r.proposedText || '（删除）'}
      </div>
      <div className="mt-2 flex justify-end gap-1">
        <button
          className="text-[11px] px-2 py-0.5 rounded border border-paper-300 dark:border-ink-500 hover:bg-paper-100 dark:hover:bg-ink-600 inline-flex items-center gap-1"
          onClick={(e) => {
            e.stopPropagation();
            onReject();
          }}
        >
          <X size={11} /> 拒绝
        </button>
        <button
          disabled={conflict}
          className="text-[11px] px-2 py-0.5 rounded bg-accent-500 text-white hover:bg-accent-400 disabled:opacity-40 inline-flex items-center gap-1"
          onClick={(e) => {
            e.stopPropagation();
            onAccept();
          }}
        >
          <Check size={11} /> 接受
        </button>
      </div>
    </div>
  );
}
