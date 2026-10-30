export const SEED_MARKER_KEY = "seed.completed";

/** Startup seeds only when this marker is absent, so later boots do not overwrite data. */
export function shouldRunStartupSeed(marker) {
  return marker == null;
}
