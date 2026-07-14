import { DEFAULT_SCHEMA_NAME, DEFAULT_ENTRY } from '@/constants';
import { Filepath } from '@/core/types/filepath';
import { SymbolKind } from '@/core/types/symbol';
import type Compiler from '../../index';
import { applyTextEdits } from './applyTextEdits';
import { updateSettingEdit } from '@/core/utils/setting';
import type {
  ElementIdentifier, DepIdentifier, RefIdentifier,
  EndpointRef,
} from './types';
import { endpointsEqual, lookupElementSymbol } from './utils';
import { findDepBlocks } from './syncDep';
import { ElementKind } from '@/core/types/keywords';
import {
  ElementDeclarationNode, FunctionApplicationNode, InfixExpressionNode, type SyntaxNode,
} from '@/core/types/nodes';
import { destructureComplexVariable } from '@/core/utils/expression';
import Lexer from '@/core/lexer/lexer';
import Parser from '@/core/parser/parser';
import { SyntaxNodeIdGenerator } from '@/core/types/nodes';

// Updates, creates, or removes a setting on the element identified by `target`.
//  - value: string -> create or update the setting with this value
//  - value: undefined -> name-only setting (e.g. `[pk]`)
//  - value: null -> remove the setting
// Returns the new source, or the original if nothing changed.
export function updateElementSetting (
  this: Compiler,
  filepath: Filepath,
  target: ElementIdentifier,
  settingName: string,
  value: string | null | undefined,
): string {
  const source = this.getSource(filepath) ?? '';

  // dep - find by endpoints
  if (target.kind === 'dep') {
    return updateDepSetting(source, target, settingName, value);
  }

  // ref - find by endpoints
  if (target.kind === 'ref') {
    return updateRefSetting(source, target, settingName, value);
  }

  // named elements - find declaration by symbol lookup
  const declaration = findNamedElementDeclaration(this, filepath, target);
  if (!declaration) return source;

  const edit = updateSettingEdit(declaration, settingName, value, source);
  if (!edit) return source;

  return applyTextEdits(source, [
    edit,
  ]);
}

// Finds the declaration node for a named element
function findNamedElementDeclaration (compiler: Compiler, filepath: Filepath, target: ElementIdentifier): SyntaxNode | undefined {
  const schema = ('schema' in target ? target.schema : undefined) ?? DEFAULT_SCHEMA_NAME;

  switch (target.kind) {
    case SymbolKind.Column: {
      const tableSymbol = lookupElementSymbol(compiler, filepath, schema, target.table, SymbolKind.Table);
      return tableSymbol ? compiler.lookupMembers(tableSymbol, SymbolKind.Column, target.column)?.declaration : undefined;
    }
    case SymbolKind.Table:
      return lookupElementSymbol(compiler, filepath, schema, target.table)?.declaration;
    case SymbolKind.Enum:
    case SymbolKind.StickyNote:
    case SymbolKind.TableGroup:
      return lookupElementSymbol(compiler, filepath, schema, target.name, target.kind)?.declaration;
    case SymbolKind.Schema:
      return lookupElementSymbol(compiler, filepath, target.schema, '', SymbolKind.Schema)?.declaration;
    default:
      return undefined;
  }
}

// For deps: short form can have settings on the header or the edge node.
// Block form has settings on the header [...] or as body lines.
function updateDepSetting (source: string, target: DepIdentifier, settingName: string, value: string | null | undefined): string {
  const block = findDepBlocks(source).find((block) => block.edges.some((e) => endpointsEqual(e.upstream, target.upstream) && endpointsEqual(e.downstream, target.downstream)));
  if (!block) return source;

  const { declaration } = block;
  const { body } = declaration;

  // short form (Dep: a -> b [color: #hex]) - check both header and edge node
  if (body instanceof FunctionApplicationNode) {
    // check header first
    const headerEdit = updateSettingEdit(declaration, settingName, value, source);
    if (headerEdit) return applyTextEdits(source, [
      headerEdit,
    ]);
    // then edge node
    const edgeEdit = updateSettingEdit(body, settingName, value, source);
    if (edgeEdit) return applyTextEdits(source, [
      edgeEdit,
    ]);
    return source;
  }

  // block form - header [...] or body line
  const edit = updateSettingEdit(declaration, settingName, value, source);
  if (!edit) return source;
  return applyTextEdits(source, [
    edit,
  ]);
}

// For refs: short form has settings on header or edge node,
// block form has settings on the matching edge node inside the body
function updateRefSetting (source: string, target: RefIdentifier, settingName: string, value: string | null | undefined): string {
  const edgeNode = findRefEdgeNode(source, target);
  if (!edgeNode) return source;

  const edit = updateSettingEdit(edgeNode, settingName, value, source);
  if (!edit) return source;
  return applyTextEdits(source, [
    edit,
  ]);
}

// Converts AST variable fragments [schema?, table, ...fields] to EndpointRef
function fragmentsToEndpoint (fragments: string[]): EndpointRef | undefined {
  if (fragments.length === 0) return undefined;
  if (fragments.length === 1) return { table: fragments[0] };
  if (fragments.length === 2) return {
    table: fragments[0],
    fields: [
      fragments[1],
    ],
  };
  return { schema: fragments[0], table: fragments[1], fields: fragments.slice(2) };
}

// Checks if an infix expression matches both ref endpoints (in either order)
function refInfixMatches (infix: InfixExpressionNode, target: RefIdentifier): boolean {
  const leftFragments = infix.leftExpression ? destructureComplexVariable(infix.leftExpression) : null;
  const rightFragments = infix.rightExpression ? destructureComplexVariable(infix.rightExpression) : null;
  if (!leftFragments || !rightFragments) return false;

  const left = fragmentsToEndpoint(leftFragments);
  const right = fragmentsToEndpoint(rightFragments);
  if (!left || !right) return false;

  const [
    ep0,
    ep1,
  ] = target.endpoints;
  return (endpointsEqual(left, ep0) && endpointsEqual(right, ep1))
    || (endpointsEqual(left, ep1) && endpointsEqual(right, ep0));
}

// Finds the ref edge node matching the given endpoints.
// Returns the FunctionApplicationNode that holds the edge (and its settings).
function findRefEdgeNode (source: string, target: RefIdentifier): FunctionApplicationNode | undefined {
  const lexerResult = new Lexer(source, DEFAULT_ENTRY).lex();
  if (lexerResult.getErrors().length > 0) return undefined;
  const tokens = lexerResult.getValue();

  const ast = new Parser(source, tokens, new SyntaxNodeIdGenerator(), DEFAULT_ENTRY).parse();
  if (ast.getErrors().length > 0) return undefined;
  const program = ast.getValue().ast;

  for (const element of program.declarations) {
    if (!(element instanceof ElementDeclarationNode) || !element.isKind(ElementKind.Ref)) continue;

    const body = element.body;

    // short form: Ref: a.id > b.id [color: #hex]
    if (body instanceof FunctionApplicationNode && body.callee instanceof InfixExpressionNode) {
      if (refInfixMatches(body.callee, target)) return body;
      continue;
    }

    // block form: Ref { a.id > b.id [color: #hex] }
    if (body && !(body instanceof FunctionApplicationNode)) {
      for (const field of body.body) {
        if (field instanceof FunctionApplicationNode && field.callee instanceof InfixExpressionNode) {
          if (refInfixMatches(field.callee, target)) return field;
        }
      }
    }
  }

  return undefined;
}
