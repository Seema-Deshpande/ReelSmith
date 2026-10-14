// Round a time in seconds to 2 decimals: 2.34567 becomes 2.35.
export function roundSeconds(seconds: number): number {
  return Math.round(seconds * 100) / 100;
}
