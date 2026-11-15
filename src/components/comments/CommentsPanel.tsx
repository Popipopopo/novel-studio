import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle2, MessageSquare, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { db } from '../../db/database';
import type { CommentThread } from '../../models/types';
import {
  addCommentReply,
  createCommentThread,
  deleteComment,
  updateComment,
} from '../../db/repo';
import { useAppStore } from '../../store/useAppStore';

export default function CommentsPanel({ chapterId }: { chapterId: string }) {
  const [showResolved, setShowResolved] = useState(false);
  const threads =
    useLiveQuery(
      () =>
        db.comments.where('chapterId').equals(chapterId).toArray(),
      [chapterId]
    ) ?? [];
  const projectId = useAppStore((s) => s.activeProjectId);
  const activeCommentId = useAppStore((s) => s.activeCommentId);
  const setActiveCommentId = useAppStore((s) => s.setActiveCommentId);

  const list = [...threads].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt)
  );
  const visible = showResolved ? list : list.filter((t) => !t.resolved);
  const openCount = list.filter((t) => !t.resolved).length;

  return (
    <div className="p-4 space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <h4 className="font-serif text-ink-500 dark:text-ink-50">
          评论 · {openCount} 未解决
        </h4>
        <button
          className="ghost text-xs"
          onClick={() => setShowResolved((v) => !v)}
        >
          {showResolved ? '仅未解决' : '查看已解决'}
        </button>
      </div>

      <button
        className="w-full px-2 py-1.5 border border-dashed border-paper-300 dark:border-ink-500 rounded text-xs text-ink-300 hover:text-accent-500 flex items-center justify-center gap-1"
        onClick={async () => {
          if (!projectId) return;
          const body = window.prompt('章节级评论');
          if (body && body.trim()) {
            await createCommentThread(projectId, chapterId, body.trim(), {
              chapterLevel: true,
            });
          }
        }}
      >
        <Plus size={12} /> 添加章节级评论
      </button>

      <div className="space-y-2">
        {visible.map((t) => (
          <ThreadCard
            key={t.id}
            t={t}
            active={activeCommentId === t.id}
            onClick={() => setActiveCommentId(t.id)}
          />
        ))}
        {visible.length === 0 && (
          <div className="text-xs text-ink-300">暂无评论。</div>
        )}
      </div>
    </div>
  );
}

function ThreadCard({
  t,
  active,
  onClick,
}: {
  t: CommentThread;
  active: boolean;
  onClick: () => void;
}) {
  const [reply, setReply] = useState('');
  return (
    <div
      className={
        'rounded border p-2 transition cursor-pointer ' +
        (active
          ? 'border-accent-300 bg-accent-50 dark:bg-accent-600/20'
          : 'border-paper-200 dark:border-ink-500 bg-white dark:bg-ink-800 hover:border-accent-200')
      }
      onClick={onClick}
    >
      <div className="flex items-center gap-1 text-[11px] text-ink-300 mb-1">
        {t.chapterLevel ? (
          <MessageSquare size={11} />
        ) : t.orphaned ? (
          <span className="text-amber-700">⚠ 已失去正文锚点</span>
        ) : (
          <MessageSquare size={11} />
        )}
        <span>{new Date(t.createdAt).toLocaleString('zh-CN')}</span>
        <div className="flex-1" />
        <button
          title="删除评论"
          className="ghost"
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm('删除评论？')) deleteComment(t.id);
          }}
        >
          <Trash2 size={11} />
        </button>
      </div>
      {t.anchorText && !t.chapterLevel && (
        <div className="text-[11px] text-ink-300 italic border-l-2 border-paper-300 pl-2 mb-1 line-clamp-2">
          "{t.anchorText}"
        </div>
      )}
      {t.messages.map((m) => (
        <div key={m.id} className="text-[12.5px] mb-1 whitespace-pre-wrap">
          {m.body}
        </div>
      ))}
      <div className="mt-2 flex gap-1">
        <input
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={async (e) => {
            if (e.key === 'Enter' && reply.trim()) {
              await addCommentReply(t.id, reply.trim());
              setReply('');
            }
          }}
          placeholder="回复……"
          className="flex-1 bg-transparent border border-paper-200 dark:border-ink-500 rounded px-2 py-1 text-xs outline-none focus:border-accent-300"
        />
        {t.resolved ? (
          <button
            title="重新打开"
            className="ghost"
            onClick={(e) => {
              e.stopPropagation();
              updateComment(t.id, { resolved: false });
            }}
          >
            <RotateCcw size={12} />
          </button>
        ) : (
          <button
            title="标记为已解决"
            className="ghost"
            onClick={(e) => {
              e.stopPropagation();
              updateComment(t.id, { resolved: true });
            }}
          >
            <CheckCircle2 size={12} />
          </button>
        )}
      </div>
    </div>
  );
}
