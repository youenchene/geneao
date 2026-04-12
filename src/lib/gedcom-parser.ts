/**
 * Shared GEDCOM parser module.
 * Uses the `gedcom` npm package (tmcw) to parse .ged files,
 * then transforms the compact AST into typed Individual/Family maps.
 */
import { parse, compact } from "gedcom";

export interface Individual {
  id: string;
  name: string;
  displayName: string;
  givenName: string;
  surname: string;
  sex: "M" | "F" | "U";
  birthDate: string;
  birthPlace: string;
  deathDate: string;
  deathPlace: string;
  note: string;
  familiesAsSpouse: string[]; // FAM xref_ids where this person is a spouse
  familyAsChild: string | null; // FAM xref_id where this person is a child
}

export interface Family {
  id: string;
  husbandId: string | null;
  wifeId: string | null;
  childIds: string[];
  marriageDate: string;
  marriagePlace: string;
  divorceDate: string;
  note: string;
}

export interface GedcomData {
  individuals: Map<string, Individual>;
  families: Map<string, Family>;
  raw: string; // original GEDCOM text for family-tree-viewer
}

function collectValues(data: Record<string, unknown>, key: string): string[] {
  const first = data[key] as string | undefined;
  const extra = data[`+${key}`] as string[] | undefined;
  const result: string[] = [];
  if (first) result.push(first);
  if (extra) result.push(...extra);
  return result;
}

export function parseGedcom(text: string): GedcomData {
  const ast = parse(text);
  const compacted = compact(ast);

  const individuals = new Map<string, Individual>();
  const families = new Map<string, Family>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const node of compacted.children as any[]) {
    if (node.type === "INDI") {
      const d = node.data as Record<string, unknown>;
      const id = d.xref_id as string;

      // Deduplicate family refs
      const famsRefs = [...new Set(collectValues(d, "@FAMILY_SPOUSE"))];
      const famcRefs = [...new Set(collectValues(d, "@FAMILY_CHILD"))];

      individuals.set(id, {
        id,
        name: (d["NAME"] as string) || "",
        displayName: (d["NAME/DISPLAY"] as string) || (d["NAME/GIVEN_NAME"] as string) || "",
        givenName: (d["NAME/GIVEN_NAME"] as string) || "",
        surname: (d["NAME/SURNAME"] as string) || "",
        sex: ((d["SEX"] as string) === "F" ? "F" : (d["SEX"] as string) === "M" ? "M" : "U"),
        birthDate: (d["BIRTH/DATE"] as string) || "",
        birthPlace: (d["BIRTH/PLACE"] as string) || "",
        deathDate: (d["DEATH/DATE"] as string) || "",
        deathPlace: (d["DEATH/PLACE"] as string) || "",
        note: (d["NOTE"] as string) || "",
        familiesAsSpouse: famsRefs,
        familyAsChild: famcRefs[0] || null,
      });
    } else if (node.type === "FAM") {
      const d = node.data as Record<string, unknown>;
      const id = d.xref_id as string;

      const childIds = [...new Set(collectValues(d, "@CHILD"))];

      families.set(id, {
        id,
        husbandId: (d["@HUSBAND"] as string) || null,
        wifeId: (d["@WIFE"] as string) || null,
        childIds,
        marriageDate: (d["MARRIAGE/DATE"] as string) || "",
        marriagePlace: (d["MARRIAGE/PLACE"] as string) || "",
        divorceDate: (d["DIVORCE/DATE"] as string) || "",
        note: (d["NOTE"] as string) || "",
      });
    }
  }

  return { individuals, families, raw: text };
}

/**
 * Find the root family: the one with the most total descendants.
 */
export function findRootFamily(data: GedcomData): string | null {
  let bestId: string | null = null;
  let bestCount = 0;

  for (const [famId] of data.families) {
    const count = countDescendants(data, famId, new Set());
    if (count > bestCount) {
      bestCount = count;
      bestId = famId;
    }
  }
  return bestId;
}

function countDescendants(
  data: GedcomData,
  familyId: string,
  visited: Set<string>
): number {
  if (visited.has(familyId)) return 0;
  visited.add(familyId);

  const family = data.families.get(familyId);
  if (!family) return 0;

  let count = family.childIds.length;
  for (const childId of family.childIds) {
    const child = data.individuals.get(childId);
    if (child) {
      for (const spouseFamId of child.familiesAsSpouse) {
        count += countDescendants(data, spouseFamId, visited);
      }
    }
  }
  return count;
}

/**
 * Extract a birth year from a GEDCOM date string.
 */
export function extractYear(dateStr: string): string {
  if (!dateStr) return "";
  const match = dateStr.match(/\d{4}/);
  return match ? match[0] : "";
}

/**
 * Format a person's lifespan string: "1980 -" or "1909 - 1998"
 */
export function formatLifespan(indi: Individual): string {
  const birth = extractYear(indi.birthDate);
  const death = extractYear(indi.deathDate);
  if (!birth && !death) return "";
  if (birth && death) return `${birth} - ${death}`;
  if (birth) return `${birth} -`;
  return `- ${death}`;
}

/**
 * Fetch and parse a .ged file from the given URL.
 */
export async function fetchAndParseGedcom(url: string): Promise<GedcomData> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  const text = await response.text();
  return parseGedcom(text);
}
