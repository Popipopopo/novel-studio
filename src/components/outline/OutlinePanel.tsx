import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, GripVertical, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { db } from '../../db/database';
import type { Chapter, SceneEvent, WritingStatus } from '../../models/types';
import { WritingStatusLabel, EventStatusLabel } from '../../models/types';
import {
  addSceneEvent,
  removeSceneEvent,
  reorderSceneEvents,
  updateChapter,
  updateChapterOutline,
  updateSceneEvent,
} from '../../db/repo';
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

export default function OutlinePanel({ chapterId }: { chapterId: string }) {
  const ch = useLiveQuery(() => db.chapters.get(chapterId), [chapterId]);
  if (!ch) return null;
  return <OutlineBody ch={ch} />;
}

function OutlineBody({ ch }: { ch: Chapter }) {
  return (
    <div className="p-4 space-y-5 text-sm">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-serif text-ink-500 dark:text-ink-50">章节设置</h4>
          <StatusSelect
            value={ch.status}
            onChange={(v) => updateChapter(ch.id, { status: v })}
          />
        </div>
        <Field
          label="章节概要"
          value={ch.outline.summary}
          onChange={(v) => updateChapterOutline(ch.id, { summary: v })}
        />
        <Field
          label="本章目标"
          value={ch.outline.narrativeGoal}
          onChange={(v) => updateChapterOutline(ch.id, { narrativeGoal: v })}
        />
      </div>

      <div>
        <h4 className="font-serif text-ink-500 dark:text-ink-50 mb-2">小事件</h4>
        <EventList events={ch.outline.events} chapterId={ch.id} />
        <button
          className="mt-2 w-full px-2 py-1.5 border border-dashed border-paper-300 dark:border-ink-500 rounded text-xs text-ink-300 hover:text-accent-500 flex items-center justify-center gap-1"
          onClick={async () => {
            const t = window.prompt('事件标题');
            if (t) await addSceneEvent(ch.id, t);
          }}
        >
          <Plus size={12} /> 添加事件
        </button>
      </div>

      <div>
        <h4 className="font-serif text-ink-500 dark:text-ink-50 mb-2">叙事线索</h4>
        <Field
          label="角色发展 / 关系推进"
          value={ch.outline.characterDevelopment}
          onChange={(v) =>
            updateChapterOutline(ch.id, { characterDevelopment: v })
          }
        />
        <Field
          label="埋设伏笔"
          value={ch.outline.foreshadowingPlanted}
          onChange={(v) =>
            updateChapterOutline(ch.id, { foreshadowingPlanted: v })
          }
        />
        <Field
          label="回收伏笔"
          value={ch.outline.foreshadowingResolved}
          onChange={(v) =>
            updateChapterOutline(ch.id, { foreshadowingResolved: v })
          }
        />
        <Field
          label="结尾钩子"
          value={ch.outline.endingHook}
          onChange={(v) => updateChapterOutline(ch.id, { endingHook: v })}
        />
        <Field
          label="备注"
          value={ch.outline.notes}
          onChange={(v) => updateChapterOutline(ch.id, { notes: v })}
        />
      </div>

      <div className="text-xs text-ink-300 border-t border-paper-200 dark:border-ink-500 pt-3">
        正文字数：<span className="text-ink-500 dark:text-ink-50">{ch.wordCount}</span>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
}) {
  const [v, setV] = useState(value ?? '');
  return (
    <div className="mb-2">
      <label className="text-[11px] text-ink-300">{label}</label>
      <textarea
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => v !== (value ?? '') && onChange(v)}
        rows={2}
        className="mt-1 w-full p-2 rounded border border-paper-200 dark:border-ink-500 bg-white dark:bg-ink-800 text-[13px] outline-none focus:border-accent-300 resize-none"
      />
    </div>
  );
}

function StatusSelect({
  value,
  onChange,
}: {
  value: WritingStatus;
  onChange: (v: WritingStatus) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as WritingStatus)}
      className="text-xs rounded border border-paper-200 dark:border-ink-500 bg-white dark:bg-ink-800 px-1.5 py-0.5 outline-none"
    >
      {Object.entries(WritingStatusLabel).map(([k, v]) => (
        <option value={k} key={k}>
          {v}
        </option>
      ))}
    </select>
  );
}

function EventList({
  events,
  chapterId,
}: {
  events: SceneEvent[];
  chapterId: string;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );
  const ids = events.map((e) => e.id);
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={async (ev) => {
        const { active, over } = ev;
        if (!over || active.id === over.id) return;
        const oldI = ids.indexOf(String(active.id));
        const newI = ids.indexOf(String(over.id));
        await reorderSceneEvents(chapterId, arrayMove(ids, oldI, newI));
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="space-y-1.5">
          {events.map((e) => (
            <EventCard key={e.id} ev={e} chapterId={chapterId} />
          ))}
          {events.length === 0 && (
            <div className="text-xs text-ink-300">还没有小事件。</div>
          )}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function EventCard({ ev, chapterId }: { ev: SceneEvent; chapterId: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ev.id,
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const [title, setTitle] = useState(ev.title);
  const [desc, setDesc] = useState(ev.description ?? '');
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded border border-paper-200 dark:border-ink-500 bg-white dark:bg-ink-800 p-2 text-[13px]"
    >
      <div className="flex items-center gap-1">
        <button className="p-0.5 cursor-grab" {...attributes} {...listeners}>
          <GripVertical size={12} className="text-ink-200" />
        </button>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title !== ev.title && updateSceneEvent(chapterId, ev.id, { title })}
          className="flex-1 bg-transparent outline-none"
        />
        <select
          value={ev.status}
          onChange={(e) =>
            updateSceneEvent(chapterId, ev.id, { status: e.target.value as any })
          }
          className="text-[10.5px] rounded border border-paper-200 dark:border-ink-500 bg-transparent px-1"
        >
          {Object.entries(EventStatusLabel).map(([k, v]) => (
            <option value={k} key={k}>
              {v}
            </option>
          ))}
        </select>
        <button
          className="ghost"
          onClick={() =>
            window.confirm('删除该事件？') && removeSceneEvent(chapterId, ev.id)
          }
        >
          <Trash2 size={11} />
        </button>
      </div>
      <textarea
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        onBlur={() =>
          desc !== (ev.description ?? '') &&
          updateSceneEvent(chapterId, ev.id, { description: desc })
        }
        rows={2}
        placeholder="事件描述 / 叙事目的"
        className="mt-1 w-full bg-transparent outline-none text-[12px] text-ink-400 dark:text-ink-100 resize-none"
      />
    </div>
  );
}
