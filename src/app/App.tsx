import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Menu,
  PanelRightClose,
  PanelRightOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Moon,
  Sun,
  FileText,
  Layout,
  Settings as SettingsIcon,
  Download,
  Focus,
  Eye,
  Edit3,
} from 'lucide-react';
import { db } from '../db/database';
import { useAppStore } from '../store/useAppStore';
import LeftNav from '../components/navigation/LeftNav';
import ChapterEditor from '../components/editor/ChapterEditor';
import OutlinePanel from '../components/outline/OutlinePanel';
import CommentsPanel from '../components/comments/CommentsPanel';
import RevisionsPanel from '../components/revisions/RevisionsPanel';
import StoryBoard from '../components/story-board/StoryBoard';
import ProjectSettings from '../components/settings/ProjectSettings';
import { CommentComposerProvider } from '../components/comments/CommentComposer';
import { ProposeRevisionProvider } from '../components/revisions/ProposeRevisionDialog';
import {
  downloadBlob,
  exportChapterMarkdown,
  exportProjectJSON,
} from '../services/import-export';
import { seedDemoProject } from '../services/demo';
import type { Editor } from '@tiptap/core';

export default function App() {
  const {
    activeProjectId,
    setActiveProject,
    activeChapterId,
    topView,
    setTopView,
    writeMode,
    setWriteMode,
    rightTab,
    setRightTab,
    leftCollapsed,
    rightCollapsed,
    toggleLeft,
    toggleRight,
    theme,
    toggleTheme,
    saveStatus,
  } = useAppStore();

  const projects = useLiveQuery(() => db.projects.toArray(), []) ?? [];

  // On first launch, seed demo and pick it as active.
  useEffect(() => {
    (async () => {
      const count = await db.projects.count();
      if (count === 0) {
        const p = await seedDemoProject();
        setActiveProject(p.id);
      } else if (!activeProjectId) {
        const first = await db.projects.toCollection().first();
        if (first) setActiveProject(first.id);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chapter = useLiveQuery(
    () => (activeChapterId ? db.chapters.get(activeChapterId) : undefined),
    [activeChapterId]
  );

  const [editor, setEditor] = useState<Editor | null>(null);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 's') {
        e.preventDefault();
        // Autosave already runs; just force a flush by dispatching a dummy update
      } else if (mod && e.key === '/') {
        e.preventDefault();
        setWriteMode(writeMode === 'focus' ? 'edit' : 'focus');
      } else if (mod && e.key === 'ArrowDown') {
        gotoNextChapter(1);
        e.preventDefault();
      } else if (mod && e.key === 'ArrowUp') {
        gotoNextChapter(-1);
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [writeMode, activeChapterId, activeProjectId]);

  async function gotoNextChapter(dir: 1 | -1) {
    if (!activeProjectId) return;
    const all = await db.chapters
      .where('projectId')
      .equals(activeProjectId)
      .and((c) => !c.deletedAt)
      .sortBy('order');
    if (all.length === 0) return;
    const idx = all.findIndex((c) => c.id === activeChapterId);
    const next = all[(idx + dir + all.length) % all.length];
    useAppStore.getState().setActiveChapter(next.id);
  }

  return (
    <CommentComposerProvider>
      <ProposeRevisionProvider>
        <div className="h-screen w-full flex flex-col bg-paper-50 dark:bg-ink-800 text-ink-600 dark:text-ink-50">
          {/* Top bar */}
          <header className="h-12 flex items-center px-3 border-b border-paper-200 dark:border-ink-500 bg-paper-50/80 dark:bg-ink-700/80 backdrop-blur z-20">
            <button
              className="ghost md:hidden"
              onClick={toggleLeft}
              title="菜单"
            >
              <Menu size={16} />
            </button>
            <div className="font-serif text-[15px] tracking-wide text-ink-500 dark:text-ink-50">
              小说工坊
            </div>
            <div className="w-6" />
            <nav className="flex items-center gap-1">
              <TopButton
                active={topView === 'write'}
                onClick={() => setTopView('write')}
                icon={<FileText size={13} />}
                label="写作"
              />
              <TopButton
                active={topView === 'board'}
                onClick={() => setTopView('board')}
                icon={<Layout size={13} />}
                label="剧情总览"
              />
              <TopButton
                active={topView === 'settings'}
                onClick={() => setTopView('settings')}
                icon={<SettingsIcon size={13} />}
                label="项目设置"
              />
            </nav>
            <div className="flex-1" />
            <ProjectPicker
              projects={projects}
              activeId={activeProjectId}
              onPick={setActiveProject}
            />
            <SaveStatus status={saveStatus} />
            {topView === 'write' && (
              <>
                <ModeToggle />
                <button
                  className="ghost"
                  onClick={toggleLeft}
                  title={leftCollapsed ? '展开左侧' : '折叠左侧'}
                >
                  {leftCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
                </button>
                <button
                  className="ghost"
                  onClick={toggleRight}
                  title={rightCollapsed ? '展开右侧' : '折叠右侧'}
                >
                  {rightCollapsed ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />}
                </button>
              </>
            )}
            {topView === 'write' && chapter && (
              <button
                className="ghost"
                title="导出当前章节为 Markdown"
                onClick={async () => {
                  const md = await exportChapterMarkdown(chapter.id);
                  downloadBlob(`${chapter.title}.md`, md, 'text/markdown');
                }}
              >
                <Download size={15} />
              </button>
            )}
            <button className="ghost" onClick={toggleTheme} title="切换主题">
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </header>

          {/* Main */}
          <div className="flex-1 min-h-0 flex">
            {topView === 'write' && (
              <>
                {!leftCollapsed && writeMode !== 'focus' && (
                  <aside className="w-[260px] border-r border-paper-200 dark:border-ink-500 bg-paper-50 dark:bg-ink-700 shrink-0">
                    <LeftNav />
                  </aside>
                )}
                <main className="flex-1 min-w-0 flex flex-col">
                  {chapter ? (
                    <div className="flex-1 min-h-0 flex flex-col">
                      <div className="px-10 pt-8 pb-2 mx-auto w-full max-w-[720px]">
                        <input
                          value={chapter.title}
                          onChange={(e) =>
                            db.chapters.update(chapter.id, {
                              title: e.target.value,
                              updatedAt: new Date().toISOString(),
                            })
                          }
                          className="w-full font-serif text-[22px] bg-transparent outline-none placeholder:text-ink-200"
                          placeholder="章节标题"
                        />
                        <div className="text-[11px] text-ink-300 mt-1">
                          {chapter.wordCount} 字
                        </div>
                      </div>
                      <div className="flex-1 min-h-0">
                        <ChapterEditor
                          chapter={chapter}
                          onEditorReady={setEditor}
                        />
                      </div>
                    </div>
                  ) : (
                    <EmptyEditorState />
                  )}
                </main>
                {!rightCollapsed && writeMode !== 'focus' && (
                  <aside className="w-[320px] border-l border-paper-200 dark:border-ink-500 bg-paper-50 dark:bg-ink-700 shrink-0 flex flex-col">
                    <RightTabs />
                    <div className="flex-1 min-h-0 overflow-y-auto thin-scroll">
                      {chapter && rightTab === 'outline' && (
                        <OutlinePanel chapterId={chapter.id} />
                      )}
                      {chapter && rightTab === 'comments' && (
                        <CommentsPanel chapterId={chapter.id} />
                      )}
                      {chapter && rightTab === 'revisions' && (
                        <RevisionsPanel chapterId={chapter.id} editor={editor} />
                      )}
                      {!chapter && (
                        <div className="p-4 text-xs text-ink-300">
                          选择或创建一个章节以查看大纲、评论和修订。
                        </div>
                      )}
                    </div>
                  </aside>
                )}
              </>
            )}
            {topView === 'board' && <StoryBoard />}
            {topView === 'settings' && <ProjectSettings />}
          </div>
        </div>
      </ProposeRevisionProvider>
    </CommentComposerProvider>
  );
}

function TopButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={
        'inline-flex items-center gap-1 px-2.5 py-1 rounded text-[12.5px] transition ' +
        (active
          ? 'bg-accent-100 text-accent-600 dark:bg-accent-600/40 dark:text-accent-100'
          : 'hover:bg-paper-100 dark:hover:bg-ink-600 text-ink-400 dark:text-ink-100')
      }
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function ProjectPicker({
  projects,
  activeId,
  onPick,
}: {
  projects: { id: string; title: string }[];
  activeId: string | null;
  onPick: (id: string) => void;
}) {
  if (projects.length <= 1) return null;
  return (
    <select
      value={activeId ?? ''}
      onChange={(e) => onPick(e.target.value)}
      className="text-xs bg-transparent border border-paper-200 dark:border-ink-500 rounded px-2 py-1 outline-none mr-2"
    >
      {projects.map((p) => (
        <option key={p.id} value={p.id}>
          {p.title}
        </option>
      ))}
    </select>
  );
}

function SaveStatus({ status }: { status: string }) {
  const map: Record<string, string> = {
    idle: '',
    saving: '保存中…',
    saved: '已保存',
    error: '保存失败',
  };
  const color =
    status === 'error'
      ? 'text-red-600'
      : status === 'saving'
      ? 'text-amber-600'
      : 'text-ink-300';
  return <span className={'text-[11px] mr-3 ' + color}>{map[status]}</span>;
}

function ModeToggle() {
  const writeMode = useAppStore((s) => s.writeMode);
  const setWriteMode = useAppStore((s) => s.setWriteMode);
  const Btn = ({
    v,
    icon,
    label,
  }: {
    v: 'edit' | 'read' | 'focus';
    icon: React.ReactNode;
    label: string;
  }) => (
    <button
      className={
        'px-1.5 py-0.5 rounded text-[11px] transition ' +
        (writeMode === v
          ? 'bg-paper-200 dark:bg-ink-500 text-ink-500 dark:text-ink-50'
          : 'text-ink-300 hover:text-ink-500 dark:hover:text-ink-50')
      }
      onClick={() => setWriteMode(v)}
      title={label}
    >
      {icon}
    </button>
  );
  return (
    <div className="flex items-center gap-0.5 mr-2 border border-paper-200 dark:border-ink-500 rounded">
      <Btn v="edit" icon={<Edit3 size={12} />} label="编辑" />
      <Btn v="read" icon={<Eye size={12} />} label="阅读" />
      <Btn v="focus" icon={<Focus size={12} />} label="专注" />
    </div>
  );
}

function RightTabs() {
  const rightTab = useAppStore((s) => s.rightTab);
  const setRightTab = useAppStore((s) => s.setRightTab);
  const Tab = ({ v, label }: { v: 'outline' | 'comments' | 'revisions'; label: string }) => (
    <button
      className={
        'flex-1 px-2 py-2 text-[12.5px] transition ' +
        (rightTab === v
          ? 'text-ink-500 dark:text-ink-50 border-b-2 border-accent-500'
          : 'text-ink-300 border-b-2 border-transparent hover:text-ink-500')
      }
      onClick={() => setRightTab(v)}
    >
      {label}
    </button>
  );
  return (
    <div className="flex border-b border-paper-200 dark:border-ink-500 sticky top-0 bg-paper-50 dark:bg-ink-700 z-10">
      <Tab v="outline" label="章节大纲" />
      <Tab v="comments" label="评论" />
      <Tab v="revisions" label="修订" />
    </div>
  );
}

function EmptyEditorState() {
  return (
    <div className="flex-1 flex items-center justify-center text-ink-300">
      <div className="text-center max-w-md px-6">
        <p className="font-serif text-xl mb-2">还未选择章节</p>
        <p className="text-sm">
          在左侧选择或创建一个章节，或者前往"项目设置"载入演示项目。
        </p>
      </div>
    </div>
  );
}
