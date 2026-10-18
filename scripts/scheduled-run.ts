// Local daily pipeline: no Telegram sends, git publication or automatic accusations.
import { spawn } from "node:child_process";
import { mkdir, open, unlink, appendFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { dataDir } from "../src/config.ts";

const root = resolve(import.meta.dirname, "..");
const directory = dataDir();
await mkdir(directory, { recursive: true });
const lockPath = join(directory, "scheduled-run.lock");
const lock = await open(lockPath, "wx");
await lock.writeFile(JSON.stringify({ pid: process.pid, started_at: new Date().toISOString() }));
const logDir = join(root, "logs"); await mkdir(logDir, { recursive: true });
const logPath = join(logDir, `daily-${new Date().toISOString().replace(/[:.]/g, "-")}.log`);
const results: { step: string; code: number | null }[] = [];
try {
  for (const script of ["ingest-tenders.ts", "ingest-market.ts", "analyze.ts", "ai-batch.ts", "analyze-documents.ts", "build-web-data.ts"]) {
    await appendFile(logPath, `\n${new Date().toISOString()} ${script}\n`);
    const code = await new Promise<number | null>((resolveCode) => {
      const child = spawn(process.execPath, [join(root, "scripts", script)], { cwd: root, windowsHide: true,
        env: { ...process.env, TR_FEED_MAX_PAGES: process.env.TR_FEED_MAX_PAGES ?? "500",
          TR_AI_BATCH_LIMIT: process.env.TR_AI_BATCH_LIMIT ?? "10" }, stdio: ["ignore", "pipe", "pipe"] });
      const timer = setTimeout(() => child.kill(), 4 * 60 * 60 * 1000);
      const writes: Promise<void>[] = [];
      const log = (chunk: Buffer) => { process.stdout.write(chunk); writes.push(appendFile(logPath, chunk)); };
      child.stdout.on("data", log); child.stderr.on("data", log);
      child.on("error", error => { clearTimeout(timer); writes.push(appendFile(logPath, error.message)); });
      child.on("close", async code => { clearTimeout(timer); await Promise.all(writes); resolveCode(code); });
    });
    results.push({ step: script, code });
  }
  await writeFile(join(directory, "scheduled-status.json"), JSON.stringify({ finished_at: new Date().toISOString(), log: logPath, results }, null, 2));
  if (results.some(r => r.code !== 0)) process.exitCode = 1;
} finally { await lock.close(); await unlink(lockPath); }
