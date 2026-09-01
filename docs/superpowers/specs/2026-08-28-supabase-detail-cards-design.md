# Детальные карточки тендеров в Supabase

## Задача

Две связанные жалобы, один корень:
- «Не все тендеры» — деталь есть у 2 654 из 36 773; остальные показывают
  «картку ще не завантажено».
- «3 дня не обновляются» — данные в git свежие каждый день, но сайт это
  замороженный снимок сборки, и до посетителя новые данные не доходят.

Оба чинятся одним: **детальные карточки живут в Supabase, а сайт читает их
вживую.** Тогда доступна деталь для всех 36 773, и новые данные видны сразу,
без пересборки и промоута.

## Границы

- **Лента не трогается.** Она работает на флагах из git (19 МБ, вся Украина)
  плюс findings/audit. Тащить всё в Supabase нельзя: лента грузит весь
  датасет в память при старте, а 250+ МБ из базы на каждый холодный старт
  Vercel убьют скорость и лимит трафика.
- Переезжают только **карточки**: `tenders`, `tender_items`, `bids`,
  `awards` — контент страницы тендера.
- **Ценовой анализ** (findings, «завищена ціна») остаётся у подмножества,
  где посчитан. Расширять на всю страну — отдельным проектом; иначе
  findings.json тоже разрастётся и сломает git.
- **Острота в ленте** для непроанализированных тендеров остаётся
  приблизительной, как сейчас.

## Схема (проект `tender_radar_bot`, ref `ysaclorvgikqlbiuhxtt`)

Четыре таблицы, повторяющие типы из `src/store/types.ts`:

```sql
create table tenders (
  id text primary key, tender_id text not null, title text, description text,
  status text, method text, value_amount double precision, currency text,
  date timestamptz, entity_edrpou text, entity_name text, region text,
  locality text, officer_name text, officer_email text, officer_phone text,
  raw jsonb
);
create table tender_items (
  tender_id text not null, item_id text not null, description text,
  cpv_code text, cpv_name text, quantity double precision, unit_code text,
  unit_name text, lot_id text, primary key (tender_id, item_id)
);
create table bids (
  tender_id text not null, bid_id text not null, supplier_edrpou text,
  supplier_name text, amount double precision, status text,
  primary key (tender_id, bid_id)
);
create table awards (
  tender_id text not null, award_id text not null, supplier_edrpou text,
  supplier_name text, amount double precision, status text, date timestamptz,
  primary key (tender_id, award_id)
);
create index tender_items_tender_idx on tender_items (tender_id);
create index bids_tender_idx on bids (tender_id);
create index awards_tender_idx on awards (tender_id);
```

RLS включён, политик нет: anon-ключ ничего не видит; сайт и ingest ходят под
service-ключом (обходит RLS). Тот же приём, что у `tg_subscribers`.

## Модуль доступа

`src/store/supabase-cards.ts`, обычный `fetch` к PostgREST — **без
`@supabase/supabase-js`** (ноль runtime-зависимостей, как везде в проекте):

- `loadSupabaseConfig(env?)` → `{ url, serviceKey } | null` (null, если ключей
  нет — тогда всё ведёт себя как сейчас).
- `upsertCard(config, card)` — пишет tender + items + bids + awards одной
  карточки (по одному upsert на таблицу).
- `getCard(config, id)` → `{ tender, items, bids, awards } | null` — четыре
  запроса по индексу, собирает форму, которую ждёт `normalizeTender`/страница.

## Запись (ingest)

`scripts/ingest-details.ts` после нормализации карточки, помимо записи в
JsonStore, вызывает `upsertCard`, если Supabase сконфигурирован. Бэкофилл —
тот же `ingest-details`, прогнанный на все 36 773: он резюмируемый (пропускает
уже записанные), идёт часами против Prozorro. Ежедневный джоб продолжает
писать новые карточки в обе стороны.

## Чтение (сайт)

`server/pages/tender.ts`: сейчас берёт карточку из `dataset().byTender`. Меняем
на: есть в памяти (закэшированное подмножество) — рисуем как сейчас; нет —
`getCard(config, id)` из Supabase, собираем ту же структуру. Supabase
недоступен или карточки нет — мягкий откат на нынешнее «картку ще не
завантажено». Лента и все прочие страницы не меняются.

Сайту нужны `SUPABASE_URL` и `SUPABASE_SERVICE_KEY` в Vercel env (добавлены).

## Этапы (для плана)

1. **Схема** — миграция создаёт четыре таблицы + индексы + RLS.
2. **Модуль `supabase-cards.ts`** — loadSupabaseConfig, upsertCard, getCard;
   юнит-тесты с фейковым `fetch`.
3. **Чтение** — `tenderPage` берёт карточку из Supabase при промахе памяти;
   рендер-тест.
4. **Запись** — `ingest-details` пишет в Supabase; ежедневный джоб.
5. **Бэкофилл** — прогон на все 36 773 (операционный, долгий, резюмируемый).

## Проверка

- Юнит: `supabase-cards` — upsert шлёт правильные запросы, getCard собирает
  карточку, промах отдаёт null, не-2xx бросает с кодом.
- Рендер: страница тендера рисует деталь из Supabase-карточки.
- Существующие 248 тестов зелёные; `npm run typecheck` чистый.
- После бэкофилла: открыть тендер, которого раньше не было в кэше, — видна
  полная карточка, а не «не завантажено».

## Чего не делаем

- Не трогаем ленту и её путь чтения.
- Не расширяем ценовой анализ на всю страну (отдельный проект).
- Не добавляем зависимости и JavaScript на клиенте.
- Не переносим флаги/findings/audit — они остаются в git web-data.
