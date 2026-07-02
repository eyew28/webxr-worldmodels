/**
 * Curated exhibits Sophie's knowledge base covers — the three Aristide Maillol
 * sculptures in the Jardin des Tuileries scene. Each `name` is the EXACT string
 * the backend uses as `exhibit_name` (see louvre-xr-backend exhibits_data.py),
 * so it can be sent straight to /ask as the `exhibit` hint (approach B: the
 * frontend already knows which splat is loaded, so no vision guess is needed).
 *
 * `match` = lowercase substrings of the splat URL/filename that identify it.
 * La Nuit and L'Hommage à Cézanne ship as `Lanuit.ply` and `Cézanne.ply`,
 * both already covered by the tokens below.
 */
export interface Exhibit {
  /** Exact backend exhibit name — sent to /ask as `exhibit`. */
  name: string;
  match: string[];
}

export const EXHIBITS: Exhibit[] = [
  { name: "Air", match: ["airlo3c", "air"] },
  { name: "La Nuit (Night)", match: ["la_nuit", "lanuit", "nuit", "night"] },
  {
    name: "L'Hommage à Cézanne",
    match: ["hommage", "cezanne", "cézanne"],
  },
];

/** Resolves a splat URL/filename to its exhibit, or null if not one of ours. */
export function exhibitForSplatKey(key: string | null | undefined): Exhibit | null {
  if (!key) return null;
  const s = key.toLowerCase();
  return EXHIBITS.find((e) => e.match.some((token) => s.includes(token))) ?? null;
}
