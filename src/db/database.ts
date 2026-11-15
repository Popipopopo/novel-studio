import Dexie, { Table } from 'dexie';
import type {
  Chapter,
  ChapterSnapshot,
  CommentThread,
  NovelProject,
  ProposedRevision,
  StoryArc,
  Volume,
  AppMeta,
} from '../models/types';

export class NovelStudioDB extends Dexie {
  projects!: Table<NovelProject, string>;
  volumes!: Table<Volume, string>;
  arcs!: Table<StoryArc, string>;
  chapters!: Table<Chapter, string>;
  comments!: Table<CommentThread, string>;
  revisions!: Table<ProposedRevision, string>;
  snapshots!: Table<ChapterSnapshot, string>;
  meta!: Table<AppMeta, string>;

  constructor(name = 'novel-studio-db') {
    super(name);
    this.version(1).stores({
      projects: 'id, order, archived, updatedAt',
      volumes: 'id, projectId, order',
      arcs: 'id, projectId, volumeId, order',
      chapters: 'id, projectId, arcId, order, deletedAt, updatedAt',
      comments: 'id, projectId, chapterId, resolved, updatedAt',
      revisions: 'id, projectId, chapterId, state, createdAt',
      snapshots: 'id, projectId, chapterId, createdAt',
      meta: 'key',
    });
  }
}

export const db = new NovelStudioDB();

// Helper to reset/clear (useful for tests and the "remove demo" action).
export async function clearProject(projectId: string) {
  await db.transaction(
    'rw',
    [db.projects, db.volumes, db.arcs, db.chapters, db.comments, db.revisions, db.snapshots],
    async () => {
      await db.comments.where('projectId').equals(projectId).delete();
      await db.revisions.where('projectId').equals(projectId).delete();
      await db.snapshots.where('projectId').equals(projectId).delete();
      await db.chapters.where('projectId').equals(projectId).delete();
      await db.arcs.where('projectId').equals(projectId).delete();
      await db.volumes.where('projectId').equals(projectId).delete();
      await db.projects.delete(projectId);
    }
  );
}
