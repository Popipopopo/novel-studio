import { useLiveQuery } from 'dexie-react-hooks';
import {
  Book,
  ChevronDown,
  ChevronRight,
  Plus,
  Copy,
  Trash2,
  MoreHorizontal,
  Search,
  FolderPlus,
  Edit3,
} from 'lucide-react';
import { useMemo, useState, useRef } from 'react';
import { db } from '../../db/database';
import {
  createArc,
  createChapter,
  createVolume,
  deleteArc,
  deleteVolume,
  duplicateChapter,
  softDeleteChapter,
  updateArc,
  updateChapter,
  updateVolume,
} from '../../db/repo';
import { useAppStore } from '../../store/useAppStore';
import type { Chapter, StoryArc, Volume } from '../../models/types';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export default function LeftNav() {
  const projectId = useAppStore((s) => s.activeProjectId);
  const activeChapterId = useAppStore((s) => s.activeChapterId);
  const setActiveChapter = useAppStore((s) => s.setActiveChapter);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);

  const project = useLiveQuery(
    () => (projectId ? db.projects.get(projectId) : undefined),
    [projectId]
  );
  const volumes = useLiveQuery(
    () =>
      projectId
        ? db.volumes.where('projectId').equals(projectId).sortBy('order')
        : [],
    [projectId]
  ) ?? [];
  const arcs = useLiveQuery(
    () =>
      projectId
        ? db.arcs.where('projectId').equals(projectId).sortBy('order')
        : [],
    [projectId]
  ) ?? [];
  const chapters = useLiveQuery(
    () =>
      projectId
        ? db.chapters
            .where('projectId')
            .equals(projectId)
            .and((c) => !c.deletedAt)
            .sortBy('order')
        : [],
    [projectId]
  ) ?? [];
  const openComments = useLiveQuery(
    () =>
      projectId
        ? db.comments
            .where('projectId')
            .equals(projectId)
            .and((c) => !c.resolved)
            .toArray()
        : [],
    [projectId]
  ) ?? [];

  const commentsByChapter = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of openComments) m.set(c.chapterId, (m.get(c.chapterId) ?? 0) + 1);
    return m;
  }, [openComments]);

  const filteredChapters = useMemo(() => {
    if (!searchQuery) return chapters;
    const q = searchQuery.toLowerCase();
    return chapters.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.plainText.toLowerCase().includes(q)
    );
  }, [chapters, searchQuery]);

  const hitIds = useMemo(
    () => new Set(filteredChapters.map((c) => c.id)),
    [filteredChapters]
  );

  if (!project) {
    return (
      <div className="p-4 text-sm text-ink-300">未选择项目。请前往"项目设置"。</div>
    );
  }

  return (
    <div className="h-full flex flex-col thin-scroll overflow-y-auto">
      <div className="px-4 py-3 border-b border-paper-200 dark:border-ink-500 sticky top-0 bg-paper-50 dark:bg-ink-700 z-10">
        <div className="flex items-center gap-2 font-serif font-semibold">
          <Book size={16} className="text-accent-500" />
          <span className="truncate">{project.title}</span>
        </div>
        <div className="mt-2 relative">
          <Search
            size={13}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-ink-300"
          />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索章节 / 正文……"
            className="w-full pl-7 pr-2 py-1 text-xs rounded border border-paper-200 dark:border-ink-500 bg-white dark:bg-ink-800 outline-none focus:border-accent-300"
          />
        </div>
      </div>

      <div className="flex-1 py-2">
        {volumes.map((vol) => (
          <VolumeNode
            key={vol.id}
            vol={vol}
            arcs={arcs.filter((a) => a.volumeId === vol.id)}
            chapters={chapters}
            hitIds={hitIds}
            searching={!!searchQuery}
            activeChapterId={activeChapterId}
            commentsByChapter={commentsByChapter}
            onPick={setActiveChapter}
          />
        ))}
        {volumes.length === 0 && (
          <div className="px-4 py-6 text-xs text-ink-300">
            还没有分卷。点击下方 + 创建第一卷。
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-t border-paper-200 dark:border-ink-500 flex justify-between gap-2 sticky bottom-0 bg-paper-50 dark:bg-ink-700">
        <button
          className="ghost text-xs flex items-center gap-1"
          onClick={async () => {
            const name = window.prompt('新卷名称', `第${volumes.length + 1}卷`);
            if (name) await createVolume(project.id, name);
          }}
        >
          <FolderPlus size={13} /> 新建卷
        </button>
      </div>
    </div>
  );
}

function VolumeNode({
  vol,
  arcs,
  chapters,
  hitIds,
  searching,
  activeChapterId,
  commentsByChapter,
  onPick,
}: {
  vol: Volume;
  arcs: StoryArc[];
  chapters: Chapter[];
  hitIds: Set<string>;
  searching: boolean;
  activeChapterId: string | null;
  commentsByChapter: Map<string, number>;
  onPick: (id: string) => void;
}) {
  const [open, setOpen] = useState(!vol.collapsed);
  return (
    <div className="mb-1">
      <div className="group flex items-center px-3 py-1 text-[13px] font-serif text-ink-500 dark:text-ink-50">
        <button
          onClick={() => {
            setOpen((v) => !v);
            updateVolume(vol.id, { collapsed: open });
          }}
          className="p-0.5"
        >
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <div
          className="flex-1 truncate cursor-pointer"
          onDoubleClick={async () => {
            const name = window.prompt('重命名卷', vol.title);
            if (name) await updateVolume(vol.id, { title: name });
          }}
        >
          {vol.title}
        </div>
        <RowActions
          onAdd={async () => {
            const name = window.prompt('新事件组名称', `事件组 ${arcs.length + 1}`);
            if (name) await createArc(vol.projectId, vol.id, name);
          }}
          onRename={async () => {
            const name = window.prompt('重命名卷', vol.title);
            if (name) await updateVolume(vol.id, { title: name });
          }}
          onDelete={async () => {
            if (window.confirm(`删除卷"${vol.title}"及其所有事件组和章节？`))
              await deleteVolume(vol.id);
          }}
          label="卷"
        />
      </div>
      {open && (
        <div className="pl-3">
          {arcs.map((arc) => (
            <ArcNode
              key={arc.id}
              arc={arc}
              chapters={chapters.filter((c) => c.arcId === arc.id)}
              hitIds={hitIds}
              searching={searching}
              activeChapterId={activeChapterId}
              commentsByChapter={commentsByChapter}
              onPick={onPick}
            />
          ))}
          {arcs.length === 0 && (
            <div className="pl-6 py-1 text-xs text-ink-300">
              还没有事件组。
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ArcNode({
  arc,
  chapters,
  hitIds,
  searching,
  activeChapterId,
  commentsByChapter,
  onPick,
}: {
  arc: StoryArc;
  chapters: Chapter[];
  hitIds: Set<string>;
  searching: boolean;
  activeChapterId: string | null;
  commentsByChapter: Map<string, number>;
  onPick: (id: string) => void;
}) {
  const [open, setOpen] = useState(!arc.collapsed);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const sortedIds = chapters.map((c) => c.id);

  const visible = searching ? chapters.filter((c) => hitIds.has(c.id)) : chapters;

  return (
    <div className="mb-1">
      <div className="group flex items-center px-3 py-1 text-[12.5px] text-ink-400 dark:text-ink-100">
        <button
          onClick={() => {
            setOpen((v) => !v);
            updateArc(arc.id, { collapsed: open });
          }}
          className="p-0.5"
        >
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
        <div
          className="flex-1 truncate cursor-pointer"
          onDoubleClick={async () => {
            const name = window.prompt('重命名事件组', arc.title);
            if (name) await updateArc(arc.id, { title: name });
          }}
        >
          <span className="text-ink-300 mr-1">◇</span>
          {arc.title}
        </div>
        <RowActions
          onAdd={async () => {
            const name = window.prompt('新章节标题', `第 ${chapters.length + 1} 章`);
            if (!name) return;
            const ch = await createChapter(arc.projectId, arc.id, name);
            onPick(ch.id);
          }}
          onRename={async () => {
            const name = window.prompt('重命名事件组', arc.title);
            if (name) await updateArc(arc.id, { title: name });
          }}
          onDelete={async () => {
            if (window.confirm(`删除事件组"${arc.title}"及其所有章节？`))
              await deleteArc(arc.id);
          }}
          label="事件组"
        />
      </div>
      {open && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={async (ev) => {
            const { active, over } = ev;
            if (!over || active.id === over.id) return;
            const oldIndex = sortedIds.indexOf(String(active.id));
            const newIndex = sortedIds.indexOf(String(over.id));
            const next = arrayMove(sortedIds, oldIndex, newIndex);
            for (let i = 0; i < next.length; i++) {
              await updateChapter(next[i], { order: i });
            }
          }}
        >
          <SortableContext items={sortedIds} strategy={verticalListSortingStrategy}>
            <div className="pl-5 py-0.5">
              {visible.map((ch) => (
                <ChapterRow
                  key={ch.id}
                  ch={ch}
                  active={ch.id === activeChapterId}
                  openComments={commentsByChapter.get(ch.id) ?? 0}
                  onPick={() => onPick(ch.id)}
                />
              ))}
              {visible.length === 0 && (
                <div className="py-1 text-[11px] text-ink-300">
                  {searching ? '未命中' : '尚无章节'}
                </div>
              )}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function ChapterRow({
  ch,
  active,
  openComments,
  onPick,
}: {
  ch: Chapter;
  active: boolean;
  openComments: number;
  onPick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ch.id,
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onPick}
      className={
        'group flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-[12.5px] transition ' +
        (active
          ? 'bg-accent-100 text-ink-600 dark:bg-accent-600 dark:text-ink-50'
          : 'hover:bg-paper-100 dark:hover:bg-ink-600')
      }
    >
      <div className="flex-1 truncate">{ch.title}</div>
      {openComments > 0 && (
        <span
          title={`${openComments} 条未解决评论`}
          className="text-[10px] text-amber-700 bg-amber-100 dark:bg-amber-900/40 px-1.5 rounded-full"
        >
          {openComments}
        </span>
      )}
      <span className="text-[10px] text-ink-300">{ch.wordCount}</span>
      <RowActions
        compact
        onRename={async () => {
          const name = window.prompt('重命名章节', ch.title);
          if (name) await updateChapter(ch.id, { title: name });
        }}
        onDuplicate={async () => {
          await duplicateChapter(ch.id);
        }}
        onDelete={async () => {
          if (window.confirm(`将章节"${ch.title}"移入回收站？`))
            await softDeleteChapter(ch.id);
        }}
        label="章节"
      />
    </div>
  );
}

function RowActions({
  onAdd,
  onRename,
  onDuplicate,
  onDelete,
  compact,
  label,
}: {
  onAdd?: () => void;
  onRename?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  compact?: boolean;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className="relative opacity-0 group-hover:opacity-100 focus-within:opacity-100"
      onClick={(e) => e.stopPropagation()}
    >
      <button className="ghost" onClick={() => setOpen((v) => !v)} title={`${label}操作`}>
        <MoreHorizontal size={compact ? 12 : 14} />
      </button>
      {open && (
        <div
          className="absolute right-0 top-6 w-40 z-20 bg-white dark:bg-ink-700 border border-paper-200 dark:border-ink-500 rounded shadow-md py-1 text-xs"
          onMouseLeave={() => setOpen(false)}
        >
          {onAdd && (
            <button
              className="w-full px-3 py-1.5 text-left hover:bg-paper-100 dark:hover:bg-ink-600 flex items-center gap-2"
              onClick={() => {
                setOpen(false);
                onAdd();
              }}
            >
              <Plus size={12} /> 新建
            </button>
          )}
          {onRename && (
            <button
              className="w-full px-3 py-1.5 text-left hover:bg-paper-100 dark:hover:bg-ink-600 flex items-center gap-2"
              onClick={() => {
                setOpen(false);
                onRename();
              }}
            >
              <Edit3 size={12} /> 重命名
            </button>
          )}
          {onDuplicate && (
            <button
              className="w-full px-3 py-1.5 text-left hover:bg-paper-100 dark:hover:bg-ink-600 flex items-center gap-2"
              onClick={() => {
                setOpen(false);
                onDuplicate();
              }}
            >
              <Copy size={12} /> 复制
            </button>
          )}
          {onDelete && (
            <button
              className="w-full px-3 py-1.5 text-left hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 flex items-center gap-2"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
            >
              <Trash2 size={12} /> 删除
            </button>
          )}
        </div>
      )}
    </div>
  );
}
