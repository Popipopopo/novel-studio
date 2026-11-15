import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import {
  Plus,
  FileDown,
  FileUp,
  Trash2,
  RotateCcw,
  BookOpen,
  Package,
} from 'lucide-react';
import { db } from '../../db/database';
import {
  createProject,
  hardDeleteChapter,
  restoreChapter,
  updateProject,
} from '../../db/repo';
import { clearProject } from '../../db/database';
import { useAppStore } from '../../store/useAppStore';
import {
  downloadBlob,
  exportProjectJSON,
  exportProjectMarkdown,
  importBackup,
  splitIntoChapters,
  importChaptersIntoArc,
} from '../../services/import-export';
import { seedDemoProject } from '../../services/demo';
import Modal, { Button } from '../ui/Modal';

export default function ProjectSettings() {
  const projects =
    useLiveQuery(() => db.projects.toArray(), []) ?? [];
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const setActiveProject = useAppStore((s) => s.setActiveProject);
  const activeProject = projects.find((p) => p.id === activeProjectId);

  const trashed =
    useLiveQuery(
      () =>
        activeProjectId
          ? db.chapters
              .where('projectId')
              .equals(activeProjectId)
              .and((c) => !!c.deletedAt)
              .toArray()
          : [],
      [activeProjectId]
    ) ?? [];

  const fileRef = useRef<HTMLInputElement>(null);
  const txtRef = useRef<HTMLInputElement>(null);
  const [importText, setImportText] = useState<string | null>(null);
  const [splitTarget, setSplitTarget] = useState<{
    projectId: string;
    arcId: string;
  } | null>(null);
  const arcs =
    useLiveQuery(
      () =>
        activeProjectId
          ? db.arcs.where('projectId').equals(activeProjectId).toArray()
          : [],
      [activeProjectId]
    ) ?? [];

  async function onJsonImport(file: File) {
    const txt = await file.text();
    try {
      const data = JSON.parse(txt);
      const mode = window.confirm(
        '确定要【替换】同 ID 的项目数据吗？\n（取消 = 作为新项目导入）'
      )
        ? 'replace'
        : 'new_project';
      await importBackup(data, mode);
      alert('导入完成。');
    } catch (e: any) {
      alert('导入失败：' + e.message);
    }
  }

  return (
    <div className="h-full overflow-y-auto thin-scroll px-8 py-8 max-w-[960px] mx-auto space-y-8">
      <section>
        <h2 className="font-serif text-xl mb-4">项目</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {projects.map((p) => (
            <div
              key={p.id}
              className={
                'rounded-lg border p-4 cursor-pointer transition ' +
                (p.id === activeProjectId
                  ? 'border-accent-300 bg-accent-50 dark:bg-accent-600/20'
                  : 'border-paper-200 dark:border-ink-500 bg-white dark:bg-ink-800 hover:border-accent-200')
              }
              onClick={() => setActiveProject(p.id)}
            >
              <div className="flex items-center gap-2">
                <BookOpen size={14} className="text-accent-500" />
                <input
                  defaultValue={p.title}
                  onBlur={(e) => updateProject(p.id, { title: e.target.value })}
                  className="font-serif bg-transparent outline-none flex-1"
                  onClick={(e) => e.stopPropagation()}
                />
                {p.isDemo && (
                  <span className="text-[10px] text-ink-300 border px-1 rounded border-paper-300">
                    演示
                  </span>
                )}
              </div>
              <textarea
                defaultValue={p.synopsis}
                placeholder="项目简介 / 全书设定摘要……"
                onBlur={(e) => updateProject(p.id, { synopsis: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                rows={2}
                className="mt-2 w-full bg-transparent outline-none text-xs text-ink-400 dark:text-ink-100 resize-none"
              />
              <div className="mt-2 flex items-center gap-2 text-[11px] text-ink-300">
                <span>创建于 {new Date(p.createdAt).toLocaleDateString('zh-CN')}</span>
                <div className="flex-1" />
                <button
                  className="hover:text-red-500"
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (
                      window.confirm(
                        `永久删除项目"${p.title}"及全部章节、评论、修订、历史？`
                      )
                    ) {
                      await clearProject(p.id);
                      if (activeProjectId === p.id) setActiveProject(null);
                    }
                  }}
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ))}
          <button
            className="rounded-lg border border-dashed border-paper-300 dark:border-ink-500 p-4 text-sm text-ink-300 hover:text-accent-500 flex items-center justify-center gap-1"
            onClick={async () => {
              const t = window.prompt('新项目名称', '未命名');
              if (t) {
                const p = await createProject(t);
                setActiveProject(p.id);
              }
            }}
          >
            <Plus size={14} /> 新建项目
          </button>
          <button
            className="rounded-lg border border-dashed border-paper-300 dark:border-ink-500 p-4 text-sm text-ink-300 hover:text-accent-500 flex items-center justify-center gap-1"
            onClick={async () => {
              const p = await seedDemoProject();
              setActiveProject(p.id);
            }}
          >
            <Package size={14} /> 载入演示项目
          </button>
        </div>
      </section>

      {activeProject && (
        <section>
          <h2 className="font-serif text-xl mb-4">导入 / 导出</h2>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              onClick={async () => {
                const data = await exportProjectJSON(activeProject.id);
                downloadBlob(
                  `${activeProject.title}-backup.json`,
                  JSON.stringify(data, null, 2),
                  'application/json'
                );
              }}
            >
              <span className="inline-flex items-center gap-1">
                <FileDown size={13} /> 备份项目（JSON）
              </span>
            </Button>
            <Button
              variant="ghost"
              onClick={async () => {
                const md = await exportProjectMarkdown(activeProject.id);
                downloadBlob(`${activeProject.title}.md`, md, 'text/markdown');
              }}
            >
              <span className="inline-flex items-center gap-1">
                <FileDown size={13} /> 全书 Markdown
              </span>
            </Button>
            <Button
              variant="ghost"
              onClick={() => fileRef.current?.click()}
            >
              <span className="inline-flex items-center gap-1">
                <FileUp size={13} /> 还原备份（JSON）
              </span>
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onJsonImport(f);
                e.target.value = '';
              }}
            />
            <Button variant="ghost" onClick={() => txtRef.current?.click()}>
              <span className="inline-flex items-center gap-1">
                <FileUp size={13} /> 导入 TXT / Markdown
              </span>
            </Button>
            <input
              ref={txtRef}
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const txt = await f.text();
                setImportText(txt);
                e.target.value = '';
              }}
            />
          </div>
          <p className="mt-2 text-xs text-ink-300">
            项目数据仅保存于本浏览器的 IndexedDB 中。请定期备份为 JSON 文件以防数据丢失。
          </p>
        </section>
      )}

      {trashed.length > 0 && (
        <section>
          <h2 className="font-serif text-xl mb-4">回收站</h2>
          <div className="space-y-1">
            {trashed.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-2 text-sm px-3 py-1.5 rounded border border-paper-200 dark:border-ink-500 bg-white dark:bg-ink-800"
              >
                <span className="flex-1 truncate">{c.title}</span>
                <span className="text-[11px] text-ink-300">
                  {new Date(c.deletedAt!).toLocaleString('zh-CN')}
                </span>
                <button
                  className="ghost text-xs"
                  title="恢复"
                  onClick={() => restoreChapter(c.id)}
                >
                  <RotateCcw size={12} />
                </button>
                <button
                  className="ghost text-xs"
                  title="彻底删除"
                  onClick={() => {
                    if (window.confirm('彻底删除该章节？此操作不可撤销。'))
                      hardDeleteChapter(c.id);
                  }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <Modal
        wide
        open={!!importText}
        onClose={() => setImportText(null)}
        title="导入 TXT / Markdown"
        footer={
          <>
            <Button variant="ghost" onClick={() => setImportText(null)}>
              取消
            </Button>
            <Button
              disabled={!splitTarget?.arcId}
              onClick={async () => {
                if (!importText || !splitTarget) return;
                const chunks = splitIntoChapters(importText);
                await importChaptersIntoArc(
                  splitTarget.projectId,
                  splitTarget.arcId,
                  chunks.length > 0
                    ? chunks
                    : [{ title: '导入内容', body: importText }]
                );
                setImportText(null);
                alert('导入完成。');
              }}
            >
              导入到选中的事件组
            </Button>
          </>
        }
      >
        {importText && (
          <>
            <div className="text-xs text-ink-400 dark:text-ink-100">
              将按中文章节标题（"第 X 章"、"#" 等）自动切分。预览：
            </div>
            <div className="mt-2 max-h-[220px] overflow-y-auto thin-scroll text-xs border border-paper-200 dark:border-ink-500 rounded p-2 bg-paper-100 dark:bg-ink-800 space-y-2">
              {splitIntoChapters(importText).map((c, i) => (
                <div key={i}>
                  <div className="font-serif text-ink-500 dark:text-ink-50">
                    · {c.title || '未命名'}
                  </div>
                  <div className="text-ink-300 line-clamp-2">{c.body.slice(0, 160)}</div>
                </div>
              ))}
              {splitIntoChapters(importText).length === 0 && (
                <div className="text-ink-300">未识别出章节标题，将作为单一章节导入。</div>
              )}
            </div>
            <div>
              <label className="text-xs text-ink-300">导入到事件组</label>
              <select
                onChange={(e) =>
                  activeProjectId &&
                  setSplitTarget({
                    projectId: activeProjectId,
                    arcId: e.target.value,
                  })
                }
                className="mt-1 w-full p-2 rounded border border-paper-200 dark:border-ink-500 bg-white dark:bg-ink-800 text-sm outline-none"
                defaultValue=""
              >
                <option value="" disabled>
                  选择一个事件组……
                </option>
                {arcs.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
