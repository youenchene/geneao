/**
 * Default avatar resolver based on gender and age group.
 * Returns a path to a pre-generated SVG avatar.
 *
 * Age groups per spec:
 *   baby: 1-3, child: 4-10, teen: 11-18, adult: 19-60, old: 60+
 */

type AgeGroup = "baby" | "child" | "teen" | "adult" | "old";

function getAgeGroup(birthDate: string, deathDate: string): AgeGroup {
  if (!birthDate) return "adult"; // default if unknown

  const birthYear = parseInt(birthDate.match(/\d{4}/)?.[0] || "0", 10);
  if (!birthYear) return "adult";

  // Use death year if available, otherwise current year
  let referenceYear: number;
  if (deathDate) {
    const deathYear = parseInt(deathDate.match(/\d{4}/)?.[0] || "0", 10);
    referenceYear = deathYear || new Date().getFullYear();
  } else {
    referenceYear = new Date().getFullYear();
  }

  const age = referenceYear - birthYear;

  if (age <= 3) return "baby";
  if (age <= 10) return "child";
  if (age <= 18) return "teen";
  if (age <= 60) return "adult";
  return "old";
}

/**
 * Get the default avatar URL for a person based on sex and birth/death dates.
 */
export function getDefaultAvatar(
  sex: "M" | "F" | "U",
  birthDate: string,
  deathDate: string
): string {
  const gender = sex === "F" ? "female" : "male";
  const ageGroup = getAgeGroup(birthDate, deathDate);
  return `/avatars/${gender}-${ageGroup}.svg`;
}
