/**
 * A GPS code is three parts — region, area, address — and the shortest real one
 * is eight characters once the dashes are dropped. Checked locally on purpose:
 * confirming a code actually exists would mean a lookup endpoint outside this
 * feature's contract, and the verification response answers that anyway.
 */
export function isCompleteGpsCode(value: string) {
  return value.replace(/[^A-Za-z0-9]/g, '').length >= 8;
}
