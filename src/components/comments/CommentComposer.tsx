import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import Modal, { Button } from '../ui/Modal';
import { createCommentThread } from '../../db/repo';
import { useAppStore } from '../../store/useAppStore';

interface ComposerRequest {
  selectedText: string;
  onSubmit: (threadId: string) => void | Promise<void>;
}

interface ComposerCtx {
  open: (req: ComposerRequest) => void;
}

const Ctx = createContext<ComposerCtx | null>(null);

export function CommentComposerProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<ComposerRequest | null>(null);
  const [body, setBody] = useState('');
  const projectId = useAppStore((s) => s.activeProjectId);
  const chapterId = useAppStore((s) => s.activeChapterId);
  const setActiveCommentId = useAppStore((s) => s.setActiveCommentId);
  const setRightTab = useAppStore((s) => s.setRightTab);

  const close = () => {
    setReq(null);
    setBody('');
  };

  const submit = async () => {
    if (!req || !projectId || !chapterId || !body.trim()) return;
    const thread = await createCommentThread(projectId, chapterId, body.trim(), {
      anchorText: req.selectedText,
    });
    await req.onSubmit(thread.id);
    setActiveCommentId(thread.id);
    setRightTab('comments');
    close();
  };

  return (
    <Ctx.Provider value={{ open: (r) => setReq(r) }}>
      {children}
      <Modal
        open={!!req}
        onClose={close}
        title="添加评论"
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              取消
            </Button>
            <Button onClick={submit} disabled={!body.trim()}>
              添加
            </Button>
          </>
        }
      >
        {req?.selectedText && (
          <div className="text-xs text-ink-300 border-l-2 border-paper-300 pl-3 italic font-serif">
            "{req.selectedText}"
          </div>
        )}
        <textarea
          autoFocus
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="写下你的想法……"
          className="w-full min-h-[120px] p-3 rounded-md border border-paper-200 dark:border-ink-500 bg-white dark:bg-ink-800 outline-none focus:border-accent-300"
        />
      </Modal>
    </Ctx.Provider>
  );
}

export function useCommentComposer() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('CommentComposerProvider missing');
  return useCallback((req: ComposerRequest) => ctx.open(req), [ctx]);
}
