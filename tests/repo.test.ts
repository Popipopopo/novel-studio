import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/database';
import {
  createArc,
  createChapter,
  createCommentThread,
  createProject,
  createRevision,
  createVolume,
  duplicateChapter,
  saveChapterContent,
  softDeleteChapter,
  restoreChapter,
  updateChapterOutline,
  addSceneEvent,
  reorderSceneEvents,
} from '../src/db/repo';
import { fastHash } from '../src/utils/id';
import {
  exportProjectJSON,
  importBackup,
  splitIntoChapters,
  textToDoc,
} from '../src/services/import-export';
import { docToPlainText } from '../src/utils/wordCount';

async function resetDB() {
  await db.delete();
  await db.open();
}

beforeEach(async () => {
  await resetDB();
});

describe('core data model', () => {
  it('creates a project with volume → arc → chapter hierarchy', async () => {
    const p = await createProject('测试书');
    const v = await createVolume(p.id, '第一卷');
    const a = await createArc(p.id, v.id, '事件组 01');
    const ch = await createChapter(p.id, a.id, '第 1 章');
    expect(ch.projectId).toBe(p.id);
    expect(ch.arcId).toBe(a.id);
    expect(ch.wordCount).toBe(0);
  });

  it('persists manuscript edits and computes Chinese word count', async () => {
    const p = await createProject('测试书');
    const v = await createVolume(p.id, '一');
    const a = await createArc(p.id, v.id, '一');
    const ch = await createChapter(p.id, a.id, '一');
    await saveChapterContent(ch.id, textToDoc('霜站在岔路口，等了很久。'));
    const after = await db.chapters.get(ch.id);
    expect(after!.plainText.replace(/\s+/g, '')).toBe('霜站在岔路口，等了很久。');
    expect(after!.wordCount).toBeGreaterThan(0);
  });

  it('soft deletes and restores chapters', async () => {
    const p = await createProject('测试书');
    const v = await createVolume(p.id, '一');
    const a = await createArc(p.id, v.id, '一');
    const ch = await createChapter(p.id, a.id, '一');
    await softDeleteChapter(ch.id);
    const trashed = await db.chapters.get(ch.id);
    expect(trashed!.deletedAt).toBeTruthy();
    await restoreChapter(ch.id);
    const back = await db.chapters.get(ch.id);
    expect(back!.deletedAt).toBeUndefined();
  });

  it('duplicates a chapter with suffix', async () => {
    const p = await createProject('测试书');
    const v = await createVolume(p.id, '一');
    const a = await createArc(p.id, v.id, '一');
    const ch = await createChapter(p.id, a.id, '原章');
    const copy = await duplicateChapter(ch.id);
    expect(copy!.title).toMatch(/副本/);
    expect(copy!.id).not.toBe(ch.id);
  });
});

describe('scene events', () => {
  it('adds and reorders events deterministically', async () => {
    const p = await createProject('测试书');
    const v = await createVolume(p.id, '一');
    const a = await createArc(p.id, v.id, '一');
    const ch = await createChapter(p.id, a.id, '一');
    const e1 = (await addSceneEvent(ch.id, 'A'))!;
    const e2 = (await addSceneEvent(ch.id, 'B'))!;
    const e3 = (await addSceneEvent(ch.id, 'C'))!;
    await reorderSceneEvents(ch.id, [e3.id, e1.id, e2.id]);
    const after = await db.chapters.get(ch.id);
    expect(after!.outline.events.map((e) => e.title)).toEqual(['C', 'A', 'B']);
  });
});

describe('comments', () => {
  it('creates a thread and lets us resolve/reopen', async () => {
    const p = await createProject('a');
    const v = await createVolume(p.id, 'v');
    const a = await createArc(p.id, v.id, 'a');
    const ch = await createChapter(p.id, a.id, 'c');
    const t = await createCommentThread(p.id, ch.id, 'hi');
    expect(t.resolved).toBe(false);
    await db.comments.update(t.id, { resolved: true });
    const after = await db.comments.get(t.id);
    expect(after!.resolved).toBe(true);
  });
});

describe('revisions conflict detection', () => {
  it('detects when the manuscript hash drifts from the base', async () => {
    const p = await createProject('a');
    const v = await createVolume(p.id, 'v');
    const a = await createArc(p.id, v.id, 'a');
    const ch = await createChapter(p.id, a.id, 'c');
    await saveChapterContent(ch.id, textToDoc('原始句子。'));
    const after = await db.chapters.get(ch.id);
    const baseHash = fastHash(docToPlainText(after!.contentJSON));
    await createRevision({
      projectId: p.id,
      chapterId: ch.id,
      originalText: '原始句子。',
      proposedText: '改写后的句子。',
      baseManuscriptHash: baseHash,
    });
    // Now the human edits the chapter manually
    await saveChapterContent(ch.id, textToDoc('完全不同的内容。'));
    const latest = await db.chapters.get(ch.id);
    const newHash = fastHash(docToPlainText(latest!.contentJSON));
    expect(newHash).not.toBe(baseHash);
  });
});

describe('import/export', () => {
  it('round-trips a project through JSON', async () => {
    const p = await createProject('原');
    const v = await createVolume(p.id, 'v1');
    const a = await createArc(p.id, v.id, 'a1');
    const ch = await createChapter(p.id, a.id, 'ch1');
    await saveChapterContent(ch.id, textToDoc('一些内容。'));
    await updateChapterOutline(ch.id, { summary: '简介' });

    const backup = await exportProjectJSON(p.id);
    // Clear and reimport
    await db.delete();
    await db.open();

    await importBackup(backup, 'replace');
    const projects = await db.projects.toArray();
    const chapters = await db.chapters.toArray();
    expect(projects.length).toBe(1);
    expect(chapters.length).toBe(1);
    expect(chapters[0].outline.summary).toBe('简介');
  });

  it('splits markdown-style chapter headings', () => {
    const text =
      '# 第一章 相遇\n开场内容。\n\n# 第二章 别离\n结尾内容。';
    const chunks = splitIntoChapters(text);
    expect(chunks.length).toBe(2);
    expect(chunks[0].title).toMatch(/第一章/);
    expect(chunks[1].body).toMatch(/结尾/);
  });

  it('splits "第X章" Chinese headings without markdown', () => {
    const text = '第一章 相遇\n开场内容。\n第二章 别离\n结尾内容。';
    const chunks = splitIntoChapters(text);
    expect(chunks.length).toBe(2);
  });
});
