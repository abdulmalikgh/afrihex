/**
 * Scores arrive as 0.0–1.0 fractions, never percentages. `fraud_risk_score` in
 * particular reads 0.12, not 12 — showing the raw number as a percent would
 * overstate risk by two orders of magnitude.
 */
export function formatScoreAsPercent(value: number | undefined) {
  return typeof value === 'number' ? `${Math.round(value * 100)}%` : undefined;
}

/** Fraud risk keeps its decimal form, matching the web: "0.00", "0.62". */
export function formatRiskScore(value: number | undefined) {
  return typeof value === 'number' ? value.toFixed(2) : undefined;
}

export function formatMetres(value: number | undefined) {
  if (typeof value !== 'number') {
    return undefined;
  }

  // Sub-metre precision is noise from a GPS fix; whole metres below 10 keeps a
  // "2 m" reading honest without implying centimetre accuracy.
  return `${value < 10 ? Math.round(value * 10) / 10 : Math.round(value)} m`;
}

/**
 * Enum values are uppercase tokens (`LOW`, `NOT_PROVIDED`). The web shows them
 * as-is in a monospace column, which keeps them recognisable against the raw
 * JSON and avoids inventing prettier labels for values we do not control.
 */
export function formatEnumValue(value: string | undefined) {
  return value?.trim() ? value : undefined;
}
