// Prints the updater's poll interval in seconds. Live scores come from ESPN's keyless
// public API and finals from football-data.org — neither has a daily quota to throttle —
// so the cadence is a fixed 5 minutes. That's well under LIVE_STALE_MS (10 min), so the
// live ticker stays fresh and never false-triggers the "no live update" paused state.
console.log(300);
