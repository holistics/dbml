export function renameTable(
  oldName: { schema?: string; table: string },
  newName: { schema?: string; table: string },
  dbmlCode: string
): string;
