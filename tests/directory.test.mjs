/** Directory regression tests with synthetic contacts only (Node 22.6+). */
import assert from "node:assert/strict";
import test from "node:test";
import { getDirectoryRows } from "../src/lib/directory.ts";

const filters = { surname: "", givenName: "", livingCity: "", phone: "", email: "" };
const people = [
  { id: "1", surname: "Érable", givenName: "Alice", livingCity: "Lyon", phone: "06 12 34 56 78", email: "alice@example.test" },
  { id: "2", surname: "Arbre", givenName: "Zoé", livingCity: "Paris", phone: "", email: "zoe@example.test" },
  { id: "3", surname: "Érable", givenName: "Benoît", livingCity: "Paris", phone: "01.23.45.67.89", email: "" },
  { id: "4", surname: "", givenName: "Sam", livingCity: "", phone: "", email: "" },
];
const rows = (query = "", overrides = {}, column = "surname", direction = "asc") =>
  getDirectoryRows(people, query, { ...filters, ...overrides }, column, direction, "fr");
const ids = (values) => values.map((person) => person.id);

test("search ignores case, accents and outer whitespace", () => {
  assert.deepEqual(ids(rows("  ERABLE  ")), ["1", "3"]);
  assert.deepEqual(ids(rows("benoit")), ["3"]);
});

test("global words can match different columns", () => {
  assert.deepEqual(ids(rows("erable paris")), ["3"]);
  assert.deepEqual(ids(rows("example.test lyon")), ["1"]);
});

test("column filters combine with each other and global search", () => {
  assert.deepEqual(ids(rows("erable", { livingCity: "paris", givenName: "ben" })), ["3"]);
  assert.deepEqual(rows("alice", { livingCity: "paris" }), []);
});

test("phone search tolerates common separators", () => {
  assert.deepEqual(ids(rows("061234")), ["1"]);
  assert.deepEqual(ids(rows("", { phone: "01 23 45" })), ["3"]);
});

test("sort is locale-aware with stable name tie-breaks and blanks last", () => {
  assert.deepEqual(ids(rows()), ["2", "1", "3", "4"]);
  assert.deepEqual(ids(rows("", {}, "surname", "desc")), ["1", "3", "2", "4"]);
  assert.deepEqual(ids(rows("", {}, "livingCity")), ["1", "2", "3", "4"]);
  assert.deepEqual(ids(rows("", {}, "givenName", "desc")), ["2", "4", "3", "1"]);
});

test("rows preserve shared person references without mutating the source", () => {
  const originalIds = ids(people);
  assert.equal(rows()[0], people[1]);
  assert.deepEqual(ids(people), originalIds);
  assert.deepEqual(getDirectoryRows([], "", filters, "surname", "asc", "en"), []);
});
