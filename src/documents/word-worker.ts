import { parentPort, workerData } from "node:worker_threads";
import WordExtractor from "word-extractor";

// Parses bytes only: no Office launch, macros, linked resources or document HTML execution.
try {
  // Published typings omit filterUnicode, which the installed parser supports.
  type Getter = (options?: { filterUnicode?: boolean; includeFooters?: boolean }) => string;
  const doc = await new WordExtractor().extract(Buffer.from(workerData)) as unknown as Record<"getBody" | "getHeaders" | "getFooters" | "getFootnotes" | "getEndnotes" | "getTextboxes", Getter>;
  const sections = [doc.getBody({ filterUnicode: false }), doc.getHeaders({ filterUnicode: false, includeFooters: false }), doc.getFooters({ filterUnicode: false }), doc.getFootnotes({ filterUnicode: false }), doc.getEndnotes({ filterUnicode: false }), doc.getTextboxes({ filterUnicode: false })];
  const text = [...new Set(sections.filter(s => s?.trim()))].join("\n\n");
  if (text.length > 2_000_000) throw new Error("Word text exceeds extraction limit");
  parentPort!.postMessage({ text });
} catch (error) { parentPort!.postMessage({ error: (error as Error).message }); }
