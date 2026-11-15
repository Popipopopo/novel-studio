import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useRef, useState, useCallback } from 'react';
import { MessageCircle, Sparkles } from 'lucide-react';
import { CommentMark, RevInsertMark, RevDeleteMark } from './marks';
import type { Chapter } from '../../models/types';
import { saveChapterContent } from '../../db/repo';
import { useAppStore } from '../../store/useAppStore';
import {
  collectCommentIds,
  collectPendingRevisionIds,
} from './revisionOps';
import { markOrphanedComments } from '../../db/repo';
import { useProposeRevisionDialog } from '../revisions/ProposeRevisionDialog';
import { useCommentComposer } from '../comments/CommentComposer';

interface Props {
  chapter: Chapter;
  onEditorReady?: (editor: any) => void;
}

const SAVE_DEBOUNCE_MS = 700;

export default function ChapterEditor({ chapter, onEditorReady }: Props) {
  const setSaveStatus = useAppStore((s) => s.setSaveStatus);
  const setActiveCommentId = useAppStore((s) => s.setActiveCommentId);
  const setRightTab = useAppStore((s) => s.setRightTab);
  const writeMode = useAppStore((s) => s.writeMode);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectionRange, setSelectionRange] = useState<{
    from: number;
    to: number;
    text: string;
    coords: { x: number; y: number } | null;
  } | null>(null);
  const propose = useProposeRevisionDialog();
  const composeComment = useCommentComposer();

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
        Placeholder.configure({ placeholder: '从这里开始写作……' }),
        CommentMark,
        RevInsertMark,
        RevDeleteMark,
      ],
      content: chapter.contentJSON as any,
      editable: writeMode !== 'read',
      onUpdate({ editor }) {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        setSaveStatus('saving');
        saveTimer.current = setTimeout(async () => {
          try {
            const json = editor.getJSON();
            await saveChapterContent(chapter.id, json);
            const ids = collectCommentIds(editor);
            await markOrphanedComments(chapter.id, ids);
            setSaveStatus('saved');
          } catch (e) {
            console.error('[save]', e);
            setSaveStatus('error');
          }
        }, SAVE_DEBOUNCE_MS);
      },
      onSelectionUpdate({ editor }) {
        const { from, to, empty } = editor.state.selection;
        if (empty) {
          setSelectionRange(null);
          return;
        }
        const text = editor.state.doc.textBetween(from, to, ' ');
        // Compute floating toolbar coordinates
        try {
          const coords = editor.view.coordsAtPos(from);
          setSelectionRange({
            from,
            to,
            text,
            coords: { x: coords.left, y: coords.top },
          });
        } catch {
          setSelectionRange({ from, to, text, coords: null });
        }
      },
      editorProps: {
        attributes: {
          class: 'manuscript focus:outline-none',
        },
        handleClickOn(_view, _pos, _node, _nodePos, event) {
          const target = event.target as HTMLElement;
          const el = target.closest('[data-comment-id]') as HTMLElement | null;
          if (el) {
            const id = el.getAttribute('data-comment-id');
            if (id) {
              setActiveCommentId(id);
              setRightTab('comments');
              return true;
            }
          }
          return false;
        },
      },
    },
    [chapter.id]
  );

  // (useEditor's deps on [chapter.id] recreates the editor when the user
  // switches chapters — no manual setContent needed, which also preserves
  // the active selection across autosaves.)

  // Keep edit/read mode in sync.
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(writeMode !== 'read');
  }, [editor, writeMode]);

  // Expose editor to parent so sidebars can act on it (accept/reject).
  useEffect(() => {
    if (editor && onEditorReady) onEditorReady(editor);
  }, [editor, onEditorReady]);

  // Debounced count of comments & revisions present in doc.
  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      const commentIds = collectCommentIds(editor);
      markOrphanedComments(chapter.id, commentIds);
      // Expose pending rev ids on window for the revisions panel to read.
      (window as any).__pendingRevIds = collectPendingRevisionIds(editor);
    };
    editor.on('update', handler);
    handler();
    return () => {
      editor.off('update', handler);
    };
  }, [editor, chapter.id]);

  const onAddComment = useCallback(() => {
    if (!editor || !selectionRange) return;
    const { from, to, text } = selectionRange;
    composeComment({
      selectedText: text,
      onSubmit: async (threadId) => {
        editor
          .chain()
          .focus()
          .setTextSelection({ from, to })
          .setMark('comment', { commentId: threadId, resolved: false })
          .run();
      },
    });
  }, [editor, selectionRange, composeComment]);

  const onProposeRevision = useCallback(() => {
    if (!editor || !selectionRange) return;
    propose({
      selectedText: selectionRange.text,
      from: selectionRange.from,
      to: selectionRange.to,
      editor,
      chapterId: chapter.id,
    });
  }, [editor, selectionRange, propose, chapter.id]);

  if (!editor) return null;

  return (
    <div className="relative h-full overflow-y-auto thin-scroll">
      <div className="mx-auto w-full max-w-[720px] px-10 py-10">
        <EditorContent editor={editor} />
      </div>

      {selectionRange && selectionRange.coords && writeMode !== 'read' && (
        <div
          className="fixed z-30 bubble-menu"
          style={{
            left: Math.max(16, selectionRange.coords.x),
            top: Math.max(16, selectionRange.coords.y - 44),
          }}
        >
          <button className="ghost flex items-center gap-1" onClick={onAddComment}>
            <MessageCircle size={14} /> 添加评论
          </button>
          <div className="w-px h-4 bg-paper-200" />
          <button
            className="ghost flex items-center gap-1"
            onClick={onProposeRevision}
          >
            <Sparkles size={14} /> 提议修订
          </button>
        </div>
      )}
    </div>
  );
}
