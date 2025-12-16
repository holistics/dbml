import { Compiler } from '@dbml/parse';
import { DEFAULT_SCHEMA_NAME } from './model_structure/config.js';

/**
 * Renames a table in DBML code using token-based replacement to preserve comments and formatting
 *
 * @param {string} oldTableName - The current table name. Can be:
 *                                 - "users" (no schema → defaults to public schema)
 *                                 - "public.users" (explicit schema)
 * @param {string} newTableName - The new table name. Can be:
 *                                 - "customers" (no schema → defaults to public schema)
 *                                 - "private.customers" (explicit schema)
 * @param {string} dbmlCode - The DBML code containing the table
 * @returns {string} The updated DBML code with the renamed table
 */
function renameTableTokenBased (oldTableName, newTableName, dbmlCode) {
  // Parse table names
  // IMPORTANT: Missing schema defaults to DEFAULT_SCHEMA_NAME (public)
  const oldParts = parseTableName(oldTableName);
  const newPartsRaw = parseTableName(newTableName);

  // Validate new table name - add quotes if necessary
  const validationResult = validateAndQuoteTableName(newPartsRaw, dbmlCode, oldParts);
  if (!validationResult.isValid) {
    // New table name is invalid even with quotes - return unchanged
    return dbmlCode;
  }

  // Create newParts with both raw and formatted versions
  const newParts = {
    tableName: validationResult.tableName, // Formatted with quotes if needed
    schemaName: validationResult.schemaName, // Formatted with quotes if needed
    rawTableName: newPartsRaw.tableName, // Raw value without quotes
    rawSchemaName: newPartsRaw.schemaName, // Raw value without quotes
    shouldQuoteTable: validationResult.shouldQuoteTable,
    shouldQuoteSchema: validationResult.shouldQuoteSchema,
  };

  // Create Compiler instance to get tokens
  const compiler = new Compiler();
  compiler.setSource(dbmlCode);

  let tokens;
  try {
    tokens = compiler.parse.tokens();
  } catch {
    // If parsing fails, return unchanged code
    return dbmlCode;
  }

  // Check for name collision before renaming
  if (checkForNameCollision(tokens, oldParts, newParts)) {
    return dbmlCode; // Return unchanged
  }

  // Find all token positions that need to be replaced
  const replacements = findTableReferences(tokens, oldParts);

  // Apply replacements in reverse order (from end to start) to preserve positions
  return applyReplacements(dbmlCode, replacements, oldParts, newParts);
}

/**
 * Validates a table name and determines if it needs quotes
 * Checks if the original table name in source uses quotes to preserve style
 *
 * @param {{schemaName: string, tableName: string}} nameParts - Table name parts to validate
 * @param {string} dbmlSource - Original DBML source to check quoting style
 * @param {{schemaName: string, tableName: string}} oldParts - Old table name parts
 * @returns {{isValid: boolean, tableName: string, schemaName: string, useQuotes: boolean}}
 */
function validateAndQuoteTableName (nameParts, dbmlSource, oldParts) {
  const { tableName, schemaName } = nameParts;

  // Check if original table name used quotes in the source
  const originalUsedQuotes = checkIfTableUsesQuotes(dbmlSource, oldParts);

  // Helper function to test if a name is valid DBML identifier
  const isValidIdentifier = (name) => {
    // Valid DBML identifiers: alphanumeric, underscore, start with letter or underscore or number
    // Invalid: spaces, hyphens, dots, special chars
    return /^[a-zA-Z0-9_]+$/.test(name);
  };

  // Determine if we need quotes
  const tableNeedsQuotes = !isValidIdentifier(tableName);
  const schemaNeedsQuotes = !isValidIdentifier(schemaName);

  // Apply quotes individually based on need or original style
  const shouldQuoteTable = originalUsedQuotes || tableNeedsQuotes;
  const shouldQuoteSchema = originalUsedQuotes || schemaNeedsQuotes;

  // Format names with quotes if needed
  const formattedTableName = shouldQuoteTable ? `"${tableName}"` : tableName;
  const formattedSchemaName = shouldQuoteSchema ? `"${schemaName}"` : schemaName;

  // Validate by attempting to parse a minimal table definition
  try {
    const testDbml = schemaName !== DEFAULT_SCHEMA_NAME
      ? `Table ${formattedSchemaName}.${formattedTableName} { id int }`
      : `Table ${formattedTableName} { id int }`;

    const compiler = new Compiler();
    compiler.setSource(testDbml);
    compiler.parse.tokens(); // Will throw if invalid

    return {
      isValid: true,
      tableName: formattedTableName,
      schemaName: formattedSchemaName,
      shouldQuoteTable,
      shouldQuoteSchema,
    };
  } catch (error) {
    // Even with quotes, the name is invalid
    return {
      isValid: false,
      tableName,
      schemaName,
      shouldQuoteTable: false,
      shouldQuoteSchema: false,
    };
  }
}

