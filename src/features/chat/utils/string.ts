// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseSources(sourcesUsed: any): ChatSource[] {
  if (!sourcesUsed) return [];

  // If already an array, return directly
  if (Array.isArray(sourcesUsed)) return sourcesUsed;

  // If it's a string, try parsing it
  if (typeof sourcesUsed === "string") {
    try {
      const parsed = JSON.parse(sourcesUsed.replace(/'/g, '"')); // fix single quotes from backend
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.warn("Failed to parse sources_used:", sourcesUsed, err);
      return [];
    }
  }

  return [];
}
