import {
  createArc,
  createChapter,
  createProject,
  createVolume,
  saveChapterContent,
  updateArc,
  updateChapterOutline,
} from '../db/repo';
import { fastHash } from '../utils/id';
import { docToPlainText } from '../utils/wordCount';
import { db } from '../db/database';

/**
 * Seed a self-contained demo project. The prose here is placeholder text
 * written for this app only — not canon from any external manuscript.
 */
export async function seedDemoProject() {
  const project = await createProject('三周目，魔王怎么还是你？', { isDemo: true });
  await db.projects.update(project.id, {
    synopsis:
      '示例项目 · 这不是正式稿。用来演示章节、事件组、评论与修订功能。',
  });

  const vol = await createVolume(project.id, '第一卷 · 旅途的开始');

  const arc1 = await createArc(project.id, vol.id, '事件组 01 · 初遇');
  await updateArc(arc1.id, {
    summary: '霜与珏在第三次循环开始时再次相遇，气氛比前两次更为微妙。',
    centralConflict: '两人都记得之前的循环，却都在观察对方记得多少。',
    endingState: '他们决定暂时结伴同行。',
    status: 'draft',
  });

  const arc2 = await createArc(project.id, vol.id, '事件组 02 · 水磨坊的异闻');
  await updateArc(arc2.id, {
    summary: '调查一座反复出现、每次细节略有不同的废弃水磨坊。',
    centralConflict: '水磨坊是循环的某种残留物，还是循环本身的缝隙？',
    endingState: '珏的魔力首次发生明显的不受控变化。',
    status: 'outline',
  });

  const arc3 = await createArc(project.id, vol.id, '事件组 03 · 城市与试炼');
  await updateArc(arc3.id, {
    summary: '抵达城市，接受一次本不该出现在这个节点的试炼。',
    status: 'not_started',
  });

  // Chapter 1 — with manuscript (including a real inline comment mark),
  // and a pending revision in chapter 2 below.
  const ch1 = await createChapter(project.id, arc1.id, '第 1 章 · 又是你');
  const inlineCommentId = (await db.comments.toCollection().count()) === 0
    ? 'demo-cmt-1'
    : 'demo-cmt-1';
  const ch1Doc = {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: '霜站在岔路口，等了很久。' }] },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text:
              '风从身后吹过来，把斗篷的下摆卷起来又放下。她已经数过了，这是她第三次站在这里。',
          },
        ],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: '脚步声从左边的小路传来。她没有回头。她知道来的是谁。' },
        ],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: '"你比上次早到了半天。"她说。' }],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: '珏停下脚步。沉默了一会儿，才开口：' },
          {
            type: 'text',
            text: '"你也是。"',
            marks: [
              {
                type: 'comment',
                attrs: { commentId: inlineCommentId, resolved: false },
              },
            ],
          },
        ],
      },
    ],
  };
  await saveChapterContent(ch1.id, ch1Doc);
  // Create the comment thread with the matching id.
  await db.comments.add({
    id: inlineCommentId,
    projectId: project.id,
    chapterId: ch1.id,
    anchorText: '"你也是。"',
    orphaned: false,
    resolved: false,
    messages: [
      {
        id: 'demo-msg-1',
        authorKind: 'human',
        body: '这里的"你也是"有一点太轻了，是否可以让珏先走近一步再说？',
        createdAt: new Date().toISOString(),
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  await updateChapterOutline(ch1.id, {
    summary: '第三次循环的开端，两人在岔路口再次相遇。',
    narrativeGoal: '建立世界观与"循环"概念；暗示两人都保有前次记忆。',
    foreshadowingPlanted: '斗篷下摆被风卷起的细节（之后会再次出现）。',
    endingHook: '珏的那句"你也是"——她究竟记得多少？',
    events: [],
  });
  // Add a few events via direct DB (faster than calling addSceneEvent each)
  await updateChapterOutline(ch1.id, {
    events: [
      {
        id: 'ev-1-a',
        title: '在岔路口等待',
        description: '霜已经数不清这是第几次站在这里。',
        status: 'done',
        order: 0,
      } as any,
      {
        id: 'ev-1-b',
        title: '脚步声从左边传来',
        description: '霜没有回头，她认得这个节奏。',
        status: 'done',
        order: 1,
      } as any,
      {
        id: 'ev-1-c',
        title: '两人确认彼此的"记得"',
        description: '用一句暧昧的对白代替正面问话。',
        status: 'done',
        order: 2,
      } as any,
    ],
  });

  // Chapter 2 — with a pending revision pre-seeded.
  const ch2 = await createChapter(project.id, arc2.id, '第 4 章 · 水磨坊的夜晚');
  const revId = 'demo-rev-1';
  const originalSentence = '珏没有躲开。她甚至主动握住了霜的手。';
  const proposedSentence =
    '珏的肩膀微微一僵。她低头看了一眼那只手，片刻后，才慢慢放松了紧绷的指节。至少这一次，她没有退开。';
  const ch2Doc = {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: '水磨坊比白天看起来小得多。' }] },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: originalSentence,
            marks: [{ type: 'revDelete', attrs: { revId } }],
          },
          {
            type: 'text',
            text: proposedSentence,
            marks: [{ type: 'revInsert', attrs: { revId } }],
          },
        ],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: '"这里的空气是停滞的。"她说。' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: '霜想说点什么，但没说出来。' }],
      },
    ],
  };
  await saveChapterContent(ch2.id, ch2Doc);
  await updateChapterOutline(ch2.id, {
    summary: '夜晚潜入水磨坊，珏的魔力第一次出现异常。',
    narrativeGoal: '把"水磨坊"立成循环中的锚点意象。',
    endingHook: '珏的指尖残留一点灰白的光。',
    events: [
      {
        id: 'ev-2-a',
        title: '调查水磨坊的异常',
        description: '',
        status: 'done',
        order: 0,
      } as any,
      {
        id: 'ev-2-b',
        title: '发现隐藏的线索',
        description: '',
        status: 'todo',
        order: 1,
      } as any,
      {
        id: 'ev-2-c',
        title: '珏的魔力发生第一次明显变化',
        description: '',
        status: 'todo',
        order: 2,
      } as any,
    ],
  });

  // Insert the revision record with the fixed id so it matches the marks above.
  const ch2Plain = docToPlainText(ch2Doc);
  await db.revisions.add({
    id: revId,
    projectId: project.id,
    chapterId: ch2.id,
    reason: '节奏太快。珏现在还不太习惯身体接触，反应应该更克制一点。',
    originalText: originalSentence,
    proposedText: proposedSentence,
    baseManuscriptHash: fastHash(ch2Plain),
    state: 'pending',
    createdAt: new Date().toISOString(),
  });

  // Chapter 3 — empty outline, counts as "not started"
  await createChapter(project.id, arc1.id, '第 2 章 · 同行的第一夜');
  await createChapter(project.id, arc1.id, '第 3 章 · 一枚旧硬币');
  await createChapter(project.id, arc2.id, '第 5 章 · 磨坊主的女儿');
  await createChapter(project.id, arc2.id, '第 6 章 · 第一次失控');
  await createChapter(project.id, arc3.id, '第 7 章 · 抵达城市');
  await createChapter(project.id, arc3.id, '第 8 章 · 试炼开始');
  await createChapter(project.id, arc3.id, '第 9 章 · 谁是我们');

  return project;
}
