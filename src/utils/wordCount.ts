/**
 * Chinese-aware "word count". Returns character count for CJK, plus
 * counts latin runs as a single word each.
 */
export function countChinese(text: string): {
  characters: number;
  words: number;
} {
  if (!text) return { characters: 0, words: 0 };
  const stripped = text.replace(/\s+/g, '');
  const characters = Array.from(stripped).length;
  // Words = CJK chars + latin tokens
  const cjk = text.match(/[㐀-鿿豈-﫿]/g) || [];
  const latin = text.match(/[A-Za-z]+(?:['\-][A-Za-z]+)*/g) || [];
  const numbers = text.match(/\d+/g) || [];
  return {
    characters,
    words: cjk.length + latin.length + numbers.length,
  };
}

/** Extract plain text from a TipTap JSON doc. */
export function docToPlainText(doc: any): string {
  if (!doc) return '';
  const parts: string[] = [];
  const walk = (node: any) => {
    if (!node) return;
    if (typeof node.text === 'string') parts.push(node.text);
    if (Array.isArray(node.content)) node.content.forEach(walk);
    if (node.type === 'paragraph' || node.type === 'heading') {
      parts.push('\n');
    }
  };
  walk(doc);
  return parts.join('');
}
