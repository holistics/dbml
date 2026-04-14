// Convert a string to an enum value by case-insensitive match against the enum's values
export function convertStringToEnum<T extends Record<string, string>> (enumObj: T, value: string): T[keyof T] | undefined {
  const lower = value.toLowerCase();
  return (Object.values(enumObj) as string[]).find((v) => v.toLowerCase() === lower) as T[keyof T] | undefined;
}
