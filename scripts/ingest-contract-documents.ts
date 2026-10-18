import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { dataDir, openStore } from "../src/config.ts";
import { getJson } from "../src/sources/http.ts";

const dir = dataDir(); await mkdir(dir, { recursive: true });
const path = join(dir, "contract-documents.json");
type Cached = { tender_id: string; contract_id: string; fetched_at: string; contract: Record<string, any> };
let previous: Cached[] = [];
try { previous = JSON.parse(await readFile(path, "utf8")); } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
const rows = new Map(previous.map(r => [r.contract_id, r]));
const limit = Number(process.env.TR_CONTRACT_LIMIT ?? 10);
if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw Error("Contract limit must be 1–100");
let fetched = 0;
const tenders = (await openStore().allTenders()).filter(t => process.argv[2] ? t.id === process.argv[2] : t.scope_reasons?.length);
const oldest = (t: typeof tenders[number]) => ((t.raw as any)?.contracts ?? []).filter((c: any) => c.status === "active").map((c: any) => rows.get(c.id)?.fetched_at ?? "").sort()[0] ?? "";
tenders.sort((a, b) => oldest(a).localeCompare(oldest(b)));
for (const tender of tenders) {
  for (const c of (tender.raw as any)?.contracts ?? []) {
    if (fetched >= limit) break;
    if (c.status !== "active" || !/^[a-f0-9]{32}$/.test(c.id)) continue;
    const old = rows.get(c.id);
    if (old && Date.now() - Date.parse(old.fetched_at) < 86400000) continue;
    const { data } = await getJson<{ data: Record<string, any> }>(`https://public-api.prozorro.gov.ua/api/2.5/contracts/${c.id}`);
    if (data.id !== c.id || data.tender_id !== tender.id) throw Error("Contract belongs to a different tender");
    rows.set(c.id, { tender_id: tender.id, contract_id: c.id, fetched_at: new Date().toISOString(), contract: data });
    await writeFile(path + ".tmp", JSON.stringify([...rows.values()])); await rename(path + ".tmp", path);
    fetched++; console.log(`${tender.tender_id}: ${data.documents?.length ?? 0} contract documents`);
  }
  if (fetched >= limit) break;
}
console.log(`Contracts refreshed: ${fetched}`);
