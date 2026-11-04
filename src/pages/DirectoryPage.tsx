/** Searchable, sortable contact directory using the very same individuals and editor as the tree. */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { GedcomData } from "../lib/gedcom-parser";
import { directoryColumns, getDirectoryRows } from "../lib/directory";
import type { DirectoryColumn, DirectoryFilters } from "../lib/directory";
import { useEditMode } from "../context/EditModeContext";
import PersonEditModal from "../components/PersonEditModal";
import PersonDetailModal from "../components/PersonDetailModal";

interface Props {
  data: GedcomData;
  onDataChanged: () => void;
}

const emptyFilters: DirectoryFilters = { surname: "", givenName: "", livingCity: "", phone: "", email: "" };

export default function DirectoryPage({ data, onDataChanged }: Props) {
  const { t, i18n } = useTranslation();
  const { editMode } = useEditMode();
  const [query, setQuery] = useState("");
  const [sortColumn, setSortColumn] = useState<DirectoryColumn>("surname");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? data.individuals.get(selectedId) : undefined;
  const rows = useMemo(() => getDirectoryRows(
    data.individuals.values(), query, emptyFilters, sortColumn, direction, i18n.language,
  ), [data, query, sortColumn, direction, i18n.language]);

  function sortBy(column: DirectoryColumn) {
    setDirection(sortColumn === column && direction === "asc" ? "desc" : "asc");
    setSortColumn(column);
  }

  return (
    <section className="flex h-full flex-col bg-stone-50 p-4 sm:p-6" aria-labelledby="directory-title">
      <h1 id="directory-title" className="text-xl font-bold text-stone-800">{t("directory.directory")}</h1>
      <p className="mt-1 text-sm text-stone-500">{t("directory.description")}</p>
      <div className="my-4 flex flex-wrap items-end gap-3">
        <label className="flex-1 min-w-48 text-sm font-medium text-stone-600">
          {t("directory.search")}
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)}
            placeholder={t("directory.searchPlaceholder")}
            className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 focus:ring-2 focus:ring-amber-400" />
        </label>
        <button onClick={() => setQuery("")}
          className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-600 hover:bg-stone-100 cursor-pointer">
          {t("directory.reset")}
        </button>
      </div>
      <p className="mb-3 text-sm text-stone-500" role="status">
        {t("directory.count", { count: rows.length, total: data.individuals.size })}
        {" · "}{t(editMode ? "directory.editHint" : "directory.viewHint")}
      </p>
      <div className="min-h-0 overflow-auto rounded-xl border border-stone-200 bg-white">
        <table className="w-full min-w-[780px] text-left text-sm">
          <caption className="sr-only">{t("directory.description")}</caption>
          <thead className="sticky top-0 z-10 bg-stone-100 text-stone-700">
            <tr>
              {directoryColumns.map((column) => (
                <th key={column} scope="col" className="p-3 align-top"
                  aria-sort={sortColumn === column ? (direction === "asc" ? "ascending" : "descending") : "none"}>
                  <button onClick={() => sortBy(column)} className="flex w-full items-center gap-2 cursor-pointer"
                    aria-label={t("directory.sortBy", { field: t(`directory.columns.${column}`) })}>
                    {t(`directory.columns.${column}`)}
                    <span aria-hidden="true">{sortColumn === column ? (direction === "asc" ? "↑" : "↓") : "↕"}</span>
                  </button>
                </th>
              ))}
              <th scope="col" className="p-3">{t("directory.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 text-stone-700">
            {rows.map((person) => (
              <tr key={person.id} className="hover:bg-amber-50/50">
                {directoryColumns.map((column) => (
                  <td key={column} className="px-3 py-3 break-words">
                    {person[column] ? column === "email" || column === "phone" ? (
                      <a className="text-amber-800 underline" href={column === "email"
                        ? `mailto:${encodeURIComponent(person.email)}`
                        : `tel:${person.phone.replace(/[^+\d]/g, "")}`}>
                        {person[column]}
                      </a>
                    ) : person[column] : <span className="text-stone-400">—</span>}
                  </td>
                ))}
                <td className="px-3 py-3">
                  <button onClick={() => setSelectedId(person.id)}
                    aria-label={t(editMode ? "directory.editPerson" : "directory.viewPerson", { name: `${person.givenName} ${person.surname}`.trim() })}
                    className="rounded-lg border border-stone-300 px-3 py-1.5 text-amber-800 hover:bg-amber-50 cursor-pointer">
                    {t(editMode ? "directory.edit" : "directory.details")}
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-stone-500">{t("directory.noResults")}</td></tr>}
          </tbody>
        </table>
      </div>
      {selected && (editMode
        ? <PersonEditModal key={selected.id} individual={selected} onClose={() => setSelectedId(null)} onSaved={onDataChanged} />
        : <PersonDetailModal individual={selected} onClose={() => setSelectedId(null)} />)}
    </section>
  );
}
