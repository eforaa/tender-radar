import { join } from "node:path";
import { JsonStore } from "./store/json-store.ts";
import type { Store } from "./store/types.ts";

/** Exactly the string the state APIs emit. Do not normalise. */
export const REGION = "Харківська область";

/** Branches of AT "Ukrainian Railways" tracked regardless of their region. */
export const RAILWAY_EDRPOU = new Set([
  "40081216", // РФ "Південна залізниця" — the Kharkiv branch
  "40081347", // Філія "Центр забезпечення виробництва"
  "41022900", // Філія "Пасажирська компанія"
  "40123454", // Філія "Центр з ремонту та експлуатації колійних машин"
  "45462724", // Філія "УЗ Вагон-Сервіс"
  "45246390", // Філія "Приміська пасажирська компанія"
]);

/**
 * Resolved from this file's location, not the working directory, so the
 * server finds its data no matter where it is launched from.
 */
export function dataDir(): string {
  return process.env.TR_DATA_DIR ?? join(import.meta.dirname, "..", "data");
}

export function openStore(): Store {
  return new JsonStore(dataDir());
}
