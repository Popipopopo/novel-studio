export interface AITaskPromptInput {
  novelTitle: string;
  chapterTitle: string;
  selectedText: string;
  comment?: string;
  chapterSummary?: string;
  narrativeGoal?: string;
  characterNotes?: string;
}

/**
 * Build a structured Chinese-language prompt that an author can paste into
 * any LLM. The response (prose only) is pasted back into the Propose
 * Revision dialog.
 */
export function buildAITaskPrompt(input: AITaskPromptInput): string {
  const lines = [
    '你是一位中文小说编辑助手。请根据下面的上下文和意见，只针对"选中原文"给出改写建议。',
    '',
    '# 作品',
    input.novelTitle,
    '',
    '# 章节',
    input.chapterTitle,
    '',
    input.chapterSummary ? `## 章节概要\n${input.chapterSummary}\n` : '',
    input.narrativeGoal ? `## 本章目标\n${input.narrativeGoal}\n` : '',
    input.characterNotes ? `## 相关角色\n${input.characterNotes}\n` : '',
    '# 选中原文',
    '"""',
    input.selectedText,
    '"""',
    '',
    input.comment ? `# 作者意见\n${input.comment}\n` : '',
    '# 输出要求',
    '- 只输出替换后的中文正文，不要解释、不要引号、不要代码块。',
    '- 保持原作风格与叙述视角。',
    '- 保留必要的段落换行。',
    '- 不要生成作者意见以外的改动。',
  ];
  return lines.filter((l) => l !== '').join('\n');
}
