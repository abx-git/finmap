export function isValidWkn(wkn: string): boolean {
  return /^[A-Z0-9]{6}$/i.test(wkn.trim());
}
