// Helpers for reading environment variables. Used by config.ts.

// Read a setting that must be a positive number. Use the default when it is not set.
export function readNumber(name: string, defaultValue: number): number {
  const text = process.env[name];
  if (!text) return defaultValue;

  const value = Number(text);
  if (!(value > 0)) {
    throw new Error(`${name} must be a positive number, but it is "${text}"`);
  }
  return value;
}

// Read a setting that must be present.
export function readRequired(name: string): string {
  const text = process.env[name];
  if (!text) {
    throw new Error(`${name} is not set. Copy .env.example to .env and fill it in.`);
  }
  return text;
}

// Read a setting that must be one of a fixed list of words, for example "mock" or "whisper".
export function readChoice<T extends string>(name: string, allowed: readonly T[], defaultValue: T): T {
  const text = process.env[name];
  if (!text) return defaultValue;

  if (!allowed.includes(text as T)) {
    throw new Error(`${name} must be one of: ${allowed.join(", ")}. It is "${text}".`);
  }
  return text as T;
}
