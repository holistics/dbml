import Compiler from '@/compiler';
import { CompileError, CompileErrorCode } from '@/core/types/errors';
import { ElementKind, SettingName } from '@/core/types/keywords';
import { UNHANDLED } from '@/core/types/module';
import {
  ElementDeclarationNode,
  FunctionApplicationNode,
  InfixExpressionNode,
  PrefixExpressionNode,
  ProgramNode,
  SyntaxNode,
  TupleExpressionNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import { type NodeSymbol, SchemaSymbol } from '@/core/types/symbol';
import { SyntaxToken } from '@/core/types/tokens';
import {
  isRelationshipOp,
  isBinaryRelationship,
  isElementNode,
  isExpressionAVariableNode,
} from '@/core/utils/validate';
import {
  destructureComplexVariable,
  destructureMemberAccessExpression,
  extractVariableFromExpression,
  getBody,
} from '@/core/utils/expression';

function resolveColumnSymbols (compiler: Compiler, node: SyntaxNode): NodeSymbol[] | undefined {
  const fragments = destructureMemberAccessExpression(node);
  if (!fragments || fragments.length === 0) return undefined;

  const lastFragment = fragments[fragments.length - 1];
  if (lastFragment instanceof TupleExpressionNode) {
    const symbols: NodeSymbol[] = [];
    for (const elem of lastFragment.elementList) {
      const sym = compiler.nodeReferee(elem).getFiltered(UNHANDLED);
      if (!sym) return undefined;
      symbols.push(sym.originalSymbol);
    }
    return symbols;
  }

  const last = fragments[fragments.length - 1];
  if (!last || last instanceof TupleExpressionNode) return undefined;
  const sym = compiler.nodeReferee(last).getFiltered(UNHANDLED);
  if (!sym) return undefined;
  return [
    sym.originalSymbol,
  ];
}

function checkRefEndpoints (
  left: NodeSymbol[],
  right: NodeSymbol[],
  errorNode: SyntaxNode,
  seenRefIds: Map<string, SyntaxNode>,
): CompileError[] {
  const leftKey = left.map((s) => s.intern()).sort().join(',');
  const rightKey = right.map((s) => s.intern()).sort().join(',');

  if (leftKey === rightKey) {
    return [
      new CompileError(CompileErrorCode.SAME_ENDPOINT, 'Two endpoints are the same', errorNode),
    ];
  }

  const refId = leftKey < rightKey ? `${leftKey}-${rightKey}` : `${rightKey}-${leftKey}`;
  const existing = seenRefIds.get(refId);
  if (existing) {
    return [
      new CompileError(CompileErrorCode.CIRCULAR_REF, 'References with same endpoints exist', errorNode),
      new CompileError(CompileErrorCode.CIRCULAR_REF, 'References with same endpoints exist', existing),
    ];
  }
  seenRefIds.set(refId, errorNode);
  return [];
}

export default class Binder {
  private ast: ProgramNode;

  private compiler: Compiler;

  constructor (ast: ProgramNode, compiler: Compiler) {
    this.compiler = compiler;
    this.ast = ast;
  }

  resolve (): Report<void> {
    const errors: CompileError[] = [];

    const reachableFiles = this.compiler.reachableFiles(this.ast.filepath);

    for (const filepath of reachableFiles) {
      const {
        ast,
      } = this.compiler.parseFile(filepath).getFiltered(UNHANDLED) || {
        ast: undefined,
      };
      if (!ast) continue;

      // Global checks

      // Check 1: One project block only
      const projects = ast.body.filter((e): e is ElementDeclarationNode => e instanceof ElementDeclarationNode && e.isKind(ElementKind.Project));
      if (projects.length > 1) {
        projects.forEach((project) => errors.push(new CompileError(CompileErrorCode.PROJECT_REDEFINED, 'Only one project can exist', project)));
      }

      // Check 2: Binding errors
      for (const element of ast.body) {
        if (element instanceof ElementDeclarationNode && element.type) {
          const binder = element as ElementDeclarationNode & { type: SyntaxToken };
          errors.push(...this.compiler.bindNode(binder).getErrors());
        } else {
          errors.push(...this.compiler.bindNode(element).getErrors());
        }
      }
    }

    // Detect duplicate members of schemas
    const programSymbol = this.compiler.nodeSymbol(this.ast).getFiltered(UNHANDLED);
    if (programSymbol) {
      errors.push(...checkDuplicateSchemaMembers(this.compiler, programSymbol));
    }

    // Check 4: Refs with same endpoints
    errors.push(...this.checkDuplicateRefs());

    // Check 5: Tables appearing in more than one group
    errors.push(...this.checkTableGroups());

    return new Report(undefined, errors);
  }

  private checkDuplicateRefs (): CompileError[] {
    const errors: CompileError[] = [];
    const seenRefIds = new Map<string, SyntaxNode>();

    const reachableFiles = this.compiler.reachableFiles(this.ast.filepath);

    for (const filepath of reachableFiles) {
      const parseResult = this.compiler.parseFile(filepath).getFiltered(UNHANDLED);
      if (!parseResult) continue;
      const {
        ast,
      } = parseResult;
      for (const element of ast.body) {
        if (!(element instanceof ElementDeclarationNode) || !element.type) continue;
        const declaration = element as ElementDeclarationNode & { type: SyntaxToken };

        if (isElementNode(declaration, ElementKind.Ref)) {
          errors.push(...this.checkStandaloneRefs(declaration, seenRefIds));
        }
        if (isElementNode(declaration, ElementKind.Table)) {
          errors.push(...this.checkInlineRefs(declaration, seenRefIds));
        }
        if (isElementNode(declaration, ElementKind.TablePartial)) {
          errors.push(...this.checkTablePartialSelfRefs(declaration));
        }
      }
    }

    return errors;
  }

  // Standalone `Ref: a.id > b.id` declarations
  private checkStandaloneRefs (declaration: ElementDeclarationNode, seenRefIds: Map<string, SyntaxNode>): CompileError[] {
    const errors: CompileError[] = [];
    for (const field of getBody(declaration)) {
      if (!(field instanceof FunctionApplicationNode)) continue;
      if (!field.callee || !isBinaryRelationship(field.callee)) continue;
      const infix = field.callee as InfixExpressionNode;
      if (!infix.leftExpression || !infix.rightExpression) continue;

      const leftSymbols = resolveColumnSymbols(this.compiler, infix.leftExpression);
      const rightSymbols = resolveColumnSymbols(this.compiler, infix.rightExpression);
      if (!leftSymbols || !rightSymbols) continue;

      errors.push(...checkRefEndpoints(leftSymbols, rightSymbols, declaration, seenRefIds));
    }
    return errors;
  }

  // Inline refs from table column settings (e.g. `id int [ref: > users.id]`)
  private checkInlineRefs (declaration: ElementDeclarationNode, seenRefIds: Map<string, SyntaxNode>): CompileError[] {
    const errors: CompileError[] = [];
    for (const field of getBody(declaration)) {
      if (!(field instanceof FunctionApplicationNode) || !field.callee) continue;

      const colSym = this.compiler.nodeSymbol(field).getFiltered(UNHANDLED);
      if (!colSym) continue;

      const settingsMap = this.compiler.nodeSettings(field).getFiltered(UNHANDLED);
      if (!settingsMap) continue;
      const refAttrs = settingsMap[SettingName.Ref];
      if (!refAttrs || refAttrs.length === 0) continue;

      for (const attr of refAttrs) {
        const refValue = attr.value;
        if (!(refValue instanceof PrefixExpressionNode)) continue;
        if (!refValue.op || !isRelationshipOp(refValue.op.value)) continue;
        if (!refValue.expression) continue;

        const rightSymbols = resolveColumnSymbols(this.compiler, refValue.expression);
        if (!rightSymbols) continue;
        const leftSymbols = [
          colSym.originalSymbol,
        ];

        errors.push(...checkRefEndpoints(leftSymbols, rightSymbols, attr, seenRefIds));
      }
    }
    return errors;
  }

  // TablePartial: only check same-endpoint for bare column self-refs
  private checkTablePartialSelfRefs (declaration: ElementDeclarationNode): CompileError[] {
    const errors: CompileError[] = [];
    for (const field of getBody(declaration)) {
      if (!(field instanceof FunctionApplicationNode) || !field.callee) continue;

      const colName = extractVariableFromExpression(field.callee);
      if (!colName) continue;

      const settingsMap = this.compiler.nodeSettings(field).getFiltered(UNHANDLED);
      if (!settingsMap) continue;
      const refAttrs = settingsMap[SettingName.Ref];
      if (!refAttrs || refAttrs.length === 0) continue;

      for (const attr of refAttrs) {
        const refValue = attr.value;
        if (!(refValue instanceof PrefixExpressionNode)) continue;
        if (!refValue.op || !isRelationshipOp(refValue.op.value)) continue;
        if (!refValue.expression) continue;

        if (!isExpressionAVariableNode(refValue.expression)) continue;
        const targetName = refValue.expression.expression.variable?.value;
        if (targetName === colName) {
          errors.push(new CompileError(CompileErrorCode.SAME_ENDPOINT, 'Two endpoints are the same', attr));
        }
      }
    }
    return errors;
  }

  /**
   * Check that no table appears in more than one TableGroup.
   */
  private checkTableGroups (): CompileError[] {
    const errors: CompileError[] = [];
    const tableOwner = new Map<number, {
      groupName: string;
      node: SyntaxNode;
    }>();

    const reachableFiles = this.compiler.reachableFiles(this.ast.filepath);

    for (const filepath of reachableFiles) {
      const parseResult = this.compiler.parseFile(filepath).getFiltered(UNHANDLED);
      if (!parseResult) continue;
      const {
        ast,
      } = parseResult;
      for (const element of ast.body) {
        if (!(element instanceof ElementDeclarationNode) || !element.type) continue;
        const decl = element as ElementDeclarationNode & { type: SyntaxToken };
        if (!isElementNode(decl, ElementKind.TableGroup)) continue;

        const groupNameFragments = decl.name ? destructureComplexVariable(decl.name) : undefined;
        const groupName = groupNameFragments ? groupNameFragments.join('.') : '<unknown>';

        const fields = getBody(decl);
        for (const field of fields) {
          if (!(field instanceof FunctionApplicationNode)) continue;
          if (!field.callee) continue;

          // Resolve the table reference to its symbol
          const fragments = destructureMemberAccessExpression(field.callee);
          if (!fragments || fragments.length === 0) continue;

          // Get the last resolved symbol (the table)
          const lastFragment = fragments[fragments.length - 1];
          const tableSym = this.compiler.nodeReferee(lastFragment).getFiltered(UNHANDLED)?.originalSymbol;
          if (!tableSym) continue;

          const existing = tableOwner.get(tableSym.id);
          if (existing) {
            const fieldFragments = destructureComplexVariable(field.callee);
            const displayName = fieldFragments ? fieldFragments.join('.') : '<unknown>';
            errors.push(new CompileError(
              CompileErrorCode.TABLE_REAPPEAR_IN_TABLEGROUP,
              `Table "${displayName}" already appears in group "${existing.groupName}"`,
              field,
            ));
          } else {
            tableOwner.set(tableSym.id, {
              groupName,
              node: field,
            });
          }
        }
      }
    }

    return errors;
  }
}

// Recursively trigger symbolMembers on schemas to collect duplicate name errors
function checkDuplicateSchemaMembers (compiler: Compiler, symbol: NodeSymbol, visited = new Set<number>()): CompileError[] {
  if (visited.has(symbol.id)) return [];
  visited.add(symbol.id);

  const result = compiler.symbolMembers(symbol);
  const errors = [
    ...result.getErrors(),
  ];
  const members = result.getFiltered(UNHANDLED);
  if (!members) return errors;

  for (const member of members) {
    if (member instanceof SchemaSymbol) {
      errors.push(...checkDuplicateSchemaMembers(compiler, member, visited));
    }
  }

  return errors;
}
