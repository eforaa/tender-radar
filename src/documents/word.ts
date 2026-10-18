import { Worker } from "node:worker_threads";

export async function extractWord(bytes: Uint8Array): Promise<string> {
  const b = Buffer.from(bytes);
  if (!b.subarray(0, 8).equals(Buffer.from("d0cf11e0a1b11ae1", "hex")) && !b.subarray(0, 4).equals(Buffer.from("504b0304", "hex")))
    throw new Error("Not a binary DOC or DOCX document");
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./word-worker.ts", import.meta.url), { workerData: bytes,
      resourceLimits: { maxOldGenerationSizeMb: 256 } });
    const timer = setTimeout(() => { void worker.terminate(); reject(new Error("Word extraction timed out")); }, 60_000);
    worker.once("message", result => { clearTimeout(timer); void worker.terminate(); result.error ? reject(new Error(result.error)) : resolve(result.text); });
    worker.once("error", error => { clearTimeout(timer); reject(error); });
    worker.once("exit", code => { clearTimeout(timer); reject(new Error(`Word worker exited before result (${code})`)); });
  });
}

export function textFragments(text: string): { page: number; text: string; method: "text" }[] {
  const fragments = [];
  for (let start = 0; start < text.length;) {
    let end = Math.min(start + 12000, text.length);
    if (end < text.length) { const newline = text.lastIndexOf("\n", end); if (newline > start + 6000) end = newline + 1; }
    const part = text.slice(start, end).trim();
    if (part) fragments.push({ page: fragments.length + 1, text: part, method: "text" as const });
    start = end;
  }
  return fragments;
}
