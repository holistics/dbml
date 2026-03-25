import { type Position, type TextModel } from '@/services';
import { Filepath } from '@/compiler/projectLayout';
import { DEFAULT_ENTRY } from '@/compiler/constants';
import { Uri, UriComponents } from 'monaco-editor-core';

export function createPosition (lineNumber: number, column: number): Position {
  return {
    lineNumber,
    column,
  } as Position;
}

class MockUri implements Uri {
  readonly scheme: string;
  readonly authority: string;
  readonly path: string;
  readonly query: string;
  readonly fragment: string;

  get fsPath (): string {
    return '';
  }

  constructor ({
    path = '',
    scheme = '',
    authority = '',
    query = '',
    fragment = '',
  }: {
    path?: string;
    scheme?: string;
    authority?: string;
    query?: string;
    fragment?: string;
  }) {
    this.path = path;
    this.scheme = scheme;
    this.authority = authority;
    this.query = query;
    this.fragment = fragment;
  }

  with (_change: {
    scheme?: string;
    authority?: string | null;
    path?: string | null;
    query?: string | null;
    fragment?: string | null;
  }): MockUri {
    throw new Error('Unimplemented');
  }

  toJSON (): UriComponents {
    return {
      ...this,
    };
  }
}

export class MockTextModel implements TextModel {
  private content: string;
  public uri: MockUri;

  constructor (content: string, uri: Filepath = DEFAULT_ENTRY) {
    this.content = content;
    this.uri = new MockUri({ path: uri.absolute });
  }

  getOffsetAt (position: Position): number {
    // Split on all line ending types while preserving them for accurate offset calculation
    const lineEndingRegex = /\r\n|\r|\n/g;
    let lastIndex = 0;
    const lines: Array<{ text: string; ending: string }> = [];

    let match: RegExpMatchArray | null;
    while (true) {
      match = lineEndingRegex.exec(this.content);
      if (match === null) break;
      lines.push({
        text: this.content.slice(lastIndex, match.index),
        ending: match[0],
      });
      lastIndex = (match.index ?? 0) + match[0].length;
    }
    // Add remaining content after last line ending
    lines.push({ text: this.content.slice(lastIndex), ending: '' });

    let offset = 0;
    for (let i = 0; i < position.lineNumber - 1 && i < lines.length; i++) {
      offset += lines[i].text.length + lines[i].ending.length;
    }

    const currentLine = lines[position.lineNumber - 1];
    if (currentLine) {
      offset += Math.min(position.column - 1, currentLine.text.length);
    }
    return Math.max(0, offset);
  }

  getValue (): string {
    return this.content;
  }

  getLineContent (lineNumber: number): string {
    const lines = this.content.split(/\r\n|\r|\n/);
    return lines[lineNumber - 1] || '';
  }
}

export function createMockTextModel (content: string, uri: Filepath = DEFAULT_ENTRY): MockTextModel {
  return new MockTextModel(content, uri);
}

// Extract source text from a range in the program
export function extractTextFromRange (program: string, range: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number }): string {
  const mockModel = new MockTextModel(program);

  const startOffset = mockModel.getOffsetAt({
    lineNumber: range.startLineNumber,
    column: range.startColumn,
  } as Position);

  const endOffset = mockModel.getOffsetAt({
    lineNumber: range.endLineNumber,
    column: range.endColumn,
  } as Position);

  return program.substring(startOffset, endOffset);
}
