/** The social/fingerprint palette is local to the publication, not the house UI theme.
 * Preserve the original legacy colors for other publications.
 */
export const LEGACY_SOCIAL_COLORS = Object.freeze(["#f4f1e8", "#ece7d8", "#121212", "#d11a1a", "#4f6d7a", "#d2b24c"]);
export const KOIOS_008_BLUE = "#000088";
export const KOIOS_SOCIAL_COLORS = Object.freeze(["#f4f1e8", "#ece7d8", "#171a21", KOIOS_008_BLUE, "#57679c", "#c5cbe0"]);

export function socialPaletteFor(property) {
  const koios = property?.name === "Koios.News" || property?.origin === "https://koios.news";
  return koios ? KOIOS_SOCIAL_COLORS : LEGACY_SOCIAL_COLORS;
}
