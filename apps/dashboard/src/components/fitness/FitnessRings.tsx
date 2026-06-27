/**
 * FitnessRings — three compact donut rings showing Fitness (CTL),
 * Fatigue (ATL), and Form (TSB = CTL - ATL).
 *
 * Number + label are the primary truth; ring arc is decoration.
 * Color is never the sole indicator of meaning — every state also
 * has explicit text.
 */

export interface FitnessRingsProps {
  fitness: number;
  fatigue: number;
  form: number;
}

// TSB band definitions — standard TrainingPeaks interpretation
export interface TsbBand {
  label: string;
  color: string;
}

export function tsbBand(form: number): TsbBand {
  if (form > 25)   return { label: 'Transition',    color: 'var(--z2)' };
  if (form > 5)    return { label: 'Fresh',         color: 'var(--z2)' };
  if (form >= -10) return { label: 'Neutral',       color: 'var(--z3)' };
  if (form >= -30) return { label: 'Optimal training', color: 'var(--brand)' };
  return           { label: 'High risk',            color: 'var(--z5)' };
}

// ─── Single ring ───────────────────────────────────────────────────────────

interface RingProps {
  /** 0–1 fill fraction */
  fill: number;
  /** Ring track color */
  color: string;
  /** Large center number text */
  value: string;
  /** Small label below value */
  label: string;
  /** Optional sub-label (TSB band) */
  sublabel?: string;
}

const R = 44;
const STROKE = 9;
const CX = 56;
const CY = 56;
const CIRCUMFERENCE = 2 * Math.PI * R;

function Ring({ fill, color, value, label, sublabel }: RingProps) {
  const clampedFill = Math.min(1, Math.max(0, fill));
  const dashoffset = CIRCUMFERENCE * (1 - clampedFill);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--sp-2)',
        flex: '1 1 0',
        minWidth: 0,
      }}
    >
      <svg
        width={CX * 2}
        height={CY * 2}
        viewBox={`0 0 ${CX * 2} ${CY * 2}`}
        aria-hidden="true"
        style={{ overflow: 'visible' }}
      >
        {/* Track */}
        <circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={STROKE}
        />
        {/* Fill arc — starts at top (–90°) */}
        <circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${CX} ${CY})`}
          style={{ transition: 'stroke-dashoffset 0.4s ease' }}
        />
        {/* Value number inside ring */}
        <text
          x={CX}
          y={CY + 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="var(--text)"
          fontSize="22"
          fontWeight="700"
          fontFamily="var(--font)"
        >
          {value}
        </text>
      </svg>

      {/* Label */}
      <p style={{
        margin: 0,
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--text-dim)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        textAlign: 'center',
      }}>
        {label}
      </p>

      {/* Band sub-label — visible text so color is not sole indicator */}
      {sublabel && (
        <p style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 500,
          color,
          textAlign: 'center',
          lineHeight: 1.3,
        }}>
          {sublabel}
        </p>
      )}
    </div>
  );
}

// ─── FitnessRings ──────────────────────────────────────────────────────────

// Domains for arc scaling
const FITNESS_MAX = 100;  // typical CTL ceiling
const FATIGUE_MAX = 100;  // typical ATL ceiling
const FORM_MIN = -40;
const FORM_MAX = 40;

export default function FitnessRings({ fitness, fatigue, form }: FitnessRingsProps) {
  const fitnessFill = Math.min(1, Math.max(0, fitness / FITNESS_MAX));
  const fatigueFill = Math.min(1, Math.max(0, fatigue / FATIGUE_MAX));

  // Form arc: map [-40..+40] → [0..1], center at 0 = 0.5 fill
  const formFill = Math.min(1, Math.max(0, (form - FORM_MIN) / (FORM_MAX - FORM_MIN)));

  const band = tsbBand(form);
  const formSign = form > 0 ? '+' : '';

  return (
    <div
      role="region"
      aria-label="Fitness, Fatigue and Form summary"
      style={{
        display: 'flex',
        gap: 'var(--sp-2)',
        padding: 'var(--sp-4)',
        alignItems: 'flex-start',
      }}
    >
      <Ring
        fill={fitnessFill}
        color="var(--z1)"
        value={String(Math.round(fitness))}
        label="Fitness"
      />
      <Ring
        fill={fatigueFill}
        color="var(--z5)"
        value={String(Math.round(fatigue))}
        label="Fatigue"
      />
      <Ring
        fill={formFill}
        color={band.color}
        value={`${formSign}${Math.round(form)}`}
        label="Form"
        sublabel={band.label}
      />
    </div>
  );
}
