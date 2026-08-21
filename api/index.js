// src/config.ts
import { existsSync } from "node:fs";
import { join as join2 } from "node:path";

// src/store/json-store.ts
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
var JsonStore = class {
  #dir;
  constructor(dir) {
    this.#dir = dir;
  }
  async #read(table) {
    try {
      return JSON.parse(await readFile(join(this.#dir, `${table}.json`), "utf8"));
    } catch (err) {
      if (err.code === "ENOENT") return [];
      throw err;
    }
  }
  async #write(table, rows) {
    await mkdir(this.#dir, { recursive: true });
    await writeFile(join(this.#dir, `${table}.json`), JSON.stringify(rows), "utf8");
  }
  async #upsert(table, rows, key) {
    if (rows.length === 0) return;
    const existing = await this.#read(table);
    const byKey = new Map(existing.map((row) => [key(row), row]));
    for (const row of rows) byKey.set(key(row), row);
    await this.#write(table, [...byKey.values()]);
  }
  upsertTenders(rows) {
    return this.#upsert("tenders", rows, (r) => r.id);
  }
  upsertTenderItems(rows) {
    return this.#upsert("tender_items", rows, (r) => `${r.tender_id}|${r.item_id}`);
  }
  upsertBids(rows) {
    return this.#upsert("bids", rows, (r) => `${r.tender_id}|${r.bid_id}`);
  }
  upsertAwards(rows) {
    return this.#upsert("awards", rows, (r) => `${r.tender_id}|${r.award_id}`);
  }
  upsertRiskFlags(rows) {
    return this.#upsert("risk_flags", rows, (r) => `${r.tender_id}|${r.risk_id}`);
  }
  upsertRiskRules(rows) {
    return this.#upsert("risk_rules", rows, (r) => r.risk_id);
  }
  upsertMonitorings(rows) {
    return this.#upsert("monitorings", rows, (r) => r.monitoring_id);
  }
  upsertCatalogPrices(rows) {
    return this.#upsert("catalog_prices", rows, (r) => r.offer_id);
  }
  upsertFindings(rows) {
    return this.#upsert("findings", rows, (r) => `${r.tender_id}|${r.detector_key}`);
  }
  upsertRuns(rows) {
    return this.#upsert("runs", rows, (r) => r.run_id);
  }
  replaceRuns(rows) {
    return this.#write("runs", rows);
  }
  allTenders() {
    return this.#read("tenders");
  }
  allTenderItems() {
    return this.#read("tender_items");
  }
  allBids() {
    return this.#read("bids");
  }
  allAwards() {
    return this.#read("awards");
  }
  allRiskFlags() {
    return this.#read("risk_flags");
  }
  allRiskRules() {
    return this.#read("risk_rules");
  }
  allMonitorings() {
    return this.#read("monitorings");
  }
  allCatalogPrices() {
    return this.#read("catalog_prices");
  }
  allFindings() {
    return this.#read("findings");
  }
  allRuns() {
    return this.#read("runs");
  }
  async getCursor(worker) {
    const all = await this.#read("cursors");
    return all[0]?.[worker] ?? null;
  }
  async setCursor(worker, cursor) {
    const all = await this.#read("cursors");
    const map = all[0] ?? {};
    map[worker] = cursor;
    await this.#write("cursors", [map]);
  }
};

// src/config.ts
var REGION = "\u0425\u0430\u0440\u043A\u0456\u0432\u0441\u044C\u043A\u0430 \u043E\u0431\u043B\u0430\u0441\u0442\u044C";
var SOUTHERN_RAILWAY_EDRPOU = "40081216";
var RAILWAY_EDRPOU = /* @__PURE__ */ new Set([
  SOUTHERN_RAILWAY_EDRPOU,
  // РФ "Південна залізниця" — the Kharkiv branch
  "40081347",
  // Філія "Центр забезпечення виробництва"
  "41022900",
  // Філія "Пасажирська компанія"
  "40123454",
  // Філія "Центр з ремонту та експлуатації колійних машин"
  "45462724",
  // Філія "УЗ Вагон-Сервіс"
  "45246390"
  // Філія "Приміська пасажирська компанія"
]);
var RAILWAY_NAME = /залізни|укрзаліз|колійн|локомотив|вагон|тепловоз|електровоз/i;
function railwayScope(entity) {
  const edrpou = entity.entity_edrpou ?? "";
  if (edrpou === SOUTHERN_RAILWAY_EDRPOU) return "southern";
  if (RAILWAY_EDRPOU.has(edrpou)) return "branch";
  if (entity.region === REGION && RAILWAY_NAME.test(entity.entity_name ?? "")) return "local";
  return null;
}
function dataDir() {
  if (process.env.TR_DATA_DIR) return process.env.TR_DATA_DIR;
  const working = join2(import.meta.dirname, "..", "data");
  return existsSync(working) ? working : join2(import.meta.dirname, "..", "web-data");
}
function openStore() {
  return new JsonStore(dataDir());
}

// src/labels.ts
var RISK_LABELS = {
  "ari-1-1": {
    short: "\u0414\u043E\u0433\u043E\u0432\u0456\u0440 \u043F\u0435\u0440\u0435\u043F\u0438\u0441\u0443\u0432\u0430\u043B\u0438 \u0449\u043E\u043D\u0430\u0439\u043C\u0435\u043D\u0448\u0435 \u0442\u0440\u0438\u0447\u0456",
    means: "\u041F\u0456\u0441\u043B\u044F \u043F\u0435\u0440\u0435\u043C\u043E\u0433\u0438 \u0434\u043E \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0443 \u0443\u043A\u043B\u0430\u043B\u0438 \u0442\u0440\u0438 \u0447\u0438 \u0431\u0456\u043B\u044C\u0448\u0435 \u0434\u043E\u0434\u0430\u0442\u043A\u043E\u0432\u0438\u0445 \u0443\u0433\u043E\u0434. \u0421\u0430\u043C\u0435 \u0442\u0430\u043A \u043D\u0430\u0439\u0447\u0430\u0441\u0442\u0456\u0448\u0435 \u043F\u0456\u0434\u043D\u0456\u043C\u0430\u044E\u0442\u044C \u0446\u0456\u043D\u0443 \u0432\u0436\u0435 \u043F\u0456\u0441\u043B\u044F \u0442\u043E\u0433\u043E, \u044F\u043A \u0442\u043E\u0440\u0433\u0438 \u0432\u0438\u0433\u0440\u0430\u043D\u043E.",
    group: "\u0426\u0456\u043D\u0443 \u0437\u043C\u0456\u043D\u0438\u043B\u0438 \u043F\u0456\u0441\u043B\u044F \u043F\u0435\u0440\u0435\u043C\u043E\u0433\u0438"
  },
  "ari-1-2": {
    short: "\u0426\u0456\u043D\u0443 \u043F\u0456\u0434\u043D\u044F\u043B\u0438 \xAB\u0437\u0430 \u043F\u043E\u043A\u0440\u0430\u0449\u0435\u043D\u043D\u044F \u044F\u043A\u043E\u0441\u0442\u0456\xBB",
    means: "\u0414\u0432\u0456 \u0447\u0438 \u0431\u0456\u043B\u044C\u0448\u0435 \u0434\u043E\u0434\u0430\u0442\u043A\u043E\u0432\u0438\u0445 \u0443\u0433\u043E\u0434 \u0456\u0437 \u0444\u043E\u0440\u043C\u0443\u043B\u044E\u0432\u0430\u043D\u043D\u044F\u043C \u043F\u0440\u043E \u043F\u043E\u043A\u0440\u0430\u0449\u0435\u043D\u043D\u044F \u044F\u043A\u043E\u0441\u0442\u0456. \u0426\u0435 \u043F\u043E\u0448\u0438\u0440\u0435\u043D\u0438\u0439 \u0441\u043F\u043E\u0441\u0456\u0431 \u043E\u0431\u0491\u0440\u0443\u043D\u0442\u0443\u0432\u0430\u0442\u0438 \u043F\u0456\u0434\u0432\u0438\u0449\u0435\u043D\u043D\u044F \u0446\u0456\u043D\u0438.",
    group: "\u0426\u0456\u043D\u0443 \u0437\u043C\u0456\u043D\u0438\u043B\u0438 \u043F\u0456\u0441\u043B\u044F \u043F\u0435\u0440\u0435\u043C\u043E\u0433\u0438"
  },
  "sas24-3-4": {
    short: "\u0426\u0456\u043D\u0443 \u043F\u0456\u0434\u043D\u044F\u043B\u0438 \u0439 \u0441\u0442\u0440\u043E\u043A \u043F\u043E\u0434\u043E\u0432\u0436\u0438\u043B\u0438",
    means: "\u0417\u0430\u043C\u043E\u0432\u043D\u0438\u043A \u0437\u043C\u0456\u043D\u0438\u0432 \u0456\u0441\u0442\u043E\u0442\u043D\u0456 \u0443\u043C\u043E\u0432\u0438 \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0443 \u043E\u0434\u0440\u0430\u0437\u0443 \u0443 \u0434\u0432\u043E\u0445 \u0447\u0430\u0441\u0442\u0438\u043D\u0430\u0445 \u2014 \u0446\u0456\u043D\u0430 \u0432\u0433\u043E\u0440\u0443, \u0441\u0442\u0440\u043E\u043A \u0434\u0430\u043B\u0456.",
    group: "\u0426\u0456\u043D\u0443 \u0437\u043C\u0456\u043D\u0438\u043B\u0438 \u043F\u0456\u0441\u043B\u044F \u043F\u0435\u0440\u0435\u043C\u043E\u0433\u0438"
  },
  "sas24-3-2": {
    short: "\u0412\u0456\u0434\u0445\u0438\u043B\u0438\u043B\u0438 \u0434\u0432\u043E\u0445 \u0456 \u0431\u0456\u043B\u044C\u0448\u0435 \u0443\u0447\u0430\u0441\u043D\u0438\u043A\u0456\u0432 \u2014 \u0442\u043E\u0432\u0430\u0440\u0438 \u0439 \u043F\u043E\u0441\u043B\u0443\u0433\u0438",
    means: "\u0423\u0441\u0456\u0445, \u043A\u0440\u0456\u043C \u043F\u0435\u0440\u0435\u043C\u043E\u0436\u0446\u044F, \u0437\u043D\u044F\u043B\u0438 \u0437 \u0442\u043E\u0440\u0433\u0456\u0432. \u041A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0446\u0456\u044F \u0437\u043D\u0438\u043A\u0430\u0454, \u0446\u0456\u043D\u0443 \u043D\u0435\u043C\u0430 \u0437 \u0447\u0438\u043C \u043F\u043E\u0440\u0456\u0432\u043D\u044F\u0442\u0438.",
    group: "\u041A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0442\u0456\u0432 \u0443\u0441\u0443\u043D\u0443\u043B\u0438"
  },
  "sas24-3-2-1": {
    short: "\u0412\u0456\u0434\u0445\u0438\u043B\u0438\u043B\u0438 \u0434\u0432\u043E\u0445 \u0456 \u0431\u0456\u043B\u044C\u0448\u0435 \u0443\u0447\u0430\u0441\u043D\u0438\u043A\u0456\u0432 \u2014 \u0440\u043E\u0431\u043E\u0442\u0438",
    means: "\u0422\u0435 \u0441\u0430\u043C\u0435 \u043D\u0430 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0440\u043E\u0431\u0456\u0442: \u0443\u0441\u0456\u0445 \u043A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0442\u0456\u0432 \u043F\u0435\u0440\u0435\u043C\u043E\u0436\u0446\u044F \u0432\u0456\u0434\u0445\u0438\u043B\u0435\u043D\u043E.",
    group: "\u041A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0442\u0456\u0432 \u0443\u0441\u0443\u043D\u0443\u043B\u0438"
  },
  "sas24-3-5": {
    short: "\u0412\u0456\u0434\u0445\u0438\u043B\u0438\u043B\u0438, \u043D\u0435 \u0434\u0430\u0432\u0448\u0438 \u0432\u0438\u043F\u0440\u0430\u0432\u0438\u0442\u0438 \u043F\u043E\u043C\u0438\u043B\u043A\u0443",
    means: "\u0417\u0430\u043A\u043E\u043D \u0434\u0430\u0454 \u0443\u0447\u0430\u0441\u043D\u0438\u043A\u0443 24 \u0433\u043E\u0434\u0438\u043D\u0438 \u043D\u0430 \u0443\u0441\u0443\u043D\u0435\u043D\u043D\u044F \u043D\u0435\u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u043D\u043E\u0441\u0442\u0435\u0439. \u0422\u0443\u0442 \u0449\u043E\u043D\u0430\u0439\u043C\u0435\u043D\u0448\u0435 \u0434\u0432\u043E\u0445 \u0432\u0456\u0434\u0445\u0438\u043B\u0438\u043B\u0438, \u043D\u0435 \u0441\u043A\u043E\u0440\u0438\u0441\u0442\u0430\u0432\u0448\u0438\u0441\u044C \u0446\u0438\u043C \u043C\u0435\u0445\u0430\u043D\u0456\u0437\u043C\u043E\u043C.",
    group: "\u041A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0442\u0456\u0432 \u0443\u0441\u0443\u043D\u0443\u043B\u0438"
  },
  "sas24-3-15": {
    short: "\u0412\u0456\u0434\u0445\u0438\u043B\u0438\u043B\u0438 \u0443\u0447\u0430\u0441\u043D\u0438\u043A\u0456\u0432, \u043F\u043E\u043A\u0438 \u0442\u0440\u0438\u0432\u0430\u043B\u0430 \u0441\u043A\u0430\u0440\u0433\u0430",
    means: "\u0414\u0432\u043E\u0445 \u0456 \u0431\u0456\u043B\u044C\u0448\u0435 \u0443\u0447\u0430\u0441\u043D\u0438\u043A\u0456\u0432 \u0437\u043D\u044F\u043B\u0438 \u0437 \u0442\u043E\u0440\u0433\u0456\u0432 \u0443 \u043C\u043E\u043C\u0435\u043D\u0442, \u043A\u043E\u043B\u0438 \u0441\u043A\u0430\u0440\u0433\u0430 \u0449\u0435 \u0440\u043E\u0437\u0433\u043B\u044F\u0434\u0430\u043B\u0430\u0441\u044F.",
    group: "\u041A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0442\u0456\u0432 \u0443\u0441\u0443\u043D\u0443\u043B\u0438"
  },
  "sas24-3-13": {
    short: "\u0411\u0435\u0437\u043F\u0456\u0434\u0441\u0442\u0430\u0432\u043D\u043E \u0437\u0430\u0441\u0442\u043E\u0441\u0443\u0432\u0430\u043B\u0438 \u043C\u0435\u0445\u0430\u043D\u0456\u0437\u043C \xAB24 \u0433\u043E\u0434\u0438\u043D\u0438\xBB",
    means: "\u041D\u0430 \u0441\u043F\u0440\u043E\u0449\u0435\u043D\u0456\u0439 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0441\u043A\u043E\u0440\u0438\u0441\u0442\u0430\u043B\u0438\u0441\u044F \u043F\u0440\u043E\u0446\u0435\u0434\u0443\u0440\u043E\u044E \u0432\u0438\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u043D\u044F \u0442\u0430\u043C, \u0434\u0435 \u043F\u0456\u0434\u0441\u0442\u0430\u0432 \u0434\u043B\u044F \u043D\u0435\u0457 \u043D\u0435 \u0431\u0443\u043B\u043E.",
    group: "\u041A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0442\u0456\u0432 \u0443\u0441\u0443\u043D\u0443\u043B\u0438"
  },
  "sas24-3-10": {
    short: "\u041F\u0435\u0440\u0435\u043C\u043E\u0436\u0446\u044F \u043D\u0435 \u0432\u0456\u0434\u0445\u0438\u043B\u0438\u043B\u0438 \u043F\u043E\u043F\u0440\u0438 \u043F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F \u0432\u0438\u043C\u043E\u0433",
    means: "\u041F\u0435\u0440\u0435\u043C\u043E\u0436\u0435\u0446\u044C \u043D\u0435 \u0432\u0438\u043A\u043E\u043D\u0430\u0432 \u043E\u0431\u043E\u0432'\u044F\u0437\u043A\u043E\u0432\u0456 \u0432\u0438\u043C\u043E\u0433\u0438 \u0449\u043E\u0434\u043E \u043E\u043F\u0440\u0438\u043B\u044E\u0434\u043D\u0435\u043D\u043D\u044F, \u0430\u043B\u0435 \u0439\u043E\u0433\u043E \u0437\u0430\u043B\u0438\u0448\u0438\u043B\u0438 \u043F\u0435\u0440\u0435\u043C\u043E\u0436\u0446\u0435\u043C.",
    group: "\u041A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0442\u0456\u0432 \u0443\u0441\u0443\u043D\u0443\u043B\u0438"
  },
  "sas24-3-11-1": {
    short: "\u0414\u043E\u0433\u043E\u0432\u0456\u0440 \u0443\u043A\u043B\u0430\u043B\u0438 \u043F\u043E\u0432\u0437 \u0435\u043B\u0435\u043A\u0442\u0440\u043E\u043D\u043D\u0443 \u0441\u0438\u0441\u0442\u0435\u043C\u0443",
    means: "\u0417\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044E \u043F\u0440\u043E\u0432\u0435\u043B\u0438 \u0431\u0435\u0437 \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u0430\u043D\u043D\u044F \u0435\u043B\u0435\u043A\u0442\u0440\u043E\u043D\u043D\u043E\u0457 \u0441\u0438\u0441\u0442\u0435\u043C\u0438 \u0442\u0430\u043C, \u0434\u0435 \u0432\u043E\u043D\u0430 \u043E\u0431\u043E\u0432'\u044F\u0437\u043A\u043E\u0432\u0430.",
    group: "\u0421\u0438\u0441\u0442\u0435\u043C\u0443 \u043E\u0431\u0456\u0439\u0448\u043B\u0438"
  },
  "sas24-3-11-2": {
    short: "\u0414\u043E\u0433\u043E\u0432\u0456\u0440 \u0443\u043A\u043B\u0430\u043B\u0438 \u043F\u0456\u0434 \u0447\u0430\u0441 \u043E\u0441\u043A\u0430\u0440\u0436\u0435\u043D\u043D\u044F",
    means: "\u0414\u043E\u0433\u043E\u0432\u0456\u0440 \u043F\u0456\u0434\u043F\u0438\u0441\u0430\u043B\u0438, \u043F\u043E\u043A\u0438 \u043F\u0440\u043E\u0446\u0435\u0434\u0443\u0440\u0443 \u043E\u0441\u043A\u0430\u0440\u0436\u0443\u0432\u0430\u043B\u0438 \u2014 \u0442\u043E\u0431\u0442\u043E \u043D\u0435 \u0434\u043E\u0447\u0435\u043A\u0430\u0432\u0448\u0438\u0441\u044C \u0440\u0456\u0448\u0435\u043D\u043D\u044F.",
    group: "\u0421\u0438\u0441\u0442\u0435\u043C\u0443 \u043E\u0431\u0456\u0439\u0448\u043B\u0438"
  },
  "sas24-3-1": {
    short: "\u041D\u0435 \u0432\u0438\u043A\u043E\u043D\u0430\u043B\u0438 \u0440\u0456\u0448\u0435\u043D\u043D\u044F \u043F\u043E \u0441\u043A\u0430\u0440\u0437\u0456 \u0432\u0447\u0430\u0441\u043D\u043E",
    means: "\u0420\u0456\u0448\u0435\u043D\u043D\u044F \u043E\u0440\u0433\u0430\u043D\u0443 \u043E\u0441\u043A\u0430\u0440\u0436\u0435\u043D\u043D\u044F \u043E\u0431\u043E\u0432'\u044F\u0437\u043A\u043E\u0432\u0435 \u0434\u043E \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043D\u044F. \u0417\u0430\u043C\u043E\u0432\u043D\u0438\u043A \u043D\u0435 \u0432\u0438\u043A\u043E\u043D\u0430\u0432 \u0439\u043E\u0433\u043E \u0443 \u0432\u0438\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0439 \u0437\u0430\u043A\u043E\u043D\u043E\u043C \u0441\u0442\u0440\u043E\u043A.",
    group: "\u0421\u043A\u0430\u0440\u0433\u0443 \u043F\u0440\u043E\u0456\u0433\u043D\u043E\u0440\u0443\u0432\u0430\u043B\u0438"
  },
  "sas24-3-9": {
    short: "\u041F\u043E\u0432\u0442\u043E\u0440\u043D\u043E \u043E\u0431\u0440\u0430\u043B\u0438 \u0442\u043E\u0433\u043E \u0441\u0430\u043C\u043E\u0433\u043E \u043F\u0435\u0440\u0435\u043C\u043E\u0436\u0446\u044F",
    means: "\u041F\u0456\u0441\u043B\u044F \u0440\u0456\u0448\u0435\u043D\u043D\u044F \u043E\u0440\u0433\u0430\u043D\u0443 \u043E\u0441\u043A\u0430\u0440\u0436\u0435\u043D\u043D\u044F \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A \u0437\u043D\u043E\u0432\u0443 \u0432\u0438\u0437\u043D\u0430\u0432 \u043F\u0435\u0440\u0435\u043C\u043E\u0436\u0446\u0435\u043C \u0442\u043E\u0433\u043E \u0441\u0430\u043C\u043E\u0433\u043E \u0443\u0447\u0430\u0441\u043D\u0438\u043A\u0430.",
    group: "\u0421\u043A\u0430\u0440\u0433\u0443 \u043F\u0440\u043E\u0456\u0433\u043D\u043E\u0440\u0443\u0432\u0430\u043B\u0438"
  },
  "sas24-3-7": {
    short: "\u0420\u043E\u0431\u043E\u0442\u0438 \xAB\u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043E\xBB \u043F\u0456\u0434\u043E\u0437\u0440\u0456\u043B\u043E \u0448\u0432\u0438\u0434\u043A\u043E",
    means: "\u041C\u0456\u0436 \u043E\u043F\u0440\u0438\u043B\u044E\u0434\u043D\u0435\u043D\u043D\u044F\u043C \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0443 \u043D\u0430 \u0440\u043E\u0431\u043E\u0442\u0438 \u0456 \u0437\u0432\u0456\u0442\u043E\u043C \u043F\u0440\u043E \u0439\u043E\u0433\u043E \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043D\u044F \u043C\u0438\u043D\u0443\u043B\u043E \u043C\u0435\u043D\u0448\u0435 60 \u0434\u043D\u0456\u0432.",
    group: "\u0421\u0442\u0440\u043E\u043A\u0438 \u043D\u0435 \u0441\u0445\u043E\u0434\u044F\u0442\u044C\u0441\u044F"
  }
};
var GROUP_ORDER = [
  "\u0426\u0456\u043D\u0443 \u0437\u043C\u0456\u043D\u0438\u043B\u0438 \u043F\u0456\u0441\u043B\u044F \u043F\u0435\u0440\u0435\u043C\u043E\u0433\u0438",
  "\u041A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0442\u0456\u0432 \u0443\u0441\u0443\u043D\u0443\u043B\u0438",
  "\u0421\u0438\u0441\u0442\u0435\u043C\u0443 \u043E\u0431\u0456\u0439\u0448\u043B\u0438",
  "\u0421\u043A\u0430\u0440\u0433\u0443 \u043F\u0440\u043E\u0456\u0433\u043D\u043E\u0440\u0443\u0432\u0430\u043B\u0438",
  "\u0421\u0442\u0440\u043E\u043A\u0438 \u043D\u0435 \u0441\u0445\u043E\u0434\u044F\u0442\u044C\u0441\u044F"
];
var PROCEDURES = {
  aboveThreshold: "\u0412\u0456\u0434\u043A\u0440\u0438\u0442\u0456 \u0442\u043E\u0440\u0433\u0438",
  aboveThresholdUA: "\u0412\u0456\u0434\u043A\u0440\u0438\u0442\u0456 \u0442\u043E\u0440\u0433\u0438",
  aboveThresholdEU: "\u0412\u0456\u0434\u043A\u0440\u0438\u0442\u0456 \u0442\u043E\u0440\u0433\u0438 \u0437 \u043F\u0443\u0431\u043B\u0456\u043A\u0430\u0446\u0456\u0454\u044E \u0432 \u0404\u0421",
  belowThreshold: "\u0421\u043F\u0440\u043E\u0449\u0435\u043D\u0430 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F",
  reporting: "\u0417\u0432\u0456\u0442 \u043F\u0440\u043E \u0443\u043A\u043B\u0430\u0434\u0435\u043D\u0438\u0439 \u0434\u043E\u0433\u043E\u0432\u0456\u0440",
  negotiation: "\u041F\u0435\u0440\u0435\u0433\u043E\u0432\u043E\u0440\u043D\u0430 \u043F\u0440\u043E\u0446\u0435\u0434\u0443\u0440\u0430",
  "negotiation.quick": "\u041F\u0435\u0440\u0435\u0433\u043E\u0432\u043E\u0440\u043D\u0430 \u043F\u0440\u043E\u0446\u0435\u0434\u0443\u0440\u0430, \u0441\u043A\u043E\u0440\u043E\u0447\u0435\u043D\u0430",
  competitiveDialogue: "\u041A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0442\u043D\u0438\u0439 \u0434\u0456\u0430\u043B\u043E\u0433",
  "competitiveDialogue.stage2": "\u041A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0442\u043D\u0438\u0439 \u0434\u0456\u0430\u043B\u043E\u0433, \u0434\u0440\u0443\u0433\u0438\u0439 \u0435\u0442\u0430\u043F",
  priceQuotation: "\u0417\u0430\u043F\u0438\u0442 \u043F\u0440\u043E\u043F\u043E\u0437\u0438\u0446\u0456\u0439",
  simple: "\u0421\u043F\u0440\u043E\u0449\u0435\u043D\u0430 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F",
  esco: "\u0415\u043D\u0435\u0440\u0433\u043E\u0441\u0435\u0440\u0432\u0456\u0441",
  closeFrameworkAgreementUA: "\u0420\u0430\u043C\u043A\u043E\u0432\u0430 \u0443\u0433\u043E\u0434\u0430"
};
function procedureLabel(code) {
  if (!code) return null;
  return PROCEDURES[code] ?? code;
}
function readableName(name) {
  if (!name) return "";
  const clean = name.replace(/\s+/gu, " ").trim();
  if (!clean) return "";
  const letters = clean.replace(/[^\p{L}]/gu, "");
  if (letters.length === 0) return clean;
  const upper = [...letters].filter((c) => c === c.toUpperCase()).length;
  if (upper / letters.length < 0.8) return clean;
  let first = true;
  let afterQuote = false;
  return clean.replace(new RegExp(`\\p{L}[\\p{L}'\u2019-]*|[\xAB"\u201C']`, "gu"), (token) => {
    if (/^[«"“']$/.test(token)) {
      afterQuote = true;
      return token;
    }
    if (token.length <= 4) {
      first = false;
      afterQuote = false;
      return token;
    }
    const lower = token[0] + token.slice(1).toLowerCase();
    const capitalise = first || afterQuote;
    first = false;
    afterQuote = false;
    return capitalise ? lower[0].toUpperCase() + lower.slice(1) : lower.toLowerCase();
  });
}

// server/html.ts
function esc(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function money(amount) {
  if (amount === null || !Number.isFinite(amount)) return "\u2014";
  return new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 0 }).format(amount) + " \u20B4";
}
function unitMoney(amount) {
  if (amount === null || !Number.isFinite(amount)) return "\u2014";
  const digits = Math.abs(amount) < 1e3 ? 2 : 0;
  return new Intl.NumberFormat("uk-UA", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amount) + " \u20B4";
}
function shortMoney(amount) {
  if (amount === null || !Number.isFinite(amount)) return "\u2014";
  if (amount >= 1e9) return (amount / 1e9).toFixed(2).replace(".", ",") + " \u043C\u043B\u0440\u0434 \u20B4";
  if (amount >= 1e6) return (amount / 1e6).toFixed(1).replace(".", ",") + " \u043C\u043B\u043D \u20B4";
  if (amount >= 1e3) return Math.round(amount / 1e3).toLocaleString("uk-UA") + " \u0442\u0438\u0441 \u20B4";
  return Math.round(amount) + " \u20B4";
}
var MONTHS = [
  "\u0441\u0456\u0447\u043D\u044F",
  "\u043B\u044E\u0442\u043E\u0433\u043E",
  "\u0431\u0435\u0440\u0435\u0437\u043D\u044F",
  "\u043A\u0432\u0456\u0442\u043D\u044F",
  "\u0442\u0440\u0430\u0432\u043D\u044F",
  "\u0447\u0435\u0440\u0432\u043D\u044F",
  "\u043B\u0438\u043F\u043D\u044F",
  "\u0441\u0435\u0440\u043F\u043D\u044F",
  "\u0432\u0435\u0440\u0435\u0441\u043D\u044F",
  "\u0436\u043E\u0432\u0442\u043D\u044F",
  "\u043B\u0438\u0441\u0442\u043E\u043F\u0430\u0434\u0430",
  "\u0433\u0440\u0443\u0434\u043D\u044F"
];
function date(value) {
  if (!value) return "\u2014";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return "\u2014";
  const [, year, month, day2] = m;
  const name = MONTHS[Number(month) - 1];
  return name ? `${Number(day2)} ${name} ${year} \u0440.` : `${day2}.${month}.${year}`;
}
function shortDate(value) {
  if (!value) return "\u2014";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "\u2014";
}
function plural(n, one, few, many) {
  const mod100 = Math.abs(n) % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  const mod10 = mod100 % 10;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}
function trim(text, max = 130) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut) + "\u2026";
}
var STYLES = `
:root {
  color-scheme: light;

  --paper:#F6F8F9; --surface:#FFFFFF; --surface-2:#EEF3F5; --surface-3:#FAFCFC;
  --ink:#17222B; --ink-soft:#4A5966; --ink-faint:#7C8B96;
  --line:#DDE4E8; --line-soft:#EBF0F2;
  --accent:#17607F; --accent-bg:#E6F0F4;
  --alarm:#A03A2B; --alarm-bg:#FBE9E5;
  --warn:#87621F; --warn-bg:#FAF0DC;
  --calm:#276B4C; --calm-bg:#E4F1EA;
  --shadow:0 1px 2px rgba(23,34,43,.04), 0 8px 24px -18px rgba(23,34,43,.26);
  --radius:5px;
  --f-display:"Literata",Georgia,serif;
  --f-body:"IBM Plex Sans","Segoe UI",system-ui,sans-serif;
  --f-mono:"IBM Plex Mono",Consolas,monospace;
}
*{box-sizing:border-box}
pre,table{overflow-x:auto;max-width:100%}
html{scroll-behavior:smooth}
body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--f-body);font-size:17px;line-height:1.65;-webkit-font-smoothing:antialiased}
a{color:var(--accent);text-underline-offset:3px}
a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible{outline:2px solid var(--accent);outline-offset:2px}

/* ---------- chrome ---------- */
.top{border-bottom:1px solid var(--line);background:var(--surface);position:sticky;top:0;z-index:10}
.top .inner{max-width:72rem;margin:0 auto;padding:.9rem clamp(1rem,3vw,2rem);display:flex;flex-wrap:wrap;align-items:center;gap:.6rem 1.6rem}
.brand{font-family:var(--f-display);font-weight:700;font-size:1.1rem;letter-spacing:-.01em;text-decoration:none;color:var(--ink);white-space:nowrap}
.brand span{color:var(--accent)}
.nav{display:flex;flex-wrap:wrap;gap:.25rem;margin-left:auto}
.nav a{text-decoration:none;color:var(--ink-soft);font-size:.94rem;padding:.3rem .65rem;border-radius:2px}
.nav a:hover{color:var(--accent);background:var(--surface-2)}
.nav a[aria-current]{color:var(--accent);background:var(--accent-bg);font-weight:500}

/* Slide-in drawer. CSS only \u2014 a checkbox drives it, because <details>
   cannot animate between display:none and shown. The checkbox is hidden
   visually rather than with display:none, which keeps it keyboard-reachable
   and keeps the sibling selectors working. */
.sr-only{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0}
.burger{border-radius:var(--radius);flex:none;cursor:pointer;display:flex;flex-direction:column;justify-content:center;gap:4px;width:2.4rem;height:2.4rem;padding:.55rem;border:1px solid var(--line);background:var(--surface)}
.burger span{display:block;height:2px;background:var(--ink);border-radius:1px;transition:background .2s ease}
.burger:hover{border-color:var(--accent)}
.burger:hover span{background:var(--accent)}
#menu-toggle:focus-visible + .top .burger{border-radius:var(--radius);outline:2px solid var(--accent);outline-offset:2px}

.scrim{position:fixed;inset:0;background:rgba(10,18,24,.42);opacity:0;visibility:hidden;transition:opacity .28s ease,visibility .28s ease;z-index:40;cursor:pointer}
#menu-toggle:checked ~ .scrim{opacity:1;visibility:visible}

.drawer{position:fixed;top:0;right:0;bottom:0;width:min(20rem,86vw);background:var(--surface);border-left:1px solid var(--line);box-shadow:-18px 0 40px -24px rgba(10,18,24,.55);z-index:50;display:flex;flex-direction:column;transform:translateX(100%);transition:transform .28s cubic-bezier(.32,.72,.32,1);overflow-y:auto}
#menu-toggle:checked ~ .drawer{transform:translateX(0)}

.drawer-head{display:flex;align-items:center;justify-content:space-between;padding:1rem 1.15rem;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--surface)}
.drawer-head strong{font-family:var(--f-display);font-size:1.02rem;font-weight:700}
.drawer-close{cursor:pointer;font-size:1.5rem;line-height:1;color:var(--ink-faint);padding:.1rem .45rem;border:1px solid transparent}
.drawer-close:hover{color:var(--accent);border-color:var(--line)}
.drawer a{display:flex;flex-direction:column;gap:.05rem;padding:.8rem 1.15rem;text-decoration:none;color:var(--ink);border-bottom:1px solid var(--line-soft);font-size:.99rem}
.drawer a:last-child{border-bottom:0}
.drawer a:hover{background:var(--surface-2);color:var(--accent)}
.drawer a[aria-current]{background:var(--accent-bg);color:var(--accent);font-weight:500;box-shadow:inset 3px 0 0 var(--accent)}
.drawer small{color:var(--ink-faint);font-size:.82rem;font-weight:400}

@media (prefers-reduced-motion: reduce){.drawer,.scrim{transition-duration:.01ms}}


.wrap{max-width:72rem;margin:0 auto;padding:clamp(1rem,2.5vw,1.6rem) clamp(1rem,3vw,2rem) 6rem}

/* ---------- type ---------- */
h1{font-family:var(--f-display);font-weight:700;font-size:clamp(1.5rem,3vw,1.95rem);line-height:1.18;letter-spacing:-.015em;margin:0 0 .35rem;text-wrap:balance;max-width:30ch}
h1.long{font-size:clamp(1.35rem,3vw,1.9rem);max-width:32ch}
h2{font-family:var(--f-display);font-weight:700;font-size:1.35rem;line-height:1.25;margin:2.75rem 0 .35rem;text-wrap:balance}
h2:first-of-type{margin-top:2rem}
.sub{color:var(--ink-soft);max-width:80ch;margin:0 0 .55rem;font-size:.95rem}
.hint{color:var(--ink-faint);font-size:.89rem;max-width:70ch;margin:.1rem 0 .7rem}
.statline{display:flex;flex-wrap:wrap;gap:.2rem .5rem;align-items:baseline;font-size:.88rem;color:var(--ink-soft);margin:0 0 .7rem;max-width:none}
.statline b{font-family:var(--f-display);font-weight:700;color:var(--ink);font-variant-numeric:tabular-nums}
.caution{font-size:.88rem;line-height:1.5;color:var(--alarm);background:var(--alarm-bg);border:1px solid var(--alarm);border-radius:var(--radius);padding:.5rem .75rem;margin:0 0 1.5rem;max-width:72ch}

/* ---------- breadcrumb ---------- */
.back{display:inline-block;font-size:.9rem;color:var(--ink-soft);text-decoration:none;margin-bottom:1.1rem}
.back:hover{color:var(--accent)}


/* ---------- filters ---------- */
form.filters{display:flex;flex-wrap:wrap;gap:.55rem;margin-bottom:.9rem;align-items:center}
input,select{border-radius:var(--radius);font-family:inherit;font-size:.95rem;color:var(--ink);background:var(--surface);border:1px solid var(--line);padding:.55rem .75rem;min-width:0}
input[type=search]{flex:1 1 20rem}
select{max-width:24rem}
button{border-radius:var(--radius);font-family:inherit;font-size:.95rem;font-weight:500;color:#fff;background:var(--accent);border:1px solid var(--accent);padding:.55rem 1.15rem;cursor:pointer}
button:hover{filter:brightness(1.08)}
.check{display:flex;align-items:center;gap:.4rem;font-size:.93rem;color:var(--ink-soft);white-space:nowrap}
.check input{min-width:auto}
.reset{font-size:.9rem;color:var(--ink-faint)}
form.filters{flex-direction:column;align-items:stretch;gap:.6rem}
.filter-row{display:flex;flex-wrap:wrap;gap:.55rem;align-items:center}
/* Inputs must not stretch vertically: the form itself is a column, so a
   bare flex-grow on a child would grow it down the page. */
.filter-row input,.filter-row select,.filter-row button{align-self:center}
.filter-row input[type=search]{flex:1 1 22rem;max-width:38rem}
.filter-row input[type=date]{flex:0 0 auto;width:10.5rem}
.filter-row input.num{flex:0 0 auto;width:9rem;font-variant-numeric:tabular-nums}
.filter-label.faint{color:var(--ink-faint);font-size:.85rem}

/* the collapsed filter panel */
.filters-more{border:1px solid var(--line);border-radius:var(--radius);background:var(--surface)}
.filters-more summary{cursor:pointer;list-style:none;padding:.6rem .9rem;font-size:.95rem;font-weight:500;color:var(--accent);display:flex;align-items:center;gap:.5rem}
.filters-more summary::-webkit-details-marker{display:none}
.filters-more summary::before{content:"\u25B8";color:var(--ink-faint);font-size:.8rem;transition:transform .15s ease;display:inline-block}
.filters-more[open] summary::before{transform:rotate(90deg)}
.filters-more[open] summary{border-bottom:1px solid var(--line-soft)}
.filters-more summary:hover{background:var(--surface-3)}
.filters-more .inner{padding:.9rem;display:flex;flex-direction:column;gap:.6rem}
.verdict{border-left:4px solid var(--ink-faint)}
.verdict.high{border-left-color:var(--alarm)}
.verdict.medium{border-left-color:var(--warn)}
.verdict.low{border-left-color:var(--ink-faint)}
.verdict-tag{display:inline-block;font-size:.72rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;padding:.24rem .55rem;border-radius:2px;margin-right:.5rem;vertical-align:middle}
.verdict.high .verdict-tag{color:var(--alarm);background:var(--alarm-bg);border:1px solid var(--alarm)}
.verdict.medium .verdict-tag{color:var(--warn);background:var(--warn-bg);border:1px solid var(--warn)}
.verdict.low .verdict-tag{color:var(--ink-faint);background:var(--surface-2);border:1px solid var(--line)}
ol.findings{margin:.4rem 0 1rem;padding-left:1.4rem;display:flex;flex-direction:column;gap:.7rem}
ol.findings li{max-width:68ch}
ol.findings li strong{display:block;margin-bottom:.15rem}
ol.findings li span{color:var(--ink-soft);font-size:.96rem}
ol.findings li.w-high::marker{color:var(--alarm);font-weight:700}
ol.findings li.w-medium::marker{color:var(--warn);font-weight:700}
/* the three-line explainer a newcomer reads once */
.primer{display:flex;flex-wrap:wrap;align-items:center;gap:.3rem .9rem;margin:0 0 .7rem;padding:.45rem .75rem;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);font-size:.85rem;color:var(--ink-soft)}
.primer b{display:inline-flex;align-items:center;justify-content:center;width:1.15rem;height:1.15rem;border-radius:50%;background:var(--accent);color:#fff;font-size:.7rem;margin-right:.35rem}
.primer span{display:inline-flex;align-items:center;white-space:nowrap}
.primer a{margin-left:auto;font-size:.88rem}

/* one-click starting points */
.presets{display:flex;flex-wrap:wrap;gap:.35rem;margin:0 0 .6rem}
.preset{text-decoration:none;font-size:.88rem;color:var(--ink-soft);background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:.38rem .85rem;white-space:nowrap}
.preset:hover{border-color:var(--accent);color:var(--accent)}
.preset.on{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:500}

/* sorting and grouping, always in view */
.sortbar{display:flex;flex-wrap:wrap;gap:.45rem .7rem;align-items:center;margin:0 0 .7rem;padding:.5rem .75rem;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius)}
.sortbar label{display:inline-flex;align-items:center;gap:.35rem;font-size:.86rem;color:var(--ink-faint);white-space:nowrap}
.sortbar select{font-size:.88rem;padding:.3rem .45rem;max-width:12.5rem}
.sortbar input[type=search]{flex:1 1 14rem;min-width:10rem;font-size:.9rem;padding:.35rem .55rem}
.sortbar .go{font-size:.9rem;padding:.4rem .95rem}
.filters{margin-bottom:1rem}
.filters-more summary .reset{margin-left:auto}

.actions{display:flex;flex-wrap:wrap;gap:.55rem;margin:0 0 1.75rem}
.action{display:inline-flex;align-items:center;gap:.45rem;text-decoration:none;font-size:.95rem;color:var(--accent);background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:.55rem 1rem}
.action:hover{border-color:var(--accent);background:var(--accent-bg)}
.action.primary{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:500}
.action.primary:hover{filter:brightness(1.08);background:var(--accent)}
.action.primary::before{content:"\u2913";font-size:1.05rem}
.block-head{font-family:var(--f-display);font-weight:700;font-size:1.1rem;margin:1.75rem 0 .35rem}
.badge{background:var(--accent);color:#fff;font-size:.75rem;font-weight:600;min-width:1.3rem;height:1.3rem;border-radius:1rem;display:inline-flex;align-items:center;justify-content:center;padding:0 .4rem}
/* star toggle \u2014 a form so the site still needs no scripts */
.star-form{display:inline;margin:0}
.star{background:none;border:0;padding:0 .4rem 0 0;margin:0;cursor:pointer;font-size:1.15rem;line-height:1;color:var(--ink-faint);border-radius:var(--radius);vertical-align:baseline}
.star:hover{color:var(--warn)}
.star.on{color:#D9A21B}
.star span{display:none}
.name .star{float:left}

/* the labelled variant, used at the top of a dossier */
.star-form:has(.star span){display:inline-block;margin:0 0 1.25rem}
.star:has(span){display:inline-flex;align-items:center;gap:.5rem;font-size:1rem;border:1px solid var(--line);background:var(--surface);padding:.45rem .9rem;color:var(--accent)}
.star:has(span) span{display:inline}
.star.on:has(span){background:var(--accent-bg);border-color:var(--accent);font-weight:500}
.name .star:has(span){float:none}

.starred-btn{display:inline-flex;align-items:center;gap:.4rem;text-decoration:none;color:var(--ink-soft);font-size:.94rem;padding:.3rem .65rem;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface)}
.starred-btn:hover{color:var(--accent);border-color:var(--accent)}
.starred-btn.on{color:var(--accent);background:var(--accent-bg);border-color:var(--accent);font-weight:500}

.filter-label{font-size:.92rem;color:var(--ink-faint);white-space:nowrap}
select:disabled{opacity:.5;cursor:not-allowed}

/* grouped results */
.group-block{border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);box-shadow:var(--shadow);margin-bottom:.6rem}
.group-block summary{cursor:pointer;list-style:none;display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:.4rem 1rem;padding:.85rem 1.15rem}
.group-block summary::-webkit-details-marker{display:none}
.group-block summary::before{content:"\u25B8";color:var(--ink-faint);margin-right:.5rem;font-size:.8rem;transition:transform .15s ease;display:inline-block}
.group-block[open] > summary::before{transform:rotate(90deg)}
.group-block[open] > summary{border-bottom:1px solid var(--line-soft)}
.group-block summary:hover{background:var(--surface-3)}
.g-name{font-weight:600;font-size:1.02rem;flex:1 1 18rem;min-width:0}
.g-meta{font-size:.9rem;color:var(--ink-soft);font-variant-numeric:tabular-nums;white-space:nowrap}
.g-body{padding:.9rem 1.15rem 1.15rem}
.group-block .depth-1{background:var(--surface-3);box-shadow:none}
.group-block .rows{box-shadow:none}

/* ---------- result rows ---------- */
.rows{display:flex;flex-direction:column;gap:1px;background:var(--line);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);overflow:hidden}
.row{background:var(--surface);padding:.65rem 1rem;display:grid;grid-template-columns:auto 1fr minmax(6.5rem,auto);gap:.15rem .9rem;align-items:start}
.row:hover{background:var(--surface-3)}

/* severity, readable at a glance and on hover */
.dot{grid-row:1 / span 2;width:.55rem;height:.55rem;border-radius:50%;margin-top:.5rem;flex:none;background:var(--line)}
.sev-high .dot{background:var(--alarm)}
.sev-medium .dot{background:var(--warn)}
.sev-low .dot{background:#C4D0D6}

.row .who{min-width:0}
.row .name{font-size:1rem;font-weight:600;line-height:1.4;letter-spacing:-.005em;overflow-wrap:anywhere}
.row .name a{color:var(--ink);text-decoration:none}
.row .name a:hover{color:var(--accent);text-decoration:underline}
.row .meta{font-size:.85rem;color:var(--ink-soft);line-height:1.4;overflow-wrap:anywhere}
.row .meta a{color:var(--ink-soft)}
.row .meta a:hover{color:var(--accent)}
.row .amount{text-align:right}
.row .amount .big{font-family:var(--f-display);font-weight:700;font-size:1.05rem;line-height:1.3;font-variant-numeric:tabular-nums;white-space:nowrap}
.row .amount .exact{font-family:var(--f-mono);font-size:.72rem;color:var(--ink-faint);white-space:nowrap;display:block;margin-top:.1rem}
.row .flags{grid-column:2 / -1;display:flex;flex-wrap:wrap;gap:.28rem;margin-top:.3rem}

a.flag:hover{border-color:var(--accent);color:var(--accent)}
.flag.alarm{border-color:var(--alarm);background:var(--alarm-bg);color:var(--alarm);font-weight:500}
.flag.warn{border-color:var(--warn);background:var(--warn-bg);color:var(--warn)}
.flag.more{color:var(--ink-faint);border-style:dashed}
.tier{font-size:.72rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;padding:.24rem .55rem;border:1px solid currentColor;white-space:nowrap;border-radius:2px}
.tier.confirmed{color:var(--calm);background:var(--calm-bg)}
.tier.state{color:var(--warn);background:var(--warn-bg)}
.tier.own{color:var(--ink-faint);background:var(--surface-2)}
.code{font-family:var(--f-mono);font-size:.74rem;color:var(--ink-faint)}

/* ---------- cards ---------- */
.card{background:var(--surface);border-radius:var(--radius);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);padding:1.4rem 1.55rem;margin-bottom:1rem}
.card h3{margin:0 0 .5rem;font-size:1.08rem;font-weight:600;line-height:1.4;letter-spacing:-.005em}
.card p{margin:0 0 .7rem;color:var(--ink-soft);max-width:68ch}
.card p:last-child{margin-bottom:0}
.card p.lead{color:var(--ink);font-size:1.02rem}
.legal{border-left:3px solid var(--accent);background:var(--accent-bg);padding:.75rem 1rem;font-size:.94rem;color:var(--ink);max-width:none;border-radius:0 var(--radius) var(--radius) 0}
.legal.reading{border-left-color:var(--warn);background:var(--warn-bg)}
details.sub{margin:.9rem 0 .2rem;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface-3)}
details.sub summary{cursor:pointer;list-style:none;padding:.6rem .9rem;font-size:.93rem;font-weight:500;color:var(--accent)}
details.sub summary::-webkit-details-marker{display:none}
details.sub summary::before{content:"+";display:inline-block;width:1.1rem;color:var(--ink-faint);font-weight:600}
details.sub[open] summary::before{content:"\u2212"}
details.sub[open] summary{border-bottom:1px solid var(--line-soft)}
details.sub .inner{padding:.85rem .9rem 1rem}
details.sub p{margin:0 0 .8rem;font-size:.93rem;max-width:68ch}
details.sub p:last-child{margin-bottom:0}
.faint{color:var(--ink-faint);font-size:.9rem}

.group{margin:2rem 0 .75rem;display:flex;align-items:baseline;gap:.75rem;flex-wrap:wrap}
.group h3{font-family:var(--f-display);font-weight:700;font-size:1.12rem;margin:0}
.group .count{font-size:.88rem;color:var(--ink-faint)}

dl.facts{display:grid;grid-template-columns:minmax(8rem,max-content) 1fr;gap:.55rem 1.5rem;margin:0}
dl.facts dt{font-size:.86rem;color:var(--ink-faint);padding-top:.1rem}
dl.facts dd{margin:0;font-size:1rem}
dl.facts dd strong{font-weight:600}


/* ---------- misc ---------- */
.pager{display:flex;gap:.6rem;align-items:center;margin-top:1.75rem;font-size:.94rem}
.pager a{padding:.5rem 1rem;border:1px solid var(--line);background:var(--surface);text-decoration:none}
.pager a:hover{border-color:var(--accent)}
.pager span{color:var(--ink-faint)}
.empty{background:var(--surface);border:1px dashed var(--line);padding:3rem 1.5rem;text-align:center;color:var(--ink-soft)}
.card ul{margin:.2rem 0 .9rem;padding-left:1.2rem;color:var(--ink-soft);max-width:68ch}
.card li{margin-bottom:.4rem}
.note{font-size:.9rem;color:var(--ink-faint);max-width:68ch;margin-top:2.5rem;padding-top:1.15rem;border-top:1px solid var(--line)}

details.help{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);margin-bottom:1.75rem}
details.help summary{cursor:pointer;padding:.85rem 1.25rem;font-weight:500;font-size:.97rem;list-style:none;display:flex;align-items:center;gap:.5rem}
details.help summary::-webkit-details-marker{display:none}
details.help summary::before{content:"?";display:inline-flex;align-items:center;justify-content:center;width:1.35rem;height:1.35rem;border:1px solid var(--accent);color:var(--accent);font-size:.82rem;font-weight:600;flex:none}
details.help[open] summary{border-bottom:1px solid var(--line-soft)}
details.help .inner{padding:1.1rem 1.25rem 1.35rem}
details.help p{margin:0 0 .7rem;color:var(--ink-soft);max-width:68ch}
details.help p:last-child{margin-bottom:0}
details.help ul{margin:.2rem 0 .9rem;padding-left:1.2rem;color:var(--ink-soft);max-width:68ch}
details.help li{margin-bottom:.35rem}
details.help p.lead{color:var(--ink)}
details.help p strong{color:var(--ink)}
details.help + details.help{margin-top:-1rem}
/* ---------- screens ----------
   Every size decision lives here rather than beside the rule it overrides.
   Phones get a single column, thumb-sized hit areas and 16px form text:
   anything smaller and iOS zooms the whole page the moment a field is
   focused, which then leaves the layout scrolled sideways. Tablets keep the
   desktop shape with tighter spacing. */

@media (max-width:64rem){
  .card{padding:1.2rem 1.3rem}
  h2{margin-top:2.25rem}
  .wrap{padding-bottom:4.5rem}
  /* Below a wide desktop the third column is gone and the chips wrap. Let
     them: a flag nobody can see is a flag that may as well not be there. */
  .row .flags .flag{font-size:.76rem;padding:.17rem .42rem}
}

@media (max-width:44rem){
  body{font-size:16px}

  /* header: the drawer already lists every section, so the inline links are
     duplication that costs a whole row on a narrow screen */
  .nav{display:none}
  .top .inner{padding:.55rem max(1rem,env(safe-area-inset-right)) .55rem max(1rem,env(safe-area-inset-left));gap:.45rem .8rem}
  .brand{font-size:1rem}
  .burger{width:2.75rem;height:2.75rem}
  .starred-btn{min-height:2.75rem;padding:.5rem .8rem}
  .starred-btn span{display:none}
  .drawer{width:min(20rem,88vw)}
  .drawer a{padding:.9rem 1.15rem}

  .wrap{padding:.9rem 1rem 4rem}
  h1{font-size:1.25rem;max-width:none;margin-bottom:.25rem}
  h2{font-size:1.15rem;margin-top:1.75rem}
  .sub{font-size:.88rem;margin-bottom:.4rem}
  .statline{display:none}
  .presets{margin-bottom:.45rem}
  .sortbar{margin-bottom:.5rem}
  .sub,.hint,.card p,.card ul,.note,details.sub p{max-width:none}

  /* iOS zoom guard \u2014 every control a finger can land in */
  input,select,button{font-size:16px}

  .sortbar{padding:.45rem .55rem;gap:.35rem}
  /* two rows, not four: search shares its row with the button, the two
     selects share the next one with their captions stacked above them */
  .sortbar input[type=search]{flex:1 1 58%;min-width:0;min-height:2.6rem;font-size:16px}
  .sortbar .go{flex:0 0 auto;width:auto;min-height:2.6rem;padding:.4rem .95rem;font-size:16px}
  .sortbar label{order:1;flex:1 1 calc(50% - .2rem);flex-direction:column;align-items:stretch;gap:.1rem;font-size:.72rem;letter-spacing:.02em}
  .sortbar.dir label{flex:1 1 100%}
  .sortbar select{width:100%;max-width:none;min-height:2.5rem;font-size:16px}

  /* every chip visible: a hidden one may as well not exist */
  .presets{flex-wrap:wrap;gap:.3rem}
  .preset{flex:none;min-height:2.35rem;display:inline-flex;align-items:center;padding:.5rem .7rem;font-size:.86rem}
  .primer{display:none}

  /* full-bleed lists: on a phone the card frame is noise, the content is not */
  .rows,.group-block{border-radius:0;border-left:0;border-right:0;margin-inline:-1rem;box-shadow:none}
  .row{grid-template-columns:auto 1fr;padding:.7rem 1rem;gap:.1rem .7rem}
  .row .name{font-size:.98rem}
  .row .name a{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .row .meta{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .row .amount{grid-column:2;text-align:left;margin-top:.2rem}
  .row .amount .big{font-size:1rem}
  .row .amount .exact{display:inline;margin-left:.5rem}
  .row .flags{grid-column:1 / -1;margin-top:.4rem;gap:.22rem}
  .row .flags .flag{font-size:.74rem;padding:.16rem .4rem;line-height:1.35}
  .row .star{padding:.3rem .5rem .3rem 0;font-size:1.3rem}

  .group-block summary{padding:.95rem 1rem}
  .g-name{flex:1 1 100%}
  .g-body{padding:.7rem 1rem 1rem}

  .card{padding:1.05rem 1.1rem;box-shadow:none}
  .actions{gap:.45rem}
  .action{flex:1 1 100%;justify-content:center;min-height:2.75rem}
  .pager a{min-height:2.75rem;display:inline-flex;align-items:center}

  .filters-more summary{padding:.8rem .9rem}
  .filter-row input[type=search],.filter-row input[type=date],.filter-row input.num,.filter-row select{flex:1 1 100%;width:100%;max-width:none}

  dl.facts{grid-template-columns:1fr;gap:.05rem}
  dl.facts dd{margin-bottom:.7rem}

  details.help summary,details.sub summary{padding:.85rem 1rem}
  .legal{padding:.7rem .85rem}
}

@media (max-width:22rem){
  .brand span{display:none}
}

`;
var MENU = [
  { href: "/", nav: "feed", label: "\u0423\u0441\u0456 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456", hint: "\u043F\u043E\u0432\u043D\u0438\u0439 \u043F\u0435\u0440\u0435\u043B\u0456\u043A, \u0437 \u043F\u043E\u0448\u0443\u043A\u043E\u043C \u0456 \u0444\u0456\u043B\u044C\u0442\u0440\u0430\u043C\u0438" },
  { href: "/railway", nav: "railway", label: "\u0417\u0430\u043B\u0456\u0437\u043D\u0438\u0446\u044F", hint: "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0437\u0430\u043B\u0456\u0437\u043D\u0438\u0446\u0456 \u0425\u0430\u0440\u043A\u0456\u0432\u0449\u0438\u043D\u0438" },
  { href: "/prices", nav: "prices", label: "\u0417\u0430\u0432\u0438\u0449\u0435\u043D\u0456 \u0446\u0456\u043D\u0438", hint: "\u0434\u0435 \u043C\u0438 \u0441\u0430\u043C\u0456 \u043F\u043E\u0440\u0430\u0445\u0443\u0432\u0430\u043B\u0438 \u043F\u0435\u0440\u0435\u043F\u043B\u0430\u0442\u0443" },
  { href: "/starred", nav: "starred", label: "\u041E\u0431\u0440\u0430\u043D\u0435", hint: "\u0443\u0441\u0435, \u0449\u043E \u0432\u0438 \u043F\u043E\u0437\u043D\u0430\u0447\u0438\u043B\u0438 \u0437\u0456\u0440\u043E\u0447\u043A\u043E\u044E" },
  { href: "/lookup", nav: "lookup", label: "\u041F\u043E\u0448\u0443\u043A \u0437\u0430 \u0404\u0414\u0420\u041F\u041E\u0423", hint: "\u043F\u0435\u0440\u0435\u0432\u0456\u0440\u0438\u0442\u0438 \u0431\u0443\u0434\u044C-\u044F\u043A\u0435 \u043F\u0456\u0434\u043F\u0440\u0438\u0454\u043C\u0441\u0442\u0432\u043E" },
  { href: "/article/366", nav: "article-366", label: "\u041F\u0456\u0434\u0440\u043E\u0431\u043B\u0435\u043D\u043D\u044F \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0456\u0432", hint: "\u0440\u043E\u0437\u0431\u0456\u0436\u043D\u043E\u0441\u0442\u0456 \u0432 \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0430\u0445 \u0456 \u0437\u0432\u0456\u0442\u0430\u0445" },
  { href: "/entities", nav: "entities", label: "\u0425\u0442\u043E \u043A\u0443\u043F\u0443\u0454", hint: "\u0443\u0441\u0442\u0430\u043D\u043E\u0432\u0438-\u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u0438" },
  { href: "/suppliers", nav: "suppliers", label: "\u0425\u0442\u043E \u043F\u0440\u043E\u0434\u0430\u0454", hint: "\u043A\u043E\u043C\u043F\u0430\u043D\u0456\u0457-\u043F\u0435\u0440\u0435\u043C\u043E\u0436\u0446\u0456" },
  { href: "/officers", nav: "officers", label: "\u0425\u0442\u043E \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u0454", hint: "\u043F\u043E\u0441\u0430\u0434\u043E\u0432\u0446\u0456, \u0449\u043E \u0432\u0435\u043B\u0438 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456" },
  { href: "/indicators", nav: "indicators", label: "\u0429\u043E \u043C\u0438 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u043C\u043E", hint: "\u0443\u0441\u0456 \u043E\u0437\u043D\u0430\u043A\u0438 \u043F\u0440\u043E\u0441\u0442\u0438\u043C\u0438 \u0441\u043B\u043E\u0432\u0430\u043C\u0438" },
  { href: "/updates", nav: "updates", label: "\u0429\u043E \u043D\u043E\u0432\u043E\u0433\u043E", hint: "\u043E\u0441\u0442\u0430\u043D\u043D\u0454 \u043E\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u044F \u0431\u0430\u0437\u0438" },
  { href: "/about", nav: "about", label: "\u041F\u0440\u043E \u0441\u0438\u0441\u0442\u0435\u043C\u0443", hint: "\u0437\u0432\u0456\u0434\u043A\u0438 \u0434\u0430\u043D\u0456 \u0456 \u0447\u043E\u0433\u043E \u0432\u043E\u043D\u0430 \u043D\u0435 \u0440\u043E\u0431\u0438\u0442\u044C" }
];
function layout(opts) {
  return `<!doctype html>
<html lang="uk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(opts.title)} \u2014 Tender Radar</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Literata:opsz,wght@7..72,400;7..72,700&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap">
<style>${STYLES}</style>
</head>
<body>
<input type="checkbox" id="menu-toggle" class="sr-only" aria-label="\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u0438 \u0432\u0441\u0456 \u0440\u043E\u0437\u0434\u0456\u043B\u0438">
<header class="top"><div class="inner">
  <a class="brand" href="/">Tender<span>&nbsp;Radar</span></a>
  <nav class="nav">
    <a href="/"${opts.nav === "feed" ? ' aria-current="page"' : ""}>\u0417\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456</a>
    <a href="/railway"${opts.nav === "railway" ? ' aria-current="page"' : ""}>\u0417\u0430\u043B\u0456\u0437\u043D\u0438\u0446\u044F</a>
    <a href="/about"${opts.nav === "about" ? ' aria-current="page"' : ""}>\u041F\u0440\u043E \u0441\u0438\u0441\u0442\u0435\u043C\u0443</a>
  </nav>
  <a class="starred-btn${opts.nav === "starred" ? " on" : ""}" href="/starred" title="\u041E\u0431\u0440\u0430\u043D\u0435">\u2605<span>\u041E\u0431\u0440\u0430\u043D\u0435</span></a>
  <label class="burger" for="menu-toggle" role="button" aria-label="\u0423\u0441\u0456 \u0440\u043E\u0437\u0434\u0456\u043B\u0438" title="\u0423\u0441\u0456 \u0440\u043E\u0437\u0434\u0456\u043B\u0438"><span></span><span></span><span></span></label>
</div></header>
<label class="scrim" for="menu-toggle" aria-hidden="true"></label>
<nav class="drawer" aria-label="\u0423\u0441\u0456 \u0440\u043E\u0437\u0434\u0456\u043B\u0438">
  <div class="drawer-head">
    <strong>\u0420\u043E\u0437\u0434\u0456\u043B\u0438</strong>
    <label class="drawer-close" for="menu-toggle" role="button" aria-label="\u0417\u0430\u043A\u0440\u0438\u0442\u0438">&times;</label>
  </div>
  ${MENU.map(
    (item) => `<a href="${item.href}"${opts.nav === item.nav ? ' aria-current="page"' : ""}>${item.label}<small>${item.hint}</small></a>`
  ).join("")}
</nav>
<main class="wrap">
${opts.body}
</main>
</body>
</html>`;
}

// src/legal.ts
var INDICATOR_LEGAL = {
  "ari-1-1": {
    admin: "3",
    consequences: ["changesVoid", "nullity", "principles"],
    norm: "\u0421\u0442\u0430\u0442\u0442\u044F 41 \u0447\u0430\u0441\u0442\u0438\u043D\u0430 5 \u0417\u0430\u043A\u043E\u043D\u0443 \u0423\u043A\u0440\u0430\u0457\u043D\u0438 \xAB\u041F\u0440\u043E \u043F\u0443\u0431\u043B\u0456\u0447\u043D\u0456 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456\xBB \u2014 \u0432\u0438\u0447\u0435\u0440\u043F\u043D\u0438\u0439 \u043F\u0435\u0440\u0435\u043B\u0456\u043A \u0432\u043E\u0441\u044C\u043C\u0438 \u043F\u0456\u0434\u0441\u0442\u0430\u0432, \u0437\u0430 \u044F\u043A\u0438\u0445 \u0434\u043E\u0437\u0432\u043E\u043B\u0435\u043D\u043E \u0437\u043C\u0456\u043D\u044E\u0432\u0430\u0442\u0438 \u0456\u0441\u0442\u043E\u0442\u043D\u0456 \u0443\u043C\u043E\u0432\u0438 \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0443 \u043F\u0440\u043E \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044E.",
    normNote: "\u0414\u0435\u0440\u0436\u0430\u0432\u0430 \u043D\u0435 \u043D\u0430\u0432\u043E\u0434\u0438\u0442\u044C \u043D\u043E\u0440\u043C\u0443 \u0434\u043B\u044F \u0446\u044C\u043E\u0433\u043E \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u0430. \u041C\u0438 \u0437\u0456\u0441\u0442\u0430\u0432\u043B\u044F\u0454\u043C\u043E \u0439\u043E\u0433\u043E \u0437\u0456 \u0441\u0442\u0430\u0442\u0442\u0435\u044E 41: \u0442\u0440\u0438 \u0456 \u0431\u0456\u043B\u044C\u0448\u0435 \u0434\u043E\u0434\u0430\u0442\u043A\u043E\u0432\u0438\u0445 \u0443\u0433\u043E\u0434 \u043E\u0437\u043D\u0430\u0447\u0430\u0454 \u0442\u0440\u0438 \u0456 \u0431\u0456\u043B\u044C\u0448\u0435 \u043F\u0456\u0434\u0441\u0442\u0430\u0432, \u043A\u043E\u0436\u043D\u0430 \u0437 \u044F\u043A\u0438\u0445 \u043C\u0430\u0454 \u043F\u043E\u0442\u0440\u0430\u043F\u043B\u044F\u0442\u0438 \u0434\u043E \u0446\u044C\u043E\u0433\u043E \u043F\u0435\u0440\u0435\u043B\u0456\u043A\u0443.",
    criminal: [
      { code: "366", why: "\u041A\u043E\u0436\u043D\u0430 \u0434\u043E\u0434\u0430\u0442\u043A\u043E\u0432\u0430 \u0443\u0433\u043E\u0434\u0430 \u2014 \u043E\u0444\u0456\u0446\u0456\u0439\u043D\u0438\u0439 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442 \u0456\u0437 \u0437\u0430\u0437\u043D\u0430\u0447\u0435\u043D\u043E\u044E \u043F\u0456\u0434\u0441\u0442\u0430\u0432\u043E\u044E. \u042F\u043A\u0449\u043E \u043F\u0456\u0434\u0441\u0442\u0430\u0432\u0430 \u043D\u0435 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u0454 \u0434\u0456\u0439\u0441\u043D\u043E\u0441\u0442\u0456, \u0446\u0435 \u043F\u0440\u0435\u0434\u043C\u0435\u0442 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u043A\u0438 \u043D\u0430 \u0437\u0430\u0432\u0456\u0434\u043E\u043C\u043E \u043D\u0435\u043F\u0440\u0430\u0432\u0434\u0438\u0432\u0456 \u0432\u0456\u0434\u043E\u043C\u043E\u0441\u0442\u0456." },
      { code: "191", why: "\u042F\u043A\u0449\u043E \u0432 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0456 \u0437\u043C\u0456\u043D \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A \u0441\u043F\u043B\u0430\u0442\u0438\u0432 \u0431\u0456\u043B\u044C\u0448\u0435 \u0431\u0435\u0437 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u043D\u043E\u0433\u043E \u0437\u0443\u0441\u0442\u0440\u0456\u0447\u043D\u043E\u0433\u043E \u043D\u0430\u0434\u0430\u043D\u043D\u044F, \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u0437\u0430\u0432\u043E\u043B\u043E\u0434\u0456\u043D\u043D\u044F \u043A\u043E\u0448\u0442\u0430\u043C\u0438." },
      { code: "364", why: "\u0421\u0438\u0441\u0442\u0435\u043C\u0430\u0442\u0438\u0447\u043D\u0430 \u0437\u043C\u0456\u043D\u0430 \u0443\u043C\u043E\u0432 \u043D\u0430 \u043A\u043E\u0440\u0438\u0441\u0442\u044C \u043F\u043E\u0441\u0442\u0430\u0447\u0430\u043B\u044C\u043D\u0438\u043A\u0430 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u044F\u043A \u0434\u0456\u0457 \u0432\u0441\u0443\u043F\u0435\u0440\u0435\u0447 \u0456\u043D\u0442\u0435\u0440\u0435\u0441\u0430\u043C \u0441\u043B\u0443\u0436\u0431\u0438." }
    ]
  },
  "ari-1-2": {
    admin: "3",
    consequences: ["changesVoid", "nullity", "principles"],
    norm: "\u0421\u0442\u0430\u0442\u0442\u044F 41 \u0447\u0430\u0441\u0442\u0438\u043D\u0430 5 \u043F\u0443\u043D\u043A\u0442 3 \u0417\u0430\u043A\u043E\u043D\u0443 \u0423\u043A\u0440\u0430\u0457\u043D\u0438 \xAB\u041F\u0440\u043E \u043F\u0443\u0431\u043B\u0456\u0447\u043D\u0456 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456\xBB: \xAB\u043F\u043E\u043A\u0440\u0430\u0449\u0435\u043D\u043D\u044F \u044F\u043A\u043E\u0441\u0442\u0456 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u0430 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456, \u0437\u0430 \u0443\u043C\u043E\u0432\u0438 \u0449\u043E \u0442\u0430\u043A\u0435 \u043F\u043E\u043A\u0440\u0430\u0449\u0435\u043D\u043D\u044F \u043D\u0435 \u043F\u0440\u0438\u0437\u0432\u0435\u0434\u0435 \u0434\u043E \u0437\u0431\u0456\u043B\u044C\u0448\u0435\u043D\u043D\u044F \u0441\u0443\u043C\u0438\xBB.",
    normNote: "\u0414\u0435\u0440\u0436\u0430\u0432\u0430 \u043D\u0435 \u043D\u0430\u0432\u043E\u0434\u0438\u0442\u044C \u043D\u043E\u0440\u043C\u0443 \u0434\u043B\u044F \u0446\u044C\u043E\u0433\u043E \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u0430. \u041C\u0438 \u0437\u0456\u0441\u0442\u0430\u0432\u043B\u044F\u0454\u043C\u043E \u0439\u043E\u0433\u043E \u0437 \u043F\u0443\u043D\u043A\u0442\u043E\u043C 3, \u0456 \u0437\u0456\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u043D\u044F \u0442\u0443\u0442 \u043F\u0440\u044F\u043C\u0435: \u0437\u0430\u043A\u043E\u043D \u0434\u043E\u0437\u0432\u043E\u043B\u044F\u0454 \u043F\u043E\u043A\u0440\u0430\u0449\u0435\u043D\u043D\u044F \u044F\u043A\u043E\u0441\u0442\u0456 \u043B\u0438\u0448\u0435 \u0437\u0430 \u0443\u043C\u043E\u0432\u0438, \u0449\u043E \u0441\u0443\u043C\u0430 \u043D\u0435 \u0437\u0440\u043E\u0441\u0442\u0430\u0454. \u0406\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440 \u0444\u0456\u043A\u0441\u0443\u0454 \u0441\u0430\u043C\u0435 \u0432\u0438\u043F\u0430\u0434\u043A\u0438, \u0434\u0435 \u0437\u0430 \u0446\u0456\u0454\u044E \u043F\u0456\u0434\u0441\u0442\u0430\u0432\u043E\u044E \u0446\u0456\u043D\u0443 \u043F\u0456\u0434\u043D\u044F\u043B\u0438.",
    criminal: [
      { code: "366", why: "\u041F\u0456\u0434\u0441\u0442\u0430\u0432\u0430 \xAB\u043F\u043E\u043A\u0440\u0430\u0449\u0435\u043D\u043D\u044F \u044F\u043A\u043E\u0441\u0442\u0456\xBB \u0437\u0430\u0444\u0456\u043A\u0441\u043E\u0432\u0430\u043D\u0430 \u0432 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0456. \u0417\u0430\u043A\u043E\u043D \u043F\u0440\u044F\u043C\u043E \u0437\u0430\u0431\u043E\u0440\u043E\u043D\u044F\u0454 \u0437\u0431\u0456\u043B\u044C\u0448\u0435\u043D\u043D\u044F \u0441\u0443\u043C\u0438 \u0437\u0430 \u0446\u0456\u0454\u044E \u043F\u0456\u0434\u0441\u0442\u0430\u0432\u043E\u044E, \u0442\u043E\u0436 \u0440\u043E\u0437\u0431\u0456\u0436\u043D\u0456\u0441\u0442\u044C \u043C\u0456\u0436 \u043D\u0430\u043F\u0438\u0441\u0430\u043D\u0438\u043C \u0456 \u0434\u043E\u0437\u0432\u043E\u043B\u0435\u043D\u0438\u043C \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u0432 \u043F\u0435\u0440\u0448\u0443 \u0447\u0435\u0440\u0433\u0443." },
      { code: "191", why: "\u0420\u0456\u0437\u043D\u0438\u0446\u044F, \u0441\u043F\u043B\u0430\u0447\u0435\u043D\u0430 \u043F\u043E\u043D\u0430\u0434 \u043F\u043E\u0447\u0430\u0442\u043A\u043E\u0432\u0443 \u0446\u0456\u043D\u0443 \u0437\u0430 \u0444\u043E\u0440\u043C\u0430\u043B\u044C\u043D\u043E \u043D\u0435\u0434\u043E\u0437\u0432\u043E\u043B\u0435\u043D\u043E\u044E \u043F\u0456\u0434\u0441\u0442\u0430\u0432\u043E\u044E, \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u044F\u043A \u0437\u0430\u0432\u043E\u043B\u043E\u0434\u0456\u043D\u043D\u044F \u043A\u043E\u0448\u0442\u0430\u043C\u0438." },
      { code: "364", why: "\u041F\u043E\u0433\u043E\u0434\u0436\u0435\u043D\u043D\u044F \u0442\u0430\u043A\u0438\u0445 \u0437\u043C\u0456\u043D \u0441\u043B\u0443\u0436\u0431\u043E\u0432\u043E\u044E \u043E\u0441\u043E\u0431\u043E\u044E \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u044F\u043A \u0434\u0456\u0457 \u0432\u0441\u0443\u043F\u0435\u0440\u0435\u0447 \u0456\u043D\u0442\u0435\u0440\u0435\u0441\u0430\u043C \u0441\u043B\u0443\u0436\u0431\u0438." }
    ]
  },
  "sas24-3-4": {
    admin: "3",
    consequences: ["changesVoid", "principles"],
    criminal: [
      { code: "366", why: "\u0417\u043C\u0456\u043D\u0430 \u0456\u0441\u0442\u043E\u0442\u043D\u0438\u0445 \u0443\u043C\u043E\u0432 \u043E\u0444\u043E\u0440\u043C\u043B\u044E\u0454\u0442\u044C\u0441\u044F \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u043B\u044C\u043D\u043E \u0439 \u043F\u043E\u0442\u0440\u0435\u0431\u0443\u0454 \u043E\u0431\u0491\u0440\u0443\u043D\u0442\u0443\u0432\u0430\u043D\u043D\u044F; \u0439\u043E\u0433\u043E \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u043D\u0456\u0441\u0442\u044C \u0434\u0456\u0439\u0441\u043D\u043E\u0441\u0442\u0456 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F." },
      { code: "191", why: "\u041F\u0456\u0434\u0432\u0438\u0449\u0435\u043D\u043D\u044F \u0446\u0456\u043D\u0438 \u0431\u0435\u0437 \u0437\u0443\u0441\u0442\u0440\u0456\u0447\u043D\u043E\u0433\u043E \u043D\u0430\u0434\u0430\u043D\u043D\u044F \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u044F\u043A \u0437\u0430\u0432\u043E\u043B\u043E\u0434\u0456\u043D\u043D\u044F \u043A\u043E\u0448\u0442\u0430\u043C\u0438." },
      { code: "364", why: "\u041E\u0434\u043D\u043E\u0447\u0430\u0441\u043D\u0435 \u043F\u0456\u0434\u0432\u0438\u0449\u0435\u043D\u043D\u044F \u0446\u0456\u043D\u0438 \u0442\u0430 \u043F\u0440\u043E\u0434\u043E\u0432\u0436\u0435\u043D\u043D\u044F \u0441\u0442\u0440\u043E\u043A\u0443 \u043D\u0430 \u043A\u043E\u0440\u0438\u0441\u0442\u044C \u043F\u043E\u0441\u0442\u0430\u0447\u0430\u043B\u044C\u043D\u0438\u043A\u0430 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u044F\u043A \u0437\u043B\u043E\u0432\u0436\u0438\u0432\u0430\u043D\u043D\u044F." }
    ]
  },
  "sas24-3-2": {
    admin: "3",
    consequences: ["principles", "nullity"],
    norm: "\u0421\u0442\u0430\u0442\u0442\u044F 31 \u0417\u0430\u043A\u043E\u043D\u0443 \u0423\u043A\u0440\u0430\u0457\u043D\u0438 \xAB\u041F\u0440\u043E \u043F\u0443\u0431\u043B\u0456\u0447\u043D\u0456 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456\xBB \u2014 \u0432\u0438\u0447\u0435\u0440\u043F\u043D\u0438\u0439 \u043F\u0435\u0440\u0435\u043B\u0456\u043A \u043F\u0456\u0434\u0441\u0442\u0430\u0432 \u0434\u043B\u044F \u0432\u0456\u0434\u0445\u0438\u043B\u0435\u043D\u043D\u044F \u0442\u0435\u043D\u0434\u0435\u0440\u043D\u043E\u0457 \u043F\u0440\u043E\u043F\u043E\u0437\u0438\u0446\u0456\u0457.",
    normNote: "\u0414\u0435\u0440\u0436\u0430\u0432\u0430 \u043D\u0435 \u043D\u0430\u0432\u043E\u0434\u0438\u0442\u044C \u043D\u043E\u0440\u043C\u0443 \u0434\u043B\u044F \u0446\u044C\u043E\u0433\u043E \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u0430. \u041C\u0438 \u0437\u0456\u0441\u0442\u0430\u0432\u043B\u044F\u0454\u043C\u043E \u0439\u043E\u0433\u043E \u0437\u0456 \u0441\u0442\u0430\u0442\u0442\u0435\u044E 31, \u044F\u043A\u0443 \u0441\u0430\u043C\u0430 \u0434\u0435\u0440\u0436\u0430\u0432\u0430 \u043D\u0430\u0432\u043E\u0434\u0438\u0442\u044C \u0434\u043B\u044F \u0441\u043F\u043E\u0440\u0456\u0434\u043D\u0435\u043D\u0438\u0445 \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u0456\u0432 \u043F\u0440\u043E \u0432\u0456\u0434\u0445\u0438\u043B\u0435\u043D\u043D\u044F \u043F\u0440\u043E\u043F\u043E\u0437\u0438\u0446\u0456\u0439 (sas24-3-10, sas24-3-15).",
    criminal: [
      { code: "364", why: "\u0412\u0456\u0434\u0445\u0438\u043B\u0435\u043D\u043D\u044F \u043A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0442\u0456\u0432 \u043F\u043E\u0437\u0430 \u043F\u0456\u0434\u0441\u0442\u0430\u0432\u0430\u043C\u0438 \u0441\u0442\u0430\u0442\u0442\u0456 31 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u044F\u043A \u0434\u0456\u0457 \u0432\u0441\u0443\u043F\u0435\u0440\u0435\u0447 \u0456\u043D\u0442\u0435\u0440\u0435\u0441\u0430\u043C \u0441\u043B\u0443\u0436\u0431\u0438 \u043D\u0430 \u043A\u043E\u0440\u0438\u0441\u0442\u044C \u0442\u0440\u0435\u0442\u044C\u043E\u0457 \u043E\u0441\u043E\u0431\u0438." },
      { code: "191", why: "\u042F\u043A\u0449\u043E \u0443\u0441\u0443\u043D\u0435\u043D\u043D\u044F \u043A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0446\u0456\u0457 \u043F\u0440\u0438\u0437\u0432\u0435\u043B\u043E \u0434\u043E \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0437\u0430 \u0437\u0430\u0432\u0438\u0449\u0435\u043D\u043E\u044E \u0446\u0456\u043D\u043E\u044E, \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u0437\u0430\u0432\u043E\u043B\u043E\u0434\u0456\u043D\u043D\u044F \u0440\u0456\u0437\u043D\u0438\u0446\u0435\u044E." }
    ]
  },
  "sas24-3-2-1": {
    admin: "3",
    consequences: ["principles", "nullity"],
    norm: "\u0421\u0442\u0430\u0442\u0442\u044F 31 \u0417\u0430\u043A\u043E\u043D\u0443 \u0423\u043A\u0440\u0430\u0457\u043D\u0438 \xAB\u041F\u0440\u043E \u043F\u0443\u0431\u043B\u0456\u0447\u043D\u0456 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456\xBB \u2014 \u0432\u0438\u0447\u0435\u0440\u043F\u043D\u0438\u0439 \u043F\u0435\u0440\u0435\u043B\u0456\u043A \u043F\u0456\u0434\u0441\u0442\u0430\u0432 \u0434\u043B\u044F \u0432\u0456\u0434\u0445\u0438\u043B\u0435\u043D\u043D\u044F \u0442\u0435\u043D\u0434\u0435\u0440\u043D\u043E\u0457 \u043F\u0440\u043E\u043F\u043E\u0437\u0438\u0446\u0456\u0457.",
    normNote: "\u0414\u0435\u0440\u0436\u0430\u0432\u0430 \u043D\u0435 \u043D\u0430\u0432\u043E\u0434\u0438\u0442\u044C \u043D\u043E\u0440\u043C\u0443 \u0434\u043B\u044F \u0446\u044C\u043E\u0433\u043E \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u0430. \u041C\u0438 \u0437\u0456\u0441\u0442\u0430\u0432\u043B\u044F\u0454\u043C\u043E \u0439\u043E\u0433\u043E \u0437\u0456 \u0441\u0442\u0430\u0442\u0442\u0435\u044E 31 \u0442\u0430\u043A \u0441\u0430\u043C\u043E, \u044F\u043A \u0434\u043B\u044F \u0430\u043D\u0430\u043B\u043E\u0433\u0456\u0447\u043D\u043E\u0433\u043E \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u0430 \u043D\u0430 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F\u0445 \u0442\u043E\u0432\u0430\u0440\u0456\u0432.",
    criminal: [
      { code: "364", why: "\u0412\u0456\u0434\u0445\u0438\u043B\u0435\u043D\u043D\u044F \u043A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0442\u0456\u0432 \u043F\u043E\u0437\u0430 \u043F\u0456\u0434\u0441\u0442\u0430\u0432\u0430\u043C\u0438 \u0441\u0442\u0430\u0442\u0442\u0456 31 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u044F\u043A \u0434\u0456\u0457 \u0432\u0441\u0443\u043F\u0435\u0440\u0435\u0447 \u0456\u043D\u0442\u0435\u0440\u0435\u0441\u0430\u043C \u0441\u043B\u0443\u0436\u0431\u0438 \u043D\u0430 \u043A\u043E\u0440\u0438\u0441\u0442\u044C \u0442\u0440\u0435\u0442\u044C\u043E\u0457 \u043E\u0441\u043E\u0431\u0438." },
      { code: "191", why: "\u042F\u043A\u0449\u043E \u0443\u0441\u0443\u043D\u0435\u043D\u043D\u044F \u043A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0446\u0456\u0457 \u043F\u0440\u0438\u0437\u0432\u0435\u043B\u043E \u0434\u043E \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0440\u043E\u0431\u0456\u0442 \u0437\u0430 \u0437\u0430\u0432\u0438\u0449\u0435\u043D\u043E\u044E \u0446\u0456\u043D\u043E\u044E, \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u0437\u0430\u0432\u043E\u043B\u043E\u0434\u0456\u043D\u043D\u044F \u0440\u0456\u0437\u043D\u0438\u0446\u0435\u044E." }
    ]
  },
  "sas24-3-5": {
    admin: "3",
    consequences: ["principles"],
    criminal: [
      { code: "364", why: "\u041D\u0435\u043D\u0430\u0434\u0430\u043D\u043D\u044F \u0443\u0447\u0430\u0441\u043D\u0438\u043A\u0430\u043C \u043F\u0435\u0440\u0435\u0434\u0431\u0430\u0447\u0435\u043D\u043E\u0457 \u0437\u0430\u043A\u043E\u043D\u043E\u043C \u043C\u043E\u0436\u043B\u0438\u0432\u043E\u0441\u0442\u0456 \u0443\u0441\u0443\u043D\u0443\u0442\u0438 \u043D\u0435\u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u043D\u043E\u0441\u0442\u0456 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u044F\u043A \u0434\u0456\u0457 \u0432\u0441\u0443\u043F\u0435\u0440\u0435\u0447 \u0456\u043D\u0442\u0435\u0440\u0435\u0441\u0430\u043C \u0441\u043B\u0443\u0436\u0431\u0438." }
    ]
  },
  "sas24-3-15": {
    admin: "3",
    consequences: ["principles"],
    criminal: [
      { code: "364", why: "\u0412\u0456\u0434\u0445\u0438\u043B\u0435\u043D\u043D\u044F \u0443\u0447\u0430\u0441\u043D\u0438\u043A\u0456\u0432 \u0443 \u043C\u043E\u043C\u0435\u043D\u0442, \u043A\u043E\u043B\u0438 \u0441\u043A\u0430\u0440\u0433\u0430 \u0449\u0435 \u0440\u043E\u0437\u0433\u043B\u044F\u0434\u0430\u043B\u0430\u0441\u044F, \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u044F\u043A \u0437\u043B\u043E\u0432\u0436\u0438\u0432\u0430\u043D\u043D\u044F \u0441\u043B\u0443\u0436\u0431\u043E\u0432\u0438\u043C \u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0449\u0435\u043C." }
    ]
  },
  "sas24-3-13": {
    admin: "3",
    consequences: ["principles"],
    criminal: [
      { code: "364", why: "\u0417\u0430\u0441\u0442\u043E\u0441\u0443\u0432\u0430\u043D\u043D\u044F \u043F\u0440\u043E\u0446\u0435\u0434\u0443\u0440\u0438 \u0432\u0438\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u043D\u044F \u0431\u0435\u0437 \u043F\u0456\u0434\u0441\u0442\u0430\u0432 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u044F\u043A \u0434\u0456\u0457 \u0432\u0441\u0443\u043F\u0435\u0440\u0435\u0447 \u0456\u043D\u0442\u0435\u0440\u0435\u0441\u0430\u043C \u0441\u043B\u0443\u0436\u0431\u0438." }
    ]
  },
  "sas24-3-10": {
    admin: "3",
    consequences: ["principles"],
    criminal: [
      { code: "364", why: "\u0417\u0430\u043B\u0438\u0448\u0435\u043D\u043D\u044F \u043F\u0435\u0440\u0435\u043C\u043E\u0436\u0446\u0435\u043C \u0443\u0447\u0430\u0441\u043D\u0438\u043A\u0430, \u044F\u043A\u0438\u0439 \u043D\u0435 \u0432\u0438\u043A\u043E\u043D\u0430\u0432 \u043E\u0431\u043E\u0432'\u044F\u0437\u043A\u043E\u0432\u0456 \u0432\u0438\u043C\u043E\u0433\u0438, \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u044F\u043A \u0443\u043C\u0438\u0441\u043D\u0456 \u0434\u0456\u0457 \u0432\u0441\u0443\u043F\u0435\u0440\u0435\u0447 \u0456\u043D\u0442\u0435\u0440\u0435\u0441\u0430\u043C \u0441\u043B\u0443\u0436\u0431\u0438." },
      { code: "367", why: "\u042F\u043A\u0449\u043E \u0443\u043C\u0438\u0441\u043B\u0443 \u043D\u0435 \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043E, \u0442\u0456 \u0441\u0430\u043C\u0456 \u0434\u0456\u0457 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u044E\u0442\u044C\u0441\u044F \u044F\u043A \u043D\u0435\u043D\u0430\u043B\u0435\u0436\u043D\u0435 \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043D\u044F \u0441\u043B\u0443\u0436\u0431\u043E\u0432\u0438\u0445 \u043E\u0431\u043E\u0432'\u044F\u0437\u043A\u0456\u0432." }
    ]
  },
  "sas24-3-11-1": {
    admin: "3",
    consequences: ["nullity", "principles"],
    criminal: [
      { code: "364", why: "\u041F\u0440\u043E\u0432\u0435\u0434\u0435\u043D\u043D\u044F \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u043F\u043E\u0432\u0437 \u0435\u043B\u0435\u043A\u0442\u0440\u043E\u043D\u043D\u0443 \u0441\u0438\u0441\u0442\u0435\u043C\u0443 \u0442\u0430\u043C, \u0434\u0435 \u0432\u043E\u043D\u0430 \u043E\u0431\u043E\u0432'\u044F\u0437\u043A\u043E\u0432\u0430, \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u044F\u043A \u0437\u043B\u043E\u0432\u0436\u0438\u0432\u0430\u043D\u043D\u044F \u0441\u043B\u0443\u0436\u0431\u043E\u0432\u0438\u043C \u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0449\u0435\u043C." },
      { code: "191", why: "\u0417\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F \u043F\u043E\u0437\u0430 \u043A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0442\u043D\u043E\u044E \u043F\u0440\u043E\u0446\u0435\u0434\u0443\u0440\u043E\u044E \u0443\u0441\u0443\u0432\u0430\u0454 \u0446\u0456\u043D\u043E\u0432\u0443 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u043A\u0443, \u0442\u043E\u0436 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u0439 \u0437\u0430\u0432\u043E\u043B\u043E\u0434\u0456\u043D\u043D\u044F \u043A\u043E\u0448\u0442\u0430\u043C\u0438." }
    ]
  },
  "sas24-3-11-2": {
    admin: "3",
    consequences: ["nullity", "principles"],
    criminal: [
      { code: "364", why: "\u041F\u0456\u0434\u043F\u0438\u0441\u0430\u043D\u043D\u044F \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0443 \u043F\u0456\u0434 \u0447\u0430\u0441 \u043E\u0441\u043A\u0430\u0440\u0436\u0435\u043D\u043D\u044F, \u0431\u0435\u0437 \u043E\u0447\u0456\u043A\u0443\u0432\u0430\u043D\u043D\u044F \u0440\u0456\u0448\u0435\u043D\u043D\u044F, \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u044F\u043A \u0437\u043B\u043E\u0432\u0436\u0438\u0432\u0430\u043D\u043D\u044F \u0441\u043B\u0443\u0436\u0431\u043E\u0432\u0438\u043C \u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0449\u0435\u043C." }
    ]
  },
  "sas24-3-1": {
    admin: "5",
    consequences: ["principles"],
    criminal: [
      { code: "364", why: "\u0421\u0432\u0456\u0434\u043E\u043C\u0435 \u043D\u0435\u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043D\u044F \u043E\u0431\u043E\u0432'\u044F\u0437\u043A\u043E\u0432\u043E\u0433\u043E \u0440\u0456\u0448\u0435\u043D\u043D\u044F \u043E\u0440\u0433\u0430\u043D\u0443 \u043E\u0441\u043A\u0430\u0440\u0436\u0435\u043D\u043D\u044F \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u044F\u043A \u0434\u0456\u0457 \u0432\u0441\u0443\u043F\u0435\u0440\u0435\u0447 \u0456\u043D\u0442\u0435\u0440\u0435\u0441\u0430\u043C \u0441\u043B\u0443\u0436\u0431\u0438." },
      { code: "367", why: "\u042F\u043A\u0449\u043E \u0441\u0442\u0440\u043E\u043A \u043F\u0440\u043E\u043F\u0443\u0449\u0435\u043D\u043E \u0431\u0435\u0437 \u0443\u043C\u0438\u0441\u043B\u0443, \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u043D\u0435\u043D\u0430\u043B\u0435\u0436\u043D\u0435 \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043D\u044F \u0441\u043B\u0443\u0436\u0431\u043E\u0432\u0438\u0445 \u043E\u0431\u043E\u0432'\u044F\u0437\u043A\u0456\u0432." }
    ]
  },
  "sas24-3-9": {
    admin: "5",
    consequences: ["principles"],
    norm: "\u0421\u0442\u0430\u0442\u0442\u044F 18 \u0447\u0430\u0441\u0442\u0438\u043D\u0430 22 \u0417\u0430\u043A\u043E\u043D\u0443 \u0423\u043A\u0440\u0430\u0457\u043D\u0438 \xAB\u041F\u0440\u043E \u043F\u0443\u0431\u043B\u0456\u0447\u043D\u0456 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456\xBB \u2014 \u0440\u0456\u0448\u0435\u043D\u043D\u044F \u043E\u0440\u0433\u0430\u043D\u0443 \u043E\u0441\u043A\u0430\u0440\u0436\u0435\u043D\u043D\u044F \u0454 \u043E\u0431\u043E\u0432'\u044F\u0437\u043A\u043E\u0432\u0438\u043C\u0438 \u0434\u043B\u044F \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043D\u044F \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u0430\u043C\u0438.",
    normNote: "\u0414\u0435\u0440\u0436\u0430\u0432\u0430 \u043D\u0435 \u043D\u0430\u0432\u043E\u0434\u0438\u0442\u044C \u043D\u043E\u0440\u043C\u0443 \u0434\u043B\u044F \u0446\u044C\u043E\u0433\u043E \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u0430. \u041C\u0438 \u0437\u0456\u0441\u0442\u0430\u0432\u043B\u044F\u0454\u043C\u043E \u0439\u043E\u0433\u043E \u0437\u0456 \u0441\u0442\u0430\u0442\u0442\u0435\u044E 18, \u044F\u043A\u0443 \u0441\u0430\u043C\u0430 \u0434\u0435\u0440\u0436\u0430\u0432\u0430 \u043D\u0430\u0432\u043E\u0434\u0438\u0442\u044C \u0434\u043B\u044F \u0441\u043F\u043E\u0440\u0456\u0434\u043D\u0435\u043D\u043E\u0433\u043E \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u0430 \u043F\u0440\u043E \u043D\u0435\u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043D\u044F \u0440\u0456\u0448\u0435\u043D\u043D\u044F \u043E\u0440\u0433\u0430\u043D\u0443 \u043E\u0441\u043A\u0430\u0440\u0436\u0435\u043D\u043D\u044F (sas24-3-1).",
    criminal: [
      { code: "364", why: "\u041F\u043E\u0432\u0442\u043E\u0440\u043D\u0435 \u0432\u0438\u0437\u043D\u0430\u0447\u0435\u043D\u043D\u044F \u043F\u0435\u0440\u0435\u043C\u043E\u0436\u0446\u0435\u043C \u0442\u043E\u0433\u043E \u0441\u0430\u043C\u043E\u0433\u043E \u0443\u0447\u0430\u0441\u043D\u0438\u043A\u0430 \u043F\u0456\u0441\u043B\u044F \u0440\u0456\u0448\u0435\u043D\u043D\u044F \u043E\u0440\u0433\u0430\u043D\u0443 \u043E\u0441\u043A\u0430\u0440\u0436\u0435\u043D\u043D\u044F \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u044F\u043A \u0437\u043B\u043E\u0432\u0436\u0438\u0432\u0430\u043D\u043D\u044F \u0441\u043B\u0443\u0436\u0431\u043E\u0432\u0438\u043C \u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0449\u0435\u043C." }
    ]
  },
  "sas24-3-7": {
    admin: "1",
    consequences: ["principles"],
    norm: "\u0421\u0442\u0430\u0442\u0442\u044F 41 \u0417\u0430\u043A\u043E\u043D\u0443 \u0423\u043A\u0440\u0430\u0457\u043D\u0438 \xAB\u041F\u0440\u043E \u043F\u0443\u0431\u043B\u0456\u0447\u043D\u0456 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456\xBB \u0440\u0430\u0437\u043E\u043C \u0456\u0437 \u043E\u0431\u043E\u0432'\u044F\u0437\u043A\u043E\u043C \u043E\u043F\u0440\u0438\u043B\u044E\u0434\u043D\u0438\u0442\u0438 \u0437\u0432\u0456\u0442 \u043F\u0440\u043E \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043D\u044F \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0443.",
    normNote: "\u0414\u0435\u0440\u0436\u0430\u0432\u0430 \u043D\u0435 \u043D\u0430\u0432\u043E\u0434\u0438\u0442\u044C \u043D\u043E\u0440\u043C\u0443 \u0434\u043B\u044F \u0446\u044C\u043E\u0433\u043E \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u0430. \u0422\u0443\u0442 \u043C\u0438 \u0441\u0432\u0456\u0434\u043E\u043C\u043E \u043E\u0431\u0435\u0440\u0435\u0436\u043D\u0456: \u0441\u0430\u043C \u043F\u043E \u0441\u043E\u0431\u0456 \u043A\u043E\u0440\u043E\u0442\u043A\u0438\u0439 \u0441\u0442\u0440\u043E\u043A \u043D\u043E\u0440\u043C\u0443 \u043D\u0435 \u043F\u043E\u0440\u0443\u0448\u0443\u0454. \u0417\u043D\u0430\u0447\u0435\u043D\u043D\u044F \u043C\u0430\u0454 \u0440\u043E\u0437\u0431\u0456\u0436\u043D\u0456\u0441\u0442\u044C \u043C\u0456\u0436 \u043E\u0431\u0441\u044F\u0433\u043E\u043C \u0440\u043E\u0431\u0456\u0442 \u0456 \u0447\u0430\u0441\u043E\u043C, \u0437\u0430 \u044F\u043A\u0438\u0439 \u0457\u0445 \u0437\u0430\u0434\u0435\u043A\u043B\u0430\u0440\u043E\u0432\u0430\u043D\u043E \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u0438\u043C\u0438.",
    criminal: [
      { code: "366", why: "\u0417\u0432\u0456\u0442 \u043F\u0440\u043E \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043D\u044F \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0443 \u2014 \u043E\u0444\u0456\u0446\u0456\u0439\u043D\u0438\u0439 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442. \u042F\u043A\u0449\u043E \u043E\u0431\u0441\u044F\u0433 \u0440\u043E\u0431\u0456\u0442 \u0444\u0456\u0437\u0438\u0447\u043D\u043E \u043D\u0435 \u043C\u0456\u0433 \u0431\u0443\u0442\u0438 \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u0438\u0439 \u0443 \u0437\u0430\u0434\u0435\u043A\u043B\u0430\u0440\u043E\u0432\u0430\u043D\u0438\u0439 \u0441\u0442\u0440\u043E\u043A, \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u0432\u043D\u0435\u0441\u0435\u043D\u043D\u044F \u0437\u0430\u0432\u0456\u0434\u043E\u043C\u043E \u043D\u0435\u043F\u0440\u0430\u0432\u0434\u0438\u0432\u0438\u0445 \u0432\u0456\u0434\u043E\u043C\u043E\u0441\u0442\u0435\u0439." },
      { code: "191", why: "\u041E\u043F\u043B\u0430\u0442\u0430 \u0437\u0430 \u0440\u043E\u0431\u043E\u0442\u0438, \u044F\u043A\u0456 \u043D\u0435 \u0432\u0438\u043A\u043E\u043D\u0443\u0432\u0430\u043B\u0438\u0441\u044F \u0432 \u0437\u0430\u0434\u0435\u043A\u043B\u0430\u0440\u043E\u0432\u0430\u043D\u043E\u043C\u0443 \u043E\u0431\u0441\u044F\u0437\u0456, \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u044F\u043A \u0437\u0430\u0432\u043E\u043B\u043E\u0434\u0456\u043D\u043D\u044F \u043A\u043E\u0448\u0442\u0430\u043C\u0438." }
    ]
  }
};
var ADMIN_ARTICLE = {
  code: "164-14",
  title: "\u041F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F \u0437\u0430\u043A\u043E\u043D\u043E\u0434\u0430\u0432\u0441\u0442\u0432\u0430 \u043F\u0440\u043E \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 (\u041A\u0423\u043F\u0410\u041F)",
  unitUah: 17,
  parts: {
    "1": {
      label: "\u0447\u0430\u0441\u0442\u0438\u043D\u0430 1",
      conduct: "\u043D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0435 \u0432\u0438\u0437\u043D\u0430\u0447\u0435\u043D\u043D\u044F \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u0430 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456, \u043D\u0435\u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u043D\u0456\u0441\u0442\u044C \u0442\u0435\u043D\u0434\u0435\u0440\u043D\u043E\u0457 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u0446\u0456\u0457 \u0432\u0438\u043C\u043E\u0433\u0430\u043C \u0437\u0430\u043A\u043E\u043D\u0443, \u043D\u0435\u043E\u043F\u0440\u0438\u043B\u044E\u0434\u043D\u0435\u043D\u043D\u044F \u0456\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0456\u0457 \u043F\u0440\u043E \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044E \u0430\u0431\u043E \u043F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F \u0441\u0442\u0440\u043E\u043A\u0456\u0432 \u0457\u0457 \u043E\u043F\u0440\u0438\u043B\u044E\u0434\u043D\u0435\u043D\u043D\u044F.",
      fineFrom: 100,
      fineTo: 100
    },
    "3": {
      label: "\u0447\u0430\u0441\u0442\u0438\u043D\u0430 3",
      conduct: "\u043F\u0440\u0438\u0434\u0431\u0430\u043D\u043D\u044F \u0431\u0435\u0437 \u0437\u0430\u0441\u0442\u043E\u0441\u0443\u0432\u0430\u043D\u043D\u044F \u0432\u0438\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0445 \u0437\u0430\u043A\u043E\u043D\u043E\u043C \u043F\u0440\u043E\u0446\u0435\u0434\u0443\u0440, \u0431\u0435\u0437\u043F\u0456\u0434\u0441\u0442\u0430\u0432\u043D\u0435 \u0432\u0456\u0434\u0445\u0438\u043B\u0435\u043D\u043D\u044F \u0442\u0435\u043D\u0434\u0435\u0440\u043D\u0438\u0445 \u043F\u0440\u043E\u043F\u043E\u0437\u0438\u0446\u0456\u0439, \u043D\u0435\u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u043D\u0456\u0441\u0442\u044C \u0443\u043C\u043E\u0432 \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0443 \u0437\u043C\u0456\u0441\u0442\u0443 \u043F\u0440\u043E\u043F\u043E\u0437\u0438\u0446\u0456\u0457 \u043F\u0435\u0440\u0435\u043C\u043E\u0436\u0446\u044F \u0442\u0430 \u0432\u043D\u0435\u0441\u0435\u043D\u043D\u044F \u0437\u043C\u0456\u043D \u0434\u043E \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0443 \u043F\u043E\u0437\u0430 \u043F\u0456\u0434\u0441\u0442\u0430\u0432\u0430\u043C\u0438 \u0437\u0430\u043A\u043E\u043D\u0443.",
      fineFrom: 1500,
      fineTo: 3e3
    },
    "5": {
      label: "\u0447\u0430\u0441\u0442\u0438\u043D\u0430 5",
      conduct: "\u043D\u0435\u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043D\u044F \u0440\u0456\u0448\u0435\u043D\u043D\u044F \u043E\u0440\u0433\u0430\u043D\u0443 \u043E\u0441\u043A\u0430\u0440\u0436\u0435\u043D\u043D\u044F.",
      fineFrom: 2e3,
      fineTo: 5e3
    }
  }
};
var CONSEQUENCES = {
  nullity: {
    norm: "\u0421\u0442\u0430\u0442\u0442\u044F 43 \u0417\u0430\u043A\u043E\u043D\u0443 \u0423\u043A\u0440\u0430\u0457\u043D\u0438 \xAB\u041F\u0440\u043E \u043F\u0443\u0431\u043B\u0456\u0447\u043D\u0456 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456\xBB \u2014 \u043D\u0456\u043A\u0447\u0435\u043C\u043D\u0456\u0441\u0442\u044C \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0443 \u043F\u0440\u043E \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044E.",
    effect: "\u0414\u043E\u0433\u043E\u0432\u0456\u0440 \u0454 \u043D\u0456\u043A\u0447\u0435\u043C\u043D\u0438\u043C, \u0437\u043E\u043A\u0440\u0435\u043C\u0430 \u044F\u043A\u0449\u043E \u0439\u043E\u0433\u043E \u0443\u043A\u043B\u0430\u0434\u0435\u043D\u043E \u0431\u0435\u0437 \u043F\u0435\u0440\u0435\u0434\u0431\u0430\u0447\u0435\u043D\u043E\u0457 \u0437\u0430\u043A\u043E\u043D\u043E\u043C \u043F\u0440\u043E\u0446\u0435\u0434\u0443\u0440\u0438 \u0430\u0431\u043E \u044F\u043A\u0449\u043E \u0432\u0456\u043D \u0441\u0443\u043F\u0435\u0440\u0435\u0447\u0438\u0442\u044C \u043F\u0440\u0438\u043D\u0446\u0438\u043F\u0430\u043C \u0441\u0442\u0430\u0442\u0442\u0456 5. \u041D\u0456\u043A\u0447\u0435\u043C\u043D\u0456\u0441\u0442\u044C \u043D\u0435 \u043F\u043E\u0442\u0440\u0435\u0431\u0443\u0454 \u0432\u0438\u0437\u043D\u0430\u043D\u043D\u044F \u0441\u0443\u0434\u043E\u043C: \u0434\u043E\u0433\u043E\u0432\u0456\u0440 \u043D\u0435\u0434\u0456\u0439\u0441\u043D\u0438\u0439 \u0437 \u043C\u043E\u043C\u0435\u043D\u0442\u0443 \u0443\u043A\u043B\u0430\u0434\u0435\u043D\u043D\u044F."
  },
  principles: {
    norm: "\u0421\u0442\u0430\u0442\u0442\u044F 5 \u0417\u0430\u043A\u043E\u043D\u0443 \u0423\u043A\u0440\u0430\u0457\u043D\u0438 \xAB\u041F\u0440\u043E \u043F\u0443\u0431\u043B\u0456\u0447\u043D\u0456 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456\xBB \u2014 \u043F\u0440\u0438\u043D\u0446\u0438\u043F\u0438 \u0437\u0434\u0456\u0439\u0441\u043D\u0435\u043D\u043D\u044F \u043F\u0443\u0431\u043B\u0456\u0447\u043D\u0438\u0445 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C.",
    effect: "\u0417\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F \u043C\u0430\u0454 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u0442\u0438 \u043F\u0440\u0438\u043D\u0446\u0438\u043F\u0430\u043C \u0434\u043E\u0431\u0440\u043E\u0441\u043E\u0432\u0456\u0441\u043D\u043E\u0457 \u043A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0446\u0456\u0457, \u043C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u043E\u0457 \u0435\u043A\u043E\u043D\u043E\u043C\u0456\u0457 \u0442\u0430 \u0435\u0444\u0435\u043A\u0442\u0438\u0432\u043D\u043E\u0441\u0442\u0456, \u0432\u0456\u0434\u043A\u0440\u0438\u0442\u043E\u0441\u0442\u0456 \u0439 \u043F\u0440\u043E\u0437\u043E\u0440\u043E\u0441\u0442\u0456, \u043D\u0435\u0434\u0438\u0441\u043A\u0440\u0438\u043C\u0456\u043D\u0430\u0446\u0456\u0457 \u0443\u0447\u0430\u0441\u043D\u0438\u043A\u0456\u0432, \u043E\u0431'\u0454\u043A\u0442\u0438\u0432\u043D\u043E\u0433\u043E \u0432\u0438\u0437\u043D\u0430\u0447\u0435\u043D\u043D\u044F \u043F\u0435\u0440\u0435\u043C\u043E\u0436\u0446\u044F \u0442\u0430 \u0437\u0430\u043F\u043E\u0431\u0456\u0433\u0430\u043D\u043D\u044F \u043A\u043E\u0440\u0443\u043F\u0446\u0456\u0457. \u041F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F \u0446\u0438\u0445 \u043F\u0440\u0438\u043D\u0446\u0438\u043F\u0456\u0432 \u2014 \u0441\u0430\u043C\u043E\u0441\u0442\u0456\u0439\u043D\u0430 \u043F\u0456\u0434\u0441\u0442\u0430\u0432\u0430 \u043E\u0446\u0456\u043D\u044E\u0432\u0430\u0442\u0438 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044E \u044F\u043A \u0442\u0430\u043A\u0443, \u0449\u043E \u043D\u0435 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u0454 \u0437\u0430\u043A\u043E\u043D\u0443."
  },
  changesVoid: {
    norm: "\u0421\u0442\u0430\u0442\u0442\u044F 41 \u0447\u0430\u0441\u0442\u0438\u043D\u0438 4 \u0456 5 \u0417\u0430\u043A\u043E\u043D\u0443 \u0423\u043A\u0440\u0430\u0457\u043D\u0438 \xAB\u041F\u0440\u043E \u043F\u0443\u0431\u043B\u0456\u0447\u043D\u0456 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456\xBB \u2014 \u0432\u0438\u0447\u0435\u0440\u043F\u043D\u0438\u0439 \u043F\u0435\u0440\u0435\u043B\u0456\u043A \u0434\u043E\u0437\u0432\u043E\u043B\u0435\u043D\u0438\u0445 \u0437\u043C\u0456\u043D.",
    effect: "\u0423\u043C\u043E\u0432\u0438 \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0443 \u043D\u0435 \u043C\u043E\u0436\u0443\u0442\u044C \u0432\u0456\u0434\u0440\u0456\u0437\u043D\u044F\u0442\u0438\u0441\u044F \u0432\u0456\u0434 \u0437\u043C\u0456\u0441\u0442\u0443 \u043F\u0440\u043E\u043F\u043E\u0437\u0438\u0446\u0456\u0457 \u043F\u0435\u0440\u0435\u043C\u043E\u0436\u0446\u044F, \u0430 \u0456\u0441\u0442\u043E\u0442\u043D\u0456 \u0443\u043C\u043E\u0432\u0438 \u0437\u043C\u0456\u043D\u044E\u044E\u0442\u044C\u0441\u044F \u043B\u0438\u0448\u0435 \u0437 \u0432\u043E\u0441\u044C\u043C\u0438 \u043F\u0456\u0434\u0441\u0442\u0430\u0432 \u0447\u0430\u0441\u0442\u0438\u043D\u0438 5. \u0417\u043C\u0456\u043D\u0430 \u043F\u043E\u0437\u0430 \u0446\u0438\u043C \u043F\u0435\u0440\u0435\u043B\u0456\u043A\u043E\u043C \u0432\u0438\u0445\u043E\u0434\u0438\u0442\u044C \u0437\u0430 \u043C\u0435\u0436\u0456 \u0434\u043E\u0437\u0432\u043E\u043B\u0435\u043D\u043E\u0433\u043E \u0437\u0430\u043A\u043E\u043D\u043E\u043C."
  }
};
var SHARED_CAUTION = "\u0416\u043E\u0434\u0435\u043D \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440 \u043D\u0435 \u0434\u043E\u0432\u043E\u0434\u0438\u0442\u044C \u0441\u043A\u043B\u0430\u0434\u0443 \u0437\u043B\u043E\u0447\u0438\u043D\u0443. \u0406\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u0438 \u043F\u043E\u043A\u0430\u0437\u0443\u044E\u0442\u044C \u0440\u043E\u0437\u0431\u0456\u0436\u043D\u043E\u0441\u0442\u0456 \u0432 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u2014 \u0442\u043E\u0431\u0442\u043E \u043C\u0456\u0441\u0446\u0435, \u0434\u0435 \u0432\u0430\u0440\u0442\u043E \u043F\u043E\u0434\u0438\u0432\u0438\u0442\u0438\u0441\u044F \u0441\u0430\u043C\u0456 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0438. \u0423\u043C\u0438\u0441\u0435\u043B \u0456 \u0437\u0430\u0432\u0456\u0434\u043E\u043C\u0456\u0441\u0442\u044C \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u044E\u0454 \u0432\u0438\u043A\u043B\u044E\u0447\u043D\u043E \u0441\u0443\u0434.";
var ARTICLES = {
  "366": {
    code: "366",
    title: "\u0421\u043B\u0443\u0436\u0431\u043E\u0432\u0435 \u043F\u0456\u0434\u0440\u043E\u0431\u043B\u0435\u043D\u043D\u044F",
    summary: "\u0421\u043A\u043B\u0430\u0434\u0430\u043D\u043D\u044F \u0447\u0438 \u0432\u0438\u0434\u0430\u0447\u0430 \u0441\u043B\u0443\u0436\u0431\u043E\u0432\u043E\u044E \u043E\u0441\u043E\u0431\u043E\u044E \u0437\u0430\u0432\u0456\u0434\u043E\u043C\u043E \u043D\u0435\u043F\u0440\u0430\u0432\u0434\u0438\u0432\u0438\u0445 \u043E\u0444\u0456\u0446\u0456\u0439\u043D\u0438\u0445 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0456\u0432, \u0432\u043D\u0435\u0441\u0435\u043D\u043D\u044F \u0434\u043E \u043E\u0444\u0456\u0446\u0456\u0439\u043D\u0438\u0445 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0456\u0432 \u0437\u0430\u0432\u0456\u0434\u043E\u043C\u043E \u043D\u0435\u043F\u0440\u0430\u0432\u0434\u0438\u0432\u0438\u0445 \u0432\u0456\u0434\u043E\u043C\u043E\u0441\u0442\u0435\u0439 \u0430\u0431\u043E \u0456\u043D\u0448\u0435 \u043F\u0456\u0434\u0440\u043E\u0431\u043B\u0435\u043D\u043D\u044F \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0456\u0432.",
    elements: [
      "\u041E\u0441\u043E\u0431\u0430 \u0454 \u0441\u043B\u0443\u0436\u0431\u043E\u0432\u043E\u044E \u2014 \u043C\u0430\u0454 \u043E\u0440\u0433\u0430\u043D\u0456\u0437\u0430\u0446\u0456\u0439\u043D\u043E-\u0440\u043E\u0437\u043F\u043E\u0440\u044F\u0434\u0447\u0456 \u0430\u0431\u043E \u0430\u0434\u043C\u0456\u043D\u0456\u0441\u0442\u0440\u0430\u0442\u0438\u0432\u043D\u043E-\u0433\u043E\u0441\u043F\u043E\u0434\u0430\u0440\u0441\u044C\u043A\u0456 \u043F\u043E\u0432\u043D\u043E\u0432\u0430\u0436\u0435\u043D\u043D\u044F.",
      "\u0414\u043E\u043A\u0443\u043C\u0435\u043D\u0442 \u0454 \u043E\u0444\u0456\u0446\u0456\u0439\u043D\u0438\u043C \u2014 \u0434\u043E\u0433\u043E\u0432\u0456\u0440 \u043F\u0440\u043E \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044E, \u0434\u043E\u0434\u0430\u0442\u043A\u043E\u0432\u0430 \u0443\u0433\u043E\u0434\u0430, \u0437\u0432\u0456\u0442 \u043F\u0440\u043E \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043D\u044F, \u043F\u0440\u043E\u0442\u043E\u043A\u043E\u043B \u0443\u043F\u043E\u0432\u043D\u043E\u0432\u0430\u0436\u0435\u043D\u043E\u0457 \u043E\u0441\u043E\u0431\u0438.",
      "\u0412\u0456\u0434\u043E\u043C\u043E\u0441\u0442\u0456 \u0437\u0430\u0432\u0456\u0434\u043E\u043C\u043E \u043D\u0435\u043F\u0440\u0430\u0432\u0434\u0438\u0432\u0456 \u2014 \u043E\u0441\u043E\u0431\u0430 \u0437\u043D\u0430\u043B\u0430 \u043F\u0440\u043E \u0457\u0445 \u043D\u0435\u043F\u0440\u0430\u0432\u0434\u0438\u0432\u0456\u0441\u0442\u044C \u0443 \u043C\u043E\u043C\u0435\u043D\u0442 \u0432\u043D\u0435\u0441\u0435\u043D\u043D\u044F.",
      "\u041D\u0430\u044F\u0432\u043D\u0438\u0439 \u0443\u043C\u0438\u0441\u0435\u043B. \u041F\u043E\u043C\u0438\u043B\u043A\u0430, \u043D\u0435\u0434\u0431\u0430\u043B\u0456\u0441\u0442\u044C \u0447\u0438 \u0445\u0438\u0431\u043D\u0435 \u0442\u043B\u0443\u043C\u0430\u0447\u0435\u043D\u043D\u044F \u0437\u0430\u043A\u043E\u043D\u0443 \u0441\u043A\u043B\u0430\u0434\u0443 \u0446\u0456\u0454\u0457 \u0441\u0442\u0430\u0442\u0442\u0456 \u043D\u0435 \u0443\u0442\u0432\u043E\u0440\u044E\u044E\u0442\u044C."
    ],
    caution: SHARED_CAUTION,
    links: [
      {
        risk_id: "ari-1-1",
        why: "\u041A\u043E\u0436\u043D\u0430 \u0434\u043E\u0434\u0430\u0442\u043A\u043E\u0432\u0430 \u0443\u0433\u043E\u0434\u0430 \u2014 \u043E\u0444\u0456\u0446\u0456\u0439\u043D\u0438\u0439 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442 \u0456\u0437 \u0437\u0430\u0437\u043D\u0430\u0447\u0435\u043D\u043E\u044E \u043F\u0456\u0434\u0441\u0442\u0430\u0432\u043E\u044E. \u0422\u0440\u0438 \u0456 \u0431\u0456\u043B\u044C\u0448\u0435 \u0443\u0433\u043E\u0434 \u0434\u043E \u043E\u0434\u043D\u043E\u0433\u043E \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0443 \u043E\u0437\u043D\u0430\u0447\u0430\u0454 \u0442\u0440\u0438 \u0456 \u0431\u0456\u043B\u044C\u0448\u0435 \u043F\u0456\u0434\u0441\u0442\u0430\u0432, \u044F\u043A\u0456 \u043C\u043E\u0436\u043D\u0430 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u0438\u0442\u0438 \u043D\u0430 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u043D\u0456\u0441\u0442\u044C \u0434\u0456\u0439\u0441\u043D\u043E\u0441\u0442\u0456."
      },
      {
        risk_id: "ari-1-2",
        why: "\u041F\u0443\u043D\u043A\u0442 3 \u0447\u0430\u0441\u0442\u0438\u043D\u0438 5 \u0441\u0442\u0430\u0442\u0442\u0456 41 \u0434\u043E\u0437\u0432\u043E\u043B\u044F\u0454 \u043F\u043E\u043A\u0440\u0430\u0449\u0435\u043D\u043D\u044F \u044F\u043A\u043E\u0441\u0442\u0456 \u043B\u0438\u0448\u0435 \u0437\u0430 \u0443\u043C\u043E\u0432\u0438, \u0449\u043E \u0441\u0443\u043C\u0430 \u043D\u0435 \u0437\u0440\u043E\u0441\u0442\u0430\u0454. \u042F\u043A\u0449\u043E \u0437\u0430 \u0446\u0456\u0454\u044E \u043F\u0456\u0434\u0441\u0442\u0430\u0432\u043E\u044E \u0446\u0456\u043D\u0443 \u043F\u0456\u0434\u043D\u044F\u043B\u0438, \u0440\u043E\u0437\u0431\u0456\u0436\u043D\u0456\u0441\u0442\u044C \u043C\u0456\u0436 \u043D\u0430\u043F\u0438\u0441\u0430\u043D\u0438\u043C \u0456 \u0434\u043E\u0437\u0432\u043E\u043B\u0435\u043D\u0438\u043C \u0441\u0442\u0430\u0454 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u043E\u043C \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u043A\u0438."
      },
      {
        risk_id: "sas24-3-4",
        why: "\u0417\u043C\u0456\u043D\u0430 \u0456\u0441\u0442\u043E\u0442\u043D\u0438\u0445 \u0443\u043C\u043E\u0432 \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0443 \u043E\u0444\u043E\u0440\u043C\u043B\u044E\u0454\u0442\u044C\u0441\u044F \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u043B\u044C\u043D\u043E \u0439 \u043F\u043E\u0442\u0440\u0435\u0431\u0443\u0454 \u043E\u0431\u0491\u0440\u0443\u043D\u0442\u0443\u0432\u0430\u043D\u043D\u044F. \u041E\u0434\u043D\u043E\u0447\u0430\u0441\u043D\u0435 \u043F\u0456\u0434\u0432\u0438\u0449\u0435\u043D\u043D\u044F \u0446\u0456\u043D\u0438 \u0442\u0430 \u043F\u0440\u043E\u0434\u043E\u0432\u0436\u0435\u043D\u043D\u044F \u0441\u0442\u0440\u043E\u043A\u0443 \u2014 \u0442\u0438\u043F\u043E\u0432\u0435 \u043C\u0456\u0441\u0446\u0435 \u0434\u043B\u044F \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u043A\u0438 \u043E\u0431\u0491\u0440\u0443\u043D\u0442\u0443\u0432\u0430\u043D\u044C."
      },
      {
        risk_id: "sas24-3-7",
        why: "\u0417\u0432\u0456\u0442 \u043F\u0440\u043E \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043D\u044F \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0443 \u2014 \u043E\u0444\u0456\u0446\u0456\u0439\u043D\u0438\u0439 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442. \u042F\u043A\u0449\u043E \u043C\u0456\u0436 \u043E\u043F\u0440\u0438\u043B\u044E\u0434\u043D\u0435\u043D\u043D\u044F\u043C \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0443 \u043D\u0430 \u0440\u043E\u0431\u043E\u0442\u0438 \u0456 \u0437\u0432\u0456\u0442\u043E\u043C \u043F\u0440\u043E \u0457\u0445 \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043D\u044F \u043C\u0438\u043D\u0443\u043B\u043E \u043C\u0435\u043D\u0448\u0435 60 \u0434\u043D\u0456\u0432, \u0432\u0430\u0440\u0442\u043E \u0437\u0432\u0456\u0440\u0438\u0442\u0438 \u043E\u0431\u0441\u044F\u0433 \u0440\u043E\u0431\u0456\u0442 \u0456\u0437 \u0437\u0430\u044F\u0432\u043B\u0435\u043D\u0438\u043C \u0441\u0442\u0440\u043E\u043A\u043E\u043C."
      },
      {
        risk_id: "sas24-3-10",
        why: "\u041D\u0435\u0432\u0456\u0434\u0445\u0438\u043B\u0435\u043D\u043D\u044F \u043F\u0435\u0440\u0435\u043C\u043E\u0436\u0446\u044F, \u044F\u043A\u0438\u0439 \u043D\u0435 \u0432\u0438\u043A\u043E\u043D\u0430\u0432 \u0432\u0438\u043C\u043E\u0433\u0438 \u0449\u043E\u0434\u043E \u043E\u043F\u0440\u0438\u043B\u044E\u0434\u043D\u0435\u043D\u043D\u044F \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0456\u0432, \u043E\u0437\u043D\u0430\u0447\u0430\u0454, \u0449\u043E \u0440\u0456\u0448\u0435\u043D\u043D\u044F \u0443\u043F\u043E\u0432\u043D\u043E\u0432\u0430\u0436\u0435\u043D\u043E\u0457 \u043E\u0441\u043E\u0431\u0438 \u0440\u043E\u0437\u0445\u043E\u0434\u0438\u0442\u044C\u0441\u044F \u0437 \u043D\u0430\u044F\u0432\u043D\u0438\u043C\u0438 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u043C\u0438."
      }
    ]
  },
  "191": {
    code: "191",
    title: "\u041F\u0440\u0438\u0432\u043B\u0430\u0441\u043D\u0435\u043D\u043D\u044F, \u0440\u043E\u0437\u0442\u0440\u0430\u0442\u0430 \u043C\u0430\u0439\u043D\u0430 \u0430\u0431\u043E \u0437\u0430\u0432\u043E\u043B\u043E\u0434\u0456\u043D\u043D\u044F \u043D\u0438\u043C \u0448\u043B\u044F\u0445\u043E\u043C \u0437\u043B\u043E\u0432\u0436\u0438\u0432\u0430\u043D\u043D\u044F \u0441\u043B\u0443\u0436\u0431\u043E\u0432\u0438\u043C \u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0449\u0435\u043C",
    summary: "\u0417\u0430\u0432\u043E\u043B\u043E\u0434\u0456\u043D\u043D\u044F \u0447\u0443\u0436\u0438\u043C \u043C\u0430\u0439\u043D\u043E\u043C \u0447\u0438 \u0439\u043E\u0433\u043E \u0440\u043E\u0437\u0442\u0440\u0430\u0442\u0430 \u043E\u0441\u043E\u0431\u043E\u044E, \u044F\u043A\u0456\u0439 \u0432\u043E\u043D\u043E \u0432\u0432\u0456\u0440\u0435\u043D\u0435, \u0430 \u0442\u0430\u043A\u043E\u0436 \u0437\u0430\u0432\u043E\u043B\u043E\u0434\u0456\u043D\u043D\u044F \u043C\u0430\u0439\u043D\u043E\u043C \u0448\u043B\u044F\u0445\u043E\u043C \u0437\u043B\u043E\u0432\u0436\u0438\u0432\u0430\u043D\u043D\u044F \u0441\u043B\u0443\u0436\u0431\u043E\u0432\u043E\u044E \u043E\u0441\u043E\u0431\u043E\u044E \u0441\u0432\u043E\u0457\u043C \u0441\u043B\u0443\u0436\u0431\u043E\u0432\u0438\u043C \u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0449\u0435\u043C.",
    elements: [
      "\u041C\u0430\u0439\u043D\u043E \u0432\u0432\u0456\u0440\u0435\u043D\u0435 \u043E\u0441\u043E\u0431\u0456 \u0430\u0431\u043E \u043F\u0435\u0440\u0435\u0431\u0443\u0432\u0430\u0454 \u0432 \u0457\u0457 \u0432\u0456\u0434\u0430\u043D\u043D\u0456 \u2014 \u0431\u044E\u0434\u0436\u0435\u0442\u043D\u0456 \u043A\u043E\u0448\u0442\u0438 \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u0430.",
      "\u0412\u0456\u0434\u0431\u0443\u043B\u043E\u0441\u044F \u0437\u0430\u0432\u043E\u043B\u043E\u0434\u0456\u043D\u043D\u044F \u0447\u0438 \u0440\u043E\u0437\u0442\u0440\u0430\u0442\u0430 \u2014 \u043A\u043E\u0448\u0442\u0438 \u0432\u0438\u0431\u0443\u043B\u0438 \u0431\u0435\u0437 \u043D\u0430\u043B\u0435\u0436\u043D\u043E\u0433\u043E \u0437\u0443\u0441\u0442\u0440\u0456\u0447\u043D\u043E\u0433\u043E \u043D\u0430\u0434\u0430\u043D\u043D\u044F.",
      "\u0412\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u0430\u043D\u043E \u0441\u043B\u0443\u0436\u0431\u043E\u0432\u0435 \u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0449\u0435, \u044F\u043A\u0449\u043E \u0439\u0434\u0435\u0442\u044C\u0441\u044F \u043F\u0440\u043E \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u043D\u0443 \u0444\u043E\u0440\u043C\u0443.",
      "\u041D\u0430\u044F\u0432\u043D\u0438\u0439 \u043A\u043E\u0440\u0438\u0441\u043B\u0438\u0432\u0438\u0439 \u0443\u043C\u0438\u0441\u0435\u043B \u0456 \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0439 \u0440\u043E\u0437\u043C\u0456\u0440 \u0448\u043A\u043E\u0434\u0438."
    ],
    caution: SHARED_CAUTION,
    links: [
      { risk_id: "ari-1-1", why: "\u041F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F, \u0447\u0438 \u043F\u0440\u0438\u0437\u0432\u0435\u043B\u0438 \u0431\u0430\u0433\u0430\u0442\u043E\u0440\u0430\u0437\u043E\u0432\u0456 \u0437\u043C\u0456\u043D\u0438 \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0443 \u0434\u043E \u0441\u043F\u043B\u0430\u0442\u0438 \u043F\u043E\u043D\u0430\u0434 \u043E\u0442\u0440\u0438\u043C\u0430\u043D\u0435." },
      { risk_id: "ari-1-2", why: "\u041F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u0440\u0456\u0437\u043D\u0438\u0446\u044F, \u0441\u043F\u043B\u0430\u0447\u0435\u043D\u0430 \u0437\u0430 \u043F\u0456\u0434\u0441\u0442\u0430\u0432\u043E\u044E, \u044F\u043A\u0430 \u0437\u0430 \u0437\u0430\u043A\u043E\u043D\u043E\u043C \u043D\u0435 \u0434\u043E\u0437\u0432\u043E\u043B\u044F\u0454 \u0437\u0431\u0456\u043B\u044C\u0448\u0435\u043D\u043D\u044F \u0441\u0443\u043C\u0438." },
      { risk_id: "sas24-3-7", why: "\u041F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u043E\u043F\u043B\u0430\u0442\u0430 \u0437\u0430 \u043E\u0431\u0441\u044F\u0433 \u0440\u043E\u0431\u0456\u0442, \u044F\u043A\u0438\u0439 \u043D\u0435 \u043C\u0456\u0433 \u0431\u0443\u0442\u0438 \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u0438\u0439 \u0443 \u0437\u0430\u0434\u0435\u043A\u043B\u0430\u0440\u043E\u0432\u0430\u043D\u0438\u0439 \u0441\u0442\u0440\u043E\u043A." },
      { risk_id: "sas24-3-11-1", why: "\u0417\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F \u043F\u043E\u0437\u0430 \u0435\u043B\u0435\u043A\u0442\u0440\u043E\u043D\u043D\u043E\u044E \u0441\u0438\u0441\u0442\u0435\u043C\u043E\u044E \u0443\u0441\u0443\u0432\u0430\u0454 \u0446\u0456\u043D\u043E\u0432\u0443 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u043A\u0443 \u2014 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u043F\u0435\u0440\u0435\u043F\u043B\u0430\u0442\u0430." }
    ]
  },
  "364": {
    code: "364",
    title: "\u0417\u043B\u043E\u0432\u0436\u0438\u0432\u0430\u043D\u043D\u044F \u0432\u043B\u0430\u0434\u043E\u044E \u0430\u0431\u043E \u0441\u043B\u0443\u0436\u0431\u043E\u0432\u0438\u043C \u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0449\u0435\u043C",
    summary: "\u0423\u043C\u0438\u0441\u043D\u0435, \u0437 \u043A\u043E\u0440\u0438\u0441\u043B\u0438\u0432\u0438\u0445 \u043C\u043E\u0442\u0438\u0432\u0456\u0432 \u0447\u0438 \u0432 \u0456\u043D\u0448\u0438\u0445 \u043E\u0441\u043E\u0431\u0438\u0441\u0442\u0438\u0445 \u0456\u043D\u0442\u0435\u0440\u0435\u0441\u0430\u0445 \u0430\u0431\u043E \u0432 \u0456\u043D\u0442\u0435\u0440\u0435\u0441\u0430\u0445 \u0442\u0440\u0435\u0442\u0456\u0445 \u043E\u0441\u0456\u0431, \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u0430\u043D\u043D\u044F \u0441\u043B\u0443\u0436\u0431\u043E\u0432\u043E\u044E \u043E\u0441\u043E\u0431\u043E\u044E \u0432\u043B\u0430\u0434\u0438 \u0447\u0438 \u0441\u043B\u0443\u0436\u0431\u043E\u0432\u043E\u0433\u043E \u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0449\u0430 \u0432\u0441\u0443\u043F\u0435\u0440\u0435\u0447 \u0456\u043D\u0442\u0435\u0440\u0435\u0441\u0430\u043C \u0441\u043B\u0443\u0436\u0431\u0438.",
    elements: [
      "\u041E\u0441\u043E\u0431\u0430 \u0454 \u0441\u043B\u0443\u0436\u0431\u043E\u0432\u043E\u044E.",
      "\u0412\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u0430\u043D\u043E \u0432\u043B\u0430\u0434\u0443 \u0430\u0431\u043E \u0441\u043B\u0443\u0436\u0431\u043E\u0432\u0435 \u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0449\u0435 \u0432\u0441\u0443\u043F\u0435\u0440\u0435\u0447 \u0456\u043D\u0442\u0435\u0440\u0435\u0441\u0430\u043C \u0441\u043B\u0443\u0436\u0431\u0438.",
      "\u041D\u0430\u044F\u0432\u043D\u0438\u0439 \u043C\u043E\u0442\u0438\u0432 \u2014 \u043A\u043E\u0440\u0438\u0441\u043B\u0438\u0432\u0438\u0439, \u0456\u043D\u0448\u0438\u0439 \u043E\u0441\u043E\u0431\u0438\u0441\u0442\u0438\u0439, \u0430\u0431\u043E \u0432 \u0456\u043D\u0442\u0435\u0440\u0435\u0441\u0430\u0445 \u0442\u0440\u0435\u0442\u0456\u0445 \u043E\u0441\u0456\u0431.",
      "\u0417\u0430\u0432\u0434\u0430\u043D\u043E \u0456\u0441\u0442\u043E\u0442\u043D\u043E\u0457 \u0448\u043A\u043E\u0434\u0438 \u043E\u0445\u043E\u0440\u043E\u043D\u044E\u0432\u0430\u043D\u0438\u043C \u0437\u0430\u043A\u043E\u043D\u043E\u043C \u043F\u0440\u0430\u0432\u0430\u043C \u0442\u0430 \u0456\u043D\u0442\u0435\u0440\u0435\u0441\u0430\u043C."
    ],
    caution: SHARED_CAUTION,
    links: [
      { risk_id: "sas24-3-2", why: "\u0412\u0456\u0434\u0445\u0438\u043B\u0435\u043D\u043D\u044F \u043A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0442\u0456\u0432 \u043F\u043E\u0437\u0430 \u043F\u0456\u0434\u0441\u0442\u0430\u0432\u0430\u043C\u0438 \u0441\u0442\u0430\u0442\u0442\u0456 31 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u044F\u043A \u0434\u0456\u0457 \u043D\u0430 \u043A\u043E\u0440\u0438\u0441\u0442\u044C \u0442\u0440\u0435\u0442\u044C\u043E\u0457 \u043E\u0441\u043E\u0431\u0438." },
      { risk_id: "sas24-3-5", why: "\u041D\u0435\u043D\u0430\u0434\u0430\u043D\u043D\u044F \u043C\u043E\u0436\u043B\u0438\u0432\u043E\u0441\u0442\u0456 \u0443\u0441\u0443\u043D\u0443\u0442\u0438 \u043D\u0435\u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u043D\u043E\u0441\u0442\u0456 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454\u0442\u044C\u0441\u044F \u044F\u043A \u0434\u0456\u0457 \u0432\u0441\u0443\u043F\u0435\u0440\u0435\u0447 \u0456\u043D\u0442\u0435\u0440\u0435\u0441\u0430\u043C \u0441\u043B\u0443\u0436\u0431\u0438." },
      { risk_id: "sas24-3-9", why: "\u041F\u043E\u0432\u0442\u043E\u0440\u043D\u0435 \u0432\u0438\u0437\u043D\u0430\u0447\u0435\u043D\u043D\u044F \u0442\u043E\u0433\u043E \u0441\u0430\u043C\u043E\u0433\u043E \u043F\u0435\u0440\u0435\u043C\u043E\u0436\u0446\u044F \u043F\u0456\u0441\u043B\u044F \u0440\u0456\u0448\u0435\u043D\u043D\u044F \u043E\u0440\u0433\u0430\u043D\u0443 \u043E\u0441\u043A\u0430\u0440\u0436\u0435\u043D\u043D\u044F." },
      { risk_id: "sas24-3-11-1", why: "\u041F\u0440\u043E\u0432\u0435\u0434\u0435\u043D\u043D\u044F \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u043F\u043E\u0432\u0437 \u043E\u0431\u043E\u0432'\u044F\u0437\u043A\u043E\u0432\u0443 \u0435\u043B\u0435\u043A\u0442\u0440\u043E\u043D\u043D\u0443 \u0441\u0438\u0441\u0442\u0435\u043C\u0443." }
    ]
  },
  "367": {
    code: "367",
    title: "\u0421\u043B\u0443\u0436\u0431\u043E\u0432\u0430 \u043D\u0435\u0434\u0431\u0430\u043B\u0456\u0441\u0442\u044C",
    summary: "\u041D\u0435\u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043D\u044F \u0430\u0431\u043E \u043D\u0435\u043D\u0430\u043B\u0435\u0436\u043D\u0435 \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043D\u044F \u0441\u043B\u0443\u0436\u0431\u043E\u0432\u043E\u044E \u043E\u0441\u043E\u0431\u043E\u044E \u0441\u0432\u043E\u0457\u0445 \u0441\u043B\u0443\u0436\u0431\u043E\u0432\u0438\u0445 \u043E\u0431\u043E\u0432'\u044F\u0437\u043A\u0456\u0432 \u0447\u0435\u0440\u0435\u0437 \u043D\u0435\u0441\u0443\u043C\u043B\u0456\u043D\u043D\u0435 \u0441\u0442\u0430\u0432\u043B\u0435\u043D\u043D\u044F \u0434\u043E \u043D\u0438\u0445, \u0449\u043E \u0437\u0430\u0432\u0434\u0430\u043B\u043E \u0456\u0441\u0442\u043E\u0442\u043D\u043E\u0457 \u0448\u043A\u043E\u0434\u0438.",
    elements: [
      "\u041E\u0441\u043E\u0431\u0430 \u0454 \u0441\u043B\u0443\u0436\u0431\u043E\u0432\u043E\u044E \u0456 \u043C\u0430\u043B\u0430 \u0432\u0438\u0437\u043D\u0430\u0447\u0435\u043D\u0456 \u043E\u0431\u043E\u0432'\u044F\u0437\u043A\u0438.",
      "\u041E\u0431\u043E\u0432'\u044F\u0437\u043A\u0438 \u043D\u0435 \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043E \u0430\u0431\u043E \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043E \u043D\u0435\u043D\u0430\u043B\u0435\u0436\u043D\u043E.",
      "\u041F\u0440\u0438\u0447\u0438\u043D\u0430 \u2014 \u043D\u0435\u0441\u0443\u043C\u043B\u0456\u043D\u043D\u0435 \u0441\u0442\u0430\u0432\u043B\u0435\u043D\u043D\u044F, \u0430 \u043D\u0435 \u0443\u043C\u0438\u0441\u0435\u043B; \u0446\u0438\u043C \u0441\u0442\u0430\u0442\u0442\u044F \u0432\u0456\u0434\u0440\u0456\u0437\u043D\u044F\u0454\u0442\u044C\u0441\u044F \u0432\u0456\u0434 364.",
      "\u0417\u0430\u0432\u0434\u0430\u043D\u043E \u0456\u0441\u0442\u043E\u0442\u043D\u043E\u0457 \u0448\u043A\u043E\u0434\u0438, \u0456 \u043C\u0456\u0436 \u0431\u0435\u0437\u0434\u0456\u044F\u043B\u044C\u043D\u0456\u0441\u0442\u044E \u0442\u0430 \u0448\u043A\u043E\u0434\u043E\u044E \u0454 \u043F\u0440\u0438\u0447\u0438\u043D\u043D\u0438\u0439 \u0437\u0432'\u044F\u0437\u043E\u043A."
    ],
    caution: SHARED_CAUTION,
    links: [
      { risk_id: "sas24-3-1", why: "\u041F\u0440\u043E\u043F\u0443\u0449\u0435\u043D\u0438\u0439 \u0441\u0442\u0440\u043E\u043A \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043D\u044F \u0440\u0456\u0448\u0435\u043D\u043D\u044F \u043E\u0440\u0433\u0430\u043D\u0443 \u043E\u0441\u043A\u0430\u0440\u0436\u0435\u043D\u043D\u044F, \u044F\u043A\u0449\u043E \u0443\u043C\u0438\u0441\u043B\u0443 \u043D\u0435 \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043E." },
      { risk_id: "sas24-3-10", why: "\u041D\u0435\u0432\u0456\u0434\u0445\u0438\u043B\u0435\u043D\u043D\u044F \u043F\u0435\u0440\u0435\u043C\u043E\u0436\u0446\u044F, \u044F\u043A\u0438\u0439 \u043D\u0435 \u0432\u0438\u043A\u043E\u043D\u0430\u0432 \u0432\u0438\u043C\u043E\u0433\u0438, \u044F\u043A\u0449\u043E \u0443\u043C\u0438\u0441\u043B\u0443 \u043D\u0435 \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043E." }
    ]
  }
};
var JOINT_STOCK = /(^|[\s"«(“'])(АТ|ПАТ|ПрАТ|ВАТ|ЗАТ)([\s"«.,“']|$)|акціонерн/i;
function isJointStock(name) {
  return name !== null && JOINT_STOCK.test(name);
}

// src/normalize/tender.ts
function officerKey(row) {
  if (row.officer_email) return row.officer_email.trim().toLowerCase();
  if (row.officer_name && row.entity_edrpou) return `${row.officer_name.trim().toLowerCase()}@@${row.entity_edrpou}`;
  return null;
}

// server/data.ts
function tenderDateOf(tenderRef) {
  const m = /^UA-(\d{4}-\d{2}-\d{2})-/.exec(tenderRef);
  return m ? m[1] : null;
}
function activeAward(awards) {
  return awards.find((a) => a.status === "active") ?? awards[0];
}
async function loadDataset() {
  const store = openStore();
  const flags = await store.allRiskFlags();
  const rules = await store.allRiskRules();
  const tenders = await store.allTenders();
  const awards = await store.allAwards();
  const bids = await store.allBids();
  const runs = await store.allRuns();
  const findings = await store.allFindings();
  const findingsByTender = /* @__PURE__ */ new Map();
  for (const finding of findings) {
    const list = findingsByTender.get(finding.tender_id) ?? [];
    list.push(finding);
    findingsByTender.set(finding.tender_id, list);
  }
  const tenderById = new Map(tenders.map((t) => [t.id, t]));
  const awardsByTender = /* @__PURE__ */ new Map();
  for (const award of awards) {
    const list = awardsByTender.get(award.tender_id) ?? [];
    list.push(award);
    awardsByTender.set(award.tender_id, list);
  }
  const bidCount = /* @__PURE__ */ new Map();
  for (const bid of bids) bidCount.set(bid.tender_id, (bidCount.get(bid.tender_id) ?? 0) + 1);
  const byTender = /* @__PURE__ */ new Map();
  for (const flag of flags) {
    let entry = byTender.get(flag.tender_id);
    if (!entry) {
      const detail = tenderById.get(flag.tender_id);
      const won = activeAward(awardsByTender.get(flag.tender_id) ?? []);
      entry = {
        tender_id: flag.tender_id,
        tender_ref: flag.tender_ref || detail?.tender_id || "",
        tender_date: tenderDateOf(flag.tender_ref || detail?.tender_id || ""),
        title: detail?.title ?? null,
        status: detail?.status ?? null,
        method: detail?.method ?? null,
        entity_edrpou: flag.entity_edrpou ?? detail?.entity_edrpou ?? null,
        entity_name: flag.entity_name ?? detail?.entity_name ?? null,
        region: flag.region ?? detail?.region ?? null,
        value_amount: flag.value_amount ?? detail?.value_amount ?? null,
        date_assessed: flag.date_assessed,
        risks: [],
        officer_name: detail?.officer_name ?? null,
        officer_email: detail?.officer_email ?? null,
        officer_phone: detail?.officer_phone ?? null,
        officer_key: detail ? officerKey(detail) : null,
        winner_name: won?.supplier_name ?? null,
        winner_edrpou: won?.supplier_edrpou ?? null,
        winner_amount: won?.amount ?? null,
        bidders: bidCount.get(flag.tender_id) ?? 0,
        detailed: Boolean(detail),
        findings: findingsByTender.get(flag.tender_id) ?? []
      };
      byTender.set(flag.tender_id, entry);
    }
    if (!entry.tender_ref && flag.tender_ref) {
      entry.tender_ref = flag.tender_ref;
      entry.tender_date = tenderDateOf(flag.tender_ref);
    }
    if (entry.value_amount === null) entry.value_amount = flag.value_amount;
    if (!entry.risks.includes(flag.risk_id)) entry.risks.push(flag.risk_id);
  }
  const cases = [...byTender.values()];
  return {
    cases,
    byTender,
    rules,
    ruleById: new Map(rules.map((r) => [r.risk_id, r])),
    runs,
    findingCount: findings.length,
    flagCount: flags.length,
    totalValue: cases.reduce((sum2, c) => sum2 + (c.value_amount ?? 0), 0)
  };
}

// server/grouping.ts
var DIMENSIONS = [
  { value: "", label: "\u0411\u0435\u0437 \u0433\u0440\u0443\u043F\u0443\u0432\u0430\u043D\u043D\u044F" },
  { value: "entity", label: "\u0417\u0430 \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u043E\u043C" },
  { value: "officer", label: "\u0417\u0430 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u043B\u044C\u043D\u0438\u043C" },
  { value: "supplier", label: "\u0417\u0430 \u043F\u0435\u0440\u0435\u043C\u043E\u0436\u0446\u0435\u043C" },
  { value: "risk", label: "\u0417\u0430 \u043E\u0437\u043D\u0430\u043A\u043E\u044E" },
  { value: "year", label: "\u0417\u0430 \u0440\u043E\u043A\u043E\u043C" },
  { value: "method", label: "\u0417\u0430 \u043F\u0440\u043E\u0446\u0435\u0434\u0443\u0440\u043E\u044E" },
  { value: "severity", label: "\u0417\u0430 \u0433\u043E\u0441\u0442\u0440\u043E\u0442\u043E\u044E" }
];
function isDimension(value) {
  return DIMENSIONS.some((d) => d.value === value);
}
var SEVERITY_ORDER = { \u0413\u043E\u0441\u0442\u0440\u0456: 0, \u041F\u043E\u043C\u0456\u0442\u043D\u0456: 1, \u0417\u0432\u0438\u0447\u0430\u0439\u043D\u0456: 2 };
function bucketsOf(entry, dimension, riskLabel) {
  switch (dimension) {
    case "entity":
      return [
        {
          key: entry.entity_edrpou ?? "\u2014",
          label: entry.entity_name ?? "\u0417\u0430\u043C\u043E\u0432\u043D\u0438\u043A \u043D\u0435 \u0432\u043A\u0430\u0437\u0430\u043D\u0438\u0439",
          href: entry.entity_edrpou ? `/entity/${encodeURIComponent(entry.entity_edrpou)}` : null
        }
      ];
    case "officer":
      return entry.officer_key ? [{ key: entry.officer_key, label: entry.officer_name ?? entry.officer_key, href: `/officer/${encodeURIComponent(entry.officer_key)}` }] : [{ key: "\u2014", label: "\u0412\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u043B\u044C\u043D\u043E\u0433\u043E \u043D\u0435 \u0432\u043A\u0430\u0437\u0430\u043D\u043E", href: null }];
    case "supplier":
      return entry.winner_edrpou ? [{ key: entry.winner_edrpou, label: entry.winner_name ?? entry.winner_edrpou, href: `/supplier/${encodeURIComponent(entry.winner_edrpou)}` }] : [{ key: "\u2014", label: "\u041F\u0435\u0440\u0435\u043C\u043E\u0436\u0446\u044F \u043D\u0435 \u0432\u0438\u0437\u043D\u0430\u0447\u0435\u043D\u043E", href: null }];
    case "risk":
      return entry.risks.map((id) => ({ key: id, label: riskLabel(id), href: `/?risk=${encodeURIComponent(id)}` }));
    case "year": {
      const year = (entry.date_assessed ?? entry.tender_ref.slice(3, 7) ?? "").slice(0, 4);
      return [{ key: year || "\u2014", label: year ? `${year} \u0440\u0456\u043A` : "\u0420\u0456\u043A \u043D\u0435\u0432\u0456\u0434\u043E\u043C\u0438\u0439", href: null }];
    }
    case "method":
      return [{ key: entry.method ?? "\u2014", label: entry.method ?? "\u041F\u0440\u043E\u0446\u0435\u0434\u0443\u0440\u0443 \u043D\u0435 \u0432\u043A\u0430\u0437\u0430\u043D\u043E", href: null }];
    case "severity": {
      const label = entry.findings.some((f) => f.severity === "high") || entry.risks.length >= 3 ? "\u0413\u043E\u0441\u0442\u0440\u0456" : entry.findings.length > 0 || entry.bidders === 1 ? "\u041F\u043E\u043C\u0456\u0442\u043D\u0456" : "\u0417\u0432\u0438\u0447\u0430\u0439\u043D\u0456";
      return [{ key: label, label, href: null }];
    }
    default:
      return [];
  }
}
function sum(cases) {
  return cases.reduce((total, c) => total + (c.value_amount ?? 0), 0);
}
function sortGroups(groups, dimension) {
  if (dimension === "year") return groups.sort((a, b) => b.bucket.key.localeCompare(a.bucket.key));
  if (dimension === "severity") {
    return groups.sort((a, b) => (SEVERITY_ORDER[a.bucket.key] ?? 9) - (SEVERITY_ORDER[b.bucket.key] ?? 9));
  }
  return groups.sort((a, b) => b.value - a.value || b.cases.length - a.cases.length);
}
function buildGroups(cases, first, second, riskLabel) {
  if (!first) return [];
  const byKey = /* @__PURE__ */ new Map();
  for (const entry of cases) {
    for (const bucket of bucketsOf(entry, first, riskLabel)) {
      const group = byKey.get(bucket.key) ?? { bucket, cases: [] };
      group.cases.push(entry);
      byKey.set(bucket.key, group);
    }
  }
  const groups = [...byKey.values()].map(({ bucket, cases: inner }) => ({
    bucket,
    cases: inner,
    value: sum(inner),
    children: second && second !== first ? buildGroups(inner, second, "", riskLabel) : []
  }));
  return sortGroups(groups, first);
}

// server/favourites.ts
var FAVOURITES_COOKIE = "tr_starred";
var MAX_SAVED = 60;
var TTL_SECONDS = 365 * 24 * 60 * 60;
var SEPARATOR = "~";
var PREFIX = {
  tender: "t",
  entity: "e",
  supplier: "s",
  officer: "o"
};
var BY_PREFIX = { t: "tender", e: "entity", s: "supplier", o: "officer" };
var EDRPOU = /^\d{6,10}$/;
function isEdrpou(value) {
  return EDRPOU.test(value.trim());
}
function normaliseEdrpou(input) {
  const digits = input.replace(/\D/g, "");
  return isEdrpou(digits) ? digits : null;
}
function isUsableId(id) {
  return id.length > 0 && id.length <= 120 && !/[~;,\s\\"]/.test(id);
}
function isFavKind(value) {
  return value === "tender" || value === "entity" || value === "supplier" || value === "officer";
}
function encodeFavourite(fav) {
  return `${PREFIX[fav.kind]}:${fav.id}`;
}
function decodeFavourite(token) {
  const colon = token.indexOf(":");
  if (colon !== 1) return null;
  const kind = BY_PREFIX[token.slice(0, 1)];
  const id = token.slice(colon + 1);
  if (!kind || !isUsableId(id)) return null;
  return { kind, id };
}
function parseFavourites(cookieValue) {
  if (!cookieValue) return [];
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const token of cookieValue.split(SEPARATOR)) {
    const fav = decodeFavourite(token.trim());
    if (!fav) continue;
    const key = encodeFavourite(fav);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(fav);
  }
  return out.slice(0, MAX_SAVED);
}
function serialiseFavourites(favourites) {
  const seen = /* @__PURE__ */ new Set();
  const tokens = [];
  for (const fav of favourites) {
    if (!isUsableId(fav.id)) continue;
    const token = encodeFavourite(fav);
    if (seen.has(token)) continue;
    seen.add(token);
    tokens.push(token);
  }
  return tokens.slice(0, MAX_SAVED).join(SEPARATOR);
}
function isStarred(favourites, kind, id) {
  return favourites.some((f) => f.kind === kind && f.id === id);
}
function toggleFavourite(current, kind, id) {
  if (!isUsableId(id)) return current;
  return isStarred(current, kind, id) ? current.filter((f) => !(f.kind === kind && f.id === id)) : [{ kind, id }, ...current];
}
function favouritesCookie(favourites, secure) {
  const value = serialiseFavourites(favourites);
  const attrs = `SameSite=Lax; Path=/${secure ? "; Secure" : ""}`;
  return value.length === 0 ? `${FAVOURITES_COOKIE}=; ${attrs}; Max-Age=0` : `${FAVOURITES_COOKIE}=${value}; ${attrs}; Max-Age=${TTL_SECONDS}`;
}

// server/conclusion.ts
function fmt(n, digits = 0) {
  return new Intl.NumberFormat("uk-UA", { maximumFractionDigits: digits }).format(n);
}
function money2(n) {
  return n === null || !Number.isFinite(n) ? "\u2014" : `${fmt(n)} \u0433\u0440\u043D`;
}
function dominantPattern(entry) {
  const counts = /* @__PURE__ */ new Map();
  for (const id of entry.risks) {
    const group = RISK_LABELS[id]?.group;
    if (!group) continue;
    counts.set(group, (counts.get(group) ?? 0) + 1);
  }
  let best = null;
  for (const [group, count] of counts) {
    if (!best || count > best.count) best = { group, count };
  }
  return best;
}
function buildConclusion(input) {
  const { entry, sameEntity, sameOfficer, sameWinner } = input;
  const observations = [];
  const nextSteps = [];
  for (const finding of entry.findings) {
    const e = finding.evidence;
    const gap = typeof e.overpayment === "number" ? e.overpayment : typeof e.extra_cost === "number" ? e.extra_cost : null;
    if (finding.detector_key === "peer_price" && typeof e.peer_median === "number" && typeof e.unit_price === "number") {
      observations.push({
        weight: finding.severity === "low" ? "medium" : "high",
        aboutThisTender: true,
        title: "\u0426\u0456\u043D\u0430 \u0437\u0430 \u043E\u0434\u0438\u043D\u0438\u0446\u044E \u0432\u0438\u0449\u0430 \u0437\u0430 \u0440\u0438\u043D\u043A\u043E\u0432\u0443",
        detail: `\u0417\u0430 \u043E\u0434\u0438\u043D\u0438\u0446\u044E \u043F\u043B\u0430\u0442\u044F\u0442\u044C ${fmt(e.unit_price, 2)} \u0433\u0440\u043D, \u0442\u043E\u0434\u0456 \u044F\u043A \u0443 ${e.peer_count ?? "\u0456\u043D\u0448\u0438\u0445"} \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F\u0445 \u0442\u043E\u0433\u043E \u0441\u0430\u043C\u043E\u0433\u043E \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u0430 \u043C\u0435\u0434\u0456\u0430\u043D\u0430 \u2014 ${fmt(e.peer_median, 2)} \u0433\u0440\u043D. ` + (gap !== null ? `\u041D\u0430 \u0432\u0435\u0441\u044C \u043E\u0431\u0441\u044F\u0433 \u0440\u0456\u0437\u043D\u0438\u0446\u044F \u0441\u043A\u043B\u0430\u0434\u0430\u0454 ${money2(gap)}.` : "")
      });
      nextSteps.push("\u0417\u0430\u043F\u0440\u043E\u0441\u0438\u0442\u0438 \u043E\u0431\u0491\u0440\u0443\u043D\u0442\u0443\u0432\u0430\u043D\u043D\u044F \u043E\u0447\u0456\u043A\u0443\u0432\u0430\u043D\u043E\u0457 \u0432\u0430\u0440\u0442\u043E\u0441\u0442\u0456 \u0442\u0430 \u0440\u043E\u0437\u0440\u0430\u0445\u0443\u043D\u043E\u043A \u0446\u0456\u043D\u0438 \u0437\u0430 \u043E\u0434\u0438\u043D\u0438\u0446\u044E.");
    }
    if (finding.detector_key === "own_price_growth" && typeof e.previous_price === "number" && typeof e.growth === "number") {
      observations.push({
        weight: e.growth >= 1 ? "high" : "medium",
        aboutThisTender: true,
        title: "\u0422\u043E\u0439 \u0441\u0430\u043C\u0438\u0439 \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A \u043F\u0456\u0434\u043D\u044F\u0432 \u0446\u0456\u043D\u0443",
        detail: `\u0420\u0430\u043D\u0456\u0448\u0435 \u0446\u0435\u0439 \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A \u043A\u0443\u043F\u0443\u0432\u0430\u0432 \u0442\u0435 \u0441\u0430\u043C\u0435 \u043F\u043E ${fmt(e.previous_price, 2)} \u0433\u0440\u043D \u0437\u0430 \u043E\u0434\u0438\u043D\u0438\u0446\u044E, \u0442\u0435\u043F\u0435\u0440 \u2014 \u043F\u043E ${fmt(Number(e.unit_price ?? 0), 2)} \u0433\u0440\u043D, \u0442\u043E\u0431\u0442\u043E \u043D\u0430 ${Math.round(e.growth * 100)}% \u0431\u0456\u043B\u044C\u0448\u0435. ` + (gap !== null ? `\u0420\u0456\u0437\u043D\u0438\u0446\u044F \u043D\u0430 \u0446\u044E \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044E \u2014 ${money2(gap)}. ` : "") + "\u041F\u043E\u0440\u0456\u0432\u043D\u044F\u043D\u043D\u044F \u0432\u0441\u0435\u0440\u0435\u0434\u0438\u043D\u0456 \u043E\u0434\u043D\u043E\u0433\u043E \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u0430, \u0442\u043E\u0436 \u043F\u043E\u0441\u0438\u043B\u0430\u043D\u043D\u044F \u043D\u0430 \u043C\u0456\u0441\u0446\u0435\u0432\u0456 \u0443\u043C\u043E\u0432\u0438 \u0442\u0443\u0442 \u043D\u0435 \u043F\u0440\u0430\u0446\u044E\u0454."
      });
      nextSteps.push("\u041F\u043E\u0440\u0456\u0432\u043D\u044F\u0442\u0438 \u0442\u0435\u0445\u043D\u0456\u0447\u043D\u0456 \u0432\u0438\u043C\u043E\u0433\u0438 \u043E\u0431\u043E\u0445 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C \u2014 \u0447\u0438 \u0441\u043F\u0440\u0430\u0432\u0434\u0456 \u0437\u043C\u0456\u043D\u0438\u0432\u0441\u044F \u043F\u0440\u0435\u0434\u043C\u0435\u0442.");
    }
  }
  if (entry.detailed && entry.bidders === 1) {
    const big = (entry.value_amount ?? 0) >= 1e7;
    observations.push({
      weight: big ? "high" : "medium",
      aboutThisTender: true,
      title: "\u041A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0446\u0456\u0457 \u043D\u0435 \u0431\u0443\u043B\u043E",
      detail: `\u041D\u0430 \u0442\u043E\u0440\u0433\u0438 \u043F\u043E\u0434\u0430\u0432\u0441\u044F \u043E\u0434\u0438\u043D \u0443\u0447\u0430\u0441\u043D\u0438\u043A, \u0456 \u0432\u0456\u043D \u0436\u0435 \u043F\u0435\u0440\u0435\u043C\u0456\u0433. \u0421\u0443\u043C\u0430 \u2014 ${money2(entry.value_amount)}. \u0411\u0435\u0437 \u0434\u0440\u0443\u0433\u043E\u0457 \u043F\u0440\u043E\u043F\u043E\u0437\u0438\u0446\u0456\u0457 \u0446\u0456\u043D\u0443 \u043D\u0435\u043C\u0430\u0454 \u0437 \u0447\u0438\u043C \u043F\u043E\u0440\u0456\u0432\u043D\u044F\u0442\u0438 \u0432 \u043C\u0435\u0436\u0430\u0445 \u0441\u0430\u043C\u043E\u0457 \u043F\u0440\u043E\u0446\u0435\u0434\u0443\u0440\u0438.`
    });
    nextSteps.push("\u041F\u0435\u0440\u0435\u0432\u0456\u0440\u0438\u0442\u0438 \u0432\u0438\u043C\u043E\u0433\u0438 \u0442\u0435\u043D\u0434\u0435\u0440\u043D\u043E\u0457 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u0446\u0456\u0457 \u2014 \u0447\u0438 \u043D\u0435 \u0437\u0432\u0443\u0436\u0443\u0432\u0430\u043B\u0438 \u0432\u043E\u043D\u0438 \u043A\u043E\u043B\u043E \u0443\u0447\u0430\u0441\u043D\u0438\u043A\u0456\u0432.");
  }
  if (entry.value_amount && entry.winner_amount && entry.value_amount > 0) {
    const discount = 1 - entry.winner_amount / entry.value_amount;
    if (discount >= 0 && discount < 0.01 && entry.value_amount >= 1e6) {
      observations.push({
        weight: "medium",
        aboutThisTender: true,
        title: "\u0422\u043E\u0440\u0433\u0438 \u043D\u0435 \u0437\u0431\u0438\u043B\u0438 \u0446\u0456\u043D\u0443",
        detail: `\u0414\u043E\u0433\u043E\u0432\u0456\u0440 \u0443\u043A\u043B\u0430\u0434\u0435\u043D\u043E \u043D\u0430 ${money2(entry.winner_amount)} \u043F\u0440\u043E\u0442\u0438 \u043E\u0447\u0456\u043A\u0443\u0432\u0430\u043D\u0438\u0445 ${money2(entry.value_amount)} \u2014 \u0437\u043D\u0438\u0436\u043A\u0430 ${(discount * 100).toFixed(2)}%. \u0424\u0430\u043A\u0442\u0438\u0447\u043D\u043E \u0430\u0443\u043A\u0446\u0456\u043E\u043D \u043D\u0435 \u0432\u0456\u0434\u0431\u0443\u0432\u0441\u044F.`
      });
    }
  }
  const pattern = dominantPattern(entry);
  if (pattern && pattern.count >= 2) {
    observations.push({
      weight: "medium",
      aboutThisTender: true,
      title: `\u041E\u0437\u043D\u0430\u043A\u0438 \u0441\u043A\u043B\u0430\u0434\u0430\u044E\u0442\u044C\u0441\u044F \u0432 \u043E\u0434\u0438\u043D \u0441\u044E\u0436\u0435\u0442: ${pattern.group.toLowerCase()}`,
      detail: `${pattern.count} \u0437 ${entry.risks.length} \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u0456\u0432 \u043D\u0430\u043B\u0435\u0436\u0430\u0442\u044C \u0434\u043E \u043E\u0434\u043D\u0456\u0454\u0457 \u0433\u0440\u0443\u043F\u0438. \u0426\u0435 \u043D\u0435 \u0437\u0431\u0456\u0433 \u043E\u043A\u0440\u0435\u043C\u0438\u0445 \u0444\u043E\u0440\u043C\u0430\u043B\u044C\u043D\u043E\u0441\u0442\u0435\u0439, \u0430 \u043F\u043E\u0432\u0442\u043E\u0440\u044E\u0432\u0430\u043D\u0438\u0439 \u0445\u0456\u0434 \u0443 \u043C\u0435\u0436\u0430\u0445 \u043E\u0434\u043D\u0456\u0454\u0457 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456.`
    });
  }
  const pair = sameWinner.filter((c) => c.entity_edrpou === entry.entity_edrpou).length;
  if (pair >= 3 && entry.winner_name) {
    observations.push({
      weight: pair >= 6 ? "high" : "medium",
      aboutThisTender: false,
      title: "\u041F\u043E\u0441\u0442\u0456\u0439\u043D\u0430 \u043F\u0430\u0440\u0430 \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A \u2014 \u043F\u0435\u0440\u0435\u043C\u043E\u0436\u0435\u0446\u044C",
      detail: `\u0426\u0435\u0439 \u043F\u043E\u0441\u0442\u0430\u0447\u0430\u043B\u044C\u043D\u0438\u043A \u0432\u0438\u0433\u0440\u0430\u0432 ${pair} \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C \u0441\u0430\u043C\u0435 \u0446\u044C\u043E\u0433\u043E \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u0430, \u0456 \u0432\u0441\u0456 \u0432\u043E\u043D\u0438 \u043C\u0430\u044E\u0442\u044C \u0434\u0435\u0440\u0436\u0430\u0432\u043D\u0456 \u043F\u043E\u0437\u043D\u0430\u0447\u043A\u0438. \u0423\u0441\u044C\u043E\u0433\u043E \u0432 \u0431\u0430\u0437\u0456 \u0437\u0430 \u043D\u0438\u043C ${sameWinner.length} \u043F\u0435\u0440\u0435\u043C\u043E\u0433.`
    });
    nextSteps.push("\u041F\u0435\u0440\u0435\u0432\u0456\u0440\u0438\u0442\u0438 \u0437\u0430\u0441\u043D\u043E\u0432\u043D\u0438\u043A\u0456\u0432 \u043F\u0435\u0440\u0435\u043C\u043E\u0436\u0446\u044F \u0442\u0430 \u0457\u0445 \u0437\u0432'\u044F\u0437\u043A\u0438 \u0456\u0437 \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u043E\u043C.");
  }
  if (entry.officer_name && sameOfficer.length >= 5) {
    const officerSolo = sameOfficer.filter((c) => c.bidders === 1).length;
    observations.push({
      weight: sameOfficer.length >= 20 ? "medium" : "low",
      aboutThisTender: false,
      title: "\u0417\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0446\u0456\u0454\u0457 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u043B\u044C\u043D\u043E\u0457 \u043E\u0441\u043E\u0431\u0438 \u043F\u043E\u0437\u043D\u0430\u0447\u0430\u044E\u0442\u044C\u0441\u044F \u0441\u0438\u0441\u0442\u0435\u043C\u0430\u0442\u0438\u0447\u043D\u043E",
      detail: `${entry.officer_name} \u0432\u043A\u0430\u0437\u0430\u043D\u0430 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u043B\u044C\u043D\u043E\u044E \u0443 ${sameOfficer.length} \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F\u0445 \u0456\u0437 \u0434\u0435\u0440\u0436\u0430\u0432\u043D\u0438\u043C\u0438 \u043F\u043E\u0437\u043D\u0430\u0447\u043A\u0430\u043C\u0438` + (officerSolo > 0 ? `, \u0437 \u043D\u0438\u0445 ${officerSolo} \u2014 \u0431\u0435\u0437 \u043A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0442\u0456\u0432` : "") + ". \u0426\u0435 \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0430 \u043F\u043E\u0442\u043E\u043A\u0443 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C, \u0430 \u043D\u0435 \u0437\u0432\u0438\u043D\u0443\u0432\u0430\u0447\u0435\u043D\u043D\u044F \u043E\u0441\u043E\u0431\u0438."
    });
  }
  if (sameEntity.length >= 20) {
    const entityValue = sameEntity.reduce((sum2, c) => sum2 + (c.value_amount ?? 0), 0);
    observations.push({
      weight: "low",
      aboutThisTender: false,
      title: "\u0417\u0430\u043C\u043E\u0432\u043D\u0438\u043A \u0443 \u043F\u0435\u0440\u0435\u043B\u0456\u043A\u0443 \u043F\u043E\u0441\u0442\u0456\u0439\u043D\u043E",
      detail: `\u0417\u0430 \u0446\u0438\u043C \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u043E\u043C \u043E\u0431\u043B\u0456\u043A\u043E\u0432\u0430\u043D\u043E ${sameEntity.length} \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C \u0456\u0437 \u043F\u043E\u0437\u043D\u0430\u0447\u043A\u0430\u043C\u0438 \u043D\u0430 ${money2(entityValue)}.`
    });
  }
  const own = observations.filter((o) => o.aboutThisTender);
  const highs = own.filter((o) => o.weight === "high").length;
  const mediums = own.filter((o) => o.weight === "medium").length;
  const level = highs >= 1 ? "high" : mediums >= 2 ? "medium" : mediums === 1 ? "medium" : "low";
  const headline = own.length === 0 ? observations.length === 0 ? "\u041A\u0440\u0456\u043C \u0441\u0430\u043C\u043E\u0457 \u0434\u0435\u0440\u0436\u0430\u0432\u043D\u043E\u0457 \u043F\u043E\u0437\u043D\u0430\u0447\u043A\u0438, \u043C\u0438 \u043D\u0456\u0447\u043E\u0433\u043E \u043D\u0435 \u0437\u043D\u0430\u0439\u0448\u043B\u0438" : "\u0423 \u0441\u0430\u043C\u0456\u0439 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u043D\u0456\u0447\u043E\u0433\u043E \u043D\u0435 \u0437\u043D\u0430\u0439\u0448\u043B\u0438, \u0430\u043B\u0435 \u043D\u0430\u0432\u043A\u043E\u043B\u043E \u043D\u0435\u0457 \u0454 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442" : level === "high" ? "\u0404 \u0449\u043E \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0442\u0438: \u0437\u043D\u0430\u0439\u0434\u0435\u043D\u043E \u043A\u0456\u043B\u044C\u043A\u0456\u0441\u043D\u0456 \u0440\u043E\u0437\u0431\u0456\u0436\u043D\u043E\u0441\u0442\u0456" : "\u0412\u0430\u0440\u0442\u043E \u043F\u043E\u0434\u0438\u0432\u0438\u0442\u0438\u0441\u044F \u0443\u0432\u0430\u0436\u043D\u0456\u0448\u0435";
  if (own.length === 0) {
    nextSteps.push("\u0412\u0456\u0434\u043A\u0440\u0438\u0442\u0438 \u043F\u0435\u0440\u0448\u043E\u0434\u0436\u0435\u0440\u0435\u043B\u043E \u0432 Prozorro \u0456 \u0437\u0432\u0456\u0440\u0438\u0442\u0438 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0438 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0437 \u043E\u043F\u0438\u0441\u043E\u043C \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u0430.");
  } else {
    nextSteps.push("\u0412\u0438\u0442\u0440\u0435\u0431\u0443\u0432\u0430\u0442\u0438 \u0434\u043E\u0433\u043E\u0432\u0456\u0440 \u0456 \u0432\u0441\u0456 \u0434\u043E\u0434\u0430\u0442\u043A\u043E\u0432\u0456 \u0443\u0433\u043E\u0434\u0438 \u0434\u043E \u043D\u044C\u043E\u0433\u043E.");
  }
  return { level, headline, observations, nextSteps: [...new Set(nextSteps)] };
}

// server/qualification.ts
var EVIDENCE_BY_ARTICLE = {
  "366": [
    "\u0414\u043E\u0433\u043E\u0432\u0456\u0440 \u043F\u0440\u043E \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044E \u0442\u0430 \u0432\u0441\u0456 \u0434\u043E\u0434\u0430\u0442\u043A\u043E\u0432\u0456 \u0443\u0433\u043E\u0434\u0438 \u0434\u043E \u043D\u044C\u043E\u0433\u043E, \u0456\u0437 \u0437\u0430\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u043C\u0438 \u043F\u0456\u0434\u0441\u0442\u0430\u0432\u0430\u043C\u0438 \u0437\u043C\u0456\u043D.",
    "\u041F\u0435\u0440\u0432\u0438\u043D\u043D\u0456 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0438, \u044F\u043A\u0456 \u043C\u0430\u043B\u0438 \u0431 \u043F\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0436\u0443\u0432\u0430\u0442\u0438 \u0446\u0456 \u043F\u0456\u0434\u0441\u0442\u0430\u0432\u0438: \u0430\u043A\u0442\u0438, \u0441\u043F\u0435\u0446\u0438\u0444\u0456\u043A\u0430\u0446\u0456\u0457, \u0440\u043E\u0437\u0440\u0430\u0445\u0443\u043D\u043A\u0438.",
    "\u0417\u0432\u0456\u0442 \u043F\u0440\u043E \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043D\u044F \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0443 \u0442\u0430 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0438, \u0449\u043E \u043F\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0436\u0443\u044E\u0442\u044C \u0444\u0430\u043A\u0442\u0438\u0447\u043D\u0438\u0439 \u043E\u0431\u0441\u044F\u0433.",
    "\u041F\u0440\u043E\u0442\u043E\u043A\u043E\u043B\u0438 \u0443\u043F\u043E\u0432\u043D\u043E\u0432\u0430\u0436\u0435\u043D\u043E\u0457 \u043E\u0441\u043E\u0431\u0438 \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u0430."
  ],
  "191": [
    "\u041F\u043B\u0430\u0442\u0456\u0436\u043D\u0456 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0438 \u0442\u0430 \u0432\u0438\u043F\u0438\u0441\u043A\u0438 \u0437\u0430 \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u043E\u043C.",
    "\u0420\u043E\u0437\u0440\u0430\u0445\u0443\u043D\u043E\u043A \u0440\u0456\u0437\u043D\u0438\u0446\u0456 \u043C\u0456\u0436 \u0441\u043F\u043B\u0430\u0447\u0435\u043D\u0438\u043C \u0456 \u043E\u0431\u0491\u0440\u0443\u043D\u0442\u043E\u0432\u0430\u043D\u043E\u044E \u0432\u0430\u0440\u0442\u0456\u0441\u0442\u044E.",
    "\u0414\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0438 \u043F\u0440\u043E \u0444\u0430\u043A\u0442\u0438\u0447\u043D\u043E \u043E\u0442\u0440\u0438\u043C\u0430\u043D\u0438\u0439 \u0442\u043E\u0432\u0430\u0440, \u0440\u043E\u0431\u043E\u0442\u0443 \u0447\u0438 \u043F\u043E\u0441\u043B\u0443\u0433\u0443."
  ],
  "364": [
    "\u041F\u043E\u0441\u0430\u0434\u043E\u0432\u0430 \u0456\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0456\u044F \u0442\u0430 \u043D\u0430\u043A\u0430\u0437 \u043F\u0440\u043E \u043F\u0440\u0438\u0437\u043D\u0430\u0447\u0435\u043D\u043D\u044F \u0443\u043F\u043E\u0432\u043D\u043E\u0432\u0430\u0436\u0435\u043D\u043E\u0457 \u043E\u0441\u043E\u0431\u0438.",
    "\u0422\u0435\u043D\u0434\u0435\u0440\u043D\u0430 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u0446\u0456\u044F \u0442\u0430 \u043F\u0440\u043E\u0442\u043E\u043A\u043E\u043B\u0438 \u0440\u043E\u0437\u0433\u043B\u044F\u0434\u0443 \u043F\u0440\u043E\u043F\u043E\u0437\u0438\u0446\u0456\u0439.",
    "\u041B\u0438\u0441\u0442\u0443\u0432\u0430\u043D\u043D\u044F \u0449\u043E\u0434\u043E \u0440\u043E\u0437\u0433\u043B\u044F\u0434\u0443 \u0442\u0430 \u0432\u0456\u0434\u0445\u0438\u043B\u0435\u043D\u043D\u044F \u043F\u0440\u043E\u043F\u043E\u0437\u0438\u0446\u0456\u0439 \u0443\u0447\u0430\u0441\u043D\u0438\u043A\u0456\u0432."
  ],
  "367": [
    "\u041F\u043E\u0441\u0430\u0434\u043E\u0432\u0430 \u0456\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0456\u044F \u0442\u0430 \u043E\u0431\u0441\u044F\u0433 \u043E\u0431\u043E\u0432'\u044F\u0437\u043A\u0456\u0432 \u0443\u043F\u043E\u0432\u043D\u043E\u0432\u0430\u0436\u0435\u043D\u043E\u0457 \u043E\u0441\u043E\u0431\u0438.",
    "\u0414\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0438, \u0449\u043E \u043F\u043E\u043A\u0430\u0437\u0443\u044E\u0442\u044C, \u044F\u043A\u0456 \u0434\u0456\u0457 \u043C\u0430\u043B\u0438 \u0431\u0443\u0442\u0438 \u0432\u0447\u0438\u043D\u0435\u043D\u0456 \u0442\u0430 \u0443 \u044F\u043A\u0438\u0439 \u0441\u0442\u0440\u043E\u043A."
  ]
};
function fine(part) {
  const p = ADMIN_ARTICLE.parts[part];
  const uah = (n) => new Intl.NumberFormat("uk-UA").format(n * ADMIN_ARTICLE.unitUah);
  return p.fineFrom === p.fineTo ? `${p.fineFrom} \u043D\u043C\u0434\u0433 (${uah(p.fineFrom)} \u0433\u0440\u043D)` : `\u0432\u0456\u0434 ${p.fineFrom} \u0434\u043E ${p.fineTo} \u043D\u043C\u0434\u0433 (${uah(p.fineFrom)}\u2013${uah(p.fineTo)} \u0433\u0440\u043D)`;
}
function shortName(riskId, rules) {
  return RISK_LABELS[riskId]?.short ?? rules.get(riskId)?.name ?? riskId;
}
function buildQualification(entry, rules) {
  const norms = /* @__PURE__ */ new Map();
  const consequenceKeys = /* @__PURE__ */ new Set();
  const adminParts = /* @__PURE__ */ new Map();
  const criminal = /* @__PURE__ */ new Map();
  for (const riskId of entry.risks) {
    const rule = rules.get(riskId);
    const legal = INDICATOR_LEGAL[riskId];
    const name = shortName(riskId, rules);
    const stateNorm = rule?.legitimateness?.trim();
    const text = stateNorm || legal?.norm;
    if (text) {
      const existing = norms.get(text);
      if (existing) {
        existing.from.push(name);
      } else {
        norms.set(text, {
          norm: text,
          source: stateNorm ? "state" : "reading",
          note: stateNorm ? void 0 : legal?.normNote,
          from: [name]
        });
      }
    }
    for (const key of legal?.consequences ?? []) consequenceKeys.add(key);
    if (legal?.admin) {
      const list = adminParts.get(legal.admin) ?? [];
      list.push(name);
      adminParts.set(legal.admin, list);
    }
    for (const direction of legal?.criminal ?? []) {
      const acc = criminal.get(direction.code) ?? { reasons: [] };
      if (!acc.reasons.includes(direction.why)) acc.reasons.push(direction.why);
      criminal.set(direction.code, acc);
    }
  }
  return {
    norms: [...norms.values()],
    consequences: [...consequenceKeys].map((key) => CONSEQUENCES[key]).filter(Boolean),
    admin: [...adminParts.entries()].map(([part, from]) => ({
      part: ADMIN_ARTICLE.parts[part].label,
      conduct: ADMIN_ARTICLE.parts[part].conduct,
      fine: fine(part),
      from
    })),
    criminal: [...criminal.entries()].map(([code, acc]) => {
      const article = ARTICLES[code];
      return {
        code,
        title: article?.title ?? "",
        summary: article?.summary ?? "",
        elements: article?.elements ?? [],
        reasons: acc.reasons,
        evidence: EVIDENCE_BY_ARTICLE[code] ?? []
      };
    }),
    caution: "\u041D\u0430\u0432\u0435\u0434\u0435\u043D\u0435 \u043D\u0438\u0436\u0447\u0435 \u2014 \u043F\u0440\u0430\u0432\u043E\u0432\u0430 \u0434\u043E\u0432\u0456\u0434\u043A\u0430 \u0434\u043B\u044F \u044E\u0440\u0438\u0441\u0442\u0430, \u0430 \u043D\u0435 \u043A\u0432\u0430\u043B\u0456\u0444\u0456\u043A\u0430\u0446\u0456\u044F \u0434\u0456\u0439 \u0431\u0443\u0434\u044C-\u044F\u043A\u043E\u0457 \u043E\u0441\u043E\u0431\u0438. \u0406\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440 \u0444\u0456\u043A\u0441\u0443\u0454 \u0440\u043E\u0437\u0431\u0456\u0436\u043D\u0456\u0441\u0442\u044C \u0443 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456; \u0447\u0438 \u0454 \u0432\u043E\u043D\u0430 \u043F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F\u043C, \u0456 \u0442\u0438\u043C \u0431\u0456\u043B\u044C\u0448\u0435 \u0437\u043B\u043E\u0447\u0438\u043D\u043E\u043C, \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u044E\u044E\u0442\u044C \u0443\u043F\u043E\u0432\u043D\u043E\u0432\u0430\u0436\u0435\u043D\u0456 \u043E\u0440\u0433\u0430\u043D\u0438 \u0442\u0430 \u0441\u0443\u0434 \u043D\u0430 \u043F\u0456\u0434\u0441\u0442\u0430\u0432\u0456 \u0441\u0430\u043C\u0438\u0445 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0456\u0432."
  };
}

// server/report.ts
function plainNumber(n, digits = 2) {
  return new Intl.NumberFormat("uk-UA", { maximumFractionDigits: digits }).format(n).replace(/ /g, " ");
}
function money3(amount) {
  if (amount === null || !Number.isFinite(amount)) return "\u2014";
  return plainNumber(amount) + " \u0433\u0440\u043D";
}
var day = shortDate;
function wrap(text, width = 78, indent = "  ") {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    if ((line + " " + word).trim().length > width) {
      lines.push(indent + line.trim());
      line = word;
    } else {
      line += " " + word;
    }
  }
  if (line.trim()) lines.push(indent + line.trim());
  return lines.join("\n");
}
function sections(ctx) {
  const { entry, rules } = ctx;
  const out = [];
  const verdict = ctx.conclusion;
  out.push({
    heading: "\u0412\u0418\u0421\u041D\u041E\u0412\u041E\u041A \u0421\u0418\u0421\u0422\u0415\u041C\u0418",
    lines: [
      verdict.headline,
      "",
      ...verdict.observations.length > 0 ? verdict.observations.flatMap((o, i) => [`${i + 1}. ${o.title}`, wrap(o.detail), ""]) : [
        wrap(
          "\u0414\u0435\u0440\u0436\u0430\u0432\u043D\u0430 \u0441\u0438\u0441\u0442\u0435\u043C\u0430 \u043F\u043E\u0437\u043D\u0430\u0447\u0438\u043B\u0430 \u0446\u044E \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044E, \u0430\u043B\u0435 \u043D\u0430\u0448\u0456 \u0432\u043B\u0430\u0441\u043D\u0456 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u043A\u0438 \u2014 \u0446\u0456\u043D\u0430 \u043F\u0440\u043E\u0442\u0438 \u0440\u0438\u043D\u043A\u0443, \u043A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0446\u0456\u044F, \u043F\u043E\u0432\u0442\u043E\u0440\u044E\u0432\u0430\u043D\u0456\u0441\u0442\u044C \u0437\u0432'\u044F\u0437\u043A\u0456\u0432 \u2014 \u043D\u0456\u0447\u043E\u0433\u043E \u0434\u043E\u0434\u0430\u0442\u043A\u043E\u0432\u043E\u0433\u043E \u043D\u0435 \u043F\u043E\u043A\u0430\u0437\u0430\u043B\u0438."
        ),
        ""
      ],
      "\u0429\u043E \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u0438\u0442\u0438 \u0434\u0430\u043B\u0456:",
      ...verdict.nextSteps.map((step) => wrap(`\u2014 ${step}`)),
      "",
      wrap(
        "\u0426\u0435\u0439 \u0432\u0438\u0441\u043D\u043E\u0432\u043E\u043A \u0441\u043A\u043B\u0430\u043B\u0430 \u0441\u0438\u0441\u0442\u0435\u043C\u0430 \u0437 \u0447\u0438\u0441\u0435\u043B, \u043D\u0430\u0432\u0435\u0434\u0435\u043D\u0438\u0445 \u043D\u0438\u0436\u0447\u0435. \u0412\u0456\u043D \u043D\u0435 \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u044E\u0454 \u043F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F \u0456 \u043D\u0435 \u0454 \u043A\u0432\u0430\u043B\u0456\u0444\u0456\u043A\u0430\u0446\u0456\u0454\u044E \u0434\u0456\u0439 \u0431\u0443\u0434\u044C-\u044F\u043A\u043E\u0457 \u043E\u0441\u043E\u0431\u0438."
      )
    ]
  });
  out.push({
    heading: "\u0417\u0410\u041A\u0423\u041F\u0406\u0412\u041B\u042F",
    lines: [
      `\u041D\u0430\u0437\u0432\u0430: ${entry.title ?? "\u2014"}`,
      `\u041D\u043E\u043C\u0435\u0440: ${entry.tender_ref || entry.tender_id}`,
      `\u0414\u0430\u0442\u0430 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456: ${day(entry.tender_date)}`,
      `\u0414\u0430\u0442\u0430 \u043F\u043E\u0437\u043D\u0430\u0447\u043A\u0438 \u0434\u0435\u0440\u0436\u0430\u0432\u0438: ${day(entry.date_assessed)}`,
      `\u0421\u0443\u043C\u0430: ${money3(entry.value_amount)}`,
      `\u0420\u0435\u0433\u0456\u043E\u043D: ${entry.region ?? "\u2014"}`,
      entry.method ? `\u041F\u0440\u043E\u0446\u0435\u0434\u0443\u0440\u0430: ${procedureLabel(entry.method) ?? entry.method}` : "",
      entry.detailed ? `\u0423\u0447\u0430\u0441\u043D\u0438\u043A\u0456\u0432: ${entry.bidders === 1 ? "\u043E\u0434\u0438\u043D \u2014 \u043A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0446\u0456\u0457 \u043D\u0435 \u0431\u0443\u043B\u043E" : entry.bidders || "\u2014"}` : "",
      `\u041F\u0435\u0440\u0448\u043E\u0434\u0436\u0435\u0440\u0435\u043B\u043E: https://prozorro.gov.ua/tender/${entry.tender_ref}`
    ].filter(Boolean)
  });
  out.push({
    heading: "\u0417\u0410\u041C\u041E\u0412\u041D\u0418\u041A",
    lines: [
      `\u041D\u0430\u0437\u0432\u0430: ${readableName(entry.entity_name)}`,
      `\u0404\u0414\u0420\u041F\u041E\u0423: ${entry.entity_edrpou ?? "\u2014"}`,
      `\u0423\u0441\u044C\u043E\u0433\u043E \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C \u0456\u0437 \u043F\u043E\u0437\u043D\u0430\u0447\u043A\u0430\u043C\u0438: ${ctx.sameEntity}`
    ]
  });
  if (entry.officer_name) {
    out.push({
      heading: "\u0412\u0406\u0414\u041F\u041E\u0412\u0406\u0414\u0410\u041B\u042C\u041D\u0410 \u041E\u0421\u041E\u0411\u0410",
      lines: [
        `\u0406\u043C'\u044F: ${entry.officer_name}`,
        `\u041F\u043E\u0448\u0442\u0430: ${entry.officer_email ?? "\u2014"}`,
        `\u0422\u0435\u043B\u0435\u0444\u043E\u043D: ${entry.officer_phone ?? "\u2014"}`,
        `\u0417\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C \u0456\u0437 \u043F\u043E\u0437\u043D\u0430\u0447\u043A\u0430\u043C\u0438, \u0434\u0435 \u0432\u043A\u0430\u0437\u0430\u043D\u0430 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u043B\u044C\u043D\u043E\u044E: ${ctx.sameOfficer}`,
        "",
        wrap(
          "\u0414\u0430\u043D\u0456 \u0432\u0437\u044F\u0442\u043E \u0437 \u043A\u0430\u0440\u0442\u043A\u0438 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0432 Prozorro, \u0434\u0435 \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A \u0441\u0430\u043C \u043F\u0443\u0431\u043B\u0456\u043A\u0443\u0454 \u043A\u043E\u043D\u0442\u0430\u043A\u0442\u043D\u0443 \u043E\u0441\u043E\u0431\u0443. \u0426\u0435 \u043D\u0435 \u0442\u0432\u0435\u0440\u0434\u0436\u0435\u043D\u043D\u044F \u043F\u0440\u043E \u043F\u0440\u0430\u0432\u043E\u043F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F \u0437 \u0431\u043E\u043A\u0443 \u043D\u0430\u0437\u0432\u0430\u043D\u043E\u0457 \u043E\u0441\u043E\u0431\u0438."
        )
      ]
    });
  }
  if (entry.winner_name) {
    out.push({
      heading: "\u041F\u0415\u0420\u0415\u041C\u041E\u0416\u0415\u0426\u042C",
      lines: [
        `\u041D\u0430\u0437\u0432\u0430: ${readableName(entry.winner_name)}`,
        `\u0404\u0414\u0420\u041F\u041E\u0423: ${entry.winner_edrpou ?? "\u2014"}`,
        `\u0421\u0443\u043C\u0430 \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0443: ${money3(entry.winner_amount)}`,
        `\u041F\u0435\u0440\u0435\u043C\u043E\u0433 \u0443 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F\u0445 \u0456\u0437 \u043F\u043E\u0437\u043D\u0430\u0447\u043A\u0430\u043C\u0438: ${ctx.sameWinner}`
      ]
    });
  }
  const indicatorLines = [];
  for (const riskId of entry.risks) {
    const rule = rules.get(riskId);
    const label = RISK_LABELS[riskId];
    const legal = INDICATOR_LEGAL[riskId];
    indicatorLines.push(`[${riskId}] ${label?.short ?? rule?.name ?? riskId}`);
    if (label) indicatorLines.push(wrap(label.means));
    if (rule?.name) indicatorLines.push(wrap(`\u041E\u0444\u0456\u0446\u0456\u0439\u043D\u0435 \u0444\u043E\u0440\u043C\u0443\u043B\u044E\u0432\u0430\u043D\u043D\u044F: ${rule.name}`));
    const stateNorm = rule?.legitimateness?.trim();
    if (stateNorm) {
      indicatorLines.push(wrap(`\u041D\u043E\u0440\u043C\u0430, \u044F\u043A\u0443 \u043D\u0430\u0432\u043E\u0434\u0438\u0442\u044C \u0434\u0435\u0440\u0436\u0430\u0432\u0430: ${stateNorm}`));
    } else if (legal?.norm) {
      indicatorLines.push(wrap(`\u041D\u043E\u0440\u043C\u0430 \u2014 \u0437\u0456\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u043D\u044F \u0446\u0456\u0454\u0457 \u0441\u0438\u0441\u0442\u0435\u043C\u0438: ${legal.norm}`));
      if (legal.normNote) indicatorLines.push(wrap(legal.normNote));
    } else {
      indicatorLines.push(wrap("\u0414\u0435\u0440\u0436\u0430\u0432\u0430 \u043D\u0435 \u043D\u0430\u0432\u043E\u0434\u0438\u0442\u044C \u043D\u043E\u0440\u043C\u0443 \u0434\u043B\u044F \u0446\u044C\u043E\u0433\u043E \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u0430."));
    }
    for (const direction of legal?.criminal ?? []) {
      const article = ARTICLES[direction.code];
      indicatorLines.push(wrap(`\u0421\u0442\u0430\u0442\u0442\u044F ${direction.code} \u041A\u041A\u0423 \u2014 ${article?.title ?? ""}: ${direction.why}`));
    }
    indicatorLines.push("");
  }
  out.push({
    heading: `\u0429\u041E \u0417\u0410\u041F\u0406\u0414\u041E\u0417\u0420\u0418\u041B\u0410 \u0414\u0415\u0420\u0416\u0410\u0412\u0410 \u2014 ${entry.risks.length} ${entry.risks.length === 1 ? "\u0406\u041D\u0414\u0418\u041A\u0410\u0422\u041E\u0420" : "\u0406\u041D\u0414\u0418\u041A\u0410\u0422\u041E\u0420\u0418"}`,
    lines: indicatorLines
  });
  if (entry.findings.length > 0) {
    const lines = [];
    for (const finding of entry.findings) {
      lines.push(`${finding.title}`);
      lines.push(wrap(finding.explanation));
      const e = finding.evidence;
      for (const [key, caption] of [
        ["unit_price", "\u0426\u0456\u043D\u0430 \u0437\u0430 \u043E\u0434\u0438\u043D\u0438\u0446\u044E"],
        ["peer_median", "\u0422\u0438\u043F\u043E\u0432\u0430 \u0446\u0456\u043D\u0430 (\u043C\u0435\u0434\u0456\u0430\u043D\u0430)"],
        ["peer_count", "\u041F\u043E\u0440\u0456\u0432\u043D\u044F\u043D\u043E \u0456\u0437 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F\u043C\u0438"],
        ["previous_price", "\u041F\u043E\u043F\u0435\u0440\u0435\u0434\u043D\u044F \u0446\u0456\u043D\u0430 \u0446\u044C\u043E\u0433\u043E \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u0430"],
        ["quantity", "\u041A\u0456\u043B\u044C\u043A\u0456\u0441\u0442\u044C"],
        ["overpayment", "\u0420\u0456\u0437\u043D\u0438\u0446\u044F \u043D\u0430 \u0432\u0441\u044E \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044E"],
        ["extra_cost", "\u0420\u0456\u0437\u043D\u0438\u0446\u044F \u043D\u0430 \u0432\u0441\u044E \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044E"]
      ]) {
        if (typeof e[key] === "number") lines.push(`  ${caption}: ${plainNumber(e[key], 2)}`);
      }
      lines.push("");
    }
    out.push({ heading: "\u0420\u041E\u0417\u0420\u0410\u0425\u0423\u041D\u041E\u041A \u0426\u0406\u041D\u0418 \u0426\u0406\u0404\u042E \u0421\u0418\u0421\u0422\u0415\u041C\u041E\u042E", lines });
  }
  const q = buildQualification(entry, rules);
  const legalLines = [wrap(q.caution), ""];
  legalLines.push("\u041D\u041E\u0420\u041C\u0418, \u042F\u041A\u0406 \u0417\u0410\u0427\u0415\u041F\u041B\u0415\u041D\u0406", "");
  for (const n of q.norms) {
    legalLines.push(wrap(`${n.source === "state" ? "\u041D\u043E\u0440\u043C\u0430, \u044F\u043A\u0443 \u043D\u0430\u0432\u043E\u0434\u0438\u0442\u044C \u0434\u0435\u0440\u0436\u0430\u0432\u0430" : "\u041D\u043E\u0440\u043C\u0430 \u2014 \u0437\u0456\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u043D\u044F \u0446\u0456\u0454\u0457 \u0441\u0438\u0441\u0442\u0435\u043C\u0438"}: ${n.norm}`));
    if (n.note) legalLines.push(wrap(n.note));
    legalLines.push(wrap(`\u041F\u0456\u0434\u0441\u0442\u0430\u0432\u0430: ${n.from.join("; ")}`), "");
  }
  if (q.consequences.length > 0) {
    legalLines.push("\u0429\u041E \u0417 \u0426\u042C\u041E\u0413\u041E \u0412\u0418\u041F\u041B\u0418\u0412\u0410\u0404 \u0417\u0410 \u0417\u0410\u041A\u041E\u041D\u041E\u041C \u041F\u0420\u041E \u0417\u0410\u041A\u0423\u041F\u0406\u0412\u041B\u0406", "");
    for (const c of q.consequences) {
      legalLines.push(wrap(c.norm), wrap(c.effect), "");
    }
  }
  if (q.admin.length > 0) {
    legalLines.push("\u0410\u0414\u041C\u0406\u041D\u0406\u0421\u0422\u0420\u0410\u0422\u0418\u0412\u041D\u0410 \u0412\u0406\u0414\u041F\u041E\u0412\u0406\u0414\u0410\u041B\u042C\u041D\u0406\u0421\u0422\u042C", "");
    for (const a of q.admin) {
      legalLines.push(
        wrap(`\u0421\u0442\u0430\u0442\u0442\u044F 164-14 \u041A\u0423\u043F\u0410\u041F, ${a.part}: ${a.conduct}`),
        wrap(`\u0421\u0430\u043D\u043A\u0446\u0456\u044F: ${a.fine} \u043D\u0430 \u0441\u043B\u0443\u0436\u0431\u043E\u0432\u0438\u0445 \u0442\u0430 \u0443\u043F\u043E\u0432\u043D\u043E\u0432\u0430\u0436\u0435\u043D\u0438\u0445 \u043E\u0441\u0456\u0431 \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u0430.`),
        wrap(`\u041F\u0456\u0434\u0441\u0442\u0430\u0432\u0430: ${a.from.join("; ")}`),
        ""
      );
    }
    legalLines.push(
      wrap("\u0420\u043E\u0437\u043C\u0456\u0440 \u043D\u0430\u0432\u0435\u0434\u0435\u043D\u043E \u0432 \u043D\u0435\u043E\u043F\u043E\u0434\u0430\u0442\u043A\u043E\u0432\u0443\u0432\u0430\u043D\u0438\u0445 \u043C\u0456\u043D\u0456\u043C\u0443\u043C\u0430\u0445 \u0434\u043E\u0445\u043E\u0434\u0456\u0432 \u0433\u0440\u043E\u043C\u0430\u0434\u044F\u043D; \u0434\u043B\u044F \u0448\u0442\u0440\u0430\u0444\u0456\u0432 \u0446\u044F \u043E\u0434\u0438\u043D\u0438\u0446\u044F \u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C 17 \u0433\u0440\u043D."),
      ""
    );
  }
  if (q.criminal.length > 0) {
    legalLines.push("\u041A\u0420\u0418\u041C\u0406\u041D\u0410\u041B\u042C\u041D\u041E-\u041F\u0420\u0410\u0412\u041E\u0412\u0406 \u041D\u0410\u041F\u0420\u042F\u041C\u0418", "");
    for (const c of q.criminal) {
      legalLines.push(`\u0421\u0442\u0430\u0442\u0442\u044F ${c.code} \u041A\u041A\u0423 \u2014 ${c.title}`, wrap(c.summary));
      legalLines.push("  \u0427\u043E\u043C\u0443 \u0446\u0435\u0439 \u043D\u0430\u043F\u0440\u044F\u043C \u0432\u0438\u043D\u0438\u043A\u0430\u0454 \u0441\u0430\u043C\u0435 \u0442\u0443\u0442:");
      for (const r of c.reasons) legalLines.push(wrap(`\u2014 ${r}`, 78, "    "));
      legalLines.push("  \u0429\u043E \u043C\u0430\u0454 \u0431\u0443\u0442\u0438 \u0434\u043E\u0432\u0435\u0434\u0435\u043D\u043E:");
      for (const e of c.elements) legalLines.push(wrap(`\u2014 ${e}`, 78, "    "));
      legalLines.push("  \u042F\u043A\u0456 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0438 \u0432\u0438\u0442\u0440\u0435\u0431\u0443\u0432\u0430\u0442\u0438:");
      for (const e of c.evidence) legalLines.push(wrap(`\u2014 ${e}`, 78, "    "));
      legalLines.push("");
    }
  }
  out.push({ heading: "\u041F\u0420\u0410\u0412\u041E\u0412\u0410 \u041A\u0412\u0410\u041B\u0406\u0424\u0406\u041A\u0410\u0426\u0406\u042F", lines: legalLines });
  out.push({
    heading: "\u041C\u0415\u0416\u0406 \u0426\u042C\u041E\u0413\u041E \u0417\u0412\u0406\u0422\u0423",
    lines: [
      wrap(
        "\u041F\u043E\u0437\u043D\u0430\u0447\u043A\u0430 \u043E\u0437\u043D\u0430\u0447\u0430\u0454, \u0449\u043E \u0441\u043F\u0440\u0430\u0446\u044E\u0432\u0430\u0432 \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440 \u0434\u0435\u0440\u0436\u0430\u0432\u043D\u043E\u0457 \u0441\u0438\u0441\u0442\u0435\u043C\u0438 \u043C\u043E\u043D\u0456\u0442\u043E\u0440\u0438\u043D\u0433\u0443 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C. \u0426\u0435 \u043E\u0437\u043D\u0430\u043A\u0430 \u0440\u0438\u0437\u0438\u043A\u0443, \u044F\u043A\u0430 \u043F\u043E\u0442\u0440\u0435\u0431\u0443\u0454 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u043A\u0438, \u0430 \u043D\u0435 \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0439 \u0444\u0430\u043A\u0442 \u043F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F."
      ),
      "",
      wrap(
        "\u041F\u043E\u0441\u0438\u043B\u0430\u043D\u043D\u044F \u043D\u0430 \u0441\u0442\u0430\u0442\u0442\u0456 \u041A\u0440\u0438\u043C\u0456\u043D\u0430\u043B\u044C\u043D\u043E\u0433\u043E \u043A\u043E\u0434\u0435\u043A\u0441\u0443 \u043D\u0430\u0432\u0435\u0434\u0435\u043D\u0456 \u044F\u043A \u043D\u0430\u043F\u0440\u044F\u043C\u0438 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u043A\u0438 \u0434\u043B\u044F \u044E\u0440\u0438\u0441\u0442\u0430. \u0426\u0435 \u043D\u0435 \u043A\u0432\u0430\u043B\u0456\u0444\u0456\u043A\u0430\u0446\u0456\u044F \u0434\u0456\u0439 \u0431\u0443\u0434\u044C-\u044F\u043A\u043E\u0457 \u043E\u0441\u043E\u0431\u0438. \u0423\u043C\u0438\u0441\u0435\u043B \u0456 \u0437\u0430\u0432\u0456\u0434\u043E\u043C\u0456\u0441\u0442\u044C \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u044E\u0454 \u0432\u0438\u043A\u043B\u044E\u0447\u043D\u043E \u0441\u0443\u0434."
      ),
      "",
      wrap("\u041D\u0430\u0441\u0442\u0443\u043F\u043D\u0438\u0439 \u043A\u0440\u043E\u043A \u2014 \u0432\u0438\u0442\u0440\u0435\u0431\u0443\u0432\u0430\u0442\u0438 \u0441\u0430\u043C\u0456 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0438 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0442\u0430 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u0438\u0442\u0438 \u0457\u0445.")
    ]
  });
  return out;
}
function reportText(ctx) {
  const title = ctx.entry.title ?? ctx.entry.tender_ref;
  const head = [
    "TENDER RADAR \u2014 \u0417\u0412\u0406\u0422 \u041F\u041E \u0417\u0410\u041A\u0423\u041F\u0406\u0412\u041B\u0406",
    "=".repeat(78),
    wrap(title, 78, ""),
    `\u0421\u0444\u043E\u0440\u043C\u043E\u0432\u0430\u043D\u043E: ${day(ctx.generatedAt)}`,
    "=".repeat(78),
    ""
  ];
  const body = sections(ctx).flatMap((section) => [section.heading, "-".repeat(78), ...section.lines, ""]);
  return [...head, ...body].join("\n");
}
function reportHtml(ctx) {
  const { entry } = ctx;
  const title = entry.title ?? entry.tender_ref;
  const body = sections(ctx).map(
    (section) => `<section>
  <h2>${esc(section.heading)}</h2>
  ${section.lines.filter((l) => l.trim()).map((line) => `<p>${esc(line.trim())}</p>`).join("")}
</section>`
  ).join("");
  return `<!doctype html>
<html lang="uk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>\u0417\u0432\u0456\u0442 \u2014 ${esc(entry.tender_ref)}</title>
<style>
  :root{color-scheme:light;--ink:#17222B;--soft:#4A5966;--line:#DDE4E8;--accent:#17607F}
  *{box-sizing:border-box}
  body{margin:0;background:#F6F8F9;color:var(--ink);font-family:"IBM Plex Sans","Segoe UI",system-ui,sans-serif;font-size:15px;line-height:1.6}
  .sheet{max-width:52rem;margin:0 auto;background:#fff;padding:2.5rem 3rem 4rem;min-height:100vh}
  .toolbar{max-width:52rem;margin:1rem auto 0;padding:0 3rem;display:flex;gap:.75rem;flex-wrap:wrap}
  .toolbar a,.toolbar button{font:inherit;font-size:.92rem;text-decoration:none;color:var(--accent);background:#fff;border:1px solid var(--line);border-radius:5px;padding:.5rem 1rem;cursor:pointer}
  .toolbar a:hover,.toolbar button:hover{border-color:var(--accent)}
  h1{font-family:Literata,Georgia,serif;font-size:1.5rem;line-height:1.25;margin:0 0 .4rem}
  .ref{font-family:"IBM Plex Mono",Consolas,monospace;font-size:.85rem;color:var(--soft)}
  .made{color:var(--soft);font-size:.85rem;margin:.2rem 0 1.5rem;padding-bottom:1.2rem;border-bottom:2px solid var(--ink)}
  section{margin:0 0 1.6rem;break-inside:avoid}
  h2{font-family:Literata,Georgia,serif;font-size:1rem;letter-spacing:.04em;margin:0 0 .5rem;padding-bottom:.3rem;border-bottom:1px solid var(--line)}
  p{margin:0 0 .4rem;max-width:64ch}
  @media print{
    body{background:#fff;font-size:11pt}
    .toolbar{display:none}
    .sheet{max-width:none;padding:0;min-height:0}
    @page{margin:18mm}
  }
</style>
</head>
<body>
<div class="toolbar">
  <a href="/tender/${encodeURIComponent(entry.tender_id)}">\u2190 \u0434\u043E \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456</a>
  <button type="button" onclick="window.print()">\u0414\u0440\u0443\u043A \u0430\u0431\u043E \u0437\u0431\u0435\u0440\u0435\u0436\u0435\u043D\u043D\u044F \u0443 PDF</button>
  <a href="/tender/${encodeURIComponent(entry.tender_id)}/report.txt">\u0417\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0438\u0442\u0438 \u0442\u0435\u043A\u0441\u0442\u043E\u043C</a>
</div>
<div class="sheet">
  <h1>${esc(title)}</h1>
  <div class="ref">${esc(entry.tender_ref || entry.tender_id)}</div>
  <div class="made">Tender Radar \xB7 \u0437\u0432\u0456\u0442 \u0441\u0444\u043E\u0440\u043C\u043E\u0432\u0430\u043D\u043E ${esc(day(ctx.generatedAt))}</div>
  ${body}
</div>
</body>
</html>`;
}

// server/controls.ts
function readControls(url) {
  const rawGroup = url.searchParams.get("group") ?? "";
  const rawThen = url.searchParams.get("then") ?? "";
  return {
    q: (url.searchParams.get("q") ?? "").trim().toLowerCase(),
    risk: url.searchParams.get("risk") ?? "",
    region: url.searchParams.get("region") ?? "",
    sort: url.searchParams.get("sort") ?? "value",
    railOnly: url.searchParams.get("rail") === "1",
    soloOnly: url.searchParams.get("solo") === "1",
    priceOnly: url.searchParams.get("price") === "1",
    dateFrom: (url.searchParams.get("from") ?? "").trim(),
    dateTo: (url.searchParams.get("to") ?? "").trim(),
    min: Number(url.searchParams.get("min") ?? "") || 0,
    max: Number(url.searchParams.get("max") ?? "") || 0,
    group: isDimension(rawGroup) ? rawGroup : "",
    then: isDimension(rawThen) ? rawThen : "",
    page: Math.max(1, Number(url.searchParams.get("page") ?? 1))
  };
}
function activeCount(c) {
  return [
    c.risk,
    c.region,
    c.railOnly,
    c.soloOnly,
    c.priceOnly,
    c.dateFrom,
    c.dateTo,
    c.min > 0,
    c.max > 0,
    c.group,
    c.sort !== "value"
  ].filter(Boolean).length;
}
function isFiltered(c) {
  return Boolean(
    c.q || c.risk || c.region || c.railOnly || c.soloOnly || c.priceOnly || c.dateFrom || c.dateTo || c.min > 0 || c.max > 0
  );
}
function applyControls(cases, c, railwayCodes, opts = {}) {
  let list = cases;
  if (c.q) {
    list = list.filter(
      (x) => (x.entity_name ?? "").toLowerCase().includes(c.q) || (x.title ?? "").toLowerCase().includes(c.q) || (x.officer_name ?? "").toLowerCase().includes(c.q) || (x.winner_name ?? "").toLowerCase().includes(c.q) || (x.entity_edrpou ?? "").includes(c.q) || (x.winner_edrpou ?? "").includes(c.q) || x.tender_ref.toLowerCase().includes(c.q)
    );
  }
  if (c.risk) list = list.filter((x) => x.risks.includes(c.risk));
  if (c.region) list = list.filter((x) => x.region === c.region);
  if (c.railOnly && !opts.hideRail) list = list.filter((x) => railwayCodes.has(x.entity_edrpou ?? ""));
  if (c.soloOnly) list = list.filter((x) => x.bidders === 1);
  if (c.priceOnly && !opts.hidePrice) list = list.filter((x) => x.findings.length > 0);
  if (c.dateFrom) list = list.filter((x) => (x.tender_date ?? "") >= c.dateFrom);
  if (c.dateTo) list = list.filter((x) => (x.tender_date ?? "") <= c.dateTo);
  if (c.min > 0) list = list.filter((x) => (x.value_amount ?? 0) >= c.min);
  if (c.max > 0) list = list.filter((x) => (x.value_amount ?? 0) <= c.max);
  return [...list].sort(
    (a, b) => c.sort === "date" ? String(b.tender_date ?? "").localeCompare(String(a.tender_date ?? "")) : c.sort === "date-asc" ? String(a.tender_date ?? "").localeCompare(String(b.tender_date ?? "")) : c.sort === "assessed" ? String(b.date_assessed ?? "").localeCompare(String(a.date_assessed ?? "")) : c.sort === "value-asc" ? (a.value_amount ?? 0) - (b.value_amount ?? 0) : c.sort === "risks" ? b.risks.length - a.risks.length || (b.value_amount ?? 0) - (a.value_amount ?? 0) : (b.value_amount ?? 0) - (a.value_amount ?? 0)
  );
}
function keepControls(action, c, over = {}) {
  const p = new URLSearchParams();
  if (c.q) p.set("q", c.q);
  if (c.risk) p.set("risk", c.risk);
  if (c.region) p.set("region", c.region);
  if (c.sort !== "value") p.set("sort", c.sort);
  if (c.railOnly) p.set("rail", "1");
  if (c.soloOnly) p.set("solo", "1");
  if (c.priceOnly) p.set("price", "1");
  if (c.dateFrom) p.set("from", c.dateFrom);
  if (c.dateTo) p.set("to", c.dateTo);
  if (c.min > 0) p.set("min", String(c.min));
  if (c.max > 0) p.set("max", String(c.max));
  if (c.group) p.set("group", c.group);
  if (c.then) p.set("then", c.then);
  for (const [k, v] of Object.entries(over)) p.set(k, v);
  const query = p.toString();
  return query ? `${action}?${query}` : action;
}

// server/app.ts
var PAGE_SIZE = 30;
var MAX_ROW_FLAGS = 3;
var MAX_GROUPS = 40;
var db = await loadDataset();
console.log(
  `loaded ${db.flagCount} flags across ${db.cases.length} tenders (${db.cases.filter((c) => c.detailed).length} with full cards)`
);
function shortRisk(riskId) {
  return RISK_LABELS[riskId]?.short ?? db.ruleById.get(riskId)?.name ?? riskId;
}
function riskFlag(riskId) {
  return `<a class="flag" href="/?risk=${encodeURIComponent(riskId)}">${esc(shortRisk(riskId))}</a>`;
}
function rowSeverity(entry) {
  if (entry.findings.length > 0) return "high";
  if (entry.bidders === 1 || entry.risks.length >= 3) return "medium";
  return "low";
}
var SEVERITY_TITLE = {
  high: "\u041C\u0438 \u0437\u043D\u0430\u0439\u0448\u043B\u0438 \u0440\u043E\u0437\u0431\u0456\u0436\u043D\u0456\u0441\u0442\u044C \u0443 \u0446\u0456\u043D\u0456",
  medium: "\u0404 \u043D\u0430 \u0449\u043E \u043F\u043E\u0434\u0438\u0432\u0438\u0442\u0438\u0441\u044F: \u0431\u0435\u0437 \u043A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0442\u0456\u0432 \u0430\u0431\u043E \u043A\u0456\u043B\u044C\u043A\u0430 \u043E\u0437\u043D\u0430\u043A",
  low: "\u041F\u043E\u0437\u043D\u0430\u0447\u0435\u043D\u043E \u0434\u0435\u0440\u0436\u0430\u0432\u043E\u044E"
};
function alarms(entry) {
  const out = [];
  for (const finding of entry.findings) out.push(finding.title);
  if (entry.detailed && entry.bidders === 1) out.push("\u0404\u0434\u0438\u043D\u0438\u0439 \u0443\u0447\u0430\u0441\u043D\u0438\u043A");
  if ((entry.value_amount ?? 0) >= 1e9) out.push("\u041F\u043E\u043D\u0430\u0434 \u043C\u0456\u043B\u044C\u044F\u0440\u0434");
  if (entry.risks.length >= 3) out.push(`${entry.risks.length} \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u0438 \u043E\u0434\u0440\u0430\u0437\u0443`);
  return out;
}
var starred = [];
function star(kind, id, back, opts = {}) {
  if (!id) return "";
  const on = isStarred(starred, kind, id);
  const title = on ? "\u041F\u0440\u0438\u0431\u0440\u0430\u0442\u0438 \u0437 \u043E\u0431\u0440\u0430\u043D\u043E\u0433\u043E" : "\u0414\u043E\u0434\u0430\u0442\u0438 \u0434\u043E \u043E\u0431\u0440\u0430\u043D\u043E\u0433\u043E";
  return `<form class="star-form" method="post" action="/starred/toggle">
  <input type="hidden" name="kind" value="${esc(kind)}">
  <input type="hidden" name="id" value="${esc(id)}">
  <input type="hidden" name="back" value="${esc(back)}">
  <button type="submit" class="star${on ? " on" : ""}" title="${title}" aria-label="${title}" aria-pressed="${on}">${on ? "\u2605" : "\u2606"}${opts.label ? `<span>${on ? "\u0412 \u043E\u0431\u0440\u0430\u043D\u043E\u043C\u0443" : "\u0414\u043E \u043E\u0431\u0440\u0430\u043D\u043E\u0433\u043E"}</span>` : ""}</button>
</form>`;
}
function caseRow(entry, opts = {}) {
  const showOfficer = opts.showOfficer ?? true;
  const showEntity = opts.showEntity ?? true;
  const buyer = readableName(entry.entity_name);
  const hasOwnTitle = Boolean(entry.title);
  const title = hasOwnTitle ? trim(entry.title, 110) : buyer || "\u0417\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F";
  const meta = [];
  if (showEntity && buyer && hasOwnTitle) {
    meta.push(`<a href="/entity/${encodeURIComponent(entry.entity_edrpou ?? "")}">${esc(buyer)}</a>`);
  }
  if (entry.region) meta.push(esc(entry.region));
  if (entry.tender_date) meta.push(date(entry.tender_date));
  const people = [];
  if (showOfficer && entry.officer_name) {
    people.push(`\u0432\u0456\u0432(\u043B\u0430) <a href="/officer/${encodeURIComponent(entry.officer_key ?? "")}">${esc(entry.officer_name)}</a>`);
  }
  if (entry.winner_name) {
    people.push(
      `\u0432\u0438\u0433\u0440\u0430\u0432 <a href="/supplier/${encodeURIComponent(entry.winner_edrpou ?? "")}">${esc(readableName(entry.winner_name))}</a>`
    );
  }
  const severity = rowSeverity(entry);
  return `<div class="row sev-${severity}">
  <span class="dot" title="${esc(SEVERITY_TITLE[severity])}" aria-label="${esc(SEVERITY_TITLE[severity])}"></span>
  <div class="who">
    <div class="name">${star("tender", entry.tender_id, "/tender/" + encodeURIComponent(entry.tender_id))}<a href="/tender/${encodeURIComponent(entry.tender_id)}">${esc(title)}</a></div>
    <div class="meta">${meta.join(" \xB7 ")}</div>
    ${people.length ? `<div class="meta">${people.join(" \xB7 ")}</div>` : ""}
  </div>
  <div class="amount">
    <span class="big">${shortMoney(entry.value_amount)}</span>
    <span class="exact">${esc(entry.tender_ref || entry.tender_id)}</span>
  </div>
  <div class="flags">
    ${alarms(entry).map((a) => `<span class="flag alarm">${esc(a)}</span>`).join("")}
    ${entry.risks.slice(0, MAX_ROW_FLAGS).map(riskFlag).join("")}
    ${entry.risks.length > MAX_ROW_FLAGS ? `<a class="flag more" href="/tender/${encodeURIComponent(entry.tender_id)}">\u0449\u0435 ${entry.risks.length - MAX_ROW_FLAGS}</a>` : ""}
  </div>
</div>`;
}
function rankRisks(list) {
  const counts = /* @__PURE__ */ new Map();
  for (const entry of list) for (const r of entry.risks) counts.set(r, (counts.get(r) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}
function riskCard(riskId, count) {
  const rule = db.ruleById.get(riskId);
  const label = RISK_LABELS[riskId];
  const legal = INDICATOR_LEGAL[riskId];
  const stateNorm = rule?.legitimateness?.trim();
  const norm = stateNorm ? `<p class="legal"><strong>\u041D\u043E\u0440\u043C\u0430, \u044F\u043A\u0443 \u043D\u0430\u0432\u043E\u0434\u0438\u0442\u044C \u0434\u0435\u0440\u0436\u0430\u0432\u0430:</strong> ${esc(stateNorm)}</p>` : legal?.norm ? `<p class="legal reading"><strong>\u041D\u043E\u0440\u043C\u0430 \u2014 \u043D\u0430\u0448\u0435 \u0437\u0456\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u043D\u044F:</strong> ${esc(legal.norm)}</p>
  <p class="faint">${esc(legal.normNote ?? "")}</p>` : `<p class="faint">\u0414\u0435\u0440\u0436\u0430\u0432\u0430 \u043D\u0435 \u043D\u0430\u0432\u043E\u0434\u0438\u0442\u044C \u043D\u043E\u0440\u043C\u0443 \u0434\u043B\u044F \u0446\u044C\u043E\u0433\u043E \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u0430, \u0456 \u043C\u0438 \u043D\u0435 \u0431\u0435\u0440\u0435\u043C\u043E\u0441\u044F \u0457\u0457 \u0434\u043E\u0431\u0443\u0434\u0443\u0432\u0430\u0442\u0438.</p>`;
  const criminal = legal?.criminal.length ? `<details class="sub">
  <summary>\u0429\u043E \u0446\u0435 \u043C\u043E\u0436\u0435 \u043E\u0437\u043D\u0430\u0447\u0430\u0442\u0438 \u0437\u0430 \u043A\u0440\u0438\u043C\u0456\u043D\u0430\u043B\u044C\u043D\u0438\u043C \u0437\u0430\u043A\u043E\u043D\u043E\u043C \u2014 ${legal.criminal.length} ${plural(legal.criminal.length, "\u043D\u0430\u043F\u0440\u044F\u043C", "\u043D\u0430\u043F\u0440\u044F\u043C\u0438", "\u043D\u0430\u043F\u0440\u044F\u043C\u0456\u0432")}</summary>
  <div class="inner">
    <p class="faint">\u0426\u0435 \u043D\u0430\u043F\u0440\u044F\u043C\u0438 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u043A\u0438 \u0434\u043B\u044F \u044E\u0440\u0438\u0441\u0442\u0430, \u0430 \u043D\u0435 \u043A\u0432\u0430\u043B\u0456\u0444\u0456\u043A\u0430\u0446\u0456\u044F \u0434\u0456\u0439. \u0423\u043C\u0438\u0441\u0435\u043B \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u044E\u0454 \u043B\u0438\u0448\u0435 \u0441\u0443\u0434.</p>
    ${legal.criminal.map((direction) => {
    const article = ARTICLES[direction.code];
    return `<p><strong>\u0421\u0442\u0430\u0442\u0442\u044F ${esc(direction.code)} \u041A\u041A\u0423 \u2014 ${esc(article?.title ?? "")}</strong><br>${esc(direction.why)}<br><a href="/article/${esc(direction.code)}">\u0423\u0441\u0456 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0437\u0430 \u0446\u0438\u043C \u043D\u0430\u043F\u0440\u044F\u043C\u043E\u043C \u2192</a></p>`;
  }).join("")}
  </div>
</details>` : "";
  return `<div class="card">
  <h3><span class="tier state">\u041F\u043E\u0437\u043D\u0430\u0447\u0438\u043B\u0430 \u0434\u0435\u0440\u0436\u0430\u0432\u0430</span> &nbsp;${esc(label?.short ?? rule?.name ?? riskId)}${count ? ` <span class="faint">\u2014 ${count} ${plural(count, "\u0440\u0430\u0437", "\u0440\u0430\u0437\u0438", "\u0440\u0430\u0437\u0456\u0432")}</span>` : ""}</h3>
  ${label ? `<p class="lead">${esc(label.means)}</p>` : ""}
  ${rule?.name && label ? `<p class="faint"><strong>\u041E\u0444\u0456\u0446\u0456\u0439\u043D\u0435 \u0444\u043E\u0440\u043C\u0443\u043B\u044E\u0432\u0430\u043D\u043D\u044F:</strong> ${esc(rule.name)}</p>` : ""}
  ${norm}
  ${criminal}
  <p class="code">\u0406\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440 ${esc(riskId)} \xB7 \u0434\u0435\u0440\u0436\u0430\u0432\u043D\u0430 \u0441\u0438\u0441\u0442\u0435\u043C\u0430 \u043C\u043E\u043D\u0456\u0442\u043E\u0440\u0438\u043D\u0433\u0443 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C</p>
</div>`;
}
function groupedRiskCards(ranked) {
  const byGroup = /* @__PURE__ */ new Map();
  const ungrouped = [];
  for (const pair of ranked) {
    const group = RISK_LABELS[pair[0]]?.group;
    if (!group) {
      ungrouped.push(pair);
      continue;
    }
    const list = byGroup.get(group) ?? [];
    list.push(pair);
    byGroup.set(group, list);
  }
  const parts = [];
  for (const group of GROUP_ORDER) {
    const list = byGroup.get(group);
    if (!list) continue;
    const total = list.reduce((sum2, [, n]) => sum2 + n, 0);
    parts.push(
      `<div class="group"><h3>${esc(group)}</h3><span class="count">${total} ${plural(total, "\u0441\u043F\u0440\u0430\u0446\u044E\u0432\u0430\u043D\u043D\u044F", "\u0441\u043F\u0440\u0430\u0446\u044E\u0432\u0430\u043D\u043D\u044F", "\u0441\u043F\u0440\u0430\u0446\u044E\u0432\u0430\u043D\u044C")}</span></div>`,
      ...list.map(([riskId, count]) => riskCard(riskId, count))
    );
  }
  parts.push(...ungrouped.map(([riskId, count]) => riskCard(riskId, count)));
  return parts.join("");
}
var HELP = `<details class="help">
  <summary>\u042F\u043A \u0447\u0438\u0442\u0430\u0442\u0438 \u0446\u044E \u0441\u0442\u043E\u0440\u0456\u043D\u043A\u0443</summary>
  <div class="inner">
    <p>\u041A\u043E\u0436\u0435\u043D \u0440\u044F\u0434\u043E\u043A \u2014 \u0446\u0435 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F, \u0443 \u044F\u043A\u0456\u0439 \u0441\u043F\u0440\u0430\u0446\u044E\u0432\u0430\u0432 \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440 \u0434\u0435\u0440\u0436\u0430\u0432\u043D\u043E\u0457 \u0441\u0438\u0441\u0442\u0435\u043C\u0438 \u043C\u043E\u043D\u0456\u0442\u043E\u0440\u0438\u043D\u0433\u0443. \u0414\u0435\u0440\u0436\u0430\u0432\u0430 \u0441\u0430\u043C\u0430 \u043F\u043E\u0437\u043D\u0430\u0447\u0430\u0454 \u0442\u0430\u043A\u0456 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456; \u043C\u0438 \u043B\u0438\u0448\u0435 \u0437\u0431\u0438\u0440\u0430\u0454\u043C\u043E \u043F\u043E\u0437\u043D\u0430\u0447\u043A\u0438 \u043F\u043E ${esc(REGION)} \u0442\u0430 \u0444\u0456\u043B\u0456\u044F\u0445 \u0437\u0430\u043B\u0456\u0437\u043D\u0438\u0446\u0456 \u0439 \u043F\u043E\u043A\u0430\u0437\u0443\u0454\u043C\u043E \u0457\u0445 \u0437\u0440\u043E\u0437\u0443\u043C\u0456\u043B\u043E.</p>
    <p>\u0427\u0435\u0440\u0432\u043E\u043D\u0456 \u043F\u043E\u0437\u043D\u0430\u0447\u043A\u0438 \u2014 \u0442\u0435, \u043D\u0430 \u0449\u043E \u0432\u0430\u0440\u0442\u043E \u0433\u043B\u044F\u043D\u0443\u0442\u0438 \u043F\u0435\u0440\u0448\u0438\u043C: \u0454\u0434\u0438\u043D\u0438\u0439 \u0443\u0447\u0430\u0441\u043D\u0438\u043A \u043D\u0430 \u0432\u0435\u043B\u0438\u043A\u0438\u0445 \u0442\u043E\u0440\u0433\u0430\u0445, \u0441\u0443\u043C\u0430 \u043F\u043E\u043D\u0430\u0434 \u043C\u0456\u043B\u044C\u044F\u0440\u0434, \u043A\u0456\u043B\u044C\u043A\u0430 \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u0456\u0432 \u043E\u0434\u0440\u0430\u0437\u0443.</p>
    <p>\u0421\u0456\u0440\u0456 \u043F\u043E\u0437\u043D\u0430\u0447\u043A\u0438 \u2014 \u0449\u043E \u0441\u0430\u043C\u0435 \u0437\u0430\u043F\u0456\u0434\u043E\u0437\u0440\u0438\u043B\u0430 \u0434\u0435\u0440\u0436\u0430\u0432\u0430. \u041D\u0430\u0442\u0438\u0441\u043D\u0456\u0442\u044C \u043D\u0430 \u0431\u0443\u0434\u044C-\u044F\u043A\u0443, \u0449\u043E\u0431 \u043F\u043E\u0431\u0430\u0447\u0438\u0442\u0438 \u0432\u0441\u0456 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0437 \u0442\u0456\u0454\u044E \u0441\u0430\u043C\u043E\u044E \u043E\u0437\u043D\u0430\u043A\u043E\u044E.</p>
    <p><strong>\u041F\u043E\u0437\u043D\u0430\u0447\u043A\u0430 \u043D\u0435 \u043E\u0437\u043D\u0430\u0447\u0430\u0454, \u0449\u043E \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043E \u043F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F.</strong> \u0426\u0435 \u043F\u0456\u0434\u0441\u0442\u0430\u0432\u0430 \u0432\u0456\u0434\u043A\u0440\u0438\u0442\u0438 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044E \u0439 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u0438\u0442\u0438 \u0457\u0457 \u043B\u044E\u0434\u0438\u043D\u043E\u044E.</p>
  </div>
</details>`;
function presetsFor(action) {
  const base = [
    { label: "\u0423\u0441\u0456", hint: "\u043F\u043E\u0432\u043D\u0438\u0439 \u043F\u0435\u0440\u0435\u043B\u0456\u043A", query: "" },
    { label: "\u0417\u0430\u0432\u0438\u0449\u0435\u043D\u0430 \u0446\u0456\u043D\u0430", hint: "\u043C\u0438 \u043F\u043E\u0440\u0430\u0445\u0443\u0432\u0430\u043B\u0438 \u043F\u0435\u0440\u0435\u043F\u043B\u0430\u0442\u0443", query: "price=1" },
    { label: "\u0411\u0435\u0437 \u043A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0442\u0456\u0432", hint: "\u043F\u043E\u0434\u0430\u0432\u0441\u044F \u043E\u0434\u0438\u043D \u0443\u0447\u0430\u0441\u043D\u0438\u043A", query: "solo=1" },
    { label: "\u0412\u0456\u0434 100 \u043C\u043B\u043D", hint: "\u043D\u0430\u0439\u0431\u0456\u043B\u044C\u0448\u0456 \u0441\u0443\u043C\u0438", query: "min=100000000" },
    { label: "\u041A\u0456\u043B\u044C\u043A\u0430 \u043E\u0437\u043D\u0430\u043A", hint: "\u0441\u043F\u0440\u0430\u0446\u044E\u0432\u0430\u043B\u043E 2 \u0456 \u0431\u0456\u043B\u044C\u0448\u0435", query: "sort=risks" },
    { label: "\u041D\u0430\u0439\u043D\u043E\u0432\u0456\u0448\u0456", hint: "\u0441\u0432\u0456\u0436\u0456 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456", query: "sort=date" }
  ];
  return action === "/prices" ? base.filter((p) => p.query !== "price=1") : base;
}
function presetBar(action, url, c) {
  const current = new URLSearchParams();
  if (c.priceOnly) current.set("price", "1");
  if (c.soloOnly) current.set("solo", "1");
  if (c.min > 0) current.set("min", String(c.min));
  if (c.sort !== "value") current.set("sort", c.sort);
  const currentKey = current.toString();
  return `<div class="presets">
  ${presetsFor(action).map((p) => {
    const active = p.query === currentKey;
    const href = p.query ? `${action}?${p.query}` : action;
    return `<a class="preset${active ? " on" : ""}" href="${esc(href)}" title="${esc(p.hint)}">${esc(p.label)}</a>`;
  }).join("")}
</div>`;
}
function sortBar(action, c, extra = "") {
  const dimensionOptions = (selected, skip) => DIMENSIONS.filter((d) => d.value !== skip || d.value === "").map((d) => `<option value="${d.value}"${d.value === selected ? " selected" : ""}>${esc(d.label)}</option>`).join("");
  const hidden = (name, value) => value ? `<input type="hidden" name="${name}" value="${esc(value)}">` : "";
  return `<form class="sortbar" method="get" action="${esc(action)}">
  <input type="search" name="q" value="${esc(c.q)}" placeholder="\u041F\u043E\u0448\u0443\u043A \u0437\u0430 \u043D\u0430\u0437\u0432\u043E\u044E, \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u043E\u043C, \u0404\u0414\u0420\u041F\u041E\u0423" aria-label="\u041F\u043E\u0448\u0443\u043A">
  ${extra}
  ${hidden("risk", c.risk)}${hidden("region", c.region)}
  ${hidden("from", c.dateFrom)}${hidden("to", c.dateTo)}
  ${hidden("min", c.min > 0 ? String(c.min) : "")}${hidden("max", c.max > 0 ? String(c.max) : "")}
  ${c.railOnly ? '<input type="hidden" name="rail" value="1">' : ""}
  ${c.soloOnly ? '<input type="hidden" name="solo" value="1">' : ""}
  ${c.priceOnly ? '<input type="hidden" name="price" value="1">' : ""}

  <label>\u0421\u043E\u0440\u0442.
    <select name="sort" onchange="this.form.submit()">
      <option value="value"${c.sort === "value" ? " selected" : ""}>\u0437\u0430 \u0441\u0443\u043C\u043E\u044E, \u0441\u043F\u0430\u0434\u0430\u043D\u043D\u044F</option>
      <option value="value-asc"${c.sort === "value-asc" ? " selected" : ""}>\u0437\u0430 \u0441\u0443\u043C\u043E\u044E, \u0437\u0440\u043E\u0441\u0442\u0430\u043D\u043D\u044F</option>
      <option value="date"${c.sort === "date" ? " selected" : ""}>\u043D\u043E\u0432\u0456\u0448\u0456 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456</option>
      <option value="date-asc"${c.sort === "date-asc" ? " selected" : ""}>\u0441\u0442\u0430\u0440\u0456\u0448\u0456 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456</option>
      <option value="assessed"${c.sort === "assessed" ? " selected" : ""}>\u043D\u0435\u0449\u043E\u0434\u0430\u0432\u043D\u043E \u043F\u043E\u0437\u043D\u0430\u0447\u0435\u043D\u0456</option>
      <option value="risks"${c.sort === "risks" ? " selected" : ""}>\u0431\u0456\u043B\u044C\u0448\u0435 \u043E\u0437\u043D\u0430\u043A</option>
    </select>
  </label>

  <label>\u0413\u0440\u0443\u043F\u0438
    <select name="group" onchange="this.form.submit()">${dimensionOptions(c.group)}</select>
  </label>

  ${c.group ? `<label>\u043F\u043E\u0442\u0456\u043C
    <select name="then" onchange="this.form.submit()">${dimensionOptions(c.then, c.group)}</select>
  </label>` : ""}

  <button type="submit" class="go">\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u0438</button>
</form>`;
}
var PRIMER = `<div class="primer">
  <span><b>1</b> \u0434\u0435\u0440\u0436\u0430\u0432\u0430 \u043F\u043E\u0437\u043D\u0430\u0447\u0430\u0454 \u043F\u0456\u0434\u043E\u0437\u0440\u0456\u043B\u0456</span>
  <span><b>2</b> \u043C\u0438 \u043F\u043E\u044F\u0441\u043D\u044E\u0454\u043C\u043E \u0456 \u0440\u0430\u0445\u0443\u0454\u043C\u043E \u0446\u0456\u043D\u0443</span>
  <span><b>3</b> \u0443 \u043A\u043E\u0436\u043D\u0456\u0439 \u2014 \u0432\u0438\u0441\u043D\u043E\u0432\u043E\u043A \u0456 \u0437\u0432\u0456\u0442</span>
  <a href="/about">\u0414\u043E\u043A\u043B\u0430\u0434\u043D\u0456\u0448\u0435</a>
</div>`;
function groupBlock(group, depth) {
  const inner = group.children.length > 0 ? group.children.map((child) => groupBlock(child, depth + 1)).join("") : `<div class="rows">${group.cases.slice(0, 20).map((c) => caseRow(c)).join("")}</div>${group.cases.length > 20 ? `<p class="hint" style="margin:.6rem 0 0">\u041F\u043E\u043A\u0430\u0437\u0430\u043D\u043E 20 \u043D\u0430\u0439\u0434\u043E\u0440\u043E\u0436\u0447\u0438\u0445 \u0456\u0437 ${group.cases.length}.</p>` : ""}`;
  return `<details class="group-block depth-${depth}"${depth === 0 && group.cases.length <= 40 ? " open" : ""}>
  <summary>
    <span class="g-name">${esc(readableName(group.bucket.label))}</span>
    <span class="g-meta">${group.cases.length} ${plural(group.cases.length, "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C")} \xB7 ${shortMoney(group.value)}</span>
  </summary>
  <div class="g-body">
    ${group.bucket.href ? `<p class="hint" style="margin:0 0 .6rem"><a href="${esc(group.bucket.href)}">\u0412\u0456\u0434\u043A\u0440\u0438\u0442\u0438 \u043F\u043E\u0432\u043D\u0435 \u0434\u043E\u0441\u044C\u0454 \u2192</a></p>` : ""}
    ${inner}
  </div>
</details>`;
}
function filterPanel(action, c, opts = {}, extra = "") {
  const dimensionOptions = (selected, skip) => DIMENSIONS.filter((d) => d.value !== skip || d.value === "").map((d) => `<option value="${d.value}"${d.value === selected ? " selected" : ""}>${esc(d.label)}</option>`).join("");
  const stamps = db.cases.map((x) => x.tender_date ?? "").filter(Boolean).sort();
  const earliest = stamps[0] ?? "";
  const latest = stamps[stamps.length - 1] ?? "";
  const regions = [...new Set(db.cases.map((x) => x.region ?? "").filter(Boolean))].sort();
  const amounts = db.cases.map((x) => x.value_amount ?? 0).filter((n) => n > 0);
  const rangeHint = amounts.length ? `\u0443 \u0431\u0430\u0437\u0456 \u0432\u0456\u0434 ${shortMoney(Math.min(...amounts))} \u0434\u043E ${shortMoney(Math.max(...amounts))}` : "";
  const active = activeCount(c);
  const anything = isFiltered(c) || Boolean(c.group);
  return `<form class="filters" method="get" action="${esc(action)}">
  <input type="hidden" name="q" value="${esc(c.q)}">
  ${extra}
  <details class="filters-more"${anything ? " open" : ""}>
    <summary>\u0411\u0456\u043B\u044C\u0448\u0435 \u0444\u0456\u043B\u044C\u0442\u0440\u0456\u0432${active > 0 ? ` <span class="badge">${active}</span>` : ""}${anything ? ` <a class="reset" href="${esc(action)}">\u0441\u043A\u0438\u043D\u0443\u0442\u0438 \u0432\u0441\u0435</a>` : ""}</summary>
    <div class="inner">
      <div class="filter-row">
        <select name="risk" aria-label="\u041E\u0437\u043D\u0430\u043A\u0430">
          <option value="">\u0411\u0443\u0434\u044C-\u044F\u043A\u0430 \u043E\u0437\u043D\u0430\u043A\u0430</option>
          ${db.rules.map(
    (r) => `<option value="${esc(r.risk_id)}"${r.risk_id === c.risk ? " selected" : ""}>${esc(shortRisk(r.risk_id))}</option>`
  ).join("")}
        </select>
        <select name="region" aria-label="\u041E\u0431\u043B\u0430\u0441\u0442\u044C">
          <option value="">\u0423\u0441\u044F \u0423\u043A\u0440\u0430\u0457\u043D\u0430</option>
          ${regions.map((r) => `<option value="${esc(r)}"${r === c.region ? " selected" : ""}>${esc(r)}</option>`).join("")}
        </select>
        <input type="hidden" name="sort" value="${esc(c.sort)}">
        <input type="hidden" name="group" value="${esc(c.group)}">
        <input type="hidden" name="then" value="${esc(c.then)}">
      </div>

      <div class="filter-row">
        <span class="filter-label">\u0414\u0430\u0442\u0430 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456</span>
        <input type="date" name="from" value="${esc(c.dateFrom)}" aria-label="\u0414\u0430\u0442\u0430 \u0432\u0456\u0434" min="${esc(earliest)}" max="${esc(latest)}">
        <span class="filter-label">\u043F\u043E</span>
        <input type="date" name="to" value="${esc(c.dateTo)}" aria-label="\u0414\u0430\u0442\u0430 \u043F\u043E" min="${esc(earliest)}" max="${esc(latest)}">
      </div>

      <div class="filter-row">
        <span class="filter-label">\u0421\u0443\u043C\u0430, \u20B4</span>
        <input type="number" name="min" value="${c.min > 0 ? c.min : ""}" placeholder="\u0432\u0456\u0434" aria-label="\u0421\u0443\u043C\u0430 \u0432\u0456\u0434" min="0" step="100000" class="num">
        <span class="filter-label">\u043F\u043E</span>
        <input type="number" name="max" value="${c.max > 0 ? c.max : ""}" placeholder="\u0434\u043E" aria-label="\u0421\u0443\u043C\u0430 \u0434\u043E" min="0" step="100000" class="num">
        <span class="filter-label faint">${esc(rangeHint)}</span>
      </div>

      <div class="filter-row">
        ${opts.hideRail ? "" : `<label class="check"><input type="checkbox" name="rail" value="1"${c.railOnly ? " checked" : ""}> \u043B\u0438\u0448\u0435 \u0437\u0430\u043B\u0456\u0437\u043D\u0438\u0446\u044F</label>`}
        <label class="check"><input type="checkbox" name="solo" value="1"${c.soloOnly ? " checked" : ""}> \u043B\u0438\u0448\u0435 \u0431\u0435\u0437 \u043A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0442\u0456\u0432</label>
        ${opts.hidePrice ? "" : `<label class="check"><input type="checkbox" name="price" value="1"${c.priceOnly ? " checked" : ""}> \u043B\u0438\u0448\u0435 \u0434\u0435 \u0446\u0456\u043D\u0430 \u0437\u0430\u0432\u0438\u0449\u0435\u043D\u0430</label>`}
        <button type="submit">\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u0438</button>
      </div>
    </div>
  </details>
</form>`;
}
function resultLine(list, c, groupCount) {
  const value = list.reduce((sum2, x) => sum2 + (x.value_amount ?? 0), 0);
  const base = isFiltered(c) ? `\u0417\u043D\u0430\u0439\u0434\u0435\u043D\u043E <strong>${list.length.toLocaleString("uk-UA")}</strong> ${plural(list.length, "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044E", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C")} \u043D\u0430 ${shortMoney(value)}.` : `\u041F\u043E\u043A\u0430\u0437\u0430\u043D\u043E <strong>${list.length.toLocaleString("uk-UA")}</strong> ${plural(list.length, "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044E", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C")} \u043D\u0430 ${shortMoney(value)}.`;
  return `<p class="hint">${base}${c.group ? ` \u0417\u0433\u0440\u0443\u043F\u043E\u0432\u0430\u043D\u043E \u0443 <strong>${groupCount}</strong> ${plural(groupCount, "\u0433\u0440\u0443\u043F\u0443", "\u0433\u0440\u0443\u043F\u0438", "\u0433\u0440\u0443\u043F")}.` : ""}</p>`;
}
function listBody(list, c, action, rowOpts = {}) {
  if (list.length === 0) {
    return '<div class="empty">\u0417\u0430 \u0446\u0438\u043C\u0438 \u0443\u043C\u043E\u0432\u0430\u043C\u0438 \u043D\u0456\u0447\u043E\u0433\u043E \u043D\u0435 \u0437\u043D\u0430\u0439\u0448\u043B\u043E\u0441\u044F. \u0421\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u043F\u0440\u0438\u0431\u0440\u0430\u0442\u0438 \u0447\u0430\u0441\u0442\u0438\u043D\u0443 \u0444\u0456\u043B\u044C\u0442\u0440\u0456\u0432.</div>';
  }
  if (c.group) {
    const groups = buildGroups(list, c.group, c.then, shortRisk);
    const shown = groups.slice(0, MAX_GROUPS);
    const hidden = groups.length - shown.length;
    return `${resultLine(list, c, groups.length)}${shown.map((g) => groupBlock(g, 0)).join("")}${hidden > 0 ? `<p class="note">\u041F\u043E\u043A\u0430\u0437\u0430\u043D\u043E ${MAX_GROUPS} \u043D\u0430\u0439\u0431\u0456\u043B\u044C\u0448\u0438\u0445 ${plural(MAX_GROUPS, "\u0433\u0440\u0443\u043F\u0443", "\u0433\u0440\u0443\u043F\u0438", "\u0433\u0440\u0443\u043F")} \u0456\u0437 ${groups.length.toLocaleString("uk-UA")}. \u0417\u0432\u0443\u0437\u044C\u0442\u0435 \u0432\u0438\u0431\u0456\u0440\u043A\u0443 \u0444\u0456\u043B\u044C\u0442\u0440\u0430\u043C\u0438, \u0449\u043E\u0431 \u043F\u043E\u0431\u0430\u0447\u0438\u0442\u0438 \u0440\u0435\u0448\u0442\u0443.</p>` : ""}`;
  }
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const page2 = Math.min(c.page, pages);
  const slice = list.slice((page2 - 1) * PAGE_SIZE, page2 * PAGE_SIZE);
  return `${resultLine(list, c, 0)}
<div class="rows">${slice.map((x) => caseRow(x, rowOpts)).join("")}</div>
${pages > 1 ? `<div class="pager">
  ${page2 > 1 ? `<a href="${keepControls(action, c, { page: String(page2 - 1) })}">\u2190 \u043F\u043E\u043F\u0435\u0440\u0435\u0434\u043D\u0456</a>` : ""}
  <span>\u0441\u0442\u043E\u0440\u0456\u043D\u043A\u0430 ${page2} \u0437 ${pages}</span>
  ${page2 < pages ? `<a href="${keepControls(action, c, { page: String(page2 + 1) })}">\u043D\u0430\u0441\u0442\u0443\u043F\u043D\u0456 \u2192</a>` : ""}
</div>` : ""}`;
}
function feedPage(url) {
  const c = readControls(url);
  const list = applyControls(db.cases, c, RAILWAY_EDRPOU);
  return layout({
    title: "\u0417\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456",
    nav: "feed",
    body: `
<h1>\u0417\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456, \u044F\u043A\u0456 \u0432\u0430\u0440\u0442\u043E \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u0438\u0442\u0438</h1>
<p class="sub">\u041F\u0443\u0431\u043B\u0456\u0447\u043D\u0456 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0432\u0441\u0456\u0454\u0457 \u0423\u043A\u0440\u0430\u0457\u043D\u0438, \u044F\u043A\u0456 \u0434\u0435\u0440\u0436\u0430\u0432\u0430 \u043F\u043E\u0437\u043D\u0430\u0447\u0438\u043B\u0430 \u044F\u043A \u043F\u0456\u0434\u043E\u0437\u0440\u0456\u043B\u0456.</p>

<p class="statline">
  <b>${db.cases.length.toLocaleString("uk-UA")}</b> \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C \xB7
  <b>${shortMoney(db.totalValue)}</b> \xB7
  <b>${db.flagCount.toLocaleString("uk-UA")}</b> \u043E\u0437\u043D\u0430\u043A \xB7
  <b>${db.findingCount.toLocaleString("uk-UA")}</b> \u043F\u0435\u0440\u0435\u043F\u043B\u0430\u0442
</p>

${PRIMER}

${presetBar("/", url, c)}
${sortBar("/", c)}
${filterPanel("/", c)}

${c.risk ? riskCard(c.risk) : ""}

${listBody(list, c, "/")}

<p class="note">\u041F\u043E\u0437\u043D\u0430\u0447\u043A\u0430 \u043E\u0437\u043D\u0430\u0447\u0430\u0454, \u0449\u043E \u0441\u043F\u0440\u0430\u0446\u044E\u0432\u0430\u0432 \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440 \u0434\u0435\u0440\u0436\u0430\u0432\u043D\u043E\u0457 \u0441\u0438\u0441\u0442\u0435\u043C\u0438 \u043C\u043E\u043D\u0456\u0442\u043E\u0440\u0438\u043D\u0433\u0443 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C. \u0426\u0435 \u043E\u0437\u043D\u0430\u043A\u0430 \u0440\u0438\u0437\u0438\u043A\u0443, \u044F\u043A\u0430 \u043F\u043E\u0442\u0440\u0435\u0431\u0443\u0454 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u043A\u0438, \u0430 \u043D\u0435 \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0439 \u0444\u0430\u043A\u0442 \u043F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F.</p>
`
  });
}
function qualificationBlock(entry) {
  const q = buildQualification(entry, db.ruleById);
  return `<p class="caution">${esc(q.caution)}</p>

<h3 class="block-head">\u041D\u043E\u0440\u043C\u0438, \u044F\u043A\u0456 \u0437\u0430\u0447\u0435\u043F\u043B\u0435\u043D\u0456</h3>
${q.norms.map(
    (n) => `<div class="card">
  <p class="${n.source === "state" ? "legal" : "legal reading"}"><strong>${n.source === "state" ? "\u041D\u043E\u0440\u043C\u0430, \u044F\u043A\u0443 \u043D\u0430\u0432\u043E\u0434\u0438\u0442\u044C \u0434\u0435\u0440\u0436\u0430\u0432\u0430" : "\u041D\u043E\u0440\u043C\u0430 \u2014 \u043D\u0430\u0448\u0435 \u0437\u0456\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u043D\u044F"}:</strong> ${esc(n.norm)}</p>
  ${n.note ? `<p class="faint">${esc(n.note)}</p>` : ""}
  <p class="faint">\u041F\u0456\u0434\u0441\u0442\u0430\u0432\u0430: ${n.from.map((f) => esc(f)).join(" \xB7 ")}</p>
</div>`
  ).join("")}

<h3 class="block-head">\u0429\u043E \u0437 \u0446\u044C\u043E\u0433\u043E \u0432\u0438\u043F\u043B\u0438\u0432\u0430\u0454 \u0437\u0430 \u0437\u0430\u043A\u043E\u043D\u043E\u043C \u043F\u0440\u043E \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456</h3>
${q.consequences.map(
    (c) => `<div class="card">
  <h3>${esc(c.norm)}</h3>
  <p class="lead">${esc(c.effect)}</p>
</div>`
  ).join("")}

<h3 class="block-head">\u0410\u0434\u043C\u0456\u043D\u0456\u0441\u0442\u0440\u0430\u0442\u0438\u0432\u043D\u0430 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u043B\u044C\u043D\u0456\u0441\u0442\u044C</h3>
${q.admin.map(
    (a) => `<div class="card">
  <h3>\u0421\u0442\u0430\u0442\u0442\u044F 164-14 \u041A\u0423\u043F\u0410\u041F, ${esc(a.part)}</h3>
  <p class="lead">${esc(a.conduct)}</p>
  <dl class="facts">
    <dt>\u0421\u0430\u043D\u043A\u0446\u0456\u044F</dt><dd><strong>${esc(a.fine)}</strong> \u043D\u0430 \u0441\u043B\u0443\u0436\u0431\u043E\u0432\u0438\u0445 \u0442\u0430 \u0443\u043F\u043E\u0432\u043D\u043E\u0432\u0430\u0436\u0435\u043D\u0438\u0445 \u043E\u0441\u0456\u0431 \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u0430</dd>
    <dt>\u041F\u0456\u0434\u0441\u0442\u0430\u0432\u0430</dt><dd>${a.from.map((f) => esc(f)).join(" \xB7 ")}</dd>
  </dl>
  <p class="faint">\u0420\u043E\u0437\u043C\u0456\u0440 \u043D\u0430\u0432\u0435\u0434\u0435\u043D\u043E \u0432 \u043D\u0435\u043E\u043F\u043E\u0434\u0430\u0442\u043A\u043E\u0432\u0443\u0432\u0430\u043D\u0438\u0445 \u043C\u0456\u043D\u0456\u043C\u0443\u043C\u0430\u0445 \u0434\u043E\u0445\u043E\u0434\u0456\u0432 \u0433\u0440\u043E\u043C\u0430\u0434\u044F\u043D; \u0434\u043B\u044F \u0448\u0442\u0440\u0430\u0444\u0456\u0432 \u0446\u044F \u043E\u0434\u0438\u043D\u0438\u0446\u044F \u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C 17 \u0433\u0440\u043D.</p>
</div>`
  ).join("")}

<h3 class="block-head">\u041A\u0440\u0438\u043C\u0456\u043D\u0430\u043B\u044C\u043D\u043E-\u043F\u0440\u0430\u0432\u043E\u0432\u0456 \u043D\u0430\u043F\u0440\u044F\u043C\u0438</h3>
<p class="hint">\u0414\u043B\u044F \u043A\u043E\u0436\u043D\u043E\u0433\u043E \u043D\u0430\u043F\u0440\u044F\u043C\u0443 \u2014 \u0449\u043E \u0434\u043E\u0432\u043E\u0434\u0438\u0442\u0438 \u0456 \u044F\u043A\u0438\u043C\u0438 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u043C\u0438.</p>
${q.criminal.map(
    (c) => `<div class="card">
  <h3>\u0421\u0442\u0430\u0442\u0442\u044F ${esc(c.code)} \u041A\u041A\u0423 \u2014 ${esc(c.title)}</h3>
  <p class="lead">${esc(c.summary)}</p>
  <p><strong>\u0427\u043E\u043C\u0443 \u0446\u0435\u0439 \u043D\u0430\u043F\u0440\u044F\u043C \u0432\u0438\u043D\u0438\u043A\u0430\u0454 \u0441\u0430\u043C\u0435 \u0442\u0443\u0442:</strong></p>
  <ul>${c.reasons.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
  <details class="sub">
    <summary>\u0429\u043E \u043C\u0430\u0454 \u0431\u0443\u0442\u0438 \u0434\u043E\u0432\u0435\u0434\u0435\u043D\u043E \u0442\u0430 \u044F\u043A\u0456 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0438 \u0432\u0438\u0442\u0440\u0435\u0431\u0443\u0432\u0430\u0442\u0438</summary>
    <div class="inner">
      <p><strong>\u0421\u043A\u043B\u0430\u0434:</strong></p>
      <ul>${c.elements.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>
      <p><strong>\u0414\u043E\u043A\u0430\u0437\u0438:</strong></p>
      <ul>${c.evidence.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>
    </div>
  </details>
</div>`
  ).join("")}`;
}
function conclusionBlock(entry, sameEntity, sameOfficer, sameWinner) {
  const c = buildConclusion({ entry, sameEntity, sameOfficer, sameWinner });
  const levelLabel = c.level === "high" ? "\u0412\u0438\u0441\u043E\u043A\u0438\u0439 \u043F\u0440\u0456\u043E\u0440\u0438\u0442\u0435\u0442" : c.level === "medium" ? "\u0421\u0435\u0440\u0435\u0434\u043D\u0456\u0439 \u043F\u0440\u0456\u043E\u0440\u0438\u0442\u0435\u0442" : "\u041D\u0438\u0437\u044C\u043A\u0438\u0439 \u043F\u0440\u0456\u043E\u0440\u0438\u0442\u0435\u0442";
  return `<div class="card verdict ${esc(c.level)}">
  <h3><span class="verdict-tag">${esc(levelLabel)}</span> ${esc(c.headline)}</h3>
  ${c.observations.length > 0 ? `<ol class="findings">${c.observations.map(
    (o) => `<li class="w-${esc(o.weight)}">
    <strong>${esc(o.title)}</strong>
    <span>${esc(o.detail)}</span>
  </li>`
  ).join("")}</ol>` : `<p class="lead">\u0414\u0435\u0440\u0436\u0430\u0432\u043D\u0430 \u0441\u0438\u0441\u0442\u0435\u043C\u0430 \u043F\u043E\u0437\u043D\u0430\u0447\u0438\u043B\u0430 \u0446\u044E \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044E, \u0430\u043B\u0435 \u043D\u0430\u0448\u0456 \u0432\u043B\u0430\u0441\u043D\u0456 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u043A\u0438 \u2014 \u0446\u0456\u043D\u0430 \u043F\u0440\u043E\u0442\u0438 \u0440\u0438\u043D\u043A\u0443, \u043A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0446\u0456\u044F, \u043F\u043E\u0432\u0442\u043E\u0440\u044E\u0432\u0430\u043D\u0456\u0441\u0442\u044C \u0437\u0432'\u044F\u0437\u043A\u0456\u0432 \u2014 \u043D\u0456\u0447\u043E\u0433\u043E \u0434\u043E\u0434\u0430\u0442\u043A\u043E\u0432\u043E\u0433\u043E \u043D\u0435 \u043F\u043E\u043A\u0430\u0437\u0430\u043B\u0438.</p>`}
  <p><strong>\u0429\u043E \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u0438\u0442\u0438 \u0434\u0430\u043B\u0456:</strong></p>
  <ul>${c.nextSteps.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
  <p class="faint">\u0426\u0435\u0439 \u0432\u0438\u0441\u043D\u043E\u0432\u043E\u043A \u0441\u043A\u043B\u0430\u043B\u0430 \u0441\u0438\u0441\u0442\u0435\u043C\u0430 \u0437 \u0447\u0438\u0441\u0435\u043B, \u043D\u0430\u0432\u0435\u0434\u0435\u043D\u0438\u0445 \u0432\u0438\u0449\u0435. \u0412\u0456\u043D \u043D\u0435 \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u044E\u0454 \u043F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F \u0456 \u043D\u0435 \u0454 \u043A\u0432\u0430\u043B\u0456\u0444\u0456\u043A\u0430\u0446\u0456\u0454\u044E \u0434\u0456\u0439 \u0431\u0443\u0434\u044C-\u044F\u043A\u043E\u0457 \u043E\u0441\u043E\u0431\u0438.</p>
</div>`;
}
function tenderPage(tenderId) {
  const entry = db.byTender.get(tenderId);
  if (!entry) return notFound();
  const sameEntity = db.cases.filter((c) => c.entity_edrpou && c.entity_edrpou === entry.entity_edrpou);
  const sameOfficer = entry.officer_key ? db.cases.filter((c) => c.officer_key === entry.officer_key) : [];
  const officerValue = sameOfficer.reduce((sum2, c) => sum2 + (c.value_amount ?? 0), 0);
  const sameWinner = entry.winner_edrpou ? db.cases.filter((c) => c.winner_edrpou === entry.winner_edrpou) : [];
  const winnerValue = sameWinner.reduce((sum2, c) => sum2 + (c.winner_amount ?? c.value_amount ?? 0), 0);
  const title = entry.title || readableName(entry.entity_name) || "\u0417\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F";
  const signals = alarms(entry);
  return layout({
    title: entry.tender_ref || entry.tender_id,
    body: `
<a class="back" href="/">\u2190 \u0434\u043E \u043F\u0435\u0440\u0435\u043B\u0456\u043A\u0443 \u0437\u043D\u0430\u0445\u0456\u0434\u043E\u043A</a>
${star("tender", entry.tender_id, "/tender/" + encodeURIComponent(entry.tender_id), { label: true })}
<h1 class="long">${esc(title)}</h1>
<p class="sub">${esc(readableName(entry.entity_name))} \xB7 <span class="ref">${esc(entry.tender_ref || entry.tender_id)}</span></p>

${signals.length ? `<div class="flags" style="margin-bottom:1.25rem">${signals.map((s) => `<span class="flag alarm">${esc(s)}</span>`).join("")}</div>` : ""}

<div class="actions">
  <a class="action primary" href="/tender/${encodeURIComponent(entry.tender_id)}/report">\u0417\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0438\u0442\u0438 \u0437\u0432\u0456\u0442 \u2014 PDF \u0430\u0431\u043E \u0434\u0440\u0443\u043A</a>
  <a class="action" href="/tender/${encodeURIComponent(entry.tender_id)}/report.txt">\u0422\u0435\u043A\u0441\u0442\u043E\u0432\u0438\u043C \u0444\u0430\u0439\u043B\u043E\u043C</a>
  <a class="action" href="https://prozorro.gov.ua/tender/${encodeURIComponent(entry.tender_ref)}" target="_blank" rel="noopener">\u041F\u0435\u0440\u0448\u043E\u0434\u0436\u0435\u0440\u0435\u043B\u043E \u0432 Prozorro</a>
</div>

<div class="card">
  <dl class="facts">
    <dt>\u0421\u0443\u043C\u0430</dt><dd><strong>${money(entry.value_amount)}</strong> <span class="faint">(${shortMoney(entry.value_amount)})</span></dd>
    <dt>\u0417\u0430\u043C\u043E\u0432\u043D\u0438\u043A</dt><dd><a href="/entity/${encodeURIComponent(entry.entity_edrpou ?? "")}">${esc(readableName(entry.entity_name))}</a><br><span class="faint">\u0404\u0414\u0420\u041F\u041E\u0423 ${esc(entry.entity_edrpou ?? "\u2014")}</span></dd>
    <dt>\u0420\u0435\u0433\u0456\u043E\u043D</dt><dd>${esc(entry.region ?? "\u2014")}</dd>
    ${entry.method ? `<dt>\u041F\u0440\u043E\u0446\u0435\u0434\u0443\u0440\u0430</dt><dd>${esc(procedureLabel(entry.method) ?? "\u2014")}</dd>` : ""}
    ${entry.detailed ? `<dt>\u0423\u0447\u0430\u0441\u043D\u0438\u043A\u0456\u0432</dt><dd>${entry.bidders === 1 ? "<strong>\u043E\u0434\u0438\u043D</strong> \u2014 \u043A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0446\u0456\u0457 \u043D\u0435 \u0431\u0443\u043B\u043E" : entry.bidders || "\u2014"}</dd>` : ""}
    <dt>\u0414\u0430\u0442\u0430 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456</dt><dd>${date(entry.tender_date)}</dd>
    <dt>\u041F\u043E\u0437\u043D\u0430\u0447\u0435\u043D\u043E \u0434\u0435\u0440\u0436\u0430\u0432\u043E\u044E</dt><dd>${date(entry.date_assessed)}</dd>
    <dt>\u041F\u0435\u0440\u0448\u043E\u0434\u0436\u0435\u0440\u0435\u043B\u043E</dt><dd><a href="https://prozorro.gov.ua/tender/${encodeURIComponent(entry.tender_ref)}" target="_blank" rel="noopener">\u0412\u0456\u0434\u043A\u0440\u0438\u0442\u0438 \u043A\u0430\u0440\u0442\u043A\u0443 \u0432 Prozorro \u2192</a></dd>
  </dl>
</div>

<h2>\u0425\u0442\u043E \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u0432 \u0437\u0430 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044E</h2>
${entry.officer_name ? `<div class="card">
  <h3><a href="/officer/${encodeURIComponent(entry.officer_key ?? "")}">${esc(entry.officer_name)}</a></h3>
  <p class="lead">\u0426\u044F \u043E\u0441\u043E\u0431\u0430 \u0432\u043A\u0430\u0437\u0430\u043D\u0430 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u043B\u044C\u043D\u043E\u044E \u0449\u0435 \u0443 <strong>${sameOfficer.length}</strong> \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F\u0445 \u0456\u0437 \u043F\u043E\u0437\u043D\u0430\u0447\u043A\u0430\u043C\u0438, \u0440\u0430\u0437\u043E\u043C \u043D\u0430 <strong>${shortMoney(officerValue)}</strong>.</p>
  <dl class="facts">
    <dt>\u041F\u043E\u0448\u0442\u0430</dt><dd>${esc(entry.officer_email ?? "\u2014")}</dd>
    <dt>\u0422\u0435\u043B\u0435\u0444\u043E\u043D</dt><dd>${esc(entry.officer_phone ?? "\u2014")}</dd>
  </dl>
  <p style="margin-top:.9rem"><a href="/officer/${encodeURIComponent(entry.officer_key ?? "")}">\u0412\u0456\u0434\u043A\u0440\u0438\u0442\u0438 \u0434\u043E\u0441\u044C\u0454 \u043F\u043E\u0441\u0430\u0434\u043E\u0432\u0446\u044F \u2192</a></p>
</div>` : `<div class="card"><p>\u041A\u0430\u0440\u0442\u043A\u0443 \u0446\u0456\u0454\u0457 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0449\u0435 \u043D\u0435 \u0437\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0435\u043D\u043E, \u0442\u043E\u043C\u0443 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u043B\u044C\u043D\u0430 \u043E\u0441\u043E\u0431\u0430 \u043D\u0435\u0432\u0456\u0434\u043E\u043C\u0430.</p></div>`}

<h2>\u0425\u0442\u043E \u0432\u0438\u0433\u0440\u0430\u0432</h2>
${entry.winner_name ? `<div class="card">
  <h3><a href="/supplier/${encodeURIComponent(entry.winner_edrpou ?? "")}">${esc(readableName(entry.winner_name))}</a></h3>
  <p class="lead">\u0426\u044F \u043A\u043E\u043C\u043F\u0430\u043D\u0456\u044F \u043F\u0435\u0440\u0435\u043C\u043E\u0433\u043B\u0430 \u0449\u0435 \u0443 <strong>${sameWinner.length}</strong> \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F\u0445 \u0456\u0437 \u043F\u043E\u0437\u043D\u0430\u0447\u043A\u0430\u043C\u0438, \u0440\u0430\u0437\u043E\u043C \u043D\u0430 <strong>${shortMoney(winnerValue)}</strong>.</p>
  <dl class="facts">
    <dt>\u0404\u0414\u0420\u041F\u041E\u0423</dt><dd>${esc(entry.winner_edrpou ?? "\u2014")}</dd>
    <dt>\u0421\u0443\u043C\u0430 \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0443</dt><dd>${money(entry.winner_amount)}</dd>
  </dl>
</div>` : `<div class="card"><p>\u041F\u0435\u0440\u0435\u043C\u043E\u0436\u0446\u044F \u043D\u0435 \u0432\u0438\u0437\u043D\u0430\u0447\u0435\u043D\u043E \u0430\u0431\u043E \u043A\u0430\u0440\u0442\u043A\u0443 \u0449\u0435 \u043D\u0435 \u0437\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0435\u043D\u043E.</p></div>`}

${entry.findings.length ? `<h2>\u0421\u043A\u0456\u043B\u044C\u043A\u0438 \u0446\u0435 \u043A\u043E\u0448\u0442\u0443\u0454 \u0432 \u0456\u043D\u0448\u0438\u0445</h2>
<p class="hint">\u0420\u0430\u0445\u0443\u0432\u0430\u043B\u0430 \u0441\u0438\u0441\u0442\u0435\u043C\u0430, \u043D\u0435 \u0434\u0435\u0440\u0436\u0430\u0432\u0430. \u041D\u0438\u0436\u0447\u0435 \u2014 \u0447\u0438\u0441\u043B\u0430.</p>
${entry.findings.map((f) => {
      const e = f.evidence;
      const rows = Object.entries({
        "\u0426\u0456\u043D\u0430 \u0437\u0430 \u043E\u0434\u0438\u043D\u0438\u0446\u044E": typeof e.unit_price === "number" ? `${unitMoney(e.unit_price)}` : null,
        "\u0422\u0438\u043F\u043E\u0432\u0430 \u0446\u0456\u043D\u0430 (\u043C\u0435\u0434\u0456\u0430\u043D\u0430)": typeof e.peer_median === "number" ? `${unitMoney(e.peer_median)}` : null,
        "\u0421\u0435\u0440\u0435\u0434\u043D\u044F \u043F\u043E\u043B\u043E\u0432\u0438\u043D\u0430 \u0446\u0456\u043D": typeof e.peer_p25 === "number" && typeof e.peer_p75 === "number" ? `${unitMoney(e.peer_p25)} \u2014 ${unitMoney(e.peer_p75)}` : null,
        "\u041F\u043E\u0440\u0456\u0432\u043D\u044F\u043D\u043E \u0456\u0437 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F\u043C\u0438": typeof e.peer_count === "number" ? String(e.peer_count) : null,
        "\u041F\u043E\u043F\u0435\u0440\u0435\u0434\u043D\u044F \u0446\u0456\u043D\u0430 \u0446\u044C\u043E\u0433\u043E \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u0430": typeof e.previous_price === "number" ? `${unitMoney(e.previous_price)}` : null,
        "\u0417\u0440\u043E\u0441\u0442\u0430\u043D\u043D\u044F": typeof e.growth === "number" ? `${Math.round(e.growth * 100)}%` : null,
        "\u041A\u0456\u043B\u044C\u043A\u0456\u0441\u0442\u044C": typeof e.quantity === "number" ? `${e.quantity.toLocaleString("uk-UA")} ${esc(String(e.unit_code ?? ""))}` : null,
        "\u0420\u0456\u0437\u043D\u0438\u0446\u044F \u043D\u0430 \u0432\u0441\u044E \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044E": typeof e.overpayment === "number" ? money(e.overpayment) : typeof e.extra_cost === "number" ? money(e.extra_cost) : null,
        "\u0420\u043E\u0437\u0440\u0430\u0445\u0443\u043D\u043E\u043A \u0432\u0456\u0434": e.basis === "award" ? "\u0441\u0443\u043C\u0438 \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0443" : e.basis === "expected" ? "\u043E\u0447\u0456\u043A\u0443\u0432\u0430\u043D\u043E\u0457 \u0432\u0430\u0440\u0442\u043E\u0441\u0442\u0456" : null
      }).filter(([, v]) => v !== null);
      return `<div class="card">
  <h3><span class="tier own">\u041F\u043E\u0440\u0430\u0445\u0443\u0432\u0430\u043B\u0438 \u043C\u0438</span> &nbsp;${esc(f.title)}</h3>
  <p class="lead">${esc(f.explanation)}</p>
  <dl class="facts">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join("")}</dl>
</div>`;
    }).join("")}` : ""}

<h2>\u0429\u043E \u0442\u0443\u0442 \u043D\u0435 \u0442\u0430\u043A</h2>
<p class="hint">\u0421\u043F\u0440\u0430\u0446\u044E\u0432\u0430\u043B\u043E ${entry.risks.length} ${plural(entry.risks.length, "\u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440", "\u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u0438", "\u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u0456\u0432")} \u0456\u0437 \u0447\u043E\u0442\u0438\u0440\u043D\u0430\u0434\u0446\u044F\u0442\u0438 \u0447\u0438\u043D\u043D\u0438\u0445.</p>
${entry.risks.map((r) => riskCard(r)).join("")}

<h2>\u041F\u0440\u0430\u0432\u043E\u0432\u0430 \u043A\u0432\u0430\u043B\u0456\u0444\u0456\u043A\u0430\u0446\u0456\u044F</h2>
${qualificationBlock(entry)}

<h2>\u041D\u0430\u0448 \u0432\u0438\u0441\u043D\u043E\u0432\u043E\u043A</h2>
${conclusionBlock(entry, sameEntity, sameOfficer, sameWinner)}

<h2>\u0426\u0435\u0439 \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A \u0437\u0430\u0433\u0430\u043B\u043E\u043C</h2>
<div class="card">
  <p class="lead">\u0417\u0430 ${esc(readableName(entry.entity_name))} \u043E\u0431\u043B\u0456\u043A\u043E\u0432\u0430\u043D\u043E <strong>${sameEntity.length}</strong> \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C \u0456\u0437 \u043F\u043E\u0437\u043D\u0430\u0447\u043A\u0430\u043C\u0438.</p>
  <p><a href="/entity/${encodeURIComponent(entry.entity_edrpou ?? "")}">\u0412\u0456\u0434\u043A\u0440\u0438\u0442\u0438 \u0434\u043E\u0441\u044C\u0454 \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u0430 \u2192</a></p>
</div>

<p class="note">\u041D\u0430\u044F\u0432\u043D\u0456\u0441\u0442\u044C \u043F\u043E\u0437\u043D\u0430\u0447\u043A\u0438 \u043D\u0435 \u043E\u0437\u043D\u0430\u0447\u0430\u0454, \u0449\u043E \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043E \u043F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F, \u0456 \u043D\u0435 \u0454 \u0437\u0432\u0438\u043D\u0443\u0432\u0430\u0447\u0435\u043D\u043D\u044F\u043C \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0445 \u043E\u0441\u0456\u0431. \u0426\u0435 \u043F\u0456\u0434\u0441\u0442\u0430\u0432\u0430 \u0434\u043B\u044F \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u043A\u0438 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u043B\u044E\u0434\u0438\u043D\u043E\u044E.</p>
`
  });
}
function officerPage(key, url) {
  const dossierAction = `/officer/${encodeURIComponent(key)}`;
  const list = db.cases.filter((c) => c.officer_key === key);
  if (list.length === 0) return notFound();
  const name = list.find((c) => c.officer_name)?.officer_name ?? key;
  const email = list.find((c) => c.officer_email)?.officer_email ?? null;
  const phone = list.find((c) => c.officer_phone)?.officer_phone ?? null;
  const entity = list.find((c) => c.entity_name)?.entity_name ?? null;
  const entityEdrpou = list.find((c) => c.entity_edrpou)?.entity_edrpou ?? "";
  const value = list.reduce((sum2, c) => sum2 + (c.value_amount ?? 0), 0);
  const solo = list.filter((c) => c.bidders === 1).length;
  const ranked = rankRisks(list);
  const ctrl = readControls(url);
  const shown = applyControls(list, ctrl, RAILWAY_EDRPOU);
  return layout({
    title: name,
    nav: "officers",
    body: `
<a class="back" href="/officers">\u2190 \u0434\u043E \u043F\u0435\u0440\u0435\u043B\u0456\u043A\u0443 \u043F\u043E\u0441\u0430\u0434\u043E\u0432\u0446\u0456\u0432</a>
${star("officer", key, "/officer/" + encodeURIComponent(key), { label: true })}
<h1>${esc(name)}</h1>
<p class="sub">\u0412\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u043B\u044C\u043D\u0430 \u043E\u0441\u043E\u0431\u0430 \u0432 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F\u0445${entity ? ` \u2014 ${esc(readableName(entity))}` : ""}.</p>

<p class="statline">
  <b>${list.length}</b> \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C \u043F\u0456\u0434 \u043F\u0438\u0442\u0430\u043D\u043D\u044F\u043C \xB7
  <b>${shortMoney(value)}</b> \u0437\u0430\u0433\u0430\u043B\u044C\u043D\u0430 \u0441\u0443\u043C\u0430 \xB7
  <b>${solo}</b> \u0437 \u0454\u0434\u0438\u043D\u0438\u043C \u0443\u0447\u0430\u0441\u043D\u0438\u043A\u043E\u043C \xB7
  <b>${ranked.length}</b> \u0440\u0456\u0437\u043D\u0438\u0445 \u043E\u0437\u043D\u0430\u043A
</p>

<div class="card">
  <dl class="facts">
    <dt>\u041F\u043E\u0448\u0442\u0430</dt><dd>${esc(email ?? "\u2014")}</dd>
    <dt>\u0422\u0435\u043B\u0435\u0444\u043E\u043D</dt><dd>${esc(phone ?? "\u2014")}</dd>
    <dt>\u0423\u0441\u0442\u0430\u043D\u043E\u0432\u0430</dt><dd><a href="/entity/${encodeURIComponent(entityEdrpou)}">${esc(readableName(entity))}</a></dd>
  </dl>
  <p class="faint" style="margin-top:.9rem">\u0414\u0430\u043D\u0456 \u0432\u0437\u044F\u0442\u043E \u0437 \u043A\u0430\u0440\u0442\u043E\u043A \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C \u0443 Prozorro, \u0434\u0435 \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A \u0441\u0430\u043C \u043F\u0443\u0431\u043B\u0456\u043A\u0443\u0454 \u043A\u043E\u043D\u0442\u0430\u043A\u0442\u043D\u0443 \u043E\u0441\u043E\u0431\u0443. \u041E\u0434\u043D\u0443 \u043B\u044E\u0434\u0438\u043D\u0443 \u043C\u0456\u0436 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F\u043C\u0438 \u0437\u0456\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u043E \u0437\u0430 \u043F\u043E\u0448\u0442\u043E\u044E \u2014 \u0432\u043E\u043D\u0430 \u0441\u0442\u0430\u0431\u0456\u043B\u044C\u043D\u0456\u0448\u0430 \u0437\u0430 \u043D\u0430\u043F\u0438\u0441\u0430\u043D\u043D\u044F \u0456\u043C\u0435\u043D\u0456.</p>
</div>

<h2>\u0429\u043E \u0434\u0435\u0440\u0436\u0430\u0432\u0430 \u0437\u0430\u043F\u0456\u0434\u043E\u0437\u0440\u0438\u043B\u0430 \u0432 \u0457\u0457 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F\u0445</h2>
<p class="hint">\u041F\u0435\u0440\u0435\u043B\u0456\u043A \u043E\u0437\u043D\u0430\u043A, \u0449\u043E \u0441\u043F\u0440\u0430\u0446\u044E\u0432\u0430\u043B\u0438. <strong>\u041D\u0435 \u0441\u0443\u0434\u0438\u043C\u0456\u0441\u0442\u044C \u0456 \u043D\u0435 \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0430 \u0432\u0438\u043D\u0430.</strong></p>
${groupedRiskCards(ranked)}

<h2>\u0417\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456</h2>
${sortBar(dossierAction, ctrl)}
${filterPanel(dossierAction, ctrl)}
${listBody(shown, ctrl, dossierAction, { showOfficer: false })}

<p class="note">\u0426\u044F \u0441\u0442\u043E\u0440\u0456\u043D\u043A\u0430 \u043D\u0435 \u0454 \u0442\u0432\u0435\u0440\u0434\u0436\u0435\u043D\u043D\u044F\u043C \u043F\u0440\u043E \u043F\u0440\u0430\u0432\u043E\u043F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F \u0437 \u0431\u043E\u043A\u0443 \u043D\u0430\u0437\u0432\u0430\u043D\u043E\u0457 \u043E\u0441\u043E\u0431\u0438. \u0412\u043E\u043D\u0430 \u043F\u043E\u043A\u0430\u0437\u0443\u0454, \u0449\u043E \u0434\u0435\u0440\u0436\u0430\u0432\u043D\u0430 \u0441\u0438\u0441\u0442\u0435\u043C\u0430 \u043C\u043E\u043D\u0456\u0442\u043E\u0440\u0438\u043D\u0433\u0443 \u043F\u043E\u0437\u043D\u0430\u0447\u0438\u043B\u0430 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456, \u0443 \u044F\u043A\u0438\u0445 \u0446\u044E \u043E\u0441\u043E\u0431\u0443 \u0432\u043A\u0430\u0437\u0430\u043D\u043E \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u043B\u044C\u043D\u043E\u044E \u043A\u043E\u043D\u0442\u0430\u043A\u0442\u043D\u043E\u044E \u043E\u0441\u043E\u0431\u043E\u044E.</p>
`
  });
}
function supplierPage(edrpou, url) {
  const dossierAction = `/supplier/${encodeURIComponent(edrpou)}`;
  const list = db.cases.filter((c) => c.winner_edrpou === edrpou);
  if (list.length === 0) return notFound();
  const name = list.find((c) => c.winner_name)?.winner_name ?? edrpou;
  const value = list.reduce((sum2, c) => sum2 + (c.winner_amount ?? c.value_amount ?? 0), 0);
  const ranked = rankRisks(list);
  const buyers = new Set(list.map((c) => c.entity_edrpou).filter(Boolean));
  const solo = list.filter((c) => c.bidders === 1).length;
  const ctrl = readControls(url);
  const shown = applyControls(list, ctrl, RAILWAY_EDRPOU);
  return layout({
    title: name,
    nav: "suppliers",
    body: `
<a class="back" href="/suppliers">\u2190 \u0434\u043E \u043F\u0435\u0440\u0435\u043B\u0456\u043A\u0443 \u043F\u0435\u0440\u0435\u043C\u043E\u0436\u0446\u0456\u0432</a>
<h1>${esc(readableName(name))}</h1>
<p class="sub">\u041F\u043E\u0441\u0442\u0430\u0447\u0430\u043B\u044C\u043D\u0438\u043A \xB7 \u0404\u0414\u0420\u041F\u041E\u0423 ${esc(edrpou)}</p>
${star("supplier", edrpou, "/supplier/" + encodeURIComponent(edrpou), { label: true })}

<p class="statline">
  <b>${list.length}</b> \u043F\u0435\u0440\u0435\u043C\u043E\u0433 \u0443 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F\u0445 \u0456\u0437 \u043F\u043E\u0437\u043D\u0430\u0447\u043A\u0430\u043C\u0438 \xB7
  <b>${shortMoney(value)}</b> \u0441\u0443\u043C\u0430 \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0456\u0432 \xB7
  <b>${solo}</b> \u0434\u0435 \u0431\u0443\u0432 \u0454\u0434\u0438\u043D\u0438\u043C \u0443\u0447\u0430\u0441\u043D\u0438\u043A\u043E\u043C \xB7
  <b>${buyers.size}</b> \u0440\u0456\u0437\u043D\u0438\u0445 \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u0456\u0432
</p>

<h2>\u0429\u043E \u0434\u0435\u0440\u0436\u0430\u0432\u0430 \u0437\u0430\u043F\u0456\u0434\u043E\u0437\u0440\u0438\u043B\u0430 \u0432 \u0446\u0438\u0445 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F\u0445</h2>
${groupedRiskCards(ranked)}

<h2>\u0417\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456</h2>
${sortBar(dossierAction, ctrl)}
${filterPanel(dossierAction, ctrl)}
${listBody(shown, ctrl, dossierAction)}

<p class="note">\u041F\u0435\u0440\u0435\u043B\u0456\u043A \u043E\u0445\u043E\u043F\u043B\u044E\u0454 \u043B\u0438\u0448\u0435 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 ${esc(REGION)} \u0442\u0430 \u0444\u0456\u043B\u0456\u0439 \u0437\u0430\u043B\u0456\u0437\u043D\u0438\u0446\u0456, \u044F\u043A\u0456 \u0432\u0436\u0435 \u0437\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0435\u043D\u043E. \u0426\u0435 \u043D\u0435 \u043F\u043E\u0432\u043D\u0430 \u0456\u0441\u0442\u043E\u0440\u0456\u044F \u043A\u043E\u043C\u043F\u0430\u043D\u0456\u0457 \u043F\u043E \u0423\u043A\u0440\u0430\u0457\u043D\u0456.</p>
`
  });
}
function entityPage(edrpou, url) {
  const dossierAction = `/entity/${encodeURIComponent(edrpou)}`;
  const list = db.cases.filter((c) => c.entity_edrpou === edrpou);
  if (list.length === 0) return notFound();
  const name = list.find((c) => c.entity_name)?.entity_name ?? edrpou;
  const value = list.reduce((sum2, c) => sum2 + (c.value_amount ?? 0), 0);
  const solo = list.filter((c) => c.bidders === 1).length;
  const ranked = rankRisks(list);
  const ctrl = readControls(url);
  const shown = applyControls(list, ctrl, RAILWAY_EDRPOU);
  const officers = /* @__PURE__ */ new Map();
  for (const entry of list) {
    if (!entry.officer_key) continue;
    const acc = officers.get(entry.officer_key) ?? { name: entry.officer_name ?? entry.officer_key, count: 0, value: 0 };
    acc.count++;
    acc.value += entry.value_amount ?? 0;
    officers.set(entry.officer_key, acc);
  }
  const rankedOfficers = [...officers.entries()].sort((a, b) => b[1].value - a[1].value);
  return layout({
    title: name,
    nav: "entities",
    body: `
<a class="back" href="/entities">\u2190 \u0434\u043E \u043F\u0435\u0440\u0435\u043B\u0456\u043A\u0443 \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u0456\u0432</a>
<h1 class="long">${esc(readableName(name))}</h1>
<p class="sub">\u0404\u0414\u0420\u041F\u041E\u0423 ${esc(edrpou)}${RAILWAY_EDRPOU.has(edrpou) ? " \xB7 \u0444\u0456\u043B\u0456\u044F \u0410\u0422 \xAB\u0423\u043A\u0440\u0430\u0457\u043D\u0441\u044C\u043A\u0430 \u0437\u0430\u043B\u0456\u0437\u043D\u0438\u0446\u044F\xBB" : ""}</p>
${star("entity", edrpou, "/entity/" + encodeURIComponent(edrpou), { label: true })}

<p class="statline">
  <b>${list.length}</b> \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C \u043F\u0456\u0434 \u043F\u0438\u0442\u0430\u043D\u043D\u044F\u043C \xB7
  <b>${shortMoney(value)}</b> \u0437\u0430\u0433\u0430\u043B\u044C\u043D\u0430 \u0441\u0443\u043C\u0430 \xB7
  <b>${solo}</b> \u0437 \u0454\u0434\u0438\u043D\u0438\u043C \u0443\u0447\u0430\u0441\u043D\u0438\u043A\u043E\u043C \xB7
  <b>${rankedOfficers.length}</b> \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u043B\u044C\u043D\u0438\u0445 \u043E\u0441\u0456\u0431
</p>

${rankedOfficers.length > 0 ? `<h2>\u0425\u0442\u043E \u0432\u0456\u0432 \u0446\u0456 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456</h2>
<div class="rows">
${rankedOfficers.map(
      ([key, acc]) => `<div class="row">
  <div class="who">
    <div class="name"><a href="/officer/${encodeURIComponent(key)}">${esc(acc.name)}</a></div>
    <div class="meta">${acc.count} ${plural(acc.count, "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C")} \u0456\u0437 \u043F\u043E\u0437\u043D\u0430\u0447\u043A\u0430\u043C\u0438</div>
  </div>
  <div class="amount"><span class="big">${shortMoney(acc.value)}</span></div>
</div>`
    ).join("")}
</div>` : ""}

<h2>\u0429\u043E \u0434\u0435\u0440\u0436\u0430\u0432\u0430 \u0437\u0430\u043F\u0456\u0434\u043E\u0437\u0440\u0438\u043B\u0430</h2>
${groupedRiskCards(ranked)}

<h2>\u0417\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456</h2>
${sortBar(dossierAction, ctrl)}
${filterPanel(dossierAction, ctrl)}
${listBody(shown, ctrl, dossierAction, { showEntity: false })}
`
  });
}
var DIR_SORTS = [
  { value: "value", label: "\u0437\u0430 \u0441\u0443\u043C\u043E\u044E, \u0441\u043F\u0430\u0434\u0430\u043D\u043D\u044F" },
  { value: "value-asc", label: "\u0437\u0430 \u0441\u0443\u043C\u043E\u044E, \u0437\u0440\u043E\u0441\u0442\u0430\u043D\u043D\u044F" },
  { value: "count", label: "\u0437\u0430 \u043A\u0456\u043B\u044C\u043A\u0456\u0441\u0442\u044E \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C" },
  { value: "name", label: "\u0437\u0430 \u043D\u0430\u0437\u0432\u043E\u044E, \u0410\u2013\u042F" }
];
function readDirControls(url) {
  const sort = url.searchParams.get("sort") ?? "";
  return {
    q: (url.searchParams.get("q") ?? "").trim().slice(0, 80),
    sort: DIR_SORTS.some((x) => x.value === sort) ? sort : "value"
  };
}
function applyDirControls(rows, c) {
  const needle = c.q.toLowerCase();
  const kept = needle ? rows.filter((r) => `${r.name} ${r.meta}`.toLowerCase().includes(needle)) : rows;
  const out = [...kept];
  switch (c.sort) {
    case "value-asc":
      out.sort((a, b) => a.value - b.value);
      break;
    case "count":
      out.sort((a, b) => b.count - a.count || b.value - a.value);
      break;
    case "name":
      out.sort((a, b) => a.name.localeCompare(b.name, "uk"));
      break;
    default:
      out.sort((a, b) => b.value - a.value);
  }
  return out;
}
function dirBar(action, c) {
  const dirty = c.q !== "" || c.sort !== "value";
  return `<form class="sortbar dir" method="get" action="${esc(action)}">
  <input type="search" name="q" value="${esc(c.q)}" placeholder="\u041D\u0430\u0437\u0432\u0430 \u0430\u0431\u043E \u0404\u0414\u0420\u041F\u041E\u0423" aria-label="\u041F\u043E\u0448\u0443\u043A">
  <button class="go" type="submit">\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u0438</button>
  <label>\u0421\u043E\u0440\u0442.
    <select name="sort" onchange="this.form.submit()">${DIR_SORTS.map(
    (x) => `<option value="${x.value}"${x.value === c.sort ? " selected" : ""}>${esc(x.label)}</option>`
  ).join("")}</select>
  </label>
  ${dirty ? `<a class="reset" href="${esc(action)}">\u0441\u043A\u0438\u043D\u0443\u0442\u0438</a>` : ""}
</form>`;
}
function directoryPage(opts) {
  const c = readDirControls(opts.url);
  const rows = applyDirControls(opts.rows, c);
  const total = rows.reduce((sum2, r) => sum2 + r.value, 0);
  return layout({
    title: opts.title,
    nav: opts.nav,
    body: `
<h1>${esc(opts.heading)}</h1>
<p class="sub">${opts.intro}</p>
${dirBar(opts.action, c)}
<p class="hint">${c.q ? "\u0417\u043D\u0430\u0439\u0434\u0435\u043D\u043E" : "\u041F\u043E\u043A\u0430\u0437\u0430\u043D\u043E"} <strong>${rows.length.toLocaleString("uk-UA")}</strong> \u043D\u0430 ${shortMoney(total)}.</p>
${rows.length === 0 ? '<div class="empty">\u0417\u0430 \u0446\u0438\u043C \u0437\u0430\u043F\u0438\u0442\u043E\u043C \u043D\u0456\u0447\u043E\u0433\u043E \u043D\u0435 \u0437\u043D\u0430\u0439\u0448\u043B\u043E\u0441\u044F.</div>' : `<div class="rows">
${rows.slice(0, 150).map(
      (r) => `<div class="row">
  <div class="who">
    <div class="name">${r.kind && r.id ? star(r.kind, r.id, r.href) : ""}<a href="${esc(r.href)}">${esc(r.name)}</a></div>
    <div class="meta">${r.meta}</div>
  </div>
  <div class="amount"><span class="big">${shortMoney(r.value)}</span></div>
</div>`
    ).join("")}
</div>`}
${rows.length > 150 ? `<p class="note">\u041F\u043E\u043A\u0430\u0437\u0430\u043D\u043E \u043F\u0435\u0440\u0448\u0456 150 \u0456\u0437 ${rows.length.toLocaleString("uk-UA")}. \u0417\u0432\u0443\u0437\u044C\u0442\u0435 \u043F\u043E\u0448\u0443\u043A\u043E\u043C, \u0449\u043E\u0431 \u043F\u043E\u0431\u0430\u0447\u0438\u0442\u0438 \u0440\u0435\u0448\u0442\u0443.</p>` : ""}
`
  });
}
function entitiesPage(url) {
  const byEntity = /* @__PURE__ */ new Map();
  for (const entry of db.cases) {
    const key = entry.entity_edrpou ?? "";
    if (!key) continue;
    const acc = byEntity.get(key) ?? { name: entry.entity_name ?? key, count: 0, value: 0 };
    acc.count++;
    acc.value += entry.value_amount ?? 0;
    byEntity.set(key, acc);
  }
  return directoryPage({
    title: "\u0417\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u0438",
    nav: "entities",
    heading: "\u0417\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u0438",
    intro: "\u0423\u0441\u0442\u0430\u043D\u043E\u0432\u0438, \u0443 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F\u0445 \u044F\u043A\u0438\u0445 \u0441\u043F\u0440\u0430\u0446\u044E\u0432\u0430\u043B\u0438 \u0434\u0435\u0440\u0436\u0430\u0432\u043D\u0456 \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u0438.",
    action: "/entities",
    url,
    rows: [...byEntity.entries()].map(([edrpou, acc]) => ({
      kind: "entity",
      id: edrpou,
      href: `/entity/${encodeURIComponent(edrpou)}`,
      name: readableName(acc.name),
      meta: `\u0404\u0414\u0420\u041F\u041E\u0423 ${esc(edrpou)} \xB7 ${acc.count} ${plural(acc.count, "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C")}${RAILWAY_EDRPOU.has(edrpou) ? " \xB7 \u0437\u0430\u043B\u0456\u0437\u043D\u0438\u0446\u044F" : ""}`,
      value: acc.value,
      count: acc.count
    }))
  });
}
function officersPage(url) {
  const byOfficer = /* @__PURE__ */ new Map();
  for (const entry of db.cases) {
    if (!entry.officer_key) continue;
    const acc = byOfficer.get(entry.officer_key) ?? {
      name: entry.officer_name ?? entry.officer_key,
      entity: entry.entity_name ?? "",
      count: 0,
      value: 0
    };
    acc.count++;
    acc.value += entry.value_amount ?? 0;
    byOfficer.set(entry.officer_key, acc);
  }
  return directoryPage({
    title: "\u041F\u043E\u0441\u0430\u0434\u043E\u0432\u0446\u0456",
    nav: "officers",
    heading: "\u0412\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u043B\u044C\u043D\u0456 \u043F\u043E\u0441\u0430\u0434\u043E\u0432\u0446\u0456",
    intro: "\u041A\u043E\u043D\u0442\u0430\u043A\u0442\u043D\u0456 \u043E\u0441\u043E\u0431\u0438 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C \u0456\u0437 \u043F\u043E\u0437\u043D\u0430\u0447\u043A\u0430\u043C\u0438. \u041D\u0435 \u043F\u0435\u0440\u0435\u043B\u0456\u043A \u043F\u0456\u0434\u043E\u0437\u0440\u044E\u0432\u0430\u043D\u0438\u0445 \u2014 \u043F\u0435\u0440\u0435\u043B\u0456\u043A \u0442\u043E\u0433\u043E, \u0449\u043E \u0432\u0430\u0440\u0442\u043E \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u0438\u0442\u0438.",
    action: "/officers",
    url,
    rows: [...byOfficer.entries()].map(([key, acc]) => ({
      kind: "officer",
      id: key,
      href: `/officer/${encodeURIComponent(key)}`,
      name: acc.name,
      meta: `${esc(readableName(acc.entity))} \xB7 ${acc.count} ${plural(acc.count, "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C")}`,
      value: acc.value,
      count: acc.count
    }))
  });
}
function suppliersPage(url) {
  const bySupplier = /* @__PURE__ */ new Map();
  for (const entry of db.cases) {
    const key = entry.winner_edrpou ?? "";
    if (!key) continue;
    const acc = bySupplier.get(key) ?? { name: entry.winner_name ?? key, count: 0, value: 0, solo: 0 };
    acc.count++;
    acc.value += entry.winner_amount ?? entry.value_amount ?? 0;
    if (entry.bidders === 1) acc.solo++;
    bySupplier.set(key, acc);
  }
  return directoryPage({
    title: "\u041F\u0435\u0440\u0435\u043C\u043E\u0436\u0446\u0456",
    nav: "suppliers",
    heading: "\u041F\u0435\u0440\u0435\u043C\u043E\u0436\u0446\u0456 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C",
    intro: "\u041A\u043E\u043C\u043F\u0430\u043D\u0456\u0457, \u044F\u043A\u0456 \u0432\u0438\u0433\u0440\u0430\u043B\u0438 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0437 \u043F\u043E\u0437\u043D\u0430\u0447\u043A\u0430\u043C\u0438.",
    action: "/suppliers",
    url,
    rows: [...bySupplier.entries()].map(([edrpou, acc]) => ({
      kind: "supplier",
      id: edrpou,
      href: `/supplier/${encodeURIComponent(edrpou)}`,
      name: readableName(acc.name),
      meta: `\u0404\u0414\u0420\u041F\u041E\u0423 ${esc(edrpou)} \xB7 ${acc.count} ${plural(acc.count, "\u043F\u0435\u0440\u0435\u043C\u043E\u0433\u0430", "\u043F\u0435\u0440\u0435\u043C\u043E\u0433\u0438", "\u043F\u0435\u0440\u0435\u043C\u043E\u0433")}${acc.solo ? ` \xB7 ${acc.solo} \u0431\u0435\u0437 \u043A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0442\u0456\u0432` : ""}`,
      value: acc.value,
      count: acc.count
    }))
  });
}
function railwayBlocks() {
  const by = /* @__PURE__ */ new Map();
  for (const entry of db.cases) {
    const scope = railwayScope(entry);
    if (!scope) continue;
    const list = by.get(scope) ?? [];
    list.push(entry);
    by.set(scope, list);
  }
  const blocks = [
    {
      scope: "southern",
      heading: "\u0420\u0435\u0433\u0456\u043E\u043D\u0430\u043B\u044C\u043D\u0430 \u0444\u0456\u043B\u0456\u044F \xAB\u041F\u0456\u0432\u0434\u0435\u043D\u043D\u0430 \u0437\u0430\u043B\u0456\u0437\u043D\u0438\u0446\u044F\xBB",
      note: `\u0412\u043B\u0430\u0441\u043D\u0435 \u0437\u0430\u043B\u0456\u0437\u043D\u0438\u0446\u044F \u0425\u0430\u0440\u043A\u0456\u0432\u0449\u0438\u043D\u0438 \u2014 \u0440\u0435\u0433\u0456\u043E\u043D\u0430\u043B\u044C\u043D\u0430 \u0444\u0456\u043B\u0456\u044F \u0410\u0422 \xAB\u0423\u043A\u0440\u0430\u0457\u043D\u0441\u044C\u043A\u0430 \u0437\u0430\u043B\u0456\u0437\u043D\u0438\u0446\u044F\xBB \u0437 \u043E\u0441\u0456\u0434\u043A\u043E\u043C \u0443 \u0425\u0430\u0440\u043A\u043E\u0432\u0456, \u0404\u0414\u0420\u041F\u041E\u0423 ${SOUTHERN_RAILWAY_EDRPOU}.`,
      list: by.get("southern") ?? []
    },
    {
      scope: "branch",
      heading: "\u0406\u043D\u0448\u0456 \u0444\u0456\u043B\u0456\u0457 \u0410\u0422 \xAB\u0423\u043A\u0440\u0430\u0457\u043D\u0441\u044C\u043A\u0430 \u0437\u0430\u043B\u0456\u0437\u043D\u0438\u0446\u044F\xBB",
      note: "\u0426\u0435\u043D\u0442\u0440\u0430\u043B\u0456\u0437\u043E\u0432\u0430\u043D\u0456 \u0444\u0456\u043B\u0456\u0457, \u044F\u043A\u0456 \u0437\u0430\u043A\u0443\u043F\u043E\u0432\u0443\u044E\u0442\u044C \u0434\u043B\u044F \u0432\u0441\u0456\u0454\u0457 \u043C\u0435\u0440\u0435\u0436\u0456, \u0437\u043E\u043A\u0440\u0435\u043C\u0430 \u0439 \u0434\u043B\u044F \u0425\u0430\u0440\u043A\u0456\u0432\u0441\u044C\u043A\u043E\u0433\u043E \u0432\u0443\u0437\u043B\u0430. \u0417\u0430\u0440\u0435\u0454\u0441\u0442\u0440\u043E\u0432\u0430\u043D\u0456 \u043F\u043E\u0437\u0430 \u043C\u0435\u0436\u0430\u043C\u0438 \u043E\u0431\u043B\u0430\u0441\u0442\u0456, \u0442\u043E\u043C\u0443 \u043C\u0438 \u043F\u043E\u043A\u0430\u0437\u0443\u0454\u043C\u043E \u0457\u0445 \u043E\u043A\u0440\u0435\u043C\u043E, \u0430 \u043D\u0435 \u0437\u043C\u0456\u0448\u0443\u0454\u043C\u043E \u0437 \u0445\u0430\u0440\u043A\u0456\u0432\u0441\u044C\u043A\u0438\u043C\u0438.",
      list: by.get("branch") ?? []
    },
    {
      scope: "local",
      heading: "\u0417\u0430\u043B\u0456\u0437\u043D\u0438\u0447\u043D\u0456 \u0437\u0430\u043A\u043B\u0430\u0434\u0438 \u0425\u0430\u0440\u043A\u0456\u0432\u0449\u0438\u043D\u0438",
      note: "\u041E\u0440\u0433\u0430\u043D\u0456\u0437\u0430\u0446\u0456\u0457 \u0437\u0430\u043B\u0456\u0437\u043D\u0438\u0447\u043D\u043E\u0433\u043E \u043F\u0440\u043E\u0444\u0456\u043B\u044E, \u0437\u0430\u0440\u0435\u0454\u0441\u0442\u0440\u043E\u0432\u0430\u043D\u0456 \u0432 \u043E\u0431\u043B\u0430\u0441\u0442\u0456: \u0443\u043D\u0456\u0432\u0435\u0440\u0441\u0438\u0442\u0435\u0442, \u043B\u0456\u0446\u0435\u0439, \u0446\u0435\u043D\u0442\u0440 \u043F\u0440\u043E\u0444\u0435\u0441\u0456\u0439\u043D\u043E\u0457 \u043E\u0441\u0432\u0456\u0442\u0438.",
      list: by.get("local") ?? []
    }
  ];
  return blocks.filter((b) => b.list.length > 0);
}
function railwayPage(url) {
  const blocks = railwayBlocks();
  const all = blocks.flatMap((b) => b.list);
  const value = all.reduce((sum2, c2) => sum2 + (c2.value_amount ?? 0), 0);
  const solo = all.filter((c2) => c2.bidders === 1).length;
  const southern = blocks.find((b) => b.scope === "southern")?.list ?? [];
  const c = readControls(url);
  const filtered = applyControls(all, c, RAILWAY_EDRPOU, { hideRail: true });
  const suppliers = /* @__PURE__ */ new Map();
  for (const entry of all) {
    const key = entry.winner_edrpou ?? "";
    if (!key) continue;
    const acc = suppliers.get(key) ?? { name: entry.winner_name ?? key, count: 0, value: 0, solo: 0 };
    acc.count++;
    acc.value += entry.winner_amount ?? entry.value_amount ?? 0;
    if (entry.bidders === 1) acc.solo++;
    suppliers.set(key, acc);
  }
  const topSuppliers = [...suppliers.entries()].sort((a, b) => b[1].value - a[1].value).slice(0, 15);
  return layout({
    title: "\u0417\u0430\u043B\u0456\u0437\u043D\u0438\u0446\u044F \u0425\u0430\u0440\u043A\u0456\u0432\u0441\u044C\u043A\u043E\u0457 \u043E\u0431\u043B\u0430\u0441\u0442\u0456",
    nav: "railway",
    body: `
<h1>\u0417\u0430\u043B\u0456\u0437\u043D\u0438\u0446\u044F \u0425\u0430\u0440\u043A\u0456\u0432\u0441\u044C\u043A\u043E\u0457 \u043E\u0431\u043B\u0430\u0441\u0442\u0456</h1>
<p class="sub">\u0417\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0437\u0430\u043B\u0456\u0437\u043D\u0438\u0446\u0456. \u0422\u0440\u0438 \u0433\u0440\u0443\u043F\u0438, \u044F\u043A\u0456 \u043C\u0438 \u043D\u0435 \u0437\u043C\u0456\u0448\u0443\u0454\u043C\u043E.</p>

<p class="statline">
  <b>${all.length.toLocaleString("uk-UA")}</b> \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C \u0456\u0437 \u043F\u043E\u0437\u043D\u0430\u0447\u043A\u0430\u043C\u0438 \xB7
  <b>${shortMoney(value)}</b> \u043D\u0430 \u0442\u0430\u043A\u0443 \u0441\u0443\u043C\u0443 \xB7
  <b>${solo}</b> \u0437 \u0454\u0434\u0438\u043D\u0438\u043C \u0443\u0447\u0430\u0441\u043D\u0438\u043A\u043E\u043C \xB7
  <b>${southern.length}</b> \u0443 \xAB\u041F\u0456\u0432\u0434\u0435\u043D\u043D\u043E\u0457 \u0437\u0430\u043B\u0456\u0437\u043D\u0438\u0446\u0456\xBB
</p>

<details class="help">
  <summary>\u0429\u043E \u0441\u0430\u043C\u0435 \u0432\u0445\u043E\u0434\u0438\u0442\u044C \u0443 \u0446\u0435\u0439 \u0440\u043E\u0437\u0434\u0456\u043B</summary>
  <div class="inner">
    <p><strong>\u041F\u0456\u0432\u0434\u0435\u043D\u043D\u0430 \u0437\u0430\u043B\u0456\u0437\u043D\u0438\u0446\u044F</strong> \u2014 \u0440\u0435\u0433\u0456\u043E\u043D\u0430\u043B\u044C\u043D\u0430 \u0444\u0456\u043B\u0456\u044F \u0410\u0422 \xAB\u0423\u043A\u0440\u0430\u0457\u043D\u0441\u044C\u043A\u0430 \u0437\u0430\u043B\u0456\u0437\u043D\u0438\u0446\u044F\xBB, \u0449\u043E \u043E\u0431\u0441\u043B\u0443\u0433\u043E\u0432\u0443\u0454 \u0425\u0430\u0440\u043A\u0456\u0432\u0449\u0438\u043D\u0443. \u0426\u0435 \u0456 \u0454 \u0437\u0430\u043B\u0456\u0437\u043D\u0438\u0446\u044F \u043E\u0431\u043B\u0430\u0441\u0442\u0456 \u0443 \u043F\u0440\u044F\u043C\u043E\u043C\u0443 \u0437\u043D\u0430\u0447\u0435\u043D\u043D\u0456.</p>
    <p><strong>\u0406\u043D\u0448\u0456 \u0444\u0456\u043B\u0456\u0457 \u0423\u043A\u0440\u0437\u0430\u043B\u0456\u0437\u043D\u0438\u0446\u0456</strong> \u0437\u0430\u0440\u0435\u0454\u0441\u0442\u0440\u043E\u0432\u0430\u043D\u0456 \u0432 \u041A\u0438\u0454\u0432\u0456, \u0430\u043B\u0435 \u0437\u0430\u043A\u0443\u043F\u043E\u0432\u0443\u044E\u0442\u044C \u0446\u0435\u043D\u0442\u0440\u0430\u043B\u0456\u0437\u043E\u0432\u0430\u043D\u043E \u0434\u043B\u044F \u0432\u0441\u0456\u0454\u0457 \u043C\u0435\u0440\u0435\u0436\u0456, \u0437\u043E\u043A\u0440\u0435\u043C\u0430 \u0439 \u0434\u043B\u044F \u0445\u0430\u0440\u043A\u0456\u0432\u0441\u044C\u043A\u0438\u0445 \u043F\u0456\u0434\u0440\u043E\u0437\u0434\u0456\u043B\u0456\u0432. \u041C\u0438 \u0432\u0456\u0434\u0441\u0442\u0435\u0436\u0443\u0454\u043C\u043E \u0457\u0445 \u043E\u043A\u0440\u0435\u043C\u043E \u0439 \u043D\u0435 \u0432\u0438\u0434\u0430\u0454\u043C\u043E \u0437\u0430 \u0445\u0430\u0440\u043A\u0456\u0432\u0441\u044C\u043A\u0456.</p>
    <p><strong>\u0417\u0430\u043B\u0456\u0437\u043D\u0438\u0447\u043D\u0456 \u0437\u0430\u043A\u043B\u0430\u0434\u0438 \u0425\u0430\u0440\u043A\u0456\u0432\u0449\u0438\u043D\u0438</strong> \u2014 \u043E\u0441\u0432\u0456\u0442\u043D\u0456 \u0442\u0430 \u043D\u0430\u0443\u043A\u043E\u0432\u0456 \u043E\u0440\u0433\u0430\u043D\u0456\u0437\u0430\u0446\u0456\u0457 \u0433\u0430\u043B\u0443\u0437\u0456, \u0437\u0430\u0440\u0435\u0454\u0441\u0442\u0440\u043E\u0432\u0430\u043D\u0456 \u0432 \u043E\u0431\u043B\u0430\u0441\u0442\u0456.</p>
    <p>\u0412\u0456\u0434\u0431\u0456\u0440 \u0437\u0430 \u043D\u0430\u0437\u0432\u043E\u044E \u043D\u0430\u0432\u043C\u0438\u0441\u043D\u043E \u0432\u0443\u0437\u044C\u043A\u0438\u0439. \u0428\u0438\u0440\u0448\u0438\u0439 \u0448\u0430\u0431\u043B\u043E\u043D \u043F\u043E\u043C\u0438\u043B\u043A\u043E\u0432\u043E \u0437\u0430\u0440\u0430\u0445\u043E\u0432\u0443\u0432\u0430\u0432 \u0434\u043E \u0437\u0430\u043B\u0456\u0437\u043D\u0438\u0446\u0456 \u0417\u043C\u0456\u0457\u0432\u0441\u044C\u043A\u0443 \u0442\u0435\u043F\u043B\u043E\u0432\u0443 \u0435\u043B\u0435\u043A\u0442\u0440\u043E\u0441\u0442\u0430\u043D\u0446\u0456\u044E \u0442\u0430 \u0434\u043E\u0441\u043B\u0456\u0434\u043D\u0443 \u0441\u0442\u0430\u043D\u0446\u0456\u044E \u043F\u0442\u0430\u0445\u0456\u0432\u043D\u0438\u0446\u0442\u0432\u0430.</p>
  </div>
</details>

<h2>\u0425\u0442\u043E \u0437\u0430\u043A\u0443\u043F\u043E\u0432\u0443\u0454</h2>
${blocks.map((block) => {
      const blockValue = block.list.reduce((sum2, x) => sum2 + (x.value_amount ?? 0), 0);
      const entities = /* @__PURE__ */ new Map();
      for (const entry of block.list) {
        const key = entry.entity_edrpou ?? "";
        const acc = entities.get(key) ?? { name: entry.entity_name ?? key, count: 0, value: 0 };
        acc.count++;
        acc.value += entry.value_amount ?? 0;
        entities.set(key, acc);
      }
      return `
<h3 class="block-head">${esc(block.heading)}</h3>
<p class="hint">${esc(block.note)}</p>
<p class="hint"><strong>${block.list.length}</strong> ${plural(block.list.length, "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C")} \u043D\u0430 ${shortMoney(blockValue)}, ${entities.size} ${plural(entities.size, "\u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A", "\u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u0438", "\u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u0456\u0432")}.</p>
<div class="rows">
${[...entities.entries()].sort((a, b) => b[1].value - a[1].value).map(
        ([edrpou, acc]) => `<div class="row">
  <div class="who">
    <div class="name">${star("entity", edrpou, "/railway")}<a href="/entity/${encodeURIComponent(edrpou)}">${esc(readableName(acc.name))}</a></div>
    <div class="meta">\u0404\u0414\u0420\u041F\u041E\u0423 ${esc(edrpou)} \xB7 ${acc.count} ${plural(acc.count, "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C")} \u0456\u0437 \u043F\u043E\u0437\u043D\u0430\u0447\u043A\u0430\u043C\u0438</div>
  </div>
  <div class="amount"><span class="big">${shortMoney(acc.value)}</span></div>
</div>`
      ).join("")}
</div>`;
    }).join("")}

<h2>\u0417\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0437\u0430\u043B\u0456\u0437\u043D\u0438\u0446\u0456</h2>
${presetBar("/railway", url, c)}
${sortBar("/railway", c)}
${filterPanel("/railway", c, { hideRail: true })}
${listBody(filtered, c, "/railway")}

<h2>\u0429\u043E \u0434\u0435\u0440\u0436\u0430\u0432\u0430 \u0437\u0430\u043F\u0456\u0434\u043E\u0437\u0440\u0438\u043B\u0430 \u0432 \u0437\u0430\u043B\u0456\u0437\u043D\u0438\u0447\u043D\u0438\u0445 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F\u0445</h2>
${groupedRiskCards(rankRisks(all))}

<h2>\u0425\u0442\u043E \u0432\u0438\u0433\u0440\u0430\u0454 \u0437\u0430\u043B\u0456\u0437\u043D\u0438\u0447\u043D\u0456 \u0442\u0435\u043D\u0434\u0435\u0440\u0438</h2>
<p class="hint">\u041F'\u044F\u0442\u043D\u0430\u0434\u0446\u044F\u0442\u044C \u043D\u0430\u0439\u0431\u0456\u043B\u044C\u0448\u0438\u0445 \u043F\u0435\u0440\u0435\u043C\u043E\u0436\u0446\u0456\u0432.</p>
<div class="rows">
${topSuppliers.map(
      ([edrpou, acc]) => `<div class="row">
  <div class="who">
    <div class="name">${star("supplier", edrpou, "/railway")}<a href="/supplier/${encodeURIComponent(edrpou)}">${esc(readableName(acc.name))}</a></div>
    <div class="meta">\u0404\u0414\u0420\u041F\u041E\u0423 ${esc(edrpou)} \xB7 ${acc.count} ${plural(acc.count, "\u043F\u0435\u0440\u0435\u043C\u043E\u0433\u0430", "\u043F\u0435\u0440\u0435\u043C\u043E\u0433\u0438", "\u043F\u0435\u0440\u0435\u043C\u043E\u0433")}${acc.solo ? ` \xB7 ${acc.solo} \u0431\u0435\u0437 \u043A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0442\u0456\u0432` : ""}</div>
  </div>
  <div class="amount"><span class="big">${shortMoney(acc.value)}</span></div>
</div>`
    ).join("")}
</div>

<p class="note">\u041F\u043E\u0437\u043D\u0430\u0447\u043A\u0430 \u043E\u0437\u043D\u0430\u0447\u0430\u0454, \u0449\u043E \u0441\u043F\u0440\u0430\u0446\u044E\u0432\u0430\u0432 \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440 \u0434\u0435\u0440\u0436\u0430\u0432\u043D\u043E\u0457 \u0441\u0438\u0441\u0442\u0435\u043C\u0438 \u043C\u043E\u043D\u0456\u0442\u043E\u0440\u0438\u043D\u0433\u0443 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C. \u0426\u0435 \u043E\u0437\u043D\u0430\u043A\u0430 \u0440\u0438\u0437\u0438\u043A\u0443, \u044F\u043A\u0430 \u043F\u043E\u0442\u0440\u0435\u0431\u0443\u0454 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u043A\u0438, \u0430 \u043D\u0435 \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0439 \u0444\u0430\u043A\u0442 \u043F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F.</p>
`
  });
}
function articlePage(code, url) {
  const article = ARTICLES[code];
  if (!article) return notFound();
  const relevant = new Set(article.links.map((l) => l.risk_id));
  const jointOnly = url.searchParams.get("at") === "1";
  const articleAction = `/article/${article.code}`;
  const jointHidden = jointOnly ? '<input type="hidden" name="at" value="1">' : "";
  const ctrl = readControls(url);
  let list = db.cases.filter(
    (c) => c.region === REGION && c.risks.some((r) => relevant.has(r))
  );
  if (jointOnly) list = list.filter((c) => isJointStock(c.entity_name) || isJointStock(c.winner_name));
  const value = list.reduce((sum2, c) => sum2 + (c.value_amount ?? 0), 0);
  const solo = list.filter((c) => c.bidders === 1).length;
  const officers = new Set(list.map((c) => c.officer_key).filter(Boolean));
  const score = (entry) => entry.risks.filter((r) => relevant.has(r)).length;
  const sorted = [...list].sort(
    (a, b) => score(b) - score(a) || (b.value_amount ?? 0) - (a.value_amount ?? 0)
  );
  let shown = applyControls(sorted, ctrl, RAILWAY_EDRPOU);
  if (!url.searchParams.get("sort")) {
    const keep = new Set(shown);
    shown = sorted.filter((x) => keep.has(x));
  }
  return layout({
    title: `\u0421\u0442\u0430\u0442\u0442\u044F ${article.code}`,
    nav: `article-${article.code}`,
    body: `
<h1>\u041F\u0456\u0434\u0440\u043E\u0431\u043B\u0435\u043D\u043D\u044F \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0456\u0432</h1>
<p class="sub">\u0420\u043E\u0437\u0431\u0456\u0436\u043D\u043E\u0441\u0442\u0456 \u0432 \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0430\u0445, \u0443\u0433\u043E\u0434\u0430\u0445 \u0456 \u0437\u0432\u0456\u0442\u0430\u0445 \u2014 \u0442\u0435, \u0449\u043E \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u044E\u0442\u044C \u0437\u0430 \u0441\u0442\u0430\u0442\u0442\u0435\u044E ${esc(article.code)}.</p>

<p class="statline">
  <b>${list.length.toLocaleString("uk-UA")}</b> ${plural(list.length, "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C")} \xB7
  <b>${shortMoney(value)}</b> \xB7
  <b>${solo}</b> \u0431\u0435\u0437 \u043A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0442\u0456\u0432 \xB7
  <b>${officers.size}</b> ${plural(officers.size, "\u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u043B\u044C\u043D\u0430 \u043E\u0441\u043E\u0431\u0430", "\u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u043B\u044C\u043D\u0456 \u043E\u0441\u043E\u0431\u0438", "\u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u043B\u044C\u043D\u0438\u0445 \u043E\u0441\u0456\u0431")}
</p>

<p class="caution">\u0426\u0435 \u0441\u043F\u0438\u0441\u043E\u043A \u0434\u043B\u044F \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u043A\u0438, \u0430 \u043D\u0435 \u0437\u0432\u0438\u043D\u0443\u0432\u0430\u0447\u0435\u043D\u043D\u044F: \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u0438 \u043F\u043E\u043A\u0430\u0437\u0443\u044E\u0442\u044C \u0440\u043E\u0437\u0431\u0456\u0436\u043D\u043E\u0441\u0442\u0456 \u0432 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u0445, \u0430 \u0443\u043C\u0438\u0441\u0435\u043B \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u044E\u0454 \u043B\u0438\u0448\u0435 \u0441\u0443\u0434.</p>

<details class="help">
  <summary>\u0429\u043E \u043A\u0430\u0436\u0435 \u0441\u0442\u0430\u0442\u0442\u044F ${esc(article.code)}</summary>
  <div class="inner">
    <p class="lead">${esc(article.summary)}</p>
    <p><strong>\u0429\u043E \u043C\u0430\u0454 \u0431\u0443\u0442\u0438 \u0434\u043E\u0432\u0435\u0434\u0435\u043D\u043E:</strong></p>
    <ul>
      ${article.elements.map((e) => `<li>${esc(e)}</li>`).join("")}
    </ul>
    <p class="faint">\u041D\u0430\u0432\u0435\u0434\u0435\u043D\u043E \u044F\u043A \u0434\u043E\u0432\u0456\u0434\u043A\u0443 \u0434\u043B\u044F \u044E\u0440\u0438\u0441\u0442\u0430. \u0426\u0435 \u043D\u0435 \u043F\u0440\u0430\u0432\u043E\u0432\u0430 \u043A\u043E\u043D\u0441\u0443\u043B\u044C\u0442\u0430\u0446\u0456\u044F \u0456 \u043D\u0435 \u043A\u0432\u0430\u043B\u0456\u0444\u0456\u043A\u0430\u0446\u0456\u044F \u0447\u0438\u0457\u0445\u043E\u0441\u044C \u0434\u0456\u0439.</p>
  </div>
</details>

<details class="help">
  <summary>\u0427\u043E\u043C\u0443 \u0441\u0430\u043C\u0435 \u0446\u0456 \u043E\u0437\u043D\u0430\u043A\u0438, \u0430 \u043D\u0435 \u0432\u0441\u0456 \u0447\u043E\u0442\u0438\u0440\u043D\u0430\u0434\u0446\u044F\u0442\u044C</summary>
  <div class="inner">
    <p>\u0406\u0437 \u0447\u043E\u0442\u0438\u0440\u043D\u0430\u0434\u0446\u044F\u0442\u0438 \u0434\u0435\u0440\u0436\u0430\u0432\u043D\u0438\u0445 \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u0456\u0432 \u0434\u043B\u044F \u0446\u0456\u0454\u0457 \u0441\u0442\u0430\u0442\u0442\u0456 \u0440\u0435\u043B\u0435\u0432\u0430\u043D\u0442\u043D\u0456 ${article.links.length}. \u0420\u0435\u0448\u0442\u0430 \u0441\u0442\u043E\u0441\u0443\u044E\u0442\u044C\u0441\u044F \u043A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0446\u0456\u0457 \u0442\u0430 \u043F\u0440\u043E\u0446\u0435\u0434\u0443\u0440\u0438, \u0430 \u043D\u0435 \u0437\u043C\u0456\u0441\u0442\u0443 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0456\u0432.</p>
    ${article.links.map((link) => {
      const label = RISK_LABELS[link.risk_id];
      const hits = list.filter((c) => c.risks.includes(link.risk_id)).length;
      return `<p><strong>${esc(label?.short ?? link.risk_id)}</strong> <span class="faint">\u2014 ${hits} ${plural(hits, "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C")}</span><br>${esc(link.why)}</p>`;
    }).join("")}
  </div>
</details>

<h2>\u0417\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0434\u043B\u044F \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u043A\u0438</h2>
<form class="filters" method="get" action="/article/${esc(article.code)}">
  <div class="filter-row">
    <label class="check"><input type="checkbox" name="at" value="1"${jointOnly ? " checked" : ""}> \u043B\u0438\u0448\u0435 \u0430\u043A\u0446\u0456\u043E\u043D\u0435\u0440\u043D\u0456 \u0442\u043E\u0432\u0430\u0440\u0438\u0441\u0442\u0432\u0430 (\u0410\u0422)</label>
    <button type="submit">\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u0438</button>
    ${jointOnly ? `<a class="reset" href="/article/${esc(article.code)}">\u0441\u043A\u0438\u043D\u0443\u0442\u0438</a>` : ""}
  </div>
</form>
${sortBar(articleAction, ctrl, jointHidden)}
${filterPanel(articleAction, ctrl, {}, jointHidden)}
${listBody(shown, ctrl, articleAction)}

<p class="note">\u041F\u0435\u0440\u0435\u043B\u0456\u043A \u0441\u0444\u043E\u0440\u043C\u043E\u0432\u0430\u043D\u043E \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u043D\u043E \u0437\u0430 \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u0430\u043C\u0438 \u0434\u0435\u0440\u0436\u0430\u0432\u043D\u043E\u0457 \u0441\u0438\u0441\u0442\u0435\u043C\u0438 \u043C\u043E\u043D\u0456\u0442\u043E\u0440\u0438\u043D\u0433\u0443 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C. \u0412\u0456\u043D \u043D\u0435 \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u044E\u0454 \u0444\u0430\u043A\u0442 \u043F\u0440\u0430\u0432\u043E\u043F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F \u0456 \u043D\u0435 \u0454 \u0442\u0432\u0435\u0440\u0434\u0436\u0435\u043D\u043D\u044F\u043C \u0449\u043E\u0434\u043E \u0431\u0443\u0434\u044C-\u044F\u043A\u043E\u0457 \u043D\u0430\u0437\u0432\u0430\u043D\u043E\u0457 \u043E\u0441\u043E\u0431\u0438 \u0447\u0438 \u043A\u043E\u043C\u043F\u0430\u043D\u0456\u0457. \u041D\u0430\u0441\u0442\u0443\u043F\u043D\u0438\u0439 \u043A\u0440\u043E\u043A \u2014 \u0432\u0438\u0442\u0440\u0435\u0431\u0443\u0432\u0430\u0442\u0438 \u0441\u0430\u043C\u0456 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0438 \u0439 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u0438\u0442\u0438 \u0457\u0445.</p>
`
  });
}
function updatesPage(url) {
  const runs = [...db.runs].sort((a, b) => b.started_at.localeCompare(a.started_at));
  const latest = runs[0];
  const newIds = new Set(latest?.new_tender_ids ?? []);
  const freshAll = db.cases.filter((x) => newIds.has(x.tender_id));
  const c = readControls(url);
  const fresh = applyControls(freshAll, c, RAILWAY_EDRPOU);
  return layout({
    title: "\u041E\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u044F",
    nav: "updates",
    body: `
<h1>\u0429\u043E \u0437\u043C\u0456\u043D\u0438\u043B\u043E\u0441\u044F</h1>
<p class="sub">\u0429\u043E\u0434\u043D\u044F \u0437\u0432\u0456\u0440\u044F\u0454\u043C\u043E\u0441\u044F \u0437 \u0434\u0435\u0440\u0436\u0430\u0432\u043D\u0438\u043C \u043C\u0430\u0441\u0438\u0432\u043E\u043C \u0456 \u0434\u043E\u0434\u0430\u0454\u043C\u043E \u043D\u043E\u0432\u0435.</p>

${latest ? `<p class="statline">
  <b>${latest.new_tenders}</b> \u043D\u043E\u0432\u0438\u0445 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C \u0432\u043E\u0441\u0442\u0430\u043D\u043D\u0454 \xB7
  <b>${latest.new_flags}</b> \u043D\u043E\u0432\u0438\u0445 \u0441\u043F\u0440\u0430\u0446\u044E\u0432\u0430\u043D\u044C \xB7
  <b>${date(latest.started_at)}</b> \u043E\u0441\u0442\u0430\u043D\u043D\u0454 \u043E\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u044F \xB7
  <b>${runs.length}</b> ${plural(runs.length, "\u0437\u0430\u043F\u0443\u0441\u043A", "\u0437\u0430\u043F\u0443\u0441\u043A\u0438", "\u0437\u0430\u043F\u0443\u0441\u043A\u0456\u0432")}
</p>` : '<div class="empty">\u0416\u043E\u0434\u043D\u043E\u0433\u043E \u0437\u0430\u043F\u0443\u0441\u043A\u0443 \u0449\u0435 \u043D\u0435 \u0431\u0443\u043B\u043E. \u0412\u0438\u043A\u043E\u043D\u0430\u0439\u0442\u0435 <code>npm run daily</code>.</div>'}

${freshAll.length > 0 ? `<h2>\u041D\u043E\u0432\u0456 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0437 \u043E\u0441\u0442\u0430\u043D\u043D\u044C\u043E\u0433\u043E \u043E\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u044F</h2>
${sortBar("/updates", c)}
${filterPanel("/updates", c)}
${listBody(fresh, c, "/updates")}` : latest ? `<h2>\u041D\u043E\u0432\u0456 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0437 \u043E\u0441\u0442\u0430\u043D\u043D\u044C\u043E\u0433\u043E \u043E\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u044F</h2><div class="empty">\u041D\u043E\u0432\u0438\u0445 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C \u043D\u0435 \u0437\u2019\u044F\u0432\u0438\u043B\u043E\u0441\u044F. \u0426\u0435 \u043D\u043E\u0440\u043C\u0430\u043B\u044C\u043D\u0438\u0439 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u2014 \u0434\u0435\u0440\u0436\u0430\u0432\u0430 \u043D\u0435 \u0449\u043E\u0434\u043D\u044F \u0434\u043E\u0434\u0430\u0454 \u043F\u043E\u0437\u043D\u0430\u0447\u043A\u0438.</div>` : ""}

<h2>\u0406\u0441\u0442\u043E\u0440\u0456\u044F \u0437\u0430\u043F\u0443\u0441\u043A\u0456\u0432</h2>
<div class="rows">
${runs.slice(0, 30).map(
      (r) => `<div class="row">
  <div class="who">
    <div class="name">${date(r.started_at)}${r.status === "failed" ? ' <span class="flag alarm">\u0437\u0431\u0456\u0439</span>' : ""}</div>
    <div class="meta">${r.new_tenders} ${plural(r.new_tenders, "\u043D\u043E\u0432\u0430 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F", "\u043D\u043E\u0432\u0456 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456", "\u043D\u043E\u0432\u0438\u0445 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C")} \xB7 ${r.new_flags} ${plural(r.new_flags, "\u043D\u043E\u0432\u0435 \u0441\u043F\u0440\u0430\u0446\u044E\u0432\u0430\u043D\u043D\u044F", "\u043D\u043E\u0432\u0456 \u0441\u043F\u0440\u0430\u0446\u044E\u0432\u0430\u043D\u043D\u044F", "\u043D\u043E\u0432\u0438\u0445 \u0441\u043F\u0440\u0430\u0446\u044E\u0432\u0430\u043D\u044C")} \xB7 ${r.details_fetched} ${plural(r.details_fetched, "\u043A\u0430\u0440\u0442\u043A\u0430", "\u043A\u0430\u0440\u0442\u043A\u0438", "\u043A\u0430\u0440\u0442\u043E\u043A")} \u0437\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0435\u043D\u043E${r.errors ? ` \xB7 ${r.errors} ${plural(r.errors, "\u043F\u043E\u043C\u0438\u043B\u043A\u0430", "\u043F\u043E\u043C\u0438\u043B\u043A\u0438", "\u043F\u043E\u043C\u0438\u043B\u043E\u043A")}` : ""}</div>
    ${r.message ? `<div class="meta">${esc(r.message)}</div>` : ""}
  </div>
  <div class="amount"><span class="big">${r.status === "ok" ? "\u2713" : "\u2715"}</span></div>
</div>`
    ).join("")}
</div>

<p class="note">\u041E\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u044F \u0432\u0438\u043A\u043E\u043D\u0443\u0454 \u0441\u043A\u0440\u0438\u043F\u0442 <code>npm run daily</code>. \u0412\u0456\u043D \u0431\u0435\u0437\u043F\u0435\u0447\u043D\u0438\u0439 \u0434\u043E \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u043E\u0433\u043E \u0437\u0430\u043F\u0443\u0441\u043A\u0443: \u0443\u0441\u0435, \u0449\u043E \u0432\u0436\u0435 \u0454, \u043D\u0435 \u0434\u0443\u0431\u043B\u044E\u0454\u0442\u044C\u0441\u044F, \u0430 \u043F\u0435\u0440\u0435\u0440\u0432\u0430\u043D\u0438\u0439 \u0437\u0430\u043F\u0443\u0441\u043A \u0434\u043E\u0432\u0430\u043D\u0442\u0430\u0436\u0443\u0454\u0442\u044C\u0441\u044F \u043D\u0430\u0441\u0442\u0443\u043F\u043D\u043E\u0433\u043E \u0440\u0430\u0437\u0443.</p>
`
  });
}
function pricesPage(url) {
  const withFindings = db.cases.filter((c2) => c2.findings.length > 0);
  const gapOf = (c2) => c2.findings.reduce((total, f) => {
    const e = f.evidence;
    return total + (e.overpayment ?? e.extra_cost ?? 0);
  }, 0);
  const totalGap = withFindings.reduce((t, c2) => t + gapOf(c2), 0);
  const peer = withFindings.filter((c2) => c2.findings.some((f) => f.detector_key === "peer_price")).length;
  const growth = withFindings.filter((c2) => c2.findings.some((f) => f.detector_key === "own_price_growth")).length;
  const c = readControls(url);
  const list = applyControls(withFindings, c, RAILWAY_EDRPOU, { hidePrice: true });
  return layout({
    title: "\u0417\u0430\u0432\u0438\u0449\u0435\u043D\u0456 \u0446\u0456\u043D\u0438",
    nav: "prices",
    body: `
<h1>\u0414\u0435 \u0446\u0456\u043D\u0430 \u0432\u0438\u0433\u043B\u044F\u0434\u0430\u0454 \u0437\u0430\u0432\u0438\u0449\u0435\u043D\u043E\u044E</h1>
<p class="sub">\u0420\u0430\u0445\u0443\u0454\u043C\u043E \u0441\u0430\u043C\u0456: \u0446\u0456\u043D\u0430 \u0437\u0430 \u043E\u0434\u0438\u043D\u0438\u0446\u044E \u043F\u0440\u043E\u0442\u0438 \u0456\u043D\u0448\u0438\u0445 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C \u0456 \u043F\u0440\u043E\u0442\u0438 \u043C\u0438\u043D\u0443\u043B\u0438\u0445 \u0446\u0456\u043D \u0446\u044C\u043E\u0433\u043E \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u0430.</p>

<p class="statline">
  <b>${withFindings.length}</b> \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C \u0456\u0437 \u0437\u0430\u0432\u0438\u0449\u0435\u043D\u043E\u044E \u0446\u0456\u043D\u043E\u044E \xB7
  <b>${shortMoney(totalGap)}</b> \u0440\u0456\u0437\u043D\u0438\u0446\u044F \u043F\u0440\u043E\u0442\u0438 \u0437\u0432\u0438\u0447\u0430\u0439\u043D\u043E\u0457 \u0446\u0456\u043D\u0438 \xB7
  <b>${peer}</b> \u0434\u043E\u0440\u043E\u0436\u0447\u0435, \u043D\u0456\u0436 \u0432 \u0456\u043D\u0448\u0438\u0445 \xB7
  <b>${growth}</b> \u0434\u043E\u0440\u043E\u0436\u0447\u0435, \u043D\u0456\u0436 \u0431\u0443\u043B\u043E \u0442\u043E\u0440\u0456\u043A
</p>

<details class="help">
  <summary>\u042F\u043A \u043C\u0438 \u0446\u0435 \u0440\u0430\u0445\u0443\u0454\u043C\u043E</summary>
  <div class="inner">
    <p>\u0421\u043F\u043E\u0447\u0430\u0442\u043A\u0443 \u0440\u0430\u0445\u0443\u0454\u043C\u043E <strong>\u0446\u0456\u043D\u0443 \u0437\u0430 \u043E\u0434\u0438\u043D\u0438\u0446\u044E</strong>: \u0441\u0443\u043C\u0443 \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0443 \u0434\u0456\u043B\u0438\u043C\u043E \u043D\u0430 \u043A\u0456\u043B\u044C\u043A\u0456\u0441\u0442\u044C. \u041D\u0430\u043F\u0440\u0438\u043A\u043B\u0430\u0434, 4 \u043C\u043B\u043D \u0433\u0440\u043D \u0437\u0430 200 \u0445\u043E\u043B\u043E\u0434\u0438\u043B\u044C\u043D\u0438\u043A\u0456\u0432 \u2014 \u0446\u0435 20 \u0442\u0438\u0441\u044F\u0447 \u0437\u0430 \u0448\u0442\u0443\u043A\u0443.</p>
    <p>\u0414\u0430\u043B\u0456 \u0448\u0443\u043A\u0430\u0454\u043C\u043E, \u0437\u0430 \u0441\u043A\u0456\u043B\u044C\u043A\u0438 \u0442\u0435 \u0441\u0430\u043C\u0435 \u043A\u0443\u043F\u0443\u0432\u0430\u043B\u0438 \u0456\u043D\u0448\u0456, \u0456 \u0431\u0435\u0440\u0435\u043C\u043E \u0441\u0435\u0440\u0435\u0434\u0438\u043D\u0443. \u042F\u043A\u0449\u043E \u0446\u0456\u043D\u0430 \u043F\u043E\u043C\u0456\u0442\u043D\u043E \u0432\u0438\u0449\u0430 \u0437\u0430 \u0441\u0435\u0440\u0435\u0434\u0438\u043D\u0443 \u2014 \u043F\u043E\u043A\u0430\u0437\u0443\u0454\u043C\u043E.</p>
    <p>\u041E\u043A\u0440\u0435\u043C\u043E \u043F\u043E\u0440\u0456\u0432\u043D\u044E\u0454\u043C\u043E \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u0430 \u0437 \u043D\u0438\u043C \u0441\u0430\u043C\u0438\u043C: \u0441\u043A\u0456\u043B\u044C\u043A\u0438 \u0432\u0456\u043D \u043F\u043B\u0430\u0442\u0438\u0432 \u0437\u0430 \u0446\u0435 \u0440\u0430\u043D\u0456\u0448\u0435. \u0422\u0443\u0442 \u043C\u0456\u0441\u0446\u0435\u0432\u0456 \u0443\u043C\u043E\u0432\u0438 \u043E\u0434\u043D\u0430\u043A\u043E\u0432\u0456, \u0442\u043E\u0436 \u0441\u0442\u0440\u0438\u0431\u043E\u043A \u0446\u0456\u043D\u0438 \u0441\u043A\u043B\u0430\u0434\u043D\u0456\u0448\u0435 \u043F\u043E\u044F\u0441\u043D\u0438\u0442\u0438.</p>
    <p><strong>\u041C\u0438 \u043C\u043E\u0432\u0447\u0438\u043C\u043E, \u043A\u043E\u043B\u0438 \u043F\u043E\u0440\u0456\u0432\u043D\u044F\u0442\u0438 \u0447\u0435\u0441\u043D\u043E \u043D\u0435 \u043C\u043E\u0436\u043D\u0430.</strong> \u0420\u0435\u043C\u043E\u043D\u0442\u0438 \u0439 \u043F\u043E\u0441\u043B\u0443\u0433\u0438 \u043D\u0435 \u043F\u043E\u0440\u0456\u0432\u043D\u044E\u0454\u043C\u043E \u2014 \u043A\u043E\u0436\u0435\u043D \u043E\u0431'\u0454\u043A\u0442 \u0441\u0432\u0456\u0439. \u041D\u0435 \u043F\u043E\u0440\u0456\u0432\u043D\u044E\u0454\u043C\u043E \u0439 \u0442\u043E\u0432\u0430\u0440\u0438 \u0432\u0441\u0435\u0440\u0435\u0434\u0438\u043D\u0456 \u043D\u0430\u0434\u0442\u043E \u0448\u0438\u0440\u043E\u043A\u043E\u0433\u043E \u043A\u043E\u0434\u0443: \u043F\u0456\u0434 \u043E\u0434\u043D\u0438\u043C \u043A\u043E\u0434\u043E\u043C \u043C\u043E\u0436\u0443\u0442\u044C \u0431\u0443\u0442\u0438 \u0456 \u043F\u0440\u043E\u043A\u043B\u0430\u0434\u043A\u0430 \u0437\u0430 400 \u0433\u0440\u043D, \u0456 \u0440\u0435\u0434\u0443\u043A\u0442\u043E\u0440 \u0437\u0430 \u043C\u0456\u043B\u044C\u0439\u043E\u043D.</p>
  </div>
</details>

${presetBar("/prices", url, c)}
${sortBar("/prices", c)}
${filterPanel("/prices", c, { hidePrice: true })}

${listBody(list, c, "/prices")}

<p class="note">\u0420\u0456\u0437\u043D\u0438\u0446\u044F \u0432 \u0446\u0456\u043D\u0456 \u2014 \u0446\u0435 \u0449\u0435 \u043D\u0435 \u043F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F. \u0412\u043E\u043D\u0430 \u043C\u043E\u0436\u0435 \u043C\u0430\u0442\u0438 \u043F\u043E\u044F\u0441\u043D\u0435\u043D\u043D\u044F: \u0456\u043D\u0448\u0456 \u0443\u043C\u043E\u0432\u0438 \u043F\u043E\u0441\u0442\u0430\u0447\u0430\u043D\u043D\u044F, \u0456\u043D\u0448\u0438\u0439 \u0447\u0430\u0441, \u0456\u043D\u0448\u0430 \u044F\u043A\u0456\u0441\u0442\u044C. \u041D\u0430\u0448\u0435 \u0437\u0430\u0432\u0434\u0430\u043D\u043D\u044F \u2014 \u043F\u043E\u043A\u0430\u0437\u0430\u0442\u0438, \u0434\u0435 \u0446\u0435 \u043F\u043E\u044F\u0441\u043D\u0435\u043D\u043D\u044F \u0432\u0430\u0440\u0442\u043E \u0437\u0430\u043F\u0438\u0442\u0430\u0442\u0438.</p>
`
  });
}
function profileOf(edrpou) {
  const asBuyer = db.cases.filter((c) => c.entity_edrpou === edrpou);
  const asWinner = db.cases.filter((c) => c.winner_edrpou === edrpou);
  const name = asBuyer.find((c) => c.entity_name)?.entity_name ?? asWinner.find((c) => c.winner_name)?.winner_name ?? null;
  return { asBuyer, asWinner, name };
}
function lookupPage(code, typed) {
  const profile = code ? profileOf(code) : null;
  const found = Boolean(profile && (profile.asBuyer.length > 0 || profile.asWinner.length > 0));
  return layout({
    title: "\u041F\u043E\u0448\u0443\u043A \u0437\u0430 \u0404\u0414\u0420\u041F\u041E\u0423",
    nav: "lookup",
    body: `
<h1>\u041F\u043E\u0448\u0443\u043A \u043F\u0456\u0434\u043F\u0440\u0438\u0454\u043C\u0441\u0442\u0432\u0430 \u0437\u0430 \u0404\u0414\u0420\u041F\u041E\u0423</h1>
<p class="sub">\u041A\u043E\u0434 \u043F\u0456\u0434\u043F\u0440\u0438\u0454\u043C\u0441\u0442\u0432\u0430 \u2014 \u043F\u043E\u043A\u0430\u0436\u0435\u043C\u043E \u0432\u0441\u0435, \u0449\u043E \u043F\u0440\u043E \u043D\u044C\u043E\u0433\u043E \u0454 \u0432 \u0431\u0430\u0437\u0456.</p>

<form class="filters" method="get" action="/lookup">
  <div class="filter-row">
    <input type="search" name="edrpou" value="${esc(typed)}" placeholder="\u041D\u0430\u043F\u0440\u0438\u043A\u043B\u0430\u0434, 00131954 \u2014 \u0410\u0422 \xAB\u0425\u0430\u0440\u043A\u0456\u0432\u043E\u0431\u043B\u0435\u043D\u0435\u0440\u0433\u043E\xBB" aria-label="\u0404\u0414\u0420\u041F\u041E\u0423" inputmode="numeric">
    <button type="submit">\u0417\u043D\u0430\u0439\u0442\u0438</button>
  </div>
</form>

${typed && !code ? `<div class="empty">\xAB${esc(typed)}\xBB \u043D\u0435 \u0441\u0445\u043E\u0436\u0435 \u043D\u0430 \u043A\u043E\u0434 \u0404\u0414\u0420\u041F\u041E\u0423. \u0426\u0435 \u0432\u0456\u0434 \u0448\u0435\u0441\u0442\u0438 \u0434\u043E \u0434\u0435\u0441\u044F\u0442\u0438 \u0446\u0438\u0444\u0440.</div>` : ""}

${code && !found ? `<div class="empty">
  <p>\u041A\u043E\u0434 <strong>${esc(code)}</strong> \u0443 \u043D\u0430\u0448\u0456\u0439 \u0431\u0430\u0437\u0456 \u043D\u0435 \u0437\u0443\u0441\u0442\u0440\u0456\u0447\u0430\u0454\u0442\u044C\u0441\u044F.</p>
  <p class="faint">\u041C\u0438 \u0437\u0431\u0435\u0440\u0456\u0433\u0430\u0454\u043C\u043E \u043B\u0438\u0448\u0435 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0425\u0430\u0440\u043A\u0456\u0432\u0441\u044C\u043A\u043E\u0457 \u043E\u0431\u043B\u0430\u0441\u0442\u0456 \u0442\u0430 \u0444\u0456\u043B\u0456\u0439 \u0437\u0430\u043B\u0456\u0437\u043D\u0438\u0446\u0456, \u0443 \u044F\u043A\u0438\u0445 \u0441\u043F\u0440\u0430\u0446\u044E\u0432\u0430\u0432 \u0434\u0435\u0440\u0436\u0430\u0432\u043D\u0438\u0439 \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440. \u041F\u0456\u0434\u043F\u0440\u0438\u0454\u043C\u0441\u0442\u0432\u043E \u043C\u043E\u0436\u0435 \u0456\u0441\u043D\u0443\u0432\u0430\u0442\u0438 \u0439 \u043F\u0440\u0430\u0446\u044E\u0432\u0430\u0442\u0438 \u0432 \u0456\u043D\u0448\u0438\u0445 \u0440\u0435\u0433\u0456\u043E\u043D\u0430\u0445.</p>
  <p><a href="https://prozorro.gov.ua/search/tenders?edrpou=${encodeURIComponent(code)}" target="_blank" rel="noopener">\u041F\u043E\u0448\u0443\u043A \u0446\u044C\u043E\u0433\u043E \u043A\u043E\u0434\u0443 \u0432 Prozorro \u2192</a></p>
</div>` : ""}

${found && profile ? `${star("entity", code, "/lookup?edrpou=" + encodeURIComponent(code), { label: true })}
<h2>${esc(readableName(profile.name))}</h2>
<p class="statline">
  <b>${profile.asBuyer.length}</b> ${plural(profile.asBuyer.length, "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F \u044F\u043A \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u044F\u043A \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C \u044F\u043A \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A")} \xB7
  <b>${profile.asWinner.length}</b> ${plural(profile.asWinner.length, "\u043F\u0435\u0440\u0435\u043C\u043E\u0433\u0430 \u044F\u043A \u043F\u043E\u0441\u0442\u0430\u0447\u0430\u043B\u044C\u043D\u0438\u043A", "\u043F\u0435\u0440\u0435\u043C\u043E\u0433\u0438 \u044F\u043A \u043F\u043E\u0441\u0442\u0430\u0447\u0430\u043B\u044C\u043D\u0438\u043A", "\u043F\u0435\u0440\u0435\u043C\u043E\u0433 \u044F\u043A \u043F\u043E\u0441\u0442\u0430\u0447\u0430\u043B\u044C\u043D\u0438\u043A")}
</p>
<div class="filter-row" style="margin-bottom:1.5rem">
  ${profile.asBuyer.length ? `<a class="flag" href="/entity/${encodeURIComponent(code)}">\u0414\u043E\u0441\u044C\u0454 \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u0430 \u2192</a>` : ""}
  ${profile.asWinner.length ? `<a class="flag" href="/supplier/${encodeURIComponent(code)}">\u0414\u043E\u0441\u044C\u0454 \u043F\u043E\u0441\u0442\u0430\u0447\u0430\u043B\u044C\u043D\u0438\u043A\u0430 \u2192</a>` : ""}
</div>
<div class="rows">${[...profile.asBuyer, ...profile.asWinner].sort((a, b) => (b.value_amount ?? 0) - (a.value_amount ?? 0)).slice(0, 30).map((c) => caseRow(c)).join("")}</div>` : ""}
`
  });
}
function starredPage(saved, url) {
  const tenders = saved.filter((f) => f.kind === "tender").map((f) => db.byTender.get(f.id)).filter((c2) => Boolean(c2));
  const missingTenders = saved.filter((f) => f.kind === "tender").length - tenders.length;
  const c = readControls(url);
  const filteredTenders = applyControls(tenders, c, RAILWAY_EDRPOU);
  const companyRows = saved.filter((f) => f.kind === "entity" || f.kind === "supplier").map((f) => {
    const list = f.kind === "entity" ? db.cases.filter((c2) => c2.entity_edrpou === f.id) : db.cases.filter((c2) => c2.winner_edrpou === f.id);
    const name = f.kind === "entity" ? list.find((c2) => c2.entity_name)?.entity_name : list.find((c2) => c2.winner_name)?.winner_name;
    return {
      fav: f,
      href: `/${f.kind === "entity" ? "entity" : "supplier"}/${encodeURIComponent(f.id)}`,
      name: readableName(name ?? "") || f.id,
      role: f.kind === "entity" ? "\u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A" : "\u043F\u043E\u0441\u0442\u0430\u0447\u0430\u043B\u044C\u043D\u0438\u043A",
      count: list.length,
      value: list.reduce((sum2, c2) => sum2 + (c2.value_amount ?? 0), 0)
    };
  });
  const officerRows = saved.filter((f) => f.kind === "officer").map((f) => {
    const list = db.cases.filter((c2) => c2.officer_key === f.id);
    return {
      fav: f,
      href: `/officer/${encodeURIComponent(f.id)}`,
      name: list.find((c2) => c2.officer_name)?.officer_name ?? f.id,
      entity: readableName(list.find((c2) => c2.entity_name)?.entity_name ?? ""),
      count: list.length,
      value: list.reduce((sum2, c2) => sum2 + (c2.value_amount ?? 0), 0)
    };
  });
  const section = (title, count, inner) => count === 0 ? "" : `<h2>${esc(title)} \u2014 ${count}</h2>${inner}`;
  return layout({
    title: "\u041E\u0431\u0440\u0430\u043D\u0435",
    nav: "starred",
    body: `
<h1>\u041E\u0431\u0440\u0430\u043D\u0435</h1>
<p class="sub">\u0423\u0441\u0435, \u0449\u043E \u0432\u0438 \u043F\u043E\u0437\u043D\u0430\u0447\u0438\u043B\u0438 \u0437\u0456\u0440\u043E\u0447\u043A\u043E\u044E: \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456, \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A\u0438, \u043F\u043E\u0441\u0442\u0430\u0447\u0430\u043B\u044C\u043D\u0438\u043A\u0438, \u043F\u043E\u0441\u0430\u0434\u043E\u0432\u0446\u0456. \u0421\u043F\u0438\u0441\u043E\u043A \u0437\u0431\u0435\u0440\u0456\u0433\u0430\u0454\u0442\u044C\u0441\u044F \u0443 \u0432\u0430\u0448\u043E\u043C\u0443 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0456 \u0439 \u043D\u0435 \u043F\u0440\u0438\u0432'\u044F\u0437\u0430\u043D\u0438\u0439 \u0434\u043E \u043E\u0431\u043B\u0456\u043A\u043E\u0432\u043E\u0433\u043E \u0437\u0430\u043F\u0438\u0441\u0443.</p>

<form class="filters" method="get" action="/lookup">
  <div class="filter-row">
    <input type="search" name="edrpou" placeholder="\u0417\u043D\u0430\u0439\u0442\u0438 \u043F\u0456\u0434\u043F\u0440\u0438\u0454\u043C\u0441\u0442\u0432\u043E \u0437\u0430 \u0404\u0414\u0420\u041F\u041E\u0423 \u2014 \u043D\u0430\u043F\u0440\u0438\u043A\u043B\u0430\u0434, 00131954" aria-label="\u0404\u0414\u0420\u041F\u041E\u0423" inputmode="numeric">
    <button type="submit">\u0417\u043D\u0430\u0439\u0442\u0438</button>
  </div>
</form>

${saved.length === 0 ? `<div class="empty">\u041F\u043E\u043A\u0438 \u043D\u0456\u0447\u043E\u0433\u043E \u043D\u0435 \u043F\u043E\u0437\u043D\u0430\u0447\u0435\u043D\u043E. \u041D\u0430\u0442\u0438\u0441\u043D\u0456\u0442\u044C \u2606 \u0431\u0456\u043B\u044F \u0431\u0443\u0434\u044C-\u044F\u043A\u043E\u0457 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456, \u043A\u043E\u043C\u043F\u0430\u043D\u0456\u0457 \u0447\u0438 \u043F\u043E\u0441\u0430\u0434\u043E\u0432\u0446\u044F.</div>` : ""}

${section(
      "\u0417\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456",
      tenders.length,
      `${sortBar("/starred", c)}${filterPanel("/starred", c)}${listBody(filteredTenders, c, "/starred")}${missingTenders > 0 ? `<p class="note">${missingTenders} ${plural(missingTenders, "\u043F\u043E\u0437\u043D\u0430\u0447\u0435\u043D\u0430 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F \u0431\u0456\u043B\u044C\u0448\u0435 \u043D\u0435 \u0437\u043D\u0430\u0439\u0434\u0435\u043D\u0430", "\u043F\u043E\u0437\u043D\u0430\u0447\u0435\u043D\u0456 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0431\u0456\u043B\u044C\u0448\u0435 \u043D\u0435 \u0437\u043D\u0430\u0439\u0434\u0435\u043D\u0456", "\u043F\u043E\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0445 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C \u0431\u0456\u043B\u044C\u0448\u0435 \u043D\u0435 \u0437\u043D\u0430\u0439\u0434\u0435\u043D\u043E")} \u0432 \u0431\u0430\u0437\u0456.</p>` : ""}`
    )}

${section(
      "\u041A\u043E\u043C\u043F\u0430\u043D\u0456\u0457",
      companyRows.length,
      `<div class="rows">${companyRows.map(
        (r) => `<div class="row">
  <div class="who">
    <div class="name">${star(r.fav.kind, r.fav.id, "/starred")}<a href="${esc(r.href)}">${esc(r.name)}</a></div>
    <div class="meta">\u0404\u0414\u0420\u041F\u041E\u0423 ${esc(r.fav.id)} \xB7 ${esc(r.role)} \xB7 ${r.count} ${plural(r.count, "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C")}</div>
  </div>
  <div class="amount"><span class="big">${shortMoney(r.value)}</span></div>
</div>`
      ).join("")}</div>`
    )}

${section(
      "\u041F\u043E\u0441\u0430\u0434\u043E\u0432\u0446\u0456",
      officerRows.length,
      `<div class="rows">${officerRows.map(
        (r) => `<div class="row">
  <div class="who">
    <div class="name">${star("officer", r.fav.id, "/starred")}<a href="${esc(r.href)}">${esc(r.name)}</a></div>
    <div class="meta">${esc(r.entity)} \xB7 ${r.count} ${plural(r.count, "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456", "\u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C")}</div>
  </div>
  <div class="amount"><span class="big">${shortMoney(r.value)}</span></div>
</div>`
      ).join("")}</div>`
    )}
`
  });
}
function indicatorsPage() {
  const counted = new Map(rankRisks(db.cases));
  const ranked = db.rules.map((r) => [r.risk_id, counted.get(r.risk_id) ?? 0]).sort((a, b) => b[1] - a[1]);
  return layout({
    title: "\u0429\u043E \u043C\u0438 \u0448\u0443\u043A\u0430\u0454\u043C\u043E",
    nav: "indicators",
    body: `
<h1>\u0429\u043E \u043C\u0438 \u0448\u0443\u043A\u0430\u0454\u043C\u043E</h1>
<p class="sub">\u0427\u043E\u0442\u0438\u0440\u043D\u0430\u0434\u0446\u044F\u0442\u044C \u043E\u0437\u043D\u0430\u043A, \u0437\u0430 \u044F\u043A\u0438\u043C\u0438 \u0434\u0435\u0440\u0436\u0430\u0432\u0430 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454 \u043A\u043E\u0436\u043D\u0443 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044E. \u041D\u0438\u0436\u0447\u0435 \u2014 \u0449\u043E \u043A\u043E\u0436\u043D\u0430 \u043E\u0437\u043D\u0430\u0447\u0430\u0454 \u0437\u0432\u0438\u0447\u0430\u0439\u043D\u043E\u044E \u043C\u043E\u0432\u043E\u044E \u0456 \u0441\u043A\u0456\u043B\u044C\u043A\u0438 \u0440\u0430\u0437\u0456\u0432 \u0432\u043E\u043D\u0430 \u0441\u043F\u0440\u0430\u0446\u044E\u0432\u0430\u043B\u0430 \u0432 ${esc(REGION)} \u0442\u0430 \u043D\u0430 \u0437\u0430\u043B\u0456\u0437\u043D\u0438\u0446\u0456.</p>
${groupedRiskCards(ranked)}
`
  });
}
function aboutPage() {
  return layout({
    title: "\u041F\u0440\u043E \u0441\u0438\u0441\u0442\u0435\u043C\u0443",
    nav: "about",
    body: `
<h1>\u041F\u0440\u043E \u0441\u0438\u0441\u0442\u0435\u043C\u0443</h1>
<p class="sub">\u0429\u043E \u043F\u043E\u043A\u0430\u0437\u0443\u0454 \u0446\u0435\u0439 \u0441\u0430\u0439\u0442, \u0437\u0432\u0456\u0434\u043A\u0438 \u0431\u0435\u0440\u0435 \u0434\u0430\u043D\u0456 \u0456 \u0447\u043E\u0433\u043E \u043D\u0435 \u0440\u043E\u0431\u0438\u0442\u044C.</p>

<div class="card">
  <h3>\u0417\u0432\u0456\u0434\u043A\u0438 \u0434\u0430\u043D\u0456</h3>
  <p class="lead">\u0414\u0435\u0440\u0436\u0430\u0432\u043D\u0430 \u0441\u0438\u0441\u0442\u0435\u043C\u0430 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u043D\u0438\u0445 \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u0456\u0432 \u0440\u0438\u0437\u0438\u043A\u0443 Prozorro \u2014 \u043D\u0430\u043A\u0430\u0437 \u041C\u0456\u043D\u0444\u0456\u043D\u0443 \u2116 476 \u0432\u0456\u0434 27 \u0432\u0435\u0440\u0435\u0441\u043D\u044F 2024 \u0440\u043E\u043A\u0443. \u0414\u0435\u0440\u0436\u0430\u0432\u0430 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454 \u043A\u043E\u0436\u043D\u0443 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044E \u0437\u0430 \u0447\u0438\u043D\u043D\u0438\u043C \u043F\u0435\u0440\u0435\u043B\u0456\u043A\u043E\u043C \u043E\u0437\u043D\u0430\u043A \u0456 \u043F\u0443\u0431\u043B\u0456\u043A\u0443\u0454 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u0432\u0456\u0434\u043A\u0440\u0438\u0442\u043E.</p>
  <p>\u041C\u0438 \u0437\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0443\u0454\u043C\u043E \u0446\u0435\u0439 \u043C\u0430\u0441\u0438\u0432, \u0432\u0456\u0434\u0431\u0438\u0440\u0430\u0454\u043C\u043E ${esc(REGION)} \u0442\u0430 \u0444\u0456\u043B\u0456\u0457 \u0410\u0422 \xAB\u0423\u043A\u0440\u0430\u0457\u043D\u0441\u044C\u043A\u0430 \u0437\u0430\u043B\u0456\u0437\u043D\u0438\u0446\u044F\xBB, \u0434\u043E\u043F\u043E\u0432\u043D\u044E\u0454\u043C\u043E \u043A\u0430\u0440\u0442\u043A\u0430\u043C\u0438 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u0435\u043B\u044C \u0456\u0437 Prozorro \u2014 \u0437\u0432\u0456\u0434\u043A\u0438 \u0431\u0435\u0440\u0435\u043C\u043E \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u043B\u044C\u043D\u0443 \u043E\u0441\u043E\u0431\u0443, \u043A\u0456\u043B\u044C\u043A\u0456\u0441\u0442\u044C \u0443\u0447\u0430\u0441\u043D\u0438\u043A\u0456\u0432 \u0456 \u043F\u0435\u0440\u0435\u043C\u043E\u0436\u0446\u044F \u2014 \u0456 \u043F\u043E\u0434\u0430\u0454\u043C\u043E \u0442\u0430\u043A, \u0449\u043E\u0431 \u0437 \u0446\u0438\u043C \u043C\u043E\u0436\u043D\u0430 \u0431\u0443\u043B\u043E \u043F\u0440\u0430\u0446\u044E\u0432\u0430\u0442\u0438.</p>
</div>

<div class="card">
  <h3>\u0422\u0440\u0438 \u0440\u0456\u0432\u043D\u0456 \u0434\u043E\u0441\u0442\u043E\u0432\u0456\u0440\u043D\u043E\u0441\u0442\u0456</h3>
  <p><span class="tier confirmed">\u041F\u0435\u0440\u0435\u0432\u0456\u0440\u0438\u043B\u0430 \u0434\u0435\u0440\u0436\u0430\u0432\u0430</span> &nbsp;\u0414\u0435\u0440\u0436\u0430\u0443\u0434\u0438\u0442\u0441\u043B\u0443\u0436\u0431\u0430 \u043F\u0440\u043E\u0432\u0435\u043B\u0430 \u043C\u043E\u043D\u0456\u0442\u043E\u0440\u0438\u043D\u0433 \u0456 \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u043B\u0430 \u043F\u043E\u0440\u0443\u0448\u0435\u043D\u043D\u044F.</p>
  <p><span class="tier state">\u041F\u043E\u0437\u043D\u0430\u0447\u0438\u043B\u0430 \u0434\u0435\u0440\u0436\u0430\u0432\u0430</span> &nbsp;\u0421\u043F\u0440\u0430\u0446\u044E\u0432\u0430\u0432 \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440 \u0434\u0435\u0440\u0436\u0430\u0432\u043D\u043E\u0457 \u0441\u0438\u0441\u0442\u0435\u043C\u0438. \u0426\u0435 \u043F\u0456\u0434\u043E\u0437\u0440\u0430 \u0434\u0435\u0440\u0436\u0430\u0432\u0438 \u0437 \u043F\u043E\u0441\u0438\u043B\u0430\u043D\u043D\u044F\u043C \u043D\u0430 \u043D\u043E\u0440\u043C\u0443 \u0437\u0430\u043A\u043E\u043D\u0443 \u2014 \u0441\u0430\u043C\u0435 \u0446\u0435 \u043F\u043E\u043A\u0430\u0437\u0430\u043D\u043E \u043D\u0430 \u0441\u0430\u0439\u0442\u0456 \u0441\u044C\u043E\u0433\u043E\u0434\u043D\u0456.</p>
  <p><span class="tier own">\u041F\u043E\u0440\u0430\u0445\u0443\u0432\u0430\u043B\u0438 \u043C\u0438</span> &nbsp;\u041D\u0430\u0448 \u0440\u043E\u0437\u0440\u0430\u0445\u0443\u043D\u043E\u043A: \u0446\u0456\u043D\u0430 \u0437\u0430 \u043E\u0434\u0438\u043D\u0438\u0446\u044E \u043F\u0440\u043E\u0442\u0438 \u043A\u0430\u0442\u0430\u043B\u043E\u0436\u043D\u043E\u0457. \u041F\u0456\u0434\u043A\u043B\u044E\u0447\u0430\u0454\u0442\u044C\u0441\u044F \u043D\u0430\u0441\u0442\u0443\u043F\u043D\u0438\u043C \u0435\u0442\u0430\u043F\u043E\u043C.</p>
  <p>\u041D\u0438\u0436\u0447\u0438\u0439 \u0440\u0456\u0432\u0435\u043D\u044C \u043D\u0456\u043A\u043E\u043B\u0438 \u043D\u0435 \u043F\u043E\u0434\u0430\u0454\u0442\u044C\u0441\u044F \u044F\u043A \u0432\u0438\u0449\u0438\u0439.</p>
</div>

<div class="card">
  <h3>\u041F\u0440\u043E \u0441\u0442\u043E\u0440\u0456\u043D\u043A\u0438 \u043F\u043E\u0441\u0430\u0434\u043E\u0432\u0446\u0456\u0432</h3>
  <p>\u0406\u043C'\u044F, \u043F\u043E\u0448\u0442\u0430 \u0439 \u0442\u0435\u043B\u0435\u0444\u043E\u043D \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u043B\u044C\u043D\u043E\u0457 \u043E\u0441\u043E\u0431\u0438 \u0432\u0437\u044F\u0442\u0456 \u0437 \u043A\u0430\u0440\u0442\u043A\u0438 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u0456 \u0432 Prozorro, \u0434\u0435 \u0437\u0430\u043C\u043E\u0432\u043D\u0438\u043A \u0441\u0430\u043C \u0457\u0445 \u043F\u0443\u0431\u043B\u0456\u043A\u0443\u0454. \u041E\u0434\u043D\u0443 \u043B\u044E\u0434\u0438\u043D\u0443 \u043C\u0456\u0436 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F\u043C\u0438 \u0437\u0456\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u043E \u0437\u0430 \u043F\u043E\u0448\u0442\u043E\u044E, \u0431\u043E \u043D\u0430\u043F\u0438\u0441\u0430\u043D\u043D\u044F \u0456\u043C\u0435\u043D\u0456 \u0440\u0456\u0437\u043D\u0438\u0442\u044C\u0441\u044F.</p>
  <p>\u0421\u0442\u043E\u0440\u0456\u043D\u043A\u0430 \u043F\u043E\u0441\u0430\u0434\u043E\u0432\u0446\u044F \u043F\u043E\u043A\u0430\u0437\u0443\u0454, \u0443 \u0441\u043A\u0456\u043B\u044C\u043A\u043E\u0445 \u0439\u043E\u0433\u043E \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F\u0445 \u0441\u043F\u0440\u0430\u0446\u044E\u0432\u0430\u043B\u0438 \u0434\u0435\u0440\u0436\u0430\u0432\u043D\u0456 \u0456\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u0438 \u0456 \u0437\u0430 \u044F\u043A\u0438\u043C\u0438 \u043D\u043E\u0440\u043C\u0430\u043C\u0438 \u0437\u0430\u043A\u043E\u043D\u0443. <strong>\u0426\u0435 \u043D\u0435 \u0441\u0443\u0434\u0438\u043C\u0456\u0441\u0442\u044C \u0456 \u043D\u0435 \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0430 \u0432\u0438\u043D\u0430.</strong></p>
</div>

<div class="card">
  <h3>\u0427\u043E\u043C\u0443 \u0442\u0443\u0442 \u043D\u0435\u043C\u0430\u0454 \u0441\u0443\u0434\u0438\u043C\u043E\u0441\u0442\u0435\u0439</h3>
  <p>\u0404\u0434\u0438\u043D\u0438\u0439 \u0434\u0435\u0440\u0436\u0430\u0432\u043D\u0438\u0439 \u0440\u0435\u0454\u0441\u0442\u0440 \u0441\u0443\u0434\u043E\u0432\u0438\u0445 \u0440\u0456\u0448\u0435\u043D\u044C \u0437\u0430\u043A\u0440\u0438\u0442\u0438\u0439 CAPTCHA, \u0430 \u0432 \u0442\u0435\u043A\u0441\u0442\u0430\u0445 \u043A\u0440\u0438\u043C\u0456\u043D\u0430\u043B\u044C\u043D\u0438\u0445 \u0440\u0456\u0448\u0435\u043D\u044C \u0456\u043C\u0435\u043D\u0430 \u0437\u0430\u043C\u0456\u043D\u0435\u043D\u0456 \u043D\u0430 \xAB\u041E\u0421\u041E\u0411\u0410_1\xBB \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u043D\u043E \u0434\u043E \u0437\u0430\u043A\u043E\u043D\u043E\u0434\u0430\u0432\u0441\u0442\u0432\u0430 \u043F\u0440\u043E \u0437\u0430\u0445\u0438\u0441\u0442 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u044C\u043D\u0438\u0445 \u0434\u0430\u043D\u0438\u0445. \u0417\u0456\u0441\u0442\u0430\u0432\u0438\u0442\u0438 \u0441\u0443\u0434\u0438\u043C\u0456\u0441\u0442\u044C \u0456\u0437 \u043B\u044E\u0434\u0438\u043D\u043E\u044E \u0437\u0430 \u0437\u0431\u0456\u0433\u043E\u043C \u043F\u0440\u0456\u0437\u0432\u0438\u0449\u0430 \u043D\u0435\u043C\u043E\u0436\u043B\u0438\u0432\u043E \u043D\u0430\u0434\u0456\u0439\u043D\u043E, \u0430 \u043F\u043E\u043C\u0438\u043B\u043A\u0430 \u0442\u0443\u0442 \u2014 \u0446\u0435 \u0437\u0432\u0438\u043D\u0443\u0432\u0430\u0447\u0435\u043D\u043D\u044F \u043D\u0435\u0432\u0438\u043D\u043D\u043E\u0433\u043E.</p>
  <p>\u0422\u043E\u043C\u0443 \u0441\u0438\u0441\u0442\u0435\u043C\u0430 \u043F\u043E\u043A\u0430\u0437\u0443\u0454 \u043B\u0438\u0448\u0435 \u0442\u0435, \u0449\u043E \u043C\u043E\u0436\u043D\u0430 \u0434\u043E\u0432\u0435\u0441\u0442\u0438: \u044F\u043A\u0456 \u043E\u0437\u043D\u0430\u043A\u0438 \u0434\u0435\u0440\u0436\u0430\u0432\u043D\u0430 \u0441\u0438\u0441\u0442\u0435\u043C\u0430 \u0432\u0438\u044F\u0432\u0438\u043B\u0430 \u0432 \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u0438\u0445 \u0437\u0430\u043A\u0443\u043F\u0456\u0432\u043B\u044F\u0445 \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u043E\u0457 \u043E\u0441\u043E\u0431\u0438.</p>
</div>

<div class="card">
  <h3>\u0427\u043E\u0433\u043E \u0441\u0438\u0441\u0442\u0435\u043C\u0430 \u043D\u0435 \u0440\u043E\u0431\u0438\u0442\u044C</h3>
  <p>\u0412\u043E\u043D\u0430 \u043D\u0435 \u043E\u0433\u043E\u043B\u043E\u0448\u0443\u0454 \u0432\u0438\u043D\u0443 \u0456 \u043D\u0435 \u043D\u0430\u0437\u0438\u0432\u0430\u0454 \u0436\u043E\u0434\u043D\u0443 \u0444\u0456\u0440\u043C\u0443 \u0447\u0438 \u043B\u044E\u0434\u0438\u043D\u0443 \u0437\u043B\u043E\u0447\u0438\u043D\u0446\u0435\u043C. \u0412\u043E\u043D\u0430 \u043F\u043E\u043A\u0430\u0437\u0443\u0454 \u043E\u0437\u043D\u0430\u043A\u0438 \u0440\u0438\u0437\u0438\u043A\u0443, \u044F\u043A\u0456 \u043F\u043E\u0442\u0440\u0435\u0431\u0443\u044E\u0442\u044C \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u043A\u0438, \u0456 \u0437\u0430\u0432\u0436\u0434\u0438 \u0434\u0430\u0454 \u043F\u043E\u0441\u0438\u043B\u0430\u043D\u043D\u044F \u043D\u0430 \u043F\u0435\u0440\u0448\u043E\u0434\u0436\u0435\u0440\u0435\u043B\u043E, \u0449\u043E\u0431 \u0432\u0438\u0441\u043D\u043E\u0432\u043E\u043A \u043C\u043E\u0436\u043D\u0430 \u0431\u0443\u043B\u043E \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u0438\u0442\u0438 \u0432\u0440\u0443\u0447\u043D\u0443.</p>
</div>
`
  });
}
function notFound() {
  return layout({
    title: "\u041D\u0435 \u0437\u043D\u0430\u0439\u0434\u0435\u043D\u043E",
    body: `<h1>\u041D\u0435 \u0437\u043D\u0430\u0439\u0434\u0435\u043D\u043E</h1><p class="sub">\u0422\u0430\u043A\u043E\u0457 \u0441\u0442\u043E\u0440\u0456\u043D\u043A\u0438 \u043D\u0435\u043C\u0430\u0454. <a href="/">\u0414\u043E \u043F\u0435\u0440\u0435\u043B\u0456\u043A\u0443 \u0437\u043D\u0430\u0445\u0456\u0434\u043E\u043A \u2192</a></p>`
  });
}
function render(url, saved = []) {
  starred = saved;
  const path = decodeURIComponent(url.pathname);
  if (path === "/lookup") {
    const code = normaliseEdrpou(url.searchParams.get("edrpou") ?? "");
    if (!code) return { status: 200, body: lookupPage(null, url.searchParams.get("edrpou") ?? "") };
    return { status: 200, body: lookupPage(code, code) };
  }
  if (path === "/starred") return { status: 200, body: starredPage(saved, url) };
  if (path === "/") return { status: 200, body: feedPage(url) };
  if (path === "/entities") return { status: 200, body: entitiesPage(url) };
  if (path === "/officers") return { status: 200, body: officersPage(url) };
  if (path === "/suppliers") return { status: 200, body: suppliersPage(url) };
  if (path === "/railway") return { status: 200, body: railwayPage(url) };
  if (path === "/updates") return { status: 200, body: updatesPage(url) };
  if (path === "/prices") return { status: 200, body: pricesPage(url) };
  if (path === "/indicators") return { status: 200, body: indicatorsPage() };
  if (path === "/about") return { status: 200, body: aboutPage() };
  if (path.startsWith("/article/")) return { status: 200, body: articlePage(path.slice("/article/".length), url) };
  if (path.startsWith("/tender/")) {
    const rest = path.slice("/tender/".length);
    if (rest.endsWith("/report") || rest.endsWith("/report.txt")) {
      const asText = rest.endsWith(".txt");
      const id = rest.slice(0, rest.lastIndexOf("/report"));
      const entry = db.byTender.get(id);
      if (!entry) return { status: 404, body: notFound() };
      const sameEntity = db.cases.filter((x) => x.entity_edrpou && x.entity_edrpou === entry.entity_edrpou);
      const sameOfficer = entry.officer_key ? db.cases.filter((x) => x.officer_key === entry.officer_key) : [];
      const sameWinner = entry.winner_edrpou ? db.cases.filter((x) => x.winner_edrpou === entry.winner_edrpou) : [];
      const ctx = {
        entry,
        rules: db.ruleById,
        sameEntity: sameEntity.length,
        sameOfficer: sameOfficer.length,
        sameWinner: sameWinner.length,
        conclusion: buildConclusion({ entry, sameEntity, sameOfficer, sameWinner }),
        generatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      return asText ? {
        status: 200,
        body: reportText(ctx),
        contentType: "text/plain; charset=utf-8",
        filename: `${entry.tender_ref || entry.tender_id}.txt`
      } : { status: 200, body: reportHtml(ctx) };
    }
    return { status: 200, body: tenderPage(rest) };
  }
  if (path.startsWith("/entity/")) return { status: 200, body: entityPage(path.slice("/entity/".length), url) };
  if (path.startsWith("/officer/")) return { status: 200, body: officerPage(path.slice("/officer/".length), url) };
  if (path.startsWith("/supplier/")) return { status: 200, body: supplierPage(path.slice("/supplier/".length), url) };
  return { status: 404, body: notFound() };
}

// server/auth-pages.ts
var SHELL_STYLES = `
:root{color-scheme:light;--paper:#F6F8F9;--surface:#FFFFFF;--ink:#17222B;--ink-soft:#4A5966;
--line:#DDE4E8;--accent:#17607F;--accent-bg:#E6F0F4;--alarm:#A03A2B;--alarm-bg:#FBE9E5;
--shadow:0 1px 2px rgba(23,34,43,.04),0 8px 24px -18px rgba(23,34,43,.26);--radius:5px;
--f-display:"Literata",Georgia,serif;--f-body:"IBM Plex Sans","Segoe UI",system-ui,sans-serif}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
background:var(--paper);color:var(--ink);font-family:var(--f-body);padding:1.5rem}
.box{max-width:26rem;width:100%;background:var(--surface);border:1px solid var(--line);
border-radius:var(--radius);box-shadow:var(--shadow);padding:2rem 1.75rem;text-align:center}
h1{font-family:var(--f-display);font-weight:700;font-size:1.4rem;margin:0 0 .6rem}
p{color:var(--ink-soft);font-size:.96rem;line-height:1.55;margin:0 0 1.5rem}
p.denied{background:var(--alarm-bg);color:var(--alarm);border-radius:var(--radius);padding:.7rem 1rem;font-size:.9rem}
a.btn{display:inline-flex;align-items:center;gap:.6rem;background:var(--accent);color:#fff;
text-decoration:none;font-weight:500;padding:.7rem 1.4rem;border-radius:var(--radius)}
a.btn:hover{filter:brightness(1.08)}
`;
function shell(title, body) {
  return `<!doctype html>
<html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} \u2014 Tender Radar</title><style>${SHELL_STYLES}</style></head>
<body><div class="box">${body}</div></body></html>`;
}
function loginPage() {
  return shell(
    "\u0412\u0445\u0456\u0434",
    `<h1>Tender Radar</h1>
<p>\u0414\u043E\u0441\u0442\u0443\u043F \u0434\u043E \u0441\u0430\u0439\u0442\u0443 \u0432\u0456\u0434\u043A\u0440\u0438\u0442\u043E \u0434\u043B\u044F \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u0435\u043D\u0438\u0445 \u043E\u0431\u043B\u0456\u043A\u043E\u0432\u0438\u0445 \u0437\u0430\u043F\u0438\u0441\u0456\u0432. \u0423\u0432\u0456\u0439\u0434\u0456\u0442\u044C \u0447\u0435\u0440\u0435\u0437 Google, \u0449\u043E\u0431 \u043F\u0440\u043E\u0434\u043E\u0432\u0436\u0438\u0442\u0438.</p>
<a class="btn" href="/auth/login">\u0423\u0432\u0456\u0439\u0442\u0438 \u0447\u0435\u0440\u0435\u0437 Google</a>`
  );
}
function deniedPage(message) {
  return shell(
    "\u0414\u043E\u0441\u0442\u0443\u043F \u043D\u0435 \u043D\u0430\u0434\u0430\u043D\u043E",
    `<h1>\u0414\u043E\u0441\u0442\u0443\u043F \u043D\u0435 \u043D\u0430\u0434\u0430\u043D\u043E</h1>
<p class="denied">${esc(message)}</p>
<a class="btn" href="/auth/login">\u0421\u043F\u0440\u043E\u0431\u0443\u0432\u0430\u0442\u0438 \u0449\u0435 \u0440\u0430\u0437</a>`
  );
}

// server/auth.ts
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
var SESSION_COOKIE = "tr_session";
var STATE_COOKIE = "tr_oauth_state";
var SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1e3;
var STATE_TTL_SECONDS = 600;
function loadAuthConfig(env = process.env) {
  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  const sessionSecret = env.SESSION_SECRET;
  const allowedRaw = env.ALLOWED_EMAILS;
  if (!clientId || !clientSecret || !sessionSecret || !allowedRaw) return null;
  const allowedEmails = new Set(
    allowedRaw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
  );
  if (allowedEmails.size === 0) return null;
  return { clientId, clientSecret, sessionSecret, allowedEmails };
}
function sign(value, secret) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}
function readCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}
function cookieAttrs(secure) {
  return `HttpOnly; SameSite=Lax; Path=/${secure ? "; Secure" : ""}`;
}
function randomState() {
  return randomBytes(16).toString("base64url");
}
function setStateCookie(state, secure) {
  return `${STATE_COOKIE}=${state}; ${cookieAttrs(secure)}; Max-Age=${STATE_TTL_SECONDS}`;
}
function clearStateCookie(secure) {
  return `${STATE_COOKIE}=; ${cookieAttrs(secure)}; Max-Age=0`;
}
function createSessionCookie(email, secret, secure) {
  const expires = Date.now() + SESSION_TTL_MS;
  const payload = `${email}|${expires}`;
  const value = encodeURIComponent(`${payload}|${sign(payload, secret)}`);
  return `${SESSION_COOKIE}=${value}; ${cookieAttrs(secure)}; Max-Age=${Math.floor(SESSION_TTL_MS / 1e3)}`;
}
function clearSessionCookie(secure) {
  return `${SESSION_COOKIE}=; ${cookieAttrs(secure)}; Max-Age=0`;
}
function readSessionEmail(cookieHeader, secret) {
  const raw = readCookie(cookieHeader, SESSION_COOKIE);
  if (!raw) return null;
  const parts = raw.split("|");
  if (parts.length !== 3) return null;
  const [email, expiresStr, signature] = parts;
  const expected = sign(`${email}|${expiresStr}`, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (!Number.isFinite(Number(expiresStr)) || Date.now() > Number(expiresStr)) return null;
  return email;
}
function authorizeUrl(config, redirectUri, state) {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email",
    state,
    prompt: "select_account"
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
async function exchangeCode(config, code, redirectUri) {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    })
  });
  if (!tokenRes.ok) return null;
  const token = await tokenRes.json();
  if (!token.id_token) return null;
  const infoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token.id_token)}`);
  if (!infoRes.ok) return null;
  const claims = await infoRes.json();
  if (claims.aud !== config.clientId || !claims.email) return null;
  return { email: claims.email.toLowerCase(), emailVerified: claims.email_verified === "true" };
}

// server/router.ts
function page(status, body, headers = {}) {
  return { status, body, headers: { "content-type": "text/html; charset=utf-8", ...headers } };
}
function redirect(location, setCookie) {
  const headers = { location };
  if (setCookie) headers["set-cookie"] = setCookie;
  return { status: 302, body: "", headers };
}
function safeBack(value) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/starred";
  return value;
}
async function handle(req) {
  const config = loadAuthConfig();
  const secure = req.url.protocol === "https:";
  const saved = parseFavourites(readCookie(req.cookieHeader, FAVOURITES_COOKIE));
  function serve() {
    if (req.url.pathname === "/starred/toggle" && (req.method ?? "GET").toUpperCase() === "POST") {
      const form = new URLSearchParams(req.body ?? "");
      const kind = form.get("kind") ?? "";
      const id = (form.get("id") ?? "").trim();
      const back = safeBack(form.get("back"));
      if (!isFavKind(kind) || !id) return redirect(back);
      return redirect(back, favouritesCookie(toggleFavourite(saved, kind, id), secure));
    }
    const rendered = render(req.url, saved);
    if (rendered.contentType) {
      return {
        status: rendered.status,
        body: rendered.body,
        headers: {
          "content-type": rendered.contentType,
          ...rendered.filename ? { "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(rendered.filename)}` } : {}
        }
      };
    }
    return page(rendered.status, rendered.body);
  }
  if (!config) return serve();
  const redirectUri = `${req.url.origin}/auth/callback`;
  if (req.url.pathname === "/auth/login") {
    const state = randomState();
    return redirect(authorizeUrl(config, redirectUri, state), setStateCookie(state, secure));
  }
  if (req.url.pathname === "/auth/logout") {
    return redirect("/auth/login", clearSessionCookie(secure));
  }
  if (req.url.pathname === "/auth/callback") {
    const code = req.url.searchParams.get("code");
    const returnedState = req.url.searchParams.get("state");
    const expectedState = readCookie(req.cookieHeader, STATE_COOKIE);
    if (!code || !returnedState || !expectedState || returnedState !== expectedState) {
      return page(400, deniedPage("\u041D\u0435\u0434\u0456\u0439\u0441\u043D\u0438\u0439 \u0437\u0430\u043F\u0438\u0442 \u043D\u0430 \u0432\u0445\u0456\u0434. \u0421\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0449\u0435 \u0440\u0430\u0437."), {
        "set-cookie": clearStateCookie(secure)
      });
    }
    const identity = await exchangeCode(config, code, redirectUri);
    const clearState = clearStateCookie(secure);
    if (!identity || !identity.emailVerified) {
      return page(403, deniedPage("\u041D\u0435 \u0432\u0434\u0430\u043B\u043E\u0441\u044F \u043F\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0438 \u043F\u043E\u0448\u0442\u0443 Google."), { "set-cookie": clearState });
    }
    if (!config.allowedEmails.has(identity.email)) {
      return page(403, deniedPage(`\u0414\u043E\u0441\u0442\u0443\u043F \u0434\u043B\u044F ${identity.email} \u043D\u0435 \u043D\u0430\u0434\u0430\u043D\u043E. \u0417\u0432\u0435\u0440\u043D\u0456\u0442\u044C\u0441\u044F \u0434\u043E \u0432\u043B\u0430\u0441\u043D\u0438\u043A\u0430 \u0441\u0430\u0439\u0442\u0443.`), {
        "set-cookie": clearState
      });
    }
    return redirect("/", [createSessionCookie(identity.email, config.sessionSecret, secure), clearState]);
  }
  const email = readSessionEmail(req.cookieHeader, config.sessionSecret);
  if (!email || !config.allowedEmails.has(email)) {
    return page(200, loginPage());
  }
  return serve();
}

// api-src/handler.ts
async function handler(req, res) {
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost";
  const url = new URL(req.url ?? "/", `${proto}://${host}`);
  let payload = "";
  if (req.method === "POST") {
    for await (const chunk of req) payload += chunk;
  }
  const { status, body, headers } = await handle({
    url,
    cookieHeader: req.headers.cookie ?? null,
    method: req.method,
    body: payload
  });
  res.statusCode = status;
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
  res.setHeader("cache-control", "private, no-store");
  res.setHeader("vary", "Cookie");
  res.end(body);
}
export {
  handler as default
};
