import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { CommentMark, RevInsertMark, RevDeleteMark } from '../src/components/editor/marks';
import {
  acceptRevision,
  applyProposedRevision,
  collectCommentIds,
  findRevisionRanges,
  rejectRevision,
} from '../src/components/editor/revisionOps';

function makeEditor(text = '霜站在岔路口，等了很久。') {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return new Editor({
    element: el,
    extensions: [StarterKit, CommentMark, RevInsertMark, RevDeleteMark],
    content: {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text }] },
      ],
    },
  });
}

describe('proposed revisions', () => {
  it('applies a revision as delete+insert marks', () => {
    const editor = makeEditor();
    // "霜" is at position 1..2
    applyProposedRevision(editor, 'r1', 1, 2, '夜');
    const locs = findRevisionRanges(editor);
    const r = locs.get('r1')!;
    expect(r.deleteFrom).not.toBeNull();
    expect(r.insertFrom).not.toBeNull();
    editor.destroy();
  });

  it('accepting a revision keeps new text and removes original', () => {
    const editor = makeEditor('A B C');
    applyProposedRevision(editor, 'r1', 1, 2, 'X');
    acceptRevision(editor, 'r1');
    const txt = editor.state.doc.textContent;
    expect(txt.includes('X')).toBe(true);
    expect(txt.includes('A')).toBe(false);
    editor.destroy();
  });

  it('rejecting a revision keeps original text and removes proposed', () => {
    const editor = makeEditor('A B C');
    applyProposedRevision(editor, 'r1', 1, 2, 'X');
    rejectRevision(editor, 'r1');
    const txt = editor.state.doc.textContent;
    expect(txt.includes('A')).toBe(true);
    expect(txt.includes('X')).toBe(false);
    editor.destroy();
  });

  it('collects comment ids present in the document', () => {
    const editor = makeEditor();
    editor
      .chain()
      .focus()
      .setTextSelection({ from: 1, to: 3 })
      .setMark('comment', { commentId: 'c1', resolved: false })
      .run();
    const ids = collectCommentIds(editor);
    expect(ids.has('c1')).toBe(true);
    editor.destroy();
  });
});
