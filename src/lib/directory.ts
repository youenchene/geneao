/** Pure directory filtering and locale-aware sorting over the shared genealogy records. */
import type { Individual } from "./gedcom-parser";

export const directoryColumns = ["surname", "givenName", "livingCity", "phone", "email"] as const;
export type DirectoryColumn = typeof directoryColumns[number];
export type DirectoryFilters = Record<DirectoryColumn, string>;

export function normalizeSearch(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase().trim();
}

function matches(value: string, query: string, column: DirectoryColumn): boolean {
  const normalize = (text: string) => column === "phone"
    ? normalizeSearch(text).replace(/[\s().-]/g, "")
    : normalizeSearch(text);
  return normalize(value).includes(normalize(query));
}

export function getDirectoryRows(
  individuals: Iterable<Individual>,
  query: string,
  filters: DirectoryFilters,
  sortColumn: DirectoryColumn,
  direction: "asc" | "desc",
  language: string,
): Individual[] {
  const words = normalizeSearch(query).split(/\s+/).filter(Boolean);
  const collator = new Intl.Collator(language, { sensitivity: "base", numeric: true });
  return Array.from(individuals).filter((person) =>
    directoryColumns.every((column) => matches(person[column], filters[column], column)) &&
    words.every((word) => directoryColumns.some((column) => matches(person[column], word, column)))
  ).sort((a, b) => {
    // Keep missing values at the bottom in either direction.
    const left = a[sortColumn].trim();
    const right = b[sortColumn].trim();
    if (!left && right) return 1;
    if (left && !right) return -1;
    const primary = collator.compare(left, right) * (direction === "asc" ? 1 : -1);
    return primary || collator.compare(a.surname, b.surname) ||
      collator.compare(a.givenName, b.givenName) || collator.compare(a.id, b.id);
  });
}
