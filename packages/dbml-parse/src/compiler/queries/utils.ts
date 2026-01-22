/**
 * Unescapes a string by processing escape sequences.
 * Handles escaped quotes (\"), common escape sequences, unicode (\uHHHH), and arbitrary escapes.
 *
 * @param str - The string to unescape
 * @returns The unescaped string
 *
 * @example
 * unescapeString('table\\"name') => 'table"name'
 * unescapeString('line1\\nline2') => 'line1\nline2'
 * unescapeString('\\u0041BC') => 'ABC'
 * unescapeString('\\x') => 'x'
 */
export function unescapeString (str: string): string {
  let result = '';
  let i = 0;

  while (i < str.length) {
    if (str[i] === '\\' && i + 1 < str.length) {
      const nextChar = str[i + 1];

      // Handle unicode escape sequences \uHHHH
      if (nextChar === 'u' && i + 5 < str.length) {
        const hex = str.slice(i + 2, i + 6);
        if (/^[0-9a-fA-F]{4}$/.test(hex)) {
          result += String.fromCharCode(parseInt(hex, 16));
          i += 6;
          continue;
        }
      }

      // Handle common escape sequences
      const escapeMap: Record<string, string> = {
        'n': '\n',
        't': '\t',
        'r': '\r',
        'b': '\b',
        'f': '\f',
        'v': '\v',
        '0': '\0',
        '\\': '\\',
        '"': '"',
        '\'': '\'',
        '`': '`',
      };

      if (nextChar in escapeMap) {
        result += escapeMap[nextChar];
        i += 2;
      } else {
        // Unknown escape sequence - just use the character after backslash
        result += nextChar;
        i += 2;
      }
    } else {
      result += str[i];
      i++;
    }
  }

  return result;
}

/**
 * Escapes a string by adding backslashes before special characters.
 * Handles quotes and other characters that need escaping.
 *
 * @param str - The string to escape
 * @returns The escaped string
 *
 * @example
 * escapeString('table"name') => 'table\\"name'
 * escapeString('line1\nline2') => 'line1\\nline2'
 */
export function escapeString (str: string): string {
  let result = '';

  for (let i = 0; i < str.length; i++) {
    const char = str[i];

    switch (char) {
      case '\\':
        result += '\\\\';
        break;
      case '"':
        result += '\\"';
        break;
      case '\'':
        result += "\\'";
        break;
      case '\n':
        result += '\\n';
        break;
      case '\t':
        result += '\\t';
        break;
      case '\r':
        result += '\\r';
        break;
      case '\b':
        result += '\\b';
        break;
      case '\f':
        result += '\\f';
        break;
      case '\v':
        result += '\\v';
        break;
      case '\0':
        result += '\\0';
        break;
      default:
        result += char;
    }
  }

  return result;
}

/**
 * Splits a qualified identifier string into its components, handling quoted segments.
 *
 * Examples:
 *   - "schema.table" => ["schema", "table"]
 *   - '"schema name".table' => ["schema name", "table"]
 *   - '"schema.with.dots"."table.with.dots".column' => ["schema.with.dots", "table.with.dots", "column"]
 *   - 'schema."table name"."column name"' => ["schema", "table name", "column name"]
 *   - 'schema . table' => ["schema", "table"]
 *
 * @param identifier - The qualified identifier string to split
 * @returns Array of unquoted identifier components
 */
export function splitQualifiedIdentifier (identifier: string): string[] {
  // Match quoted strings (with escaped quotes) or unquoted identifiers
  const pattern = /"(?:[^"\\]|\\.)*"|[^."]+/g;
  const matches = identifier.match(pattern) || [];

  return matches
    .map((match) => {
      // If quoted, remove quotes and unescape
      if (match.startsWith('"') && match.endsWith('"')) {
        const content = match.slice(1, -1);
        return unescapeString(content);
      }
      // Otherwise trim whitespace from unquoted component
      return match.trim();
    })
    .filter((component) => component.length > 0);
}
