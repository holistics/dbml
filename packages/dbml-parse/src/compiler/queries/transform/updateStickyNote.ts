import { Filepath } from '@/core/types/filepath';
import { UNHANDLED } from '@/core/types/module';
import { ElementDeclarationNode, type BlockExpressionNode, FunctionApplicationNode } from '@/core/types/nodes';
import { type NodeSymbol, SymbolKind } from '@/core/types/symbol';
import type Compiler from '../../index';
import { type TextEdit, applyTextEdits } from './applyTextEdits';

export interface UpdateStickyNoteInput {
  name: string;
  content?: string;
  color?: string | null; // null to remove color
}

export function updateStickyNote (
  this: Compiler,
  filepath: Filepath,
  input: UpdateStickyNoteInput,
): Map<string, string> {
  const symbol = lookupStickyNoteSymbol(this, filepath, input.name);
  if (!symbol) return new Map();

  const declarationNode = symbol.originalSymbol.declaration;
  if (!declarationNode || !(declarationNode instanceof ElementDeclarationNode)) return new Map();

  const declarationFilepath = declarationNode.filepath;
  if (!declarationFilepath) return new Map();

  const source = this.getSource(declarationFilepath) ?? '';
  const edits: TextEdit[] = [];

  if (input.content !== undefined) {
    const contentEdit = buildContentEdit(declarationNode, input.content);
    if (contentEdit) edits.push(contentEdit);
  }

  if (input.color !== undefined) {
    const colorEdit = buildColorEdit(declarationNode, input.color, source);
    if (colorEdit) edits.push(colorEdit);
  }

  if (edits.length === 0) return new Map();

  return new Map([
    [
      declarationFilepath.absolute,
      applyTextEdits(source, edits),
    ],
  ]);
}

function buildContentEdit (declarationNode: ElementDeclarationNode, newContent: string): TextEdit | null {
  const body = declarationNode.body as BlockExpressionNode | undefined;
  if (!body) return null;

  const field = body.body.find((e) => e instanceof FunctionApplicationNode) as FunctionApplicationNode | undefined;
  if (!field?.callee) return null;

  return {
    start: field.callee.start,
    end: field.callee.end,
    newText: `'''\n  ${newContent}\n  '''`,
  };
}

function buildColorEdit (declarationNode: ElementDeclarationNode, color: string | null, source: string): TextEdit | null {
  const attrList = declarationNode.attributeList;

  if (color === null) {
    if (!attrList) return null;
    let start = attrList.start;
    while (start > 0 && source[start - 1] === ' ') start--;
    return {
      start,
      end: attrList.end,
      newText: '',
    };
  }

  if (attrList) {
    return {
      start: attrList.start,
      end: attrList.end,
      newText: `[color: ${color}]`,
    };
  }

  const nameNode = declarationNode.name;
  if (!nameNode) return null;
  return {
    start: nameNode.end,
    end: nameNode.end,
    newText: ` [color: ${color}]`,
  };
}

function lookupStickyNoteSymbol (
  compiler: Compiler,
  filepath: Filepath,
  name: string,
): NodeSymbol | null {
  const ast = compiler.parseFile(filepath).getValue().ast;
  const astSymbol = compiler.nodeSymbol(ast).getFiltered(UNHANDLED);
  if (!astSymbol) return null;

  const symbol = compiler.lookupMembers(astSymbol, SymbolKind.StickyNote, name);
  return symbol ?? null;
}
