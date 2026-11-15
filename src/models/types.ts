// Core entity types. All IDs are UUID-like strings (nanoid).
// Schema version is incremented whenever the persisted shape changes.

export const SCHEMA_VERSION = 1;

export type ID = string;
export type ISO = string; // ISO-8601 timestamp

export type WritingStatus =
  | 'not_started'
  | 'outline'
  | 'draft'
  | 'revising'
  | 'done';

export const WritingStatusLabel: Record<WritingStatus, string> = {
  not_started: '未开始',
  outline: '大纲中',
  draft: '初稿',
  revising: '修改中',
  done: '已完成',
};

export type EventStatus = 'todo' | 'done' | 'revise';
export const EventStatusLabel: Record<EventStatus, string> = {
  todo: '待写',
  done: '已写',
  revise: '待修改',
};

export interface NovelProject {
  id: ID;
  title: string;
  synopsis?: string;
  schemaVersion: number;
  isDemo?: boolean;
  archived?: boolean;
  createdAt: ISO;
  updatedAt: ISO;
  order: number;
}

export interface Volume {
  id: ID;
  projectId: ID;
  title: string;
  description?: string;
  order: number;
  collapsed?: boolean;
  createdAt: ISO;
  updatedAt: ISO;
}

export interface StoryArc {
  id: ID;
  projectId: ID;
  volumeId: ID;
  title: string;
  summary?: string;
  centralConflict?: string;
  startingState?: string;
  keyDevelopments?: string;
  endingState?: string;
  status?: WritingStatus;
  order: number;
  collapsed?: boolean;
  createdAt: ISO;
  updatedAt: ISO;
}

export interface SceneEvent {
  id: ID;
  title: string;
  description?: string;
  purpose?: string;
  characters?: string[];
  status: EventStatus;
  order: number;
}

export interface ChapterOutline {
  summary?: string;
  narrativeGoal?: string;
  characterDevelopment?: string;
  foreshadowingPlanted?: string;
  foreshadowingResolved?: string;
  endingHook?: string;
  notes?: string;
  events: SceneEvent[];
}

export interface Chapter {
  id: ID;
  projectId: ID;
  arcId: ID;
  title: string;
  /** TipTap JSON document for the accepted manuscript. */
  contentJSON: unknown;
  /** Plain text cache for word count & search (derived). */
  plainText: string;
  wordCount: number;
  status: WritingStatus;
  outline: ChapterOutline;
  order: number;
  deletedAt?: ISO; // soft delete (trash)
  createdAt: ISO;
  updatedAt: ISO;
}

export interface CommentMessage {
  id: ID;
  authorKind: 'human' | 'ai';
  body: string;
  createdAt: ISO;
}

export interface CommentThread {
  id: ID; // same id used in the `data-comment-id` attribute in the editor
  projectId: ID;
  chapterId: ID;
  /** Anchor text snapshot (used for recovery when mark is lost). */
  anchorText?: string;
  /** Whether the anchor is still present in the document. */
  orphaned?: boolean;
  /** Chapter-level comment (no inline anchor). */
  chapterLevel?: boolean;
  resolved: boolean;
  messages: CommentMessage[];
  createdAt: ISO;
  updatedAt: ISO;
}

/**
 * A proposed revision. Instead of keeping fragile character offsets we store
 * ProseMirror step-like operations embedded directly as marks in a
 * "pending" view of the chapter content. The accepted manuscript stays in
 * `Chapter.contentJSON`; the pending-view JSON is kept here.
 */
export type RevisionState = 'pending' | 'accepted' | 'rejected' | 'conflict';

export interface ProposedRevision {
  id: ID;
  projectId: ID;
  chapterId: ID;
  reason?: string;
  /** Snapshot of the original selected text (what the AI was asked about). */
  originalText: string;
  /** Snapshot of the proposed replacement. */
  proposedText: string;
  /**
   * Hash of the accepted manuscript at the time the proposal was created,
   * used for conflict detection.
   */
  baseManuscriptHash: string;
  /** Links back to the comment that motivated this revision, if any. */
  commentId?: ID;
  state: RevisionState;
  createdAt: ISO;
  resolvedAt?: ISO;
}

export interface ChapterSnapshot {
  id: ID;
  projectId: ID;
  chapterId: ID;
  reason: string;
  contentJSON: unknown;
  wordCount: number;
  createdAt: ISO;
}

export interface AppMeta {
  key: string;
  value: unknown;
}

export interface BackupFile {
  kind: 'novel-studio-backup';
  schemaVersion: number;
  exportedAt: ISO;
  projects: NovelProject[];
  volumes: Volume[];
  arcs: StoryArc[];
  chapters: Chapter[];
  comments: CommentThread[];
  revisions: ProposedRevision[];
  snapshots: ChapterSnapshot[];
}
