/*
 * The locked spec, split into lib/content/ modules. Every price, count,
 * name, URL, and line of recurring copy lives in these files; pages and
 * components import from "@/lib/site" exactly as before (this barrel
 * re-exports everything), so content stays one source with no drift.
 *
 * Asset fields set to null mean "real asset not delivered yet": the
 * components render a designed placeholder until the value is filled in.
 *
 * Relative imports throughout (never "@/") so this stays importable from
 * one-off scripts run outside Next.
 */
export * from "./content/core";
export * from "./content/media";
export * from "./content/premade";
export * from "./content/proof";
export * from "./content/pages";
export * from "./content/classic";
export * from "./content/catalog-extra";
export * from "./content/codes";
export * from "./content/sellable";
