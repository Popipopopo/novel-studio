import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ArrowRight } from 'lucide-react';
import { db } from '../../db/database';
import type { Chapter, StoryArc, Volume } from '../../models/types';
import { WritingStatusLabel } from '../../models/types';
import { useAppStore } from '../../store/useAppStore';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { updateChapter } from '../../db/repo';

export default function StoryBoard() {
  const projectId = useAppStore((s) => s.activeProjectId);
  const setActiveChapter = useAppStore((s) => s.setActiveChapter);
  const setTopView = useAppStore((s) => s.setTopView);

  const project = useLiveQuery(
    () => (projectId ? db.projects.get(projectId) : undefined),
    [projectId]
  );
  const volumes =
    useLiveQuery(
      () =>
        projectId
          ? db.volumes.where('projectId').equals(projectId).sortBy('order')
          : [],
      [projectId]
    ) ?? [];
  const arcs =
    useLiveQuery(
      () =>
        projectId
          ? db.arcs.where('projectId').equals(projectId).sortBy('order')
          : [],
      [projectId]
    ) ?? [];
  const chapters =
    useLiveQuery(
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

  const chaptersByArc = useMemo(() => {
    const m = new Map<string, Chapter[]>();
    for (const c of chapters) {
      const arr = m.get(c.arcId) ?? [];
      arr.push(c);
      m.set(c.arcId, arr);
    }
    return m;
  }, [chapters]);

  if (!project) return <div className="p-6 text-ink-300">未选择项目。</div>;

  return (
    <div className="h-full overflow-y-auto thin-scroll px-8 py-8 max-w-[1100px] mx-auto">
      <div className="mb-6">
        <div className="text-xs text-ink-300 tracking-widest">剧情总览</div>
        <h2 className="font-serif text-2xl mt-1">{project.title}</h2>
        {project.synopsis && (
          <p className="text-sm text-ink-400 dark:text-ink-100 mt-2 whitespace-pre-wrap">
            {project.synopsis}
          </p>
        )}
      </div>

      <div className="space-y-8">
        {volumes.map((vol) => (
          <VolumeBoard
            key={vol.id}
            vol={vol}
            arcs={arcs.filter((a) => a.volumeId === vol.id)}
            chaptersByArc={chaptersByArc}
            onOpen={(id) => {
              setActiveChapter(id);
              setTopView('write');
            }}
          />
        ))}
      </div>
    </div>
  );
}

function VolumeBoard({
  vol,
  arcs,
  chaptersByArc,
  onOpen,
}: {
  vol: Volume;
  arcs: StoryArc[];
  chaptersByArc: Map<string, Chapter[]>;
  onOpen: (id: string) => void;
}) {
  return (
    <section>
      <h3 className="font-serif text-lg text-ink-500 dark:text-ink-50 border-b border-paper-200 dark:border-ink-500 pb-2 mb-4">
        <span className="text-accent-500 mr-2">◇</span>
        {vol.title}
      </h3>
      <div className="space-y-4">
        {arcs.map((arc) => (
          <ArcBoard
            key={arc.id}
            arc={arc}
            chapters={chaptersByArc.get(arc.id) ?? []}
            onOpen={onOpen}
          />
        ))}
      </div>
    </section>
  );
}

function ArcBoard({
  arc,
  chapters,
  onOpen,
}: {
  arc: StoryArc;
  chapters: Chapter[];
  onOpen: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );
  const ids = chapters.map((c) => c.id);
  return (
    <div className="rounded-lg border border-paper-200 dark:border-ink-500 bg-white/60 dark:bg-ink-700/60 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-paper-100/50 dark:hover:bg-ink-600/50"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="font-serif">{arc.title}</span>
        <span className="text-[11px] text-ink-300">· {chapters.length} 章</span>
      </button>
      {open && (
        <div className="px-4 py-3 space-y-3">
          {(arc.summary || arc.centralConflict) && (
            <div className="text-xs text-ink-400 dark:text-ink-100 space-y-1">
              {arc.summary && (
                <div>
                  <span className="text-ink-300">概要：</span>
                  {arc.summary}
                </div>
              )}
              {arc.centralConflict && (
                <div>
                  <span className="text-ink-300">核心冲突：</span>
                  {arc.centralConflict}
                </div>
              )}
              {arc.endingState && (
                <div>
                  <span className="text-ink-300">结局/收束：</span>
                  {arc.endingState}
                </div>
              )}
            </div>
          )}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={async (ev) => {
              const { active, over } = ev;
              if (!over || active.id === over.id) return;
              const oldI = ids.indexOf(String(active.id));
              const newI = ids.indexOf(String(over.id));
              const next = arrayMove(ids, oldI, newI);
              for (let i = 0; i < next.length; i++) {
                await updateChapter(next[i], { order: i });
              }
            }}
          >
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {chapters.map((c) => (
                  <ChapterCard key={c.id} ch={c} onOpen={() => onOpen(c.id)} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  );
}

function ChapterCard({ ch, onOpen }: { ch: Chapter; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ch.id,
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const statusColor =
    ch.status === 'done'
      ? 'bg-accent-100 text-accent-600 dark:bg-accent-600/40 dark:text-accent-100'
      : ch.status === 'draft' || ch.status === 'revising'
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200'
      : 'bg-paper-100 text-ink-300 dark:bg-ink-500 dark:text-ink-100';
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="rounded border border-paper-200 dark:border-ink-500 bg-paper-50 dark:bg-ink-800 p-3 hover:border-accent-300 transition cursor-pointer"
      onClick={onOpen}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="font-serif text-[13px] truncate">{ch.title}</div>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${statusColor}`}>
          {WritingStatusLabel[ch.status]}
        </span>
      </div>
      {ch.outline.summary && (
        <div className="text-[11.5px] text-ink-400 dark:text-ink-100 line-clamp-2 mb-2">
          {ch.outline.summary}
        </div>
      )}
      {ch.outline.events.length > 0 && (
        <ul className="text-[11px] text-ink-400 dark:text-ink-100 space-y-0.5 mb-2">
          {ch.outline.events.slice(0, 4).map((e) => (
            <li key={e.id} className="truncate">
              · {e.title}
            </li>
          ))}
        </ul>
      )}
      <div className="text-[10px] text-ink-300 flex items-center justify-between">
        <span>{ch.wordCount} 字</span>
        <ArrowRight size={11} />
      </div>
    </div>
  );
}
