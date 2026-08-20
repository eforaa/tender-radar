import { existsSync } from "node:fs";
import { join } from "node:path";
import { JsonStore } from "./store/json-store.ts";
import type { Store } from "./store/types.ts";

/** Exactly the string the state APIs emit. Do not normalise. */
export const REGION = "Харківська область";

/** The Kharkiv regional branch of Ukrainian Railways. */
export const SOUTHERN_RAILWAY_EDRPOU = "40081216";

/** Branches of AT "Ukrainian Railways" tracked regardless of their region. */
export const RAILWAY_EDRPOU = new Set([
  SOUTHERN_RAILWAY_EDRPOU, // РФ "Південна залізниця" — the Kharkiv branch
  "40081347", // Філія "Центр забезпечення виробництва"
  "41022900", // Філія "Пасажирська компанія"
  "40123454", // Філія "Центр з ремонту та експлуатації колійних машин"
  "45462724", // Філія "УЗ Вагон-Сервіс"
  "45246390", // Філія "Приміська пасажирська компанія"
]);

/**
 * Matches railway organisations by name. Deliberately narrow: an earlier,
 * looser pattern that included "станц" swept in Зміївська теплова
 * електростанція and a poultry research station.
 */
const RAILWAY_NAME = /залізни|укрзаліз|колійн|локомотив|вагон|тепловоз|електровоз/i;

export type RailwayScope =
  /** РФ "Південна залізниця" — the Kharkiv oblast railway itself. */
  | "southern"
  /** Other Ukrainian Railways branches, registered outside the oblast. */
  | "branch"
  /** Railway organisations registered in Kharkiv oblast — colleges, the university. */
  | "local"
  | null;

export function railwayScope(entity: {
  entity_edrpou: string | null;
  entity_name: string | null;
  region: string | null;
}): RailwayScope {
  const edrpou = entity.entity_edrpou ?? "";
  if (edrpou === SOUTHERN_RAILWAY_EDRPOU) return "southern";
  if (RAILWAY_EDRPOU.has(edrpou)) return "branch";
  if (entity.region === REGION && RAILWAY_NAME.test(entity.entity_name ?? "")) return "local";
  return null;
}

/**
 * Resolved from this file's location, not the working directory, so the
 * server finds its data no matter where it is launched from.
 *
 * Falls back to the slim `web-data` export when the full working store is not
 * there — which is the case on a deployment, where `data/` is not shipped.
 */
export function dataDir(): string {
  if (process.env.TR_DATA_DIR) return process.env.TR_DATA_DIR;
  const working = join(import.meta.dirname, "..", "data");
  return existsSync(working) ? working : join(import.meta.dirname, "..", "web-data");
}

export function openStore(): Store {
  return new JsonStore(dataDir());
}
