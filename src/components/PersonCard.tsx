/**
 * SVG person card for the custom tree viewer.
 * Renders a rectangle with name (wrapping to 2 lines if needed) and lifespan.
 */
import type { Individual } from "../lib/gedcom-parser";
import { formatLifespan } from "../lib/gedcom-parser";

interface Props {
  individual: Individual;
  x: number;
  y: number;
  width: number;
  height: number;
}

const COLORS = {
  M: { fill: "#dbeafe", stroke: "#3b82f6", text: "#1e3a5f" },
  F: { fill: "#fce7f3", stroke: "#ec4899", text: "#5f1e3a" },
  U: { fill: "#f1f5f9", stroke: "#94a3b8", text: "#334155" },
};

const FONT_SIZE = 10;
const PADDING = 4;

/**
 * Split a name into lines that fit within a given character limit.
 * Tries to split on spaces; falls back to truncation.
 */
function wrapName(name: string, maxCharsPerLine: number): string[] {
  if (name.length <= maxCharsPerLine) return [name];

  // Try to split on a space near the middle
  const words = name.split(" ");
  if (words.length >= 2) {
    const line1: string[] = [];
    const line2: string[] = [];
    let len = 0;
    for (const word of words) {
      if (len === 0 || len + 1 + word.length <= maxCharsPerLine) {
        line1.push(word);
        len += (len > 0 ? 1 : 0) + word.length;
      } else {
        line2.push(word);
      }
    }
    const l1 = line1.join(" ");
    const l2 = line2.join(" ");
    if (l2.length > 0) {
      return [
        l1.length > maxCharsPerLine ? l1.slice(0, maxCharsPerLine - 1) + "." : l1,
        l2.length > maxCharsPerLine ? l2.slice(0, maxCharsPerLine - 1) + "." : l2,
      ];
    }
  }

  // Single long word: truncate
  return [name.slice(0, maxCharsPerLine - 1) + "."];
}

export default function PersonCard({ individual, x, y, width, height }: Props) {
  const colors = COLORS[individual.sex];
  const lifespan = formatLifespan(individual);
  const name = individual.displayName || individual.givenName || "?";

  // Estimate max chars that fit: ~6px per character at font-size 10
  const maxChars = Math.floor((width - PADDING * 2) / 5.8);
  const lines = wrapName(name, maxChars);
  const hasLifespan = !!lifespan;

  // Compute vertical positions
  const totalTextLines = lines.length + (hasLifespan ? 1 : 0);
  const lineHeight = FONT_SIZE + 3;
  const blockHeight = totalTextLines * lineHeight;
  const startTextY = (height - blockHeight) / 2 + FONT_SIZE;

  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        width={width}
        height={height}
        rx={6}
        ry={6}
        fill={colors.fill}
        stroke={colors.stroke}
        strokeWidth={1.5}
      />
      {lines.map((line, i) => (
        <text
          key={i}
          x={width / 2}
          y={startTextY + i * lineHeight}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={colors.text}
          fontSize={FONT_SIZE}
          fontWeight={600}
          fontFamily="system-ui, sans-serif"
        >
          {line}
        </text>
      ))}
      {hasLifespan && (
        <text
          x={width / 2}
          y={startTextY + lines.length * lineHeight}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={colors.text}
          fontSize={9}
          opacity={0.7}
          fontFamily="system-ui, sans-serif"
        >
          {lifespan}
        </text>
      )}
    </g>
  );
}
