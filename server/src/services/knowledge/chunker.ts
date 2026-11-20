/**
 * Safe, boundary-aware text chunking for knowledge documents.
 * Splits on paragraph and sentence boundaries rather than hard character cuts.
 */
export function chunkDocumentText(
  text: string,
  chunkSize = 600,
  overlap = 80
): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= chunkSize) return [trimmed];

  const chunks: string[] = [];
  const paragraphs = trimmed.split(/\n\s*\n/);
  let currentChunk = "";

  for (const para of paragraphs) {
    const cleanPara = para.trim();
    if (!cleanPara) continue;

    if (currentChunk.length + cleanPara.length + 2 <= chunkSize) {
      currentChunk = currentChunk ? `${currentChunk}\n\n${cleanPara}` : cleanPara;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      // If single paragraph is longer than chunkSize, split by sentences
      if (cleanPara.length > chunkSize) {
        const sentences = cleanPara.match(/[^.!?]+[.!?]+(\s|$)/g) || [cleanPara];
        currentChunk = "";
        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length <= chunkSize) {
            currentChunk = currentChunk ? `${currentChunk} ${sentence.trim()}` : sentence.trim();
          } else {
            if (currentChunk) chunks.push(currentChunk);
            currentChunk = sentence.trim();
          }
        }
      } else {
        currentChunk = cleanPara;
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  // Add overlap if applicable
  if (overlap > 0 && chunks.length > 1) {
    return chunks.map((chunk, i) => {
      if (i === 0) return chunk;
      const prev = chunks[i - 1];
      const overlapText = prev ? prev.slice(-overlap).trim() : "";
      return overlapText ? `...${overlapText}\n${chunk}` : chunk;
    });
  }

  return chunks;
}
