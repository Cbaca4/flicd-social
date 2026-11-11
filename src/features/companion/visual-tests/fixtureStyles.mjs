// Keep the Companion fixture offline without changing the application's cascade.
export function stripFixtureFontImports(source) {
  // Semicolons inside the quoted font-weight URL are not import terminators.
  return source.replace(/@import\s*(?:url\(\s*)?(['"])https:\/\/fonts\.googleapis\.com[^'"]*\1\s*\)?\s*;/g, "");
}
