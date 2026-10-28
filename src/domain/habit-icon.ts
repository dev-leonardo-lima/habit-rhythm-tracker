/** An icon ID is stored independently of which icons are currently installed. */
export function normalizeHabitIcon(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const id = value;
  const containsControl = [...id].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
  if (id.trim().length === 0 || id.length > 128 || containsControl) {
    return null;
  }
  return id;
}
