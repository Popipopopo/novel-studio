import { createContext, ReactNode, useCallback, useContext, useState } from 'react';
import type { Editor } from '@tiptap/core';
import Modal, { Button } from '../ui/Modal';
import { createRevision, createSnapshot } from '../../db/repo';
import { applyProposedRevision } from '../editor/revisionOps';
import { useAppStore } from '../../store/useAppStore';
import { fastHash } from '../../utils/id';
import { docToPlainText } from '../../utils/wordCount';
import { ClipboardCopy, Sparkles } from 'lucide-react';
import { buildAITaskPrompt } from '../../services/ai/prompt';
import { db } from '../../db/database';

interface ProposeRequest {
  selectedText: string;
  from: number;
  to: number;
  editor: Editor;
  chapterId: string;
}

interface ProposeCtx {
  open: (req: ProposeRequest) => void;
}
const Ctx = createContext<ProposeCtx | null>(null);

export function ProposeRevisionProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<ProposeRequest | null>(null);
  const [replacement, setReplacement] = useState('');
  const [reason, setReason] = useState('');
  const projectId = useAppStore((s) => s.activeProjectId);
  const setRightTab = useAppStore((s) => s.setRightTab);
  const setActiveRevisionId = useAppStore((s) => s.setActiveRevisionId);

  const close = () => {
    setReq(null);
    setReplacement('');
    setReason('');
  };

  const submit = async () => {
    if (!req || !projectId) return;
    // Hash the current manuscript for conflict detection later.
    const docJson = req.editor.getJSON();
    const plain = docToPlainText(docJson);
    const hash = fastHash(plain);
    const rev = await createRevision({
      projectId,
      chapterId: req.chapterId,
      reason: reason.trim() || undefined,
      originalText: req.selectedText,
      proposedText: replacement,
      baseManuscriptHash: hash,
    });
    await createSnapshot(req.chapterId, '创建修订前快照');
    applyProposedRevision(
      req.editor,
      rev.id,
      req.from,
      req.to,
      replacement
    );
    setActiveRevisionId(rev.id);
    setRightTab('revisions');
    close();
  };

  const copyPrompt = async () => {
    if (!req) return;
    const ch = await db.chapters.get(req.chapterId);
    const proj = projectId ? await db.projects.get(projectId) : null;
    const prompt = buildAITaskPrompt({
      novelTitle: proj?.title || '',
      chapterTitle: ch?.title || '',
      selectedText: req.selectedText,
      comment: reason,
      chapterSummary: ch?.outline.summary,
      narrativeGoal: ch?.outline.narrativeGoal,
    });
    try {
      await navigator.clipboard.writeText(prompt);
      alert('已复制到剪贴板。将 AI 返回的改写文本粘贴到"提议的新文本"框中，然后提交。');
    } catch {
      prompt && window.prompt('复制以下内容：', prompt);
    }
  };

  return (
    <Ctx.Provider value={{ open: (r) => setReq(r) }}>
      {children}
      <Modal
        open={!!req}
        wide
        onClose={close}
        title="提议修订"
        footer={
          <>
            <Button variant="ghost" onClick={copyPrompt} title="复制 AI 任务 Prompt">
              <span className="inline-flex items-center gap-1">
                <ClipboardCopy size={14} /> 复制 AI Prompt
              </span>
            </Button>
            <div className="flex-1" />
            <Button variant="ghost" onClick={close}>
              取消
            </Button>
            <Button onClick={submit} disabled={!replacement && !req?.selectedText}>
              <span className="inline-flex items-center gap-1">
                <Sparkles size={14} /> 提交为待审修订
              </span>
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-ink-300">原文</label>
            <div className="mt-1 min-h-[160px] p-3 rounded-md border border-paper-200 dark:border-ink-500 bg-paper-100 dark:bg-ink-800 font-serif whitespace-pre-wrap text-red-700 dark:text-red-300 line-through">
              {req?.selectedText || '（未选中内容。将作为插入新段落处理。）'}
            </div>
          </div>
          <div>
            <label className="text-xs text-ink-300">提议的新文本</label>
            <textarea
              autoFocus
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
              className="mt-1 w-full min-h-[160px] p-3 rounded-md border border-paper-200 dark:border-ink-500 bg-white dark:bg-ink-800 font-serif text-accent-500 outline-none focus:border-accent-300"
              placeholder="在此粘贴 AI 返回的改写文本，或手动写入提议的新文本……"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-ink-300">修订理由（可选）</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1 w-full min-h-[64px] p-3 rounded-md border border-paper-200 dark:border-ink-500 bg-white dark:bg-ink-800 outline-none focus:border-accent-300 text-sm"
            placeholder="为什么要这样改？例如：节奏过快、角色反应应更克制……"
          />
        </div>
        <p className="text-xs text-ink-300">
          提交后将在文中标出删除（红色删除线）与新增（青色）。原稿不会被覆盖，可随时接受或拒绝。
        </p>
      </Modal>
    </Ctx.Provider>
  );
}

export function useProposeRevisionDialog() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('ProposeRevisionProvider missing');
  return useCallback((req: ProposeRequest) => ctx.open(req), [ctx]);
}
