/**
 * SVG person card for the custom tree viewer.
 * Renders a rectangle with photo, name (wrapping to 2 lines if needed) and lifespan.
 * Shows an edit button in edit mode.
 */
import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { Individual } from "../lib/gedcom-parser";
import { formatLifespan } from "../lib/gedcom-parser";
import { getDefaultAvatar } from "../lib/avatars";
import { useEditMode } from "../context/EditModeContext";
import PersonEditModal from "./PersonEditModal";
import PersonDetailModal from "./PersonDetailModal";

interface Props {
  individual: Individual;
  x: number;
  y: number;
  width: number;
  height: number;
  photoUrl?: string;
  onDataChanged?: () => void;
}

const COLORS = {
  M: { fill: "#f0f9ff", stroke: "#7dd3fc", text: "#0c4a6e" },
  F: { fill: "#fff1f2", stroke: "#fda4af", text: "#881337" },
  U: { fill: "#f5f5f4", stroke: "#a8a29e", text: "#44403c" },
};

const FONT_SIZE = 10;
const PADDING = 4;
const PHOTO_SIZE = 24;

/**
 * Split a name into lines that fit within a given character limit.
 */
function wrapName(name: string, maxCharsPerLine: number): string[] {
  if (name.length <= maxCharsPerLine) return [name];

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

  return [name.slice(0, maxCharsPerLine - 1) + "."];
}

export default function PersonCard({
  individual,
  x,
  y,
  width,
  height,
  photoUrl,
  onDataChanged,
}: Props) {
  const { t } = useTranslation();
  const colors = COLORS[individual.sex];
  const lifespan = formatLifespan(individual);
  const givenName = individual.givenName || individual.displayName || "?";
  const surname = individual.surname || "";
  const { editMode } = useEditMode();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Resolve photo: API photo > default avatar
  const imgSrc = photoUrl || getDefaultAvatar(individual.sex, individual.birthDate, individual.deathDate);

  // Estimate max chars that fit (accounting for photo space)
  const textAreaWidth = width - PADDING * 2 - PHOTO_SIZE - 4;
  const maxChars = Math.floor(textAreaWidth / 5.8);

  // Given name on first line(s), surname on a dedicated second line
  const givenLines = wrapName(givenName, maxChars);
  const surnameLines = surname ? wrapName(surname.toUpperCase(), maxChars) : [];
  const lines = [...givenLines, ...surnameLines];
  const surnameStartIndex = givenLines.length;
  const hasLifespan = !!lifespan;

  const lineHeight = FONT_SIZE + 3;
  const totalTextLines = lines.length + (hasLifespan ? 1 : 0);
  const blockHeight = totalTextLines * lineHeight;
  const startTextY = (height - blockHeight) / 2 + FONT_SIZE;

  const textStartX = x + PHOTO_SIZE + PADDING + 4;

  return (
    <>
      <g
        transform={`translate(0, 0)`}
        onClick={(e) => {
          if (!editMode) {
            e.stopPropagation();
            setShowDetailModal(true);
          }
        }}
        style={!editMode ? { cursor: "pointer" } : undefined}
      >
        {!editMode && <title>{t("tooltip.viewDetails")}</title>}
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          rx={6}
          ry={6}
          fill={colors.fill}
          stroke={colors.stroke}
          strokeWidth={1.5}
        />

        {/* Photo / avatar */}
        <clipPath id={`photo-clip-${individual.id}`}>
          <circle cx={x + PADDING + PHOTO_SIZE / 2} cy={y + height / 2} r={PHOTO_SIZE / 2} />
        </clipPath>
        <image
          href={imgSrc}
          x={x + PADDING}
          y={y + height / 2 - PHOTO_SIZE / 2}
          width={PHOTO_SIZE}
          height={PHOTO_SIZE}
          clipPath={`url(#photo-clip-${individual.id})`}
          preserveAspectRatio="xMidYMid slice"
        />
        <circle
          cx={x + PADDING + PHOTO_SIZE / 2}
          cy={y + height / 2}
          r={PHOTO_SIZE / 2}
          fill="none"
          stroke={colors.stroke}
          strokeWidth={0.5}
          opacity={0.5}
        />

        {/* Name lines: given name then surname */}
        {lines.map((line, i) => (
          <text
            key={i}
            x={textStartX + (width - PHOTO_SIZE - PADDING * 2 - 4) / 2}
            y={y + startTextY + i * lineHeight}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={colors.text}
            fontSize={i >= surnameStartIndex ? FONT_SIZE - 1 : FONT_SIZE}
            fontWeight={i >= surnameStartIndex ? 700 : 600}
            fontFamily="system-ui, sans-serif"
          >
            {line}
          </text>
        ))}

        {/* Lifespan */}
        {hasLifespan && (
          <text
            x={textStartX + (width - PHOTO_SIZE - PADDING * 2 - 4) / 2}
            y={y + startTextY + lines.length * lineHeight}
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

        {/* Edit button (only in edit mode) */}
        {editMode && (
          <g
            onClick={(e) => {
              e.stopPropagation();
              setShowEditModal(true);
            }}
            style={{ cursor: "pointer" }}
          >
            <title>{t("tooltip.editPerson")}</title>
            <rect
              x={x + width - 18}
              y={y + 2}
              width={16}
              height={16}
              rx={3}
              fill="white"
              stroke={colors.stroke}
              strokeWidth={0.5}
              opacity={0.9}
            />
            <text
              x={x + width - 10}
              y={y + 12}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={10}
              fill={colors.text}
            >
              ✎
            </text>
          </g>
        )}
      </g>

      {/* Edit modal rendered as a portal in the DOM root (outside SVG) */}
      {showEditModal &&
        createPortal(
          <PersonEditModal
            individual={individual}
            onClose={() => setShowEditModal(false)}
            onSaved={() => onDataChanged?.()}
          />,
          document.body
        )}

      {/* Detail modal rendered as a portal (view mode only) */}
      {showDetailModal &&
        createPortal(
          <PersonDetailModal
            individual={individual}
            onClose={() => setShowDetailModal(false)}
          />,
          document.body
        )}
    </>
  );
}
