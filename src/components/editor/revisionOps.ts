import type { Editor } from '@tiptap/core';

/**
 * Operations that manipulate proposed-revision marks in the editor.
 *
 * Model: a revision is represented inline as two kinds of marked spans
 * in the pending-view manuscript:
 *   - revDelete[revId] on the original text that should be removed
 *   - revInsert[revId] on the newly proposed text
 * The accepted-manuscript view (used for persistence) is produced by
 * stripping revInsert ranges and keeping revDelete ranges, OR, upon
 * acceptance, by stripping revDelete ranges and keeping revInsert.
 */

export interface PendingRevisionLocation {
  revId: string;
  deleteFrom: number | null;
  deleteTo: number | null;
  insertFrom: number | null;
  insertTo: number | null;
}

export function findRevisionRanges(
  editor: Editor
): Map<string, PendingRevisionLocation> {
  const map = new Map<string, PendingRevisionLocation>();
  const doc = editor.state.doc;
  doc.descendants((node, pos) => {
    if (!node.isText) return;
    const nodeEnd = pos + node.nodeSize;
    for (const m of node.marks) {
      if (m.type.name === 'revDelete' || m.type.name === 'revInsert') {
        const id = m.attrs.revId as string;
        if (!id) continue;
        const entry = map.get(id) ?? {
          revId: id,
          deleteFrom: null,
          deleteTo: null,
          insertFrom: null,
          insertTo: null,
        };
        if (m.type.name === 'revDelete') {
          entry.deleteFrom =
            entry.deleteFrom === null ? pos : Math.min(entry.deleteFrom, pos);
          entry.deleteTo =
            entry.deleteTo === null
              ? nodeEnd
              : Math.max(entry.deleteTo, nodeEnd);
        } else {
          entry.insertFrom =
            entry.insertFrom === null ? pos : Math.min(entry.insertFrom, pos);
          entry.insertTo =
            entry.insertTo === null
              ? nodeEnd
              : Math.max(entry.insertTo, nodeEnd);
        }
        map.set(id, entry);
      }
    }
  });
  return map;
}

/**
 * Insert a proposed revision by:
 *  - wrapping the selected range (`from..to`) with revDelete
 *  - inserting the proposed text at `to`, wrapped in revInsert
 */
export function applyProposedRevision(
  editor: Editor,
  revId: string,
  from: number,
  to: number,
  proposedText: string
): boolean {
  const { schema } = editor.state;
  const revInsert = schema.marks['revInsert'];
  const revDelete = schema.marks['revDelete'];
  if (!revInsert || !revDelete) return false;

  return editor
    .chain()
    .focus()
    .command(({ tr, dispatch }) => {
      if (from === to && !proposedText) return false;
      if (from < to) {
        tr.addMark(from, to, revDelete.create({ revId }));
      }
      // Insert new text AFTER the deletion range (if any), so the viewer
      // sees "<strikethrough old><cyan new>".
      if (proposedText.length > 0) {
        const insertAt = to;
        tr.insertText(proposedText, insertAt);
        tr.addMark(
          insertAt,
          insertAt + proposedText.length,
          revInsert.create({ revId })
        );
      }
      if (dispatch) dispatch(tr);
      return true;
    })
    .run();
}

/** Accept: keep revInsert text (strip mark), delete revDelete range. */
export function acceptRevision(editor: Editor, revId: string): boolean {
  const loc = findRevisionRanges(editor).get(revId);
  if (!loc) return false;

  return editor
    .chain()
    .focus()
    .command(({ tr, dispatch }) => {
      const schema = editor.state.schema;
      const insertMark = schema.marks['revInsert'];
      const deleteMark = schema.marks['revDelete'];

      // Delete the strikethrough original range FIRST (higher positions
      // or the lower one — we delete them in descending order to keep
      // positions valid).
      const ranges: Array<[number, number, 'delete' | 'unwrapInsert']> = [];
      if (loc.deleteFrom !== null && loc.deleteTo !== null) {
        ranges.push([loc.deleteFrom, loc.deleteTo, 'delete']);
      }
      if (loc.insertFrom !== null && loc.insertTo !== null) {
        ranges.push([loc.insertFrom, loc.insertTo, 'unwrapInsert']);
      }
      ranges.sort((a, b) => b[0] - a[0]);
      for (const [f, t, op] of ranges) {
        if (op === 'delete') {
          tr.delete(f, t);
        } else {
          tr.removeMark(f, t, insertMark);
        }
      }
      // Also strip any stale delete marks (defensive).
      tr.removeMark(0, tr.doc.content.size, deleteMark);
      if (dispatch) dispatch(tr);
      return true;
    })
    .run();
}

/** Reject: strip revDelete (keep original), delete revInsert range. */
export function rejectRevision(editor: Editor, revId: string): boolean {
  const loc = findRevisionRanges(editor).get(revId);
  if (!loc) return false;

  return editor
    .chain()
    .focus()
    .command(({ tr, dispatch }) => {
      const schema = editor.state.schema;
      const insertMark = schema.marks['revInsert'];
      const deleteMark = schema.marks['revDelete'];

      const ranges: Array<[number, number, 'delete' | 'unwrapDelete']> = [];
      if (loc.insertFrom !== null && loc.insertTo !== null) {
        ranges.push([loc.insertFrom, loc.insertTo, 'delete']);
      }
      if (loc.deleteFrom !== null && loc.deleteTo !== null) {
        ranges.push([loc.deleteFrom, loc.deleteTo, 'unwrapDelete']);
      }
      ranges.sort((a, b) => b[0] - a[0]);
      for (const [f, t, op] of ranges) {
        if (op === 'delete') {
          tr.delete(f, t);
        } else {
          tr.removeMark(f, t, deleteMark);
        }
      }
      tr.removeMark(0, tr.doc.content.size, insertMark);
      if (dispatch) dispatch(tr);
      return true;
    })
    .run();
}

/** Returns Set of comment-ids currently present in the document. */
export function collectCommentIds(editor: Editor): Set<string> {
  const ids = new Set<string>();
  editor.state.doc.descendants((node) => {
    if (!node.isText) return;
    for (const m of node.marks) {
      if (m.type.name === 'comment' && m.attrs.commentId) {
        ids.add(m.attrs.commentId as string);
      }
    }
  });
  return ids;
}

/** Returns Set of revision-ids currently present as pending in the doc. */
export function collectPendingRevisionIds(editor: Editor): Set<string> {
  const ids = new Set<string>();
  editor.state.doc.descendants((node) => {
    if (!node.isText) return;
    for (const m of node.marks) {
      if (
        (m.type.name === 'revInsert' || m.type.name === 'revDelete') &&
        m.attrs.revId
      ) {
        ids.add(m.attrs.revId as string);
      }
    }
  });
  return ids;
}
