import { RAILWAY_EDRPOU } from "../../src/config.ts";
import { readableName } from "../../src/labels.ts";
import { esc, plural } from "../html.ts";
import { type FavKind } from "../favourites.ts";
import { dataset } from "../context.ts";
import { directoryPage } from "../components/directory.ts";

export function entitiesPage(url: URL): string {
  const byEntity = new Map<string, { name: string; count: number; value: number }>();
  for (const entry of dataset().cases) {
    const key = entry.entity_edrpou ?? "";
    if (!key) continue;
    const acc = byEntity.get(key) ?? { name: entry.entity_name ?? key, count: 0, value: 0 };
    acc.count++;
    acc.value += entry.value_amount ?? 0;
    byEntity.set(key, acc);
  }

  return directoryPage({
    title: "Замовники",
    nav: "entities",
    heading: "Замовники",
    intro: "Установи, у закупівлях яких спрацювали державні індикатори.",
    action: "/entities",
    url,
    rows: [...byEntity.entries()].map(([edrpou, acc]) => ({
      kind: "entity" as FavKind,
      id: edrpou,
      href: `/entity/${encodeURIComponent(edrpou)}`,
      name: readableName(acc.name),
      meta: `ЄДРПОУ ${esc(edrpou)} · ${acc.count} ${plural(acc.count, "закупівля", "закупівлі", "закупівель")}${RAILWAY_EDRPOU.has(edrpou) ? " · залізниця" : ""}`,
      value: acc.value,
      count: acc.count,
    })),
  });
}
