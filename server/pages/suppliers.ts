import { readableName } from "../../src/labels.ts";
import { esc, plural } from "../html.ts";
import { type FavKind } from "../favourites.ts";
import { dataset } from "../context.ts";
import { directoryPage } from "../components/directory.ts";

export function suppliersPage(url: URL): string {
  const bySupplier = new Map<string, { name: string; count: number; value: number; solo: number }>();
  for (const entry of dataset().cases) {
    const key = entry.winner_edrpou ?? "";
    if (!key) continue;
    const acc = bySupplier.get(key) ?? { name: entry.winner_name ?? key, count: 0, value: 0, solo: 0 };
    acc.count++;
    acc.value += entry.winner_amount ?? entry.value_amount ?? 0;
    if (entry.bidders === 1) acc.solo++;
    bySupplier.set(key, acc);
  }

  return directoryPage({
    title: "Переможці",
    nav: "suppliers",
    heading: "Переможці закупівель",
    intro: "Компанії, які виграли закупівлі з позначками.",
    action: "/suppliers",
    url,
    rows: [...bySupplier.entries()].map(([edrpou, acc]) => ({
      kind: "supplier" as FavKind,
      id: edrpou,
      href: `/supplier/${encodeURIComponent(edrpou)}`,
      name: readableName(acc.name),
      meta: `ЄДРПОУ ${esc(edrpou)} · ${acc.count} ${plural(acc.count, "перемога", "перемоги", "перемог")}${acc.solo ? ` · ${acc.solo} без конкурентів` : ""}`,
      value: acc.value,
      count: acc.count,
    })),
  });
}
