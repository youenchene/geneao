/**
 * Search panel: a toggle button that opens a search input.
 * Searches individuals by name and zooms to the selected person's node.
 */
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useControls } from "react-zoom-pan-pinch";
import type { GedcomData, Individual } from "../lib/gedcom-parser";
import type { PositionedNode, TreeLayout } from "../lib/tree-layout";
import { NODE_HEIGHT } from "./TreeNodeView";

interface Props {
  data: GedcomData;
  layout: TreeLayout;
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  onHighlight: (personId: string | null) => void;
}

function findNodeForPerson(
  layout: TreeLayout,
  personId: string
): PositionedNode | null {
  return layout.nodes.find((pn) => pn.node.id === personId) ?? null;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default function SearchPanel({
  data,
  layout,
  wrapperRef,
  onHighlight,
}: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { setTransform } = useControls();

  const allIndividuals = useMemo(() => {
    const list: Individual[] = [];
    for (const indi of data.individuals.values()) {
      list.push(indi);
    }
    list.sort((a, b) => {
      const surnameA = a.surname || "";
      const surnameB = b.surname || "";
      const cmp = surnameA.localeCompare(surnameB);
      if (cmp !== 0) return cmp;
      const givenA = a.displayName || a.givenName || "";
      const givenB = b.displayName || b.givenName || "";
      return givenA.localeCompare(givenB);
    });
    return list;
  }, [data]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = normalize(query.trim());
    return allIndividuals
      .filter((indi) => {
        const given = normalize(
          indi.displayName || indi.givenName || indi.name || ""
        );
        const surname = normalize(indi.surname || "");
        return given.includes(q) || surname.includes(q);
      })
      .slice(0, 12);
  }, [query, allIndividuals]);

  // Reset selected index when results change (adjust state during render)
  const [prevResults, setPrevResults] = useState(results);
  if (results !== prevResults) {
    setPrevResults(results);
    setSelectedIndex(0);
  }

  const closePanel = useCallback(() => {
    setOpen(false);
    setQuery("");
    onHighlight(null);
  }, [onHighlight]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  function selectPerson(person: Individual) {
    const posNode = findNodeForPerson(layout, person.id);
    if (!posNode || !wrapperRef.current) return;

    onHighlight(person.id);

    const wrapper = wrapperRef.current;
    const wrapperRect = wrapper.getBoundingClientRect();
    const viewW = wrapperRect.width;
    const viewH = wrapperRect.height;

    const scale = 1.0;
    const nodeX = posNode.x;
    const nodeY = posNode.y + NODE_HEIGHT / 2;

    const translateX = viewW / 2 - nodeX * scale;
    const translateY = viewH / 2 - nodeY * scale;

    setTransform(translateX, translateY, scale, 300);
    closePanel();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      selectPerson(results[selectedIndex]);
    } else if (e.key === "Escape") {
      closePanel();
    }
  }

  const btnClass =
    "w-8 h-8 flex items-center justify-center bg-white border border-stone-300 rounded shadow-sm hover:bg-stone-100 text-stone-700 text-sm font-bold select-none cursor-pointer";

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={btnClass}
        title={t("search.title")}
      >
        🔍
      </button>
    );
  }

  return (
    <div className="w-64 bg-white border border-stone-300 rounded-lg shadow-lg overflow-hidden">
      <div className="flex items-center border-b border-stone-200 px-2">
        <span className="text-stone-400 text-sm mr-1">🔍</span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("search.placeholder")}
          className="flex-1 py-2 px-1 text-sm outline-none bg-transparent"
        />
        <button
          onClick={closePanel}
          className="text-stone-400 hover:text-stone-600 text-xs px-1 cursor-pointer"
        >
          ✕
        </button>
      </div>
      {results.length > 0 && (
        <ul className="max-h-60 overflow-y-auto">
          {results.map((person, i) => {
            const given =
              person.displayName || person.givenName || person.name || "?";
            const surname = person.surname || "";
            const year = person.birthDate?.match(/\d{4}/)?.[0] || "";
            return (
              <li
                key={person.id}
                className={`px-3 py-1.5 text-sm cursor-pointer flex justify-between items-center ${
                  i === selectedIndex
                    ? "bg-amber-50 text-amber-900"
                    : "text-stone-700 hover:bg-stone-50"
                }`}
                onClick={() => selectPerson(person)}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <span className="truncate">
                  {given}
                  {surname && (
                    <span className="font-semibold ml-1">
                      {surname.toUpperCase()}
                    </span>
                  )}
                </span>
                {year && (
                  <span className="text-xs text-stone-400 ml-2 shrink-0">
                    {year}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {query.trim() && results.length === 0 && (
        <div className="px-3 py-2 text-sm text-stone-400">{t("search.noResults")}</div>
      )}
    </div>
  );
}
