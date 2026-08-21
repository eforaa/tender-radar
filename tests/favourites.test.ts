import test from "node:test";
import assert from "node:assert/strict";
import {
  isEdrpou, normaliseEdrpou, parseFavourites, serialiseFavourites,
  toggleFavourite, favouritesCookie, isStarred, isFavKind,
  encodeFavourite, decodeFavourite, FAVOURITES_COOKIE,
  type Favourite,
} from "../server/favourites.ts";

test("accepts real EDRPOU codes and rejects everything else", () => {
  assert.ok(isEdrpou("40081216"));
  assert.ok(isEdrpou("00131954"));
  assert.equal(isEdrpou("123"), false);
  assert.equal(isEdrpou("40081216a"), false);
  assert.equal(isEdrpou(""), false);
});

test("pulls a code out of whatever a person pasted", () => {
  assert.equal(normaliseEdrpou(" 40081216 "), "40081216");
  assert.equal(normaliseEdrpou("ЄДРПОУ 40081216"), "40081216");
  assert.equal(normaliseEdrpou("4008-1216"), "40081216");
  assert.equal(normaliseEdrpou("Харківобленерго"), null);
});

test("every kind round-trips through the cookie encoding", () => {
  const items: Favourite[] = [
    { kind: "tender", id: "539c36e8d90e4f5dab2738f590e17bf3" },
    { kind: "entity", id: "00131954" },
    { kind: "supplier", id: "40081216" },
    { kind: "officer", id: "taranenko@kharkivoda.gov.ua" },
  ];
  for (const item of items) {
    assert.deepEqual(decodeFavourite(encodeFavourite(item)), item);
  }
  assert.deepEqual(parseFavourites(serialiseFavourites(items)), items);
});

test("an officer id with dots survives, because the separator is not a dot", () => {
  const cookie = serialiseFavourites([{ kind: "officer", id: "o.drobotenko_czo@city.kharkiv.ua" }]);
  assert.deepEqual(parseFavourites(cookie), [{ kind: "officer", id: "o.drobotenko_czo@city.kharkiv.ua" }]);
});

test("a malformed cookie yields an empty list rather than an error", () => {
  assert.deepEqual(parseFavourites(null), []);
  assert.deepEqual(parseFavourites(""), []);
  assert.deepEqual(parseFavourites("garbage~!!~x"), []);
});

test("a cookie with junk mixed in keeps only the valid entries", () => {
  assert.deepEqual(parseFavourites("e:00131954~nonsense~t:abc"), [
    { kind: "entity", id: "00131954" },
    { kind: "tender", id: "abc" },
  ]);
});

test("an unknown kind prefix is dropped", () => {
  assert.deepEqual(parseFavourites("z:00131954"), []);
});

test("the same id under two kinds is kept as two separate entries", () => {
  // A company can be both a buyer and a supplier; starring one must not
  // silently star the other.
  const list = parseFavourites("e:00131954~s:00131954");
  assert.equal(list.length, 2);
  assert.ok(isStarred(list, "entity", "00131954"));
  assert.ok(isStarred(list, "supplier", "00131954"));
});

test("duplicates collapse on both read and write", () => {
  assert.deepEqual(parseFavourites("e:00131954~e:00131954"), [{ kind: "entity", id: "00131954" }]);
  assert.equal(serialiseFavourites([{ kind: "entity", id: "1234567" }, { kind: "entity", id: "1234567" }]), "e:1234567");
});

test("toggling adds to the front and removes an existing entry", () => {
  const one = toggleFavourite([], "tender", "abc");
  assert.deepEqual(one, [{ kind: "tender", id: "abc" }]);
  const two = toggleFavourite(one, "entity", "00131954");
  assert.deepEqual(two[0], { kind: "entity", id: "00131954" });
  assert.deepEqual(toggleFavourite(two, "tender", "abc"), [{ kind: "entity", id: "00131954" }]);
});

test("an id that would corrupt the cookie is refused", () => {
  assert.deepEqual(toggleFavourite([], "tender", "a~b"), []);
  assert.deepEqual(toggleFavourite([], "tender", "a;b"), []);
  assert.deepEqual(toggleFavourite([], "tender", ""), []);
  assert.deepEqual(toggleFavourite([], "tender", "x".repeat(200)), []);
});

test("the list is capped so the cookie cannot grow without bound", () => {
  const many: Favourite[] = Array.from({ length: 200 }, (_, i) => ({ kind: "tender", id: `id${i}` }));
  assert.equal(serialiseFavourites(many).split("~").length, 60);
});

test("kinds are validated before use", () => {
  assert.ok(isFavKind("tender"));
  assert.ok(isFavKind("officer"));
  assert.equal(isFavKind("everything"), false);
});

test("an empty list clears the cookie instead of storing nothing", () => {
  assert.match(favouritesCookie([], true), new RegExp(`^${FAVOURITES_COOKIE}=; .*Max-Age=0`));
});

test("a populated list sets a long-lived cookie", () => {
  const cookie = favouritesCookie([{ kind: "entity", id: "00131954" }], true);
  assert.match(cookie, /tr_starred=e:00131954/);
  assert.match(cookie, /Max-Age=31536000/);
  assert.match(cookie, /Secure/);
});
