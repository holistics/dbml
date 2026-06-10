/**
 * A builder-pattern class for constructing GitHub-flavored markdown tables.
 *
 * Usage:
 *   const table = new MarkdownTable()
 *     .headers(['Name', 'Score', 'Change'])
 *     .align(['l', 'r', 'r'])
 *     .row(['lex', '120ms', '+5%'])
 *     .row(['parse', '340ms', '+35%'])
 *     .build();
 */
export class MarkdownTable {
  constructor () {
    this._headers = [];
    this._alignments = [];
    this._rows = [];
  }

  /** Set column headers. */
  headers (headers) {
    this._headers = headers;
    return this;
  }

  /**
   * Set column alignments.
   * Each value is 'l' (left), 'r' (right), or 'c' (center).
   * Columns without an alignment default to left.
   */
  align (alignments) {
    this._alignments = alignments;
    return this;
  }

  /** Append a row of cell values. */
  row (cells) {
    this._rows.push(cells);
    return this;
  }

  /** Append multiple rows at once. */
  rows (rows) {
    for (const r of rows) {
      this._rows.push(r);
    }
    return this;
  }

  /** Build the markdown table string. */
  build () {
    const colCount = Math.max(
      this._headers.length,
      ...this._rows.map((r) => r.length),
    );

    // Compute max width per column for padding
    const widths = new Array(colCount).fill(0);
    const allRows = [this._headers, ...this._rows];
    for (const row of allRows) {
      for (let i = 0; i < colCount; i++) {
        const cell = String(row[i] ?? '');
        widths[i] = Math.max(widths[i], cell.length);
      }
    }
    // Separator row needs at least 3 chars (e.g. :--:)
    for (let i = 0; i < colCount; i++) {
      widths[i] = Math.max(widths[i], 3);
    }

    const pad = (str, i) => {
      const s = String(str ?? '');
      const a = this._alignments[i] || 'l';
      if (a === 'r') return s.padStart(widths[i]);
      if (a === 'c') {
        const total = widths[i] - s.length;
        const left = Math.floor(total / 2);
        return ' '.repeat(left) + s + ' '.repeat(total - left);
      }
      return s.padEnd(widths[i]);
    };

    const formatRow = (row) => {
      const cells = [];
      for (let i = 0; i < colCount; i++) {
        cells.push(pad(row[i], i));
      }
      return `| ${cells.join(' | ')} |`;
    };

    // Build separator row with alignment markers
    const separator = [];
    for (let i = 0; i < colCount; i++) {
      const a = this._alignments[i] || 'l';
      const dashes = '-'.repeat(widths[i]);
      if (a === 'c') separator.push(`:${dashes.slice(1, -1)}:`);
      else if (a === 'r') separator.push(`${dashes.slice(0, -1)}:`);
      else separator.push(dashes);
    }
    const sepRow = `| ${separator.join(' | ')} |`;

    const lines = [
      formatRow(this._headers),
      sepRow,
      ...this._rows.map(formatRow),
    ];

    return lines.join('\n');
  }
}