/**
 * Checks if a table name uses quotes in the original source
 *
 * @param {string} source - DBML source code
 * @param {{schemaName: string, tableName: string}} tableParts - Table name parts
 * @returns {boolean} True if the table definition uses quotes
 */
function checkIfTableUsesQuotes (source, tableParts) {
  // Look for Table definition with quotes
  const quotedPattern = tableParts.schemaName !== DEFAULT_SCHEMA_NAME
    ? new RegExp(`Table\\s+"${escapeRegex(tableParts.schemaName)}"\\."${escapeRegex(tableParts.tableName)}"`)
    : new RegExp(`Table\\s+"${escapeRegex(tableParts.tableName)}"`);

  return quotedPattern.test(source);
}

/**
 * Parses a table name that may be schema-qualified
 *
 * IMPORTANT: Missing schema always defaults to DEFAULT_SCHEMA_NAME (public)
 *
 * @param {string} tableName - Table name, can be:
 *                             - "users" → {schemaName: "public", tableName: "users"}
 *                             - "private.users" → {schemaName: "private", tableName: "users"}
 * @returns {{schemaName: string, tableName: string}}
 */
function parseTableName (tableName) {
  const parts = tableName.split('.');
  if (parts.length === 2 && parts[0] && parts[1]) {
    // Has explicit schema
    return {
      schemaName: parts[0],
      tableName: parts[1],
    };
  }
  // No schema → default to public
  return {
    schemaName: DEFAULT_SCHEMA_NAME,
    tableName: tableName,
  };
}

/**
 * Finds table references inside a string literal (e.g., check constraints)
 * Looks for patterns like:
 * - "table.field" (unqualified, public schema)
 * - "schema.table.field" (qualified)
 *
 * Note: For function-expression tokens, the value doesn't include backticks,
 * but start/end positions do. We need to account for this offset.
 *
 * @param {object} token - String token from compiler
 * @param {{schemaName: string, tableName: string}} oldParts - Old table name parts
 * @returns {Array<{start: number, end: number, type: string, stringContent: string}>} Array of matches
 */
function findTableReferencesInString (token, oldParts) {
  const replacements = [];
  const content = token.value;

  // For function-expression tokens (backtick strings), the token.value doesn't include backticks,
  // but token.start/end do. We need to add 1 to account for the opening backtick.
  const offset = token.kind === '<function-expression>' ? 1 : 0;

  // Pattern 1: schema.table.field (qualified)
  const qualifiedPattern = new RegExp(`\\b${escapeRegex(oldParts.schemaName)}\\.${escapeRegex(oldParts.tableName)}\\.`, 'g');
  let match;
  while ((match = qualifiedPattern.exec(content)) !== null) {
    // Calculate position: token.start + offset + match.index
    // We want to replace "schema.table" part only (not the field)
    const matchStart = token.start + offset + match.index;
    const matchEnd = matchStart + oldParts.schemaName.length + 1 + oldParts.tableName.length; // schema + . + table

    replacements.push({
      start: matchStart,
      end: matchEnd,
      type: 'string_qualified',
      stringContent: content,
    });
  }

  // Pattern 2: table.field (unqualified, only if old schema is public)
  if (oldParts.schemaName === DEFAULT_SCHEMA_NAME) {
    const unqualifiedPattern = new RegExp(`\\b${escapeRegex(oldParts.tableName)}\\.`, 'g');
    while ((match = unqualifiedPattern.exec(content)) !== null) {
      // Make sure this isn't part of schema.table.field pattern (already handled above)
      const prevChar = match.index > 0 ? content[match.index - 1] : '';
      if (prevChar !== '.') {
        const matchStart = token.start + offset + match.index;
        const matchEnd = matchStart + oldParts.tableName.length; // just the table name

        replacements.push({
          start: matchStart,
          end: matchEnd,
          type: 'string_unqualified',
          stringContent: content,
        });
      }
    }
  }

  return replacements;
}

/**
 * Escapes special regex characters in a string
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeRegex (str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Helper to check if token is an identifier (quoted or unquoted) and get its value
 * @param {object} token - Token to check
 * @returns {{isIdentifier: boolean, value: string, isQuoted: boolean}}
 */
function getIdentifierInfo (token) {
  if (token.kind === '<identifier>') {
    return { isIdentifier: true, value: token.value, isQuoted: false };
  }
  if (token.kind === '<variable>') {
    // <variable> tokens are quoted identifiers, value doesn't include quotes
    return { isIdentifier: true, value: token.value, isQuoted: true };
  }
  return { isIdentifier: false, value: '', isQuoted: false };
}

