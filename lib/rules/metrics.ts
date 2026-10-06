export function calculateOverrideRate(confirmed: number, rejected: number): number {
  const denominator = confirmed + rejected;
  return denominator === 0 ? 0 : rejected / denominator;
}
