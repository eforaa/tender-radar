import test from "node:test";
import assert from "node:assert/strict";
import {
  isEdrpou, normaliseEdrpou, parseFavourites, serialiseFavourites,
  toggleFavourite, favouritesCookie, FAVOURITES_COOKIE,
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

test("a malformed cookie yields an empty list rather than an error", () => {
  assert.deepEqual(parseFavourites(null), []);
  assert.deepEqual(parseFavourites(""), []);
  assert.deepEqual(parseFavourites("garbage.!!.x"), []);
});

test("a cookie with junk mixed in keeps only the valid codes", () => {
  assert.deepEqual(parseFavourites("40081216.nonsense.00131954"), ["40081216", "00131954"]);
});

test("duplicates collapse on both read and write", () => {
  assert.deepEqual(parseFavourites("40081216.40081216"), ["40081216"]);
  assert.equal(serialiseFavourites(["40081216", "40081216"]), "40081216");
});

test("toggling adds a new code to the front and removes an existing one", () => {
  assert.deepEqual(toggleFavourite([], "40081216"), ["40081216"]);
  assert.deepEqual(toggleFavourite(["00131954"], "40081216"), ["40081216", "00131954"]);
  assert.deepEqual(toggleFavourite(["40081216", "00131954"], "40081216"), ["00131954"]);
});

test("toggling an invalid code changes nothing", () => {
  assert.deepEqual(toggleFavourite(["40081216"], "oops"), ["40081216"]);
});

test("the list is capped so the cookie cannot grow without bound", () => {
  const many = Array.from({ length: 200 }, (_, i) => String(10000000 + i));
  assert.equal(serialiseFavourites(many).split(".").length, 60);
});

test("an empty list clears the cookie instead of storing nothing", () => {
  assert.match(favouritesCookie([], true), new RegExp(`^${FAVOURITES_COOKIE}=; .*Max-Age=0`));
});

test("a populated list sets a long-lived cookie", () => {
  const cookie = favouritesCookie(["40081216", "00131954"], true);
  assert.match(cookie, /tr_saved=40081216\.00131954/);
  assert.match(cookie, /Max-Age=31536000/);
  assert.match(cookie, /Secure/);
});
