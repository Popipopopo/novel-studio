import { db } from './database';
import { newId, nowISO } from '../utils/id';
import { countChinese, docToPlainText } from '../utils/wordCount';
import type {
  Chapter,
  ChapterOutline,
  ChapterSnapshot,
  CommentMessage,
  CommentThread,
  NovelProject,
  ProposedRevision,
  SceneEvent,
  StoryArc,
  Volume,
} from '../models/types';
import { SCHEMA_VERSION } from '../models/types';

export const defaultOutline = (): ChapterOutline => ({
  summary: '',
  narrativeGoal: '',
  characterDevelopment: '',
  foreshadowingPlanted: '',
  foreshadowingResolved: '',
  endingHook: '',
  notes: '',
  events: [],
});

export const emptyDoc = () => ({
  type: 'doc',
  content: [{ type: 'paragraph' }],
});

/* ---------- Projects ---------- */
export async function createProject(
  title: string,
  options: { isDemo?: boolean } = {}
): Promise<NovelProject> {
  const now = nowISO();
  const maxOrder = ((await db.projects.toArray()).reduce(
    (m, p) => Math.max(m, p.order),
    -1
  ));
  const proj: NovelProject = {
    id: newId(),
    title,
    synopsis: '',
    schemaVersion: SCHEMA_VERSION,
    isDemo: options.isDemo,
    archived: false,
    createdAt: now,
    updatedAt: now,
    order: maxOrder + 1,
  };
  await db.projects.add(proj);
  return proj;
}

export async function updateProject(id: string, patch: Partial<NovelProject>) {
  await db.projects.update(id, { ...patch, updatedAt: nowISO() });
}

/* ---------- Volumes ---------- */
export async function createVolume(
  projectId: string,
  title: string
): Promise<Volume> {
  const now = nowISO();
  const vols = await db.volumes.where('projectId').equals(projectId).toArray();
  const vol: Volume = {
    id: newId(),
    projectId,
    title,
    description: '',
    order: vols.reduce((m, v) => Math.max(m, v.order), -1) + 1,
    createdAt: now,
    updatedAt: now,
  };
  await db.volumes.add(vol);
  return vol;
}

export async function updateVolume(id: string, patch: Partial<Volume>) {
  await db.volumes.update(id, { ...patch, updatedAt: nowISO() });
}

export async function deleteVolume(id: string) {
  const arcs = await db.arcs.where('volumeId').equals(id).toArray();
  for (const arc of arcs) await deleteArc(arc.id);
  await db.volumes.delete(id);
}

/* ---------- Arcs ---------- */
export async function createArc(
  projectId: string,
  volumeId: string,
  title: string
): Promise<StoryArc> {
  const now = nowISO();
  const arcs = await db.arcs.where('volumeId').equals(volumeId).toArray();
  const arc: StoryArc = {
    id: newId(),
    projectId,
    volumeId,
    title,
    summary: '',
    status: 'not_started',
    order: arcs.reduce((m, a) => Math.max(m, a.order), -1) + 1,
    createdAt: now,
    updatedAt: now,
  };
  await db.arcs.add(arc);
  return arc;
}

export async function updateArc(id: string, patch: Partial<StoryArc>) {
  await db.arcs.update(id, { ...patch, updatedAt: nowISO() });
}

export async function deleteArc(id: string) {
  const chapters = await db.chapters.where('arcId').equals(id).toArray();
  for (const ch of chapters) await hardDeleteChapter(ch.id);
  await db.arcs.delete(id);
}

/* ---------- Chapters ---------- */
export async function createChapter(
  projectId: string,
  arcId: string,
  title: string
): Promise<Chapter> {
  const now = nowISO();
  const chapters = await db.chapters.where('arcId').equals(arcId).toArray();
  const ch: Chapter = {
    id: newId(),
    projectId,
    arcId,
    title,
    contentJSON: emptyDoc(),
    plainText: '',
    wordCount: 0,
    status: 'not_started',
    outline: defaultOutline(),
    order: chapters.reduce((m, c) => Math.max(m, c.order), -1) + 1,
    createdAt: now,
    updatedAt: now,
  };
  await db.chapters.add(ch);
  return ch;
}

export async function saveChapterContent(
  chapterId: string,
  contentJSON: unknown
) {
  const plain = docToPlainText(contentJSON);
  const { characters } = countChinese(plain);
  await db.chapters.update(chapterId, {
    contentJSON,
    plainText: plain,
    wordCount: characters,
    updatedAt: nowISO(),
  });
}

export async function updateChapter(id: string, patch: Partial<Chapter>) {
  await db.chapters.update(id, { ...patch, updatedAt: nowISO() });
}

export async function updateChapterOutline(
  id: string,
  patch: Partial<ChapterOutline>
) {
  const ch = await db.chapters.get(id);
  if (!ch) return;
  await db.chapters.update(id, {
    outline: { ...ch.outline, ...patch },
    updatedAt: nowISO(),
  });
}

export async function duplicateChapter(id: string): Promise<Chapter | null> {
  const ch = await db.chapters.get(id);
  if (!ch) return null;
  const sibs = await db.chapters.where('arcId').equals(ch.arcId).toArray();
  const copy: Chapter = {
    ...ch,
    id: newId(),
    title: ch.title + '（副本）',
    order: sibs.reduce((m, c) => Math.max(m, c.order), -1) + 1,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };
  await db.chapters.add(copy);
  return copy;
}

export async function softDeleteChapter(id: string) {
  await db.chapters.update(id, { deletedAt: nowISO() });
}

export async function restoreChapter(id: string) {
  await db.chapters.update(id, { deletedAt: undefined });
}