/**
 * Checks if renaming would create a name collision
 * Returns true if a table with the new name already exists in the target schema
 *
 * @param {Array} tokens - Parsed tokens from DBML
 * @param {{schemaName: string, tableName: string}} oldParts - Old table name parts
 * @param {{rawSchemaName: string, rawTableName: string}} newParts - New table name parts (raw, unquoted)
 * @returns {boolean} True if collision would occur
 */
function checkForNameCollision (tokens, oldParts, newParts) {
  const existingTables = [];

  // Find all table definitions
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    // Look for "Table" keyword
    if (token.kind === '<identifier>' && token.value === 'Table') {
      // Next non-whitespace token should be the table name (or schema.table)
      let j = i + 1;
      // Skip whitespace
      while (j < tokens.length && (tokens[j].kind === '<space>' || tokens[j].kind === '<newline>' || tokens[j].kind === '<tab>')) {
        j++;
      }

      if (j >= tokens.length) continue;

      const nameInfo = getIdentifierInfo(tokens[j]);
      if (!nameInfo.isIdentifier) continue;

      // Check if this is schema.table or just table
      let schemaName = DEFAULT_SCHEMA_NAME;
      let tableName = nameInfo.value;

      // Look ahead for dot (schema qualifier)
      let k = j + 1;
      while (k < tokens.length && (tokens[k].kind === '<space>' || tokens[k].kind === '<tab>')) {
        k++;
      }

      if (k < tokens.length && tokens[k].kind === '<op>' && tokens[k].value === '.') {
        // This is schema.table
        schemaName = nameInfo.value;

        // Get table name after dot
        let m = k + 1;
        while (m < tokens.length && (tokens[m].kind === '<space>' || tokens[m].kind === '<tab>')) {
          m++;
        }

        if (m < tokens.length) {
          const tableInfo = getIdentifierInfo(tokens[m]);
          if (tableInfo.isIdentifier) {
            tableName = tableInfo.value;
          }
        }
      }

      existingTables.push({ schemaName, tableName });
    }
  }

  // Check if new name would collide with any existing table (excluding the old table itself)
  for (const existing of existingTables) {
    // Skip the old table we're renaming
    if (existing.schemaName === oldParts.schemaName && existing.tableName === oldParts.tableName) {
      continue;
    }

    // Check for collision
    if (existing.schemaName === newParts.rawSchemaName && existing.tableName === newParts.rawTableName) {
      return true; // Collision detected!
    }
  }

  return false; // No collision
}

/**
 * Finds all token positions where the table is referenced
 * Handles both qualified (schema.table) and unqualified (table) references
 * Also handles table names inside check constraint strings
 * Supports both quoted and unquoted identifiers
 *
 * @param {Array} tokens - Array of SyntaxToken from compiler
 * @param {{schemaName: string, tableName: string}} oldParts - Old table name parts
 * @returns {Array<{start: number, end: number, type: string, wasQuoted?: boolean, stringContent?: string}>} Array of positions to replace
 */
function findTableReferences (tokens, oldParts) {
  const replacements = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    // Handle string literals and function expressions (check constraints use backticks → function-expression)
    if (token.kind === '<string>' || token.kind === '<function-expression>') {
      const stringReplacements = findTableReferencesInString(token, oldParts);
      replacements.push(...stringReplacements);
      continue;
    }

    // Skip non-identifier tokens (including both <identifier> and <variable>)
    const tokenInfo = getIdentifierInfo(token);
    if (!tokenInfo.isIdentifier) continue;

    // Check for qualified reference: schema.table
    if (i + 2 < tokens.length
      && tokens[i + 1].kind === '<op>'
      && tokens[i + 1].value === '.') {
      const secondInfo = getIdentifierInfo(tokens[i + 2]);

      if (secondInfo.isIdentifier) {
        const firstPart = tokenInfo.value;
        const secondPart = secondInfo.value;

        // Check if this is schema.table matching our old name
        if (firstPart === oldParts.schemaName && secondPart === oldParts.tableName) {
          replacements.push({
            start: token.start,
            end: tokens[i + 2].end,
            type: 'qualified', // Replacing "schema.table"
            wasQuoted: tokenInfo.isQuoted || secondInfo.isQuoted,
          });
          i += 2; // Skip the dot and table name tokens
          continue;
        }

        // Check if this is table.field where table matches old name
        // This happens in refs and check constraints: "users.id" where users is in public schema
        if (firstPart === oldParts.tableName) {
          // Check if previous token is NOT a dot (to avoid matching "schema.table.field")
          const prevToken = i > 0 ? tokens[i - 1] : null;
          const isPrevDot = prevToken && prevToken.kind === '<op>' && prevToken.value === '.';

          if (!isPrevDot) {
            // This is "table.field" - unqualified table reference
            // Only replace if old schema is public (implicit schema)
            if (oldParts.schemaName === DEFAULT_SCHEMA_NAME) {
              replacements.push({
                start: token.start,
                end: token.end,
                type: 'unqualified_with_field', // Replacing "table" in "table.field"
                wasQuoted: tokenInfo.isQuoted,
              });
            }
            // Don't skip tokens - we only want to replace the table part
            continue;
          }
        }
      }
    }

    // Check for standalone unqualified reference: just the table name
    if (tokenInfo.value === oldParts.tableName) {
      const nextToken = i + 1 < tokens.length ? tokens[i + 1] : null;
      const prevToken = i > 0 ? tokens[i - 1] : null;

      const isNextDot = nextToken && nextToken.kind === '<op>' && nextToken.value === '.';
      const isPrevDot = prevToken && prevToken.kind === '<op>' && prevToken.value === '.';

      // Skip if this is part of a qualified name we already processed
      if (isPrevDot) continue;

      // Already handled "table.field" case above
      if (isNextDot) continue;

      // This is a standalone table name (e.g., after "Table" keyword or in TableGroup)
      // Only match if old schema is public (implicit)
      if (oldParts.schemaName === DEFAULT_SCHEMA_NAME) {
        const prevNonTriviaToken = findPrevNonTriviaToken(tokens, i - 1);
        if (prevNonTriviaToken
          && (prevNonTriviaToken.value === 'Table' || prevNonTriviaToken.kind === '<lbrace>')) {
          replacements.push({
            start: token.start,
            end: token.end,
            type: 'standalone', // Replacing standalone "table"
            wasQuoted: tokenInfo.isQuoted,
          });
        }
      }
    }
  }

  return replacements;
}

