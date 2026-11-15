# Novel Studio · 小说工坊

A desktop-first, Chinese-language writing workspace for long-form fiction.
Combines Scrivener-style chapter navigation, Google-Docs-style inline
comments, a hierarchical story-arc board, and a safe tracked-changes
workflow for AI-assisted revisions.

The author owns the manuscript. AI suggestions never silently overwrite
accepted text — every AI-style edit is a reviewable proposal that can be
accepted or rejected.

## Stack

- React + TypeScript + Vite
- Tailwind CSS (paper/ink/accent palette, light + dark)
- TipTap (ProseMirror) rich-text editor with custom marks for comments
  and tracked-change inserts/deletes
- Dexie (IndexedDB) for local persistence
- Zustand for lightweight app state
- dnd-kit for drag-and-drop reordering
- Vitest + Testing Library for unit tests

## Run locally

```bash
npm install
npm run dev
```

Then open the URL Vite prints (defaults to `http://localhost:5173/`).

On first launch a labelled **演示项目 "三周目，魔王怎么还是你？"** is seeded
with sample chapters, one anchored inline comment, and one pending
tracked-change revision. Everything in it is placeholder prose — delete
it from **项目设置** whenever you like.

## Build

```bash
npm run build
npm run preview   # optional: preview the production bundle locally
```

## Deploy to GitHub Pages

Push to `main`. The workflow in `.github/workflows/deploy.yml` will:

1. Detect whether the repo is `<owner>.github.io` (apex) or a sub-path repo.
2. Pass the correct `VITE_BASE` to the Vite build.
3. Publish `dist/` to GitHub Pages via the official actions.

To enable, in the repo settings → Pages, set **Source** to
**GitHub Actions**.

> This frontend is fully static. No backend is required.

### Base path for other hosts

Set `VITE_BASE` at build time if you serve under a non-root path:

```bash
VITE_BASE=/my-subpath/ npm run build
```

## Data & privacy

- **Novel manuscripts live in your browser's IndexedDB.** They never leave
  your device unless you export them.
- Browser storage can be cleared by the browser or by the user, and is
  per-device/per-profile. **Export a JSON backup regularly** from
  **项目设置 → 备份项目（JSON）**.
- The `.gitignore` excludes any `/manuscripts` or `/exports` directory you
  might create, so your prose is never pushed by accident.

## Testing

```bash
npm test
```

Covers:

- Project / volume / arc / chapter CRUD and ordering
- Chapter manuscript persistence and Chinese word count
- Soft-delete (trash) and restore
- Scene-event reordering
- Comment lifecycle
- Revision conflict hash detection
- JSON backup round-trip
- Chinese & markdown chapter-heading splitter
- TipTap tracked-change accept / reject semantics

## Keyboard shortcuts

- `Ctrl/Cmd + /` — toggle Focus mode (hide side panels)
- `Ctrl/Cmd + ↑ / ↓` — jump to previous / next chapter
- `Esc` — close any dialog

## Architecture highlights

### Durable comment & revision anchoring

Comments and tracked-change proposals are stored as TipTap/ProseMirror
**marks** inside the manuscript document. ProseMirror automatically maps
mark ranges across edits, so anchors survive insertions and deletions in
surrounding text. If the text an anchor covers is fully deleted, the
mark is dropped by ProseMirror; the comment thread then shows
`已失去正文锚点` in the sidebar — the thread is preserved rather than
silently dropped.

### Tracked-change data model

The *accepted* manuscript is `chapters.contentJSON`. While a proposal is
pending, the same document carries extra `revDelete` and `revInsert` marks
that paint the diff inline (red strikethrough / cyan). Accepting removes
the deleted range and strips the insert mark; rejecting removes the
inserted range and strips the delete mark. A `baseManuscriptHash` on the
proposal detects when the underlying text has drifted, and the UI flags
such proposals as conflicts instead of overwriting newer manual edits.

### AI integration

Phase 1 ships a manual workflow:

1. Select text → **提议修订**.
2. Click **复制 AI Prompt** to copy a structured Chinese prompt to the
   clipboard.
3. Paste that prompt into any LLM.
4. Paste the model's reply into the **提议的新文本** box and submit.

The result appears as a pending revision — same accept/reject surface as
any other proposal.

Phase 2 (deferred) wires `AIRevisionProvider` in `src/services/ai/provider.ts`
to a secure backend gateway. API keys never live in the frontend, and
GitHub Pages hosting remains valid without the backend.

## Status

Working end-to-end:

- Three-panel writing view (navigation / manuscript / right sidebar tabs)
- Light + dark themes with Chinese-friendly typography
- Project / volume / arc / chapter hierarchy with CRUD and drag-and-drop
- Autosave with visible save state (保存中 / 已保存 / 保存失败)
- Chapter trash / restore / hard-delete
- Inline comments with floating selection toolbar, replies, resolve/reopen,
  orphan detection
- Tracked-change revisions with inline strikethrough / cyan diff,
  per-change accept/reject, accept-all / reject-all, and conflict flag
- Chapter outline with summary, narrative goal, foreshadowing, ending hook,
  and reorderable scene-event cards
- Story-arc overview with volumes → arcs → chapter cards (reorderable)
- Import: `.txt`, `.md` (with Chinese heading auto-split + preview),
  and full-project JSON (as new project OR replace)
- Export: current chapter MD, full-book MD, full-project JSON backup
- Chapter search over titles and manuscript text
- Keyboard shortcuts for focus mode and chapter navigation
- Snapshot creation before destructive revision ops (retained: newest 30
  per chapter)
- Reseedable demo project

Intentionally deferred:

- Snapshot restore UI (snapshots are created but there is no browsable
  timeline yet — restore can be scripted from a JSON backup instead)
- Live AI provider (the architecture and prompt plumbing ship; the
  secure backend gateway is out of scope for this release)
- Rich command palette (basic search + keyboard shortcuts cover the
  common paths)