export async function hardDeleteChapter(id: string) {
  await db.transaction(
    'rw',
    db.chapters,
    db.comments,
    db.revisions,
    db.snapshots,
    async () => {
      await db.comments.where('chapterId').equals(id).delete();
      await db.revisions.where('chapterId').equals(id).delete();
      await db.snapshots.where('chapterId').equals(id).delete();
      await db.chapters.delete(id);
    }
  );
}

/* ---------- Scene Events ---------- */
export async function addSceneEvent(
  chapterId: string,
  title: string
): Promise<SceneEvent | null> {
  const ch = await db.chapters.get(chapterId);
  if (!ch) return null;
  const ev: SceneEvent = {
    id: newId(),
    title,
    description: '',
    purpose: '',
    characters: [],
    status: 'todo',
    order: ch.outline.events.reduce((m, e) => Math.max(m, e.order), -1) + 1,
  };
  await db.chapters.update(chapterId, {
    outline: { ...ch.outline, events: [...ch.outline.events, ev] },
    updatedAt: nowISO(),
  });
  return ev;
}

export async function updateSceneEvent(
  chapterId: string,
  eventId: string,
  patch: Partial<SceneEvent>
) {
  const ch = await db.chapters.get(chapterId);
  if (!ch) return;
  const events = ch.outline.events.map((e) =>
    e.id === eventId ? { ...e, ...patch } : e
  );
  await db.chapters.update(chapterId, {
    outline: { ...ch.outline, events },
    updatedAt: nowISO(),
  });
}

export async function removeSceneEvent(chapterId: string, eventId: string) {
  const ch = await db.chapters.get(chapterId);
  if (!ch) return;
  await db.chapters.update(chapterId, {
    outline: {
      ...ch.outline,
      events: ch.outline.events.filter((e) => e.id !== eventId),
    },
    updatedAt: nowISO(),
  });
}

export async function reorderSceneEvents(chapterId: string, ids: string[]) {
  const ch = await db.chapters.get(chapterId);
  if (!ch) return;
  const map = new Map(ch.outline.events.map((e) => [e.id, e]));
  const events = ids
    .map((id, i) => {
      const e = map.get(id);
      return e ? { ...e, order: i } : null;
    })
    .filter(Boolean) as SceneEvent[];
  await db.chapters.update(chapterId, {
    outline: { ...ch.outline, events },
    updatedAt: nowISO(),
  });
}

/* ---------- Comments ---------- */
export async function createCommentThread(
  projectId: string,
  chapterId: string,
  firstMessage: string,
  options: { chapterLevel?: boolean; anchorText?: string } = {}
): Promise<CommentThread> {
  const now = nowISO();
  const msg: CommentMessage = {
    id: newId(),
    authorKind: 'human',
    body: firstMessage,
    createdAt: now,
  };
  const thread: CommentThread = {
    id: newId(),
    projectId,
    chapterId,
    chapterLevel: options.chapterLevel,
    anchorText: options.anchorText,
    orphaned: false,
    resolved: false,
    messages: [msg],
    createdAt: now,
    updatedAt: now,
  };
  await db.comments.add(thread);
  return thread;
}

export async function addCommentReply(threadId: string, body: string) {
  const t = await db.comments.get(threadId);
  if (!t) return;
  const msg: CommentMessage = {
    id: newId(),
    authorKind: 'human',
    body,
    createdAt: nowISO(),
  };
  await db.comments.update(threadId, {
    messages: [...t.messages, msg],
    updatedAt: nowISO(),
  });
}

export async function updateComment(threadId: string, patch: Partial<CommentThread>) {
  await db.comments.update(threadId, { ...patch, updatedAt: nowISO() });
}

export async function deleteComment(threadId: string) {
  await db.comments.delete(threadId);
}

export async function markOrphanedComments(
  chapterId: string,
  presentIds: Set<string>
) {
  const threads = await db.comments
    .where('chapterId')
    .equals(chapterId)
    .toArray();
  for (const t of threads) {
    if (t.chapterLevel) continue;
    const should = !presentIds.has(t.id);
    if (!!t.orphaned !== should) {
      await db.comments.update(t.id, { orphaned: should });
    }
  }
}

/* ---------- Revisions ---------- */
export async function createRevision(
  r: Omit<ProposedRevision, 'id' | 'createdAt' | 'state'> &
    Partial<Pick<ProposedRevision, 'state'>>
): Promise<ProposedRevision> {
  const rev: ProposedRevision = {
    ...r,
    id: newId(),
    createdAt: nowISO(),
    state: r.state ?? 'pending',
  } as ProposedRevision;
  await db.revisions.add(rev);
  return rev;
}

export async function updateRevision(id: string, patch: Partial<ProposedRevision>) {
  await db.revisions.update(id, patch);
}

export async function deleteRevision(id: string) {
  await db.revisions.delete(id);
}

/* ---------- Snapshots ---------- */
export async function createSnapshot(
  chapterId: string,
  reason: string
): Promise<ChapterSnapshot | null> {
  const ch = await db.chapters.get(chapterId);
  if (!ch) return null;
  const snap: ChapterSnapshot = {
    id: newId(),
    projectId: ch.projectId,
    chapterId,
    reason,
    contentJSON: ch.contentJSON,
    wordCount: ch.wordCount,
    createdAt: nowISO(),
  };
  await db.snapshots.add(snap);
  // Retention: keep newest 30 per chapter.
  const all = await db.snapshots
    .where('chapterId')
    .equals(chapterId)
    .toArray();
  all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const excess = all.length - 30;
  for (let i = 0; i < excess; i++) await db.snapshots.delete(all[i].id);
  return snap;
}
