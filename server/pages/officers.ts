import { readableName } from "../../src/labels.ts";
import { esc, plural } from "../html.ts";
import { type FavKind } from "../favourites.ts";
import { dataset } from "../context.ts";
import { directoryPage } from "../components/directory.ts";

export function officersPage(url: URL): string {
  const byOfficer = new Map<string, { name: string; entity: string; count: number; value: number }>();
  for (const entry of dataset().cases) {
    if (!entry.officer_key) continue;
    const acc = byOfficer.get(entry.officer_key) ?? {
      name: entry.officer_name ?? entry.officer_key,
      entity: entry.entity_name ?? "",
      count: 0,
      value: 0,
    };
    acc.count++;
    acc.value += entry.value_amount ?? 0;
    byOfficer.set(entry.officer_key, acc);
  }

  return directoryPage({
    title: "Посадовці",
    nav: "officers",
    heading: "Відповідальні посадовці",
    intro: "Контактні особи закупівель із позначками. Не перелік підозрюваних — перелік того, що варто перевірити.",
    action: "/officers",
    url,
    rows: [...byOfficer.entries()].map(([key, acc]) => ({
      kind: "officer" as FavKind,
      id: key,
      href: `/officer/${encodeURIComponent(key)}`,
      name: acc.name,
      meta: `${esc(readableName(acc.entity))} · ${acc.count} ${plural(acc.count, "закупівля", "закупівлі", "закупівель")}`,
      value: acc.value,
      count: acc.count,
    })),
  });
}
