
export function extractLastDigit(quote: number, pipSize: number): number {
  if (quote === undefined || quote === null || isNaN(quote)) return 0;
  const cleanPipSize = pipSize < 1 && pipSize > 0 ? calculateDecimalCount(pipSize) : Math.floor(pipSize);
  const multiplier = Math.pow(10, cleanPipSize);
  const truncated = Math.floor(quote * multiplier + 0.00000001);
  return Math.abs(truncated % 10);
}

export function calculateDecimalCount(pip: number): number {
  if (pip === undefined || pip === null || isNaN(pip)) return 2;
  if (Number.isInteger(pip) && pip >= 0 && pip <= 10) return pip;
  const s = String(pip);
  if (s.includes(".")) return s.split(".")[1].length;
  if (s.includes("e-")) return Number.parseInt(s.split("e-")[1], 10);
  if (pip > 0 && pip < 1) {
    return Math.abs(Math.floor(Math.log10(pip + 1e-10)));
  }
  return 2;
}

export function formatPrice(price: number, pipSize: number): string {
  const decimals = pipSize < 1 && pipSize > 0 ? calculateDecimalCount(pipSize) : Math.floor(pipSize);
  return price.toFixed(decimals);
}
