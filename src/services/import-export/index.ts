import { db } from '../../db/database';
import type {
  BackupFile,
  Chapter,
  ChapterSnapshot,
  CommentThread,
  NovelProject,
  ProposedRevision,
  StoryArc,
  Volume,
} from '../../models/types';
import { SCHEMA_VERSION } from '../../models/types';
import { nowISO, newId } from '../../utils/id';
import { createChapter, saveChapterContent } from '../../db/repo';
import { docToPlainText } from '../../utils/wordCount';

/* ---------- Export ---------- */
export async function exportProjectJSON(projectId: string): Promise<BackupFile> {
  const project = await db.projects.get(projectId);
  if (!project) throw new Error('项目不存在');
  const [volumes, arcs, chapters, comments, revisions, snapshots] =
    await Promise.all([
      db.volumes.where('projectId').equals(projectId).toArray(),
      db.arcs.where('projectId').equals(projectId).toArray(),
      db.chapters.where('projectId').equals(projectId).toArray(),
      db.comments.where('projectId').equals(projectId).toArray(),
      db.revisions.where('projectId').equals(projectId).toArray(),
      db.snapshots.where('projectId').equals(projectId).toArray(),
    ]);
  return {
    kind: 'novel-studio-backup',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: nowISO(),
    projects: [project],
    volumes,
    arcs,
    chapters,
    comments,
    revisions,
    snapshots,
  };
}

export async function exportChapterMarkdown(chapterId: string): Promise<string> {
  const ch = await db.chapters.get(chapterId);
  if (!ch) throw new Error('章节不存在');
  const plain = docToPlainText(ch.contentJSON);
  return `# ${ch.title}\n\n${plain.trim()}\n`;
}

export async function exportProjectMarkdown(projectId: string): Promise<string> {
  const proj = await db.projects.get(projectId);
  const [volumes, arcs, chapters] = await Promise.all([
    db.volumes.where('projectId').equals(projectId).sortBy('order'),
    db.arcs.where('projectId').equals(projectId).sortBy('order'),
    db.chapters
      .where('projectId')
      .equals(projectId)
      .and((c) => !c.deletedAt)
      .sortBy('order'),
  ]);
  const lines: string[] = [`# ${proj?.title ?? '未命名小说'}\n`];
  for (const vol of volumes) {
    lines.push(`\n## ${vol.title}\n`);
    for (const arc of arcs.filter((a) => a.volumeId === vol.id)) {
      lines.push(`\n### ${arc.title}\n`);
      const chs = chapters
        .filter((c) => c.arcId === arc.id)
        .sort((a, b) => a.order - b.order);
      for (const ch of chs) {
        lines.push(`\n#### ${ch.title}\n`);
        lines.push(docToPlainText(ch.contentJSON).trim() + '\n');
      }
    }
  }
  return lines.join('');
}

/* ---------- Import ---------- */

/**
 * Split a block of Chinese text into chapters based on headings like
 * "第X章", "第X卷", "Chapter X", or markdown headings. Returns a list of
 * {title, body} pairs the user can then confirm.
 */
export function splitIntoChapters(
  text: string
): { title: string; body: string }[] {
  const lines = text.split(/\r?\n/);
  const headingRe =
    /^(?:#{1,4}\s+.+|第[一二三四五六七八九十百千0-9]+[章节回]\s*[:： ]?\s*.*|Chapter\s+\d+.*)$/;
  const out: { title: string; body: string }[] = [];
  let cur: { title: string; body: string } | null = null;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (headingRe.test(line.trim())) {
      if (cur) out.push({ ...cur, body: cur.body.trim() });
      const title = line.replace(/^#{1,4}\s+/, '').trim();
      cur = { title, body: '' };
    } else {
      if (!cur) cur = { title: '未命名', body: '' };
      cur.body += (cur.body ? '\n' : '') + line;
    }
  }
  if (cur) out.push({ ...cur, body: cur.body.trim() });
  return out.filter((c) => c.title || c.body);
}

export function textToDoc(text: string): any {
  const paragraphs = text
    .replace(/\r/g, '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length === 0)
    return { type: 'doc', content: [{ type: 'paragraph' }] };
  return {
    type: 'doc',
    content: paragraphs.map((p) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: p }],
    })),
  };
}

export async function importChaptersIntoArc(
  projectId: string,
  arcId: string,
  chunks: { title: string; body: string }[]
) {
  for (const c of chunks) {
    const ch = await createChapter(projectId, arcId, c.title);
    await saveChapterContent(ch.id, textToDoc(c.body));
  }
}

export async function importBackup(
  file: BackupFile,
  mode: 'new_project' | 'replace' = 'new_project'
) {
  if (file.kind !== 'novel-studio-backup') throw new Error('备份格式无效');
  if (file.schemaVersion > SCHEMA_VERSION) {
    // Future-dated backup; attempt best-effort import.
    console.warn('Backup is from a newer schema version — may lose data.');
  }
  // Map old id → new id when importing as new project so we don't collide.
  const remap = new Map<string, string>();
  const rid = (oldId: string) => {
    if (mode === 'replace') return oldId;
    let n = remap.get(oldId);
    if (!n) {
      n = newId();
      remap.set(oldId, n);
    }
    return n;
  };

  await db.transaction(
    'rw',
    [db.projects, db.volumes, db.arcs, db.chapters, db.comments, db.revisions, db.snapshots],
    async () => {
      if (mode === 'replace') {
        for (const p of file.projects) {
          await db.comments.where('projectId').equals(p.id).delete();
          await db.revisions.where('projectId').equals(p.id).delete();
          await db.snapshots.where('projectId').equals(p.id).delete();
          await db.chapters.where('projectId').equals(p.id).delete();
          await db.arcs.where('projectId').equals(p.id).delete();
          await db.volumes.where('projectId').equals(p.id).delete();
          await db.projects.delete(p.id);
        }
      }
      for (const p of file.projects) {
        await db.projects.add({ ...p, id: rid(p.id) });
      }
      for (const v of file.volumes as Volume[]) {
        await db.volumes.add({
          ...v,
          id: rid(v.id),
          projectId: rid(v.projectId),
        });
      }
      for (const a of file.arcs as StoryArc[]) {
        await db.arcs.add({
          ...a,
          id: rid(a.id),
          projectId: rid(a.projectId),
          volumeId: rid(a.volumeId),
        });
      }
      for (const c of file.chapters as Chapter[]) {
        await db.chapters.add({
          ...c,
          id: rid(c.id),
          projectId: rid(c.projectId),
          arcId: rid(c.arcId),
        });
      }
      for (const t of file.comments as CommentThread[]) {
        await db.comments.add({
          ...t,
          id: rid(t.id),
          projectId: rid(t.projectId),
          chapterId: rid(t.chapterId),
        });
      }
      for (const r of file.revisions as ProposedRevision[]) {
        await db.revisions.add({
          ...r,
          id: rid(r.id),
          projectId: rid(r.projectId),
          chapterId: rid(r.chapterId),
          commentId: r.commentId ? rid(r.commentId) : undefined,
        });
      }
      for (const s of file.snapshots as ChapterSnapshot[]) {
        await db.snapshots.add({
          ...s,
          id: rid(s.id),
          projectId: rid(s.projectId),
          chapterId: rid(s.chapterId),
        });
      }
    }
  );
}

export function downloadBlob(filename: string, content: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
