import { Mark, mergeAttributes } from '@tiptap/core';

/**
 * Comment mark: tags a text range with a `commentId`. ProseMirror
 * automatically maps this mark across edits, which gives us durable
 * anchoring without storing offsets.
 */
export const CommentMark = Mark.create({
  name: 'comment',

  inclusive: false,
  excludes: '',

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-comment-id'),
        renderHTML: (attrs) =>
          attrs.commentId ? { 'data-comment-id': attrs.commentId } : {},
      },
      resolved: {
        default: false,
        parseHTML: (el) =>
          (el as HTMLElement).getAttribute('data-resolved') === 'true',
        renderHTML: (attrs) => ({
          'data-resolved': attrs.resolved ? 'true' : 'false',
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-comment-id]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, { class: 'comment-mark' }),
      0,
    ];
  },
});

/** A proposed insertion (new text) attached to a revision id. */
export const RevInsertMark = Mark.create({
  name: 'revInsert',
  inclusive: false,
  excludes: '',

  addAttributes() {
    return {
      revId: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-rev-id'),
        renderHTML: (attrs) =>
          attrs.revId ? { 'data-rev-id': attrs.revId } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span.rev-insert' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, { class: 'rev-insert' }),
      0,
    ];
  },
});

/** A proposed deletion (struck-through original) attached to a revision id. */
export const RevDeleteMark = Mark.create({
  name: 'revDelete',
  inclusive: false,
  excludes: '',

  addAttributes() {
    return {
      revId: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-rev-id'),
        renderHTML: (attrs) =>
          attrs.revId ? { 'data-rev-id': attrs.revId } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span.rev-delete' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, { class: 'rev-delete' }),
      0,
    ];
  },
});
