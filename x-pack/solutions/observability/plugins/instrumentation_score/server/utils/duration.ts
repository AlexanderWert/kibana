const regex = /^\s*(\d+)\s*([smhd])\s*$/i;

/**
 * Converts a duration string (e.g. '1m', '2h', '30s') to seconds.
 * Supports 's' (seconds), 'm' (minutes), 'h' (hours), 'd' (days).
 * Returns NaN for invalid input.
 */
export function durationToSeconds(duration: string): number {
  const match = regex.exec(duration);
  if (!match) return NaN;
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 3600;
    case 'd': return value * 86400;
    default: return NaN;
  }
}

export function isValidDuration(duration: string): boolean {
  const match = regex.exec(duration);
  return !!match
}