/**
 * Finds the previous non-trivia (non-whitespace/comment) token
 * @param {Array} tokens - Token array
 * @param {number} startIndex - Index to start searching backwards from
 * @returns {object|null} Previous non-trivia token or null
 */
function findPrevNonTriviaToken (tokens, startIndex) {
  for (let i = startIndex; i >= 0; i--) {
    const token = tokens[i];
    if (token.kind !== '<space>'
      && token.kind !== '<tab>'
      && token.kind !== '<newline>'
      && token.kind !== '<single-line-comment>'
      && token.kind !== '<multiline-comment>') {
      return token;
    }
  }
  return null;
}

/**
 * Applies all replacements to the source code
 *
 * @param {string} source - Original DBML source
 * @param {Array} replacements - Array of replacement positions
 * @param {{schemaName: string, tableName: string}} oldParts - Old table name parts (schema defaults to public if not specified)
 * @param {{schemaName: string, tableName: string}} newParts - New table name parts (schema defaults to public if not specified)
 * @returns {string} Modified source code
 */
function applyReplacements (source, replacements, oldParts, newParts) {
  // Sort replacements in reverse order (last to first) to preserve positions
  const sortedReplacements = [...replacements].sort((a, b) => b.start - a.start);

  let result = source;

  for (const replacement of sortedReplacements) {
    const { start, end, type } = replacement;

    let newText;

    if (type === 'qualified') {
      // Replacing "schema.table" with new name
      // If new schema is public (default), can use unqualified or qualified
      // If new schema is NOT public, must use qualified
      if (newParts.rawSchemaName !== DEFAULT_SCHEMA_NAME) {
        newText = `${newParts.schemaName}.${newParts.tableName}`;
      } else {
        newText = newParts.tableName;
      }
    } else if (type === 'unqualified_with_field' || type === 'standalone') {
      // Replacing "table" (unqualified)
      // If new schema is public (default), keep unqualified
      // If new schema is NOT public, add schema qualifier
      if (newParts.rawSchemaName !== DEFAULT_SCHEMA_NAME) {
        newText = `${newParts.schemaName}.${newParts.tableName}`;
      } else {
        newText = newParts.tableName;
      }
    } else if (type === 'string_qualified') {
      // Replacing "schema.table" inside a string literal
      if (newParts.rawSchemaName !== DEFAULT_SCHEMA_NAME) {
        newText = `${newParts.schemaName}.${newParts.tableName}`;
      } else {
        newText = newParts.tableName;
      }
    } else if (type === 'string_unqualified') {
      // Replacing "table" inside a string literal
      if (newParts.rawSchemaName !== DEFAULT_SCHEMA_NAME) {
        newText = `${newParts.schemaName}.${newParts.tableName}`;
      } else {
        newText = newParts.tableName;
      }
    } else {
      // Shouldn't happen, but fallback to table name
      newText = newParts.tableName;
    }

    // Replace the text at this position
    result = result.substring(0, start) + newText + result.substring(end);
  }

  return result;
}

export default renameTableTokenBased;
