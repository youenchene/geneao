/**
 * Search panel: a toggle button that opens a search input.
 * Searches individuals by name and zooms to the selected person's node.
 */
import { useState, useRef, useEffect, useMemo } from "react";
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

/**
 * Find the PositionedNode that contains a given individual ID
 * (either as husband, wife, or single individual).
 */
function findNodeForPerson(
  layout: TreeLayout,
  personId: string
): PositionedNode | null {
  for (const pn of layout.nodes) {
    const n = pn.node;
    if (n.type === "couple") {
      if (n.husband?.id === personId || n.wife?.id === personId) return pn;
    } else if (n.type === "individual") {
      if (n.individual?.id === personId) return pn;
    }
  }
  return null;
}

/**
 * Normalize a string for fuzzy matching: lowercase, strip accents.
 */
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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { setTransform } = useControls();

  // Build sorted list of individuals for searching
  const allIndividuals = useMemo(() => {
    const list: Individual[] = [];
    for (const indi of data.individuals.values()) {
      list.push(indi);
    }
    list.sort((a, b) => {
      const nameA = a.displayName || a.givenName || "";
      const nameB = b.displayName || b.givenName || "";
      return nameA.localeCompare(nameB);
    });
    return list;
  }, [data]);

  // Filter results based on query
  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = normalize(query.trim());
    return allIndividuals
      .filter((indi) => {
        const name = normalize(
          indi.displayName || indi.givenName || indi.name || ""
        );
        return name.includes(q);
      })
      .slice(0, 12);
  }, [query, allIndividuals]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
    if (!open) {
      setQuery("");
      onHighlight(null);
    }
  }, [open, onHighlight]);

  function selectPerson(person: Individual) {
    const posNode = findNodeForPerson(layout, person.id);
    if (!posNode || !wrapperRef.current) return;

    onHighlight(person.id);

    // Compute transform to center the node in the viewport
    const wrapper = wrapperRef.current;
    const wrapperRect = wrapper.getBoundingClientRect();
    const viewW = wrapperRect.width;
    const viewH = wrapperRect.height;

    const scale = 1.0; // Zoom in close enough to see surrounding cards
    const nodeX = posNode.x;
    const nodeY = posNode.y + NODE_HEIGHT / 2;

    const translateX = viewW / 2 - nodeX * scale;
    const translateY = viewH / 2 - nodeY * scale;

    setTransform(translateX, translateY, scale, 300);
    setOpen(false);
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
      setOpen(false);
    }
  }

  const btnClass =
    "w-8 h-8 flex items-center justify-center bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-100 text-gray-700 text-sm font-bold select-none cursor-pointer";

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={btnClass}
        title="Search person"
      >
        🔍
      </button>
    );
  }

  return (
    <div className="w-64 bg-white border border-gray-300 rounded-lg shadow-lg overflow-hidden">
      <div className="flex items-center border-b border-gray-200 px-2">
        <span className="text-gray-400 text-sm mr-1">🔍</span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search by name..."
          className="flex-1 py-2 px-1 text-sm outline-none bg-transparent"
        />
        <button
          onClick={() => setOpen(false)}
          className="text-gray-400 hover:text-gray-600 text-xs px-1 cursor-pointer"
        >
          ✕
        </button>
      </div>
      {results.length > 0 && (
        <ul className="max-h-60 overflow-y-auto">
          {results.map((person, i) => {
            const name =
              person.displayName || person.givenName || person.name || "?";
            const year = person.birthDate?.match(/\d{4}/)?.[0] || "";
            return (
              <li
                key={person.id}
                className={`px-3 py-1.5 text-sm cursor-pointer flex justify-between items-center ${
                  i === selectedIndex
                    ? "bg-blue-50 text-blue-800"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
                onClick={() => selectPerson(person)}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <span className="truncate">{name}</span>
                {year && (
                  <span className="text-xs text-gray-400 ml-2 shrink-0">
                    {year}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {query.trim() && results.length === 0 && (
        <div className="px-3 py-2 text-sm text-gray-400">No results</div>
      )}
    </div>
  );
}
