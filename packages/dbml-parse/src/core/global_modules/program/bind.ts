import { CompileError, CompileErrorCode } from '@/core/errors';
import {
  ElementDeclarationNode,
  FunctionApplicationNode,
  InfixExpressionNode,
  PrefixExpressionNode,
  ProgramNode,
  SyntaxNode,
  TupleExpressionNode,
} from '@/core/parser/nodes';
import Report from '@/core/report';
import { SyntaxToken } from '@/core/lexer/tokens';
import Compiler from '@/compiler';
import {
  isElementNode,
  getBody,
  isBinaryRelationship,
  destructureMemberAccessExpression,
  destructureComplexVariable,
  extractVariableFromExpression,
  isRelationshipOp,
  isExpressionAVariableNode,
} from '@/core/utils/expression';
import { ElementKind, SettingName } from '@/core/types/keywords';
import { UNHANDLED } from '@/constants';
import { SchemaSymbol } from '@/core/types/symbols';

export default class Binder {
  private ast: ProgramNode;

  private compiler: Compiler;

  constructor (ast: ProgramNode, compiler: Compiler) {
    this.ast = ast;
    this.compiler = compiler;
  }

  resolve (): Report<void> {
    const errors: CompileError[] = [];

    const reachableFiles = this.compiler.reachableFiles(this.ast.filepath);

    for (const filepath of reachableFiles) {
      const { ast } = this.compiler.parse(filepath).getValue();
      // Program-level checks (duplicate projects) - only if it's the entry file or we want to check all?
      // Usually project is only one per whole project.
      const projects = ast.body.filter((e): e is ElementDeclarationNode => e instanceof ElementDeclarationNode && e.isKind(ElementKind.Project));
      if (projects.length > 1) {
        projects.forEach((project) => errors.push(new CompileError(CompileErrorCode.PROJECT_REDEFINED, 'Only one project can exist', project)));
      }

      for (const element of ast.body) {
        if (element instanceof ElementDeclarationNode && element.type) {
          const binder = element as ElementDeclarationNode & { type: SyntaxToken };
          errors.push(...this.compiler.validate(binder).getErrors());
          errors.push(...this.compiler.bind(binder).getErrors());
        } else {
          errors.push(...this.compiler.validate(element).getErrors());
          errors.push(...this.compiler.bind(element).getErrors());
        }
      }
    }

    // Trigger symbolMembers to detect duplicate names at each level
    const programSymbol = this.compiler.nodeSymbol(this.ast);
    if (!programSymbol.hasValue(UNHANDLED)) {
      const schemasResult = this.compiler.symbolMembers(programSymbol.getValue());
      errors.push(...schemasResult.getErrors());

      if (!schemasResult.hasValue(UNHANDLED)) {
        for (const schema of schemasResult.getValue().filter((s) => s instanceof SchemaSymbol)) {
          const schemaMembers = this.compiler.symbolMembers(schema);
          errors.push(...schemaMembers.getErrors());

          if (!schemaMembers.hasValue(UNHANDLED)) {
            for (const member of schemaMembers.getValue()) {
              const memberMembers = this.compiler.symbolMembers(member);
              errors.push(...memberMembers.getErrors());
            }
          }
        }
      }
    }

    // Post-bind cross-element checks (require resolved symbols)
    errors.push(...this.checkDuplicateRefs());
    errors.push(...this.checkTableGroups());

    return new Report(undefined, errors);
  }

  /**
   * Get resolved column symbol IDs from a ref operand.
   * Returns sorted array of symbol IDs, or undefined if resolution fails.
   */
  private getColumnSymbolIds (node: SyntaxNode): number[] | undefined {
    const fragments = destructureMemberAccessExpression(node);
    if (!fragments || fragments.length === 0) return undefined;

    const lastFragment = fragments[fragments.length - 1];

    // Composite ref: table.(col1, col2)
    if (lastFragment instanceof TupleExpressionNode) {
      const ids: number[] = [];
      for (const elem of lastFragment.elementList) {
        const result = this.compiler.nodeReferee(elem);
        if (result.hasValue(UNHANDLED)) return undefined;
        const sym = result.getValue();
        if (!sym) return undefined;
        ids.push(sym.id);
      }
      return ids.sort();
    }

    // Single column ref: the last fragment is the column
    const result = this.compiler.nodeReferee(lastFragment);
    if (result.hasValue(UNHANDLED)) return undefined;
    const sym = result.getValue();
    if (!sym) return undefined;
    return [sym.id];
  }

  private isSameEndpoint (left: number[], right: number[]): boolean {
    if (left.length !== right.length) return false;
    return left.every((id, i) => id === right[i]);
  }

  private getRefId (left: number[], right: number[]): string {
    const leftStr = left.join(',');
    const rightStr = right.join(',');
    return leftStr < rightStr ? `${leftStr}-${rightStr}` : `${rightStr}-${leftStr}`;
  }

  /**
   * Check for same-endpoint and circular/duplicate refs.
   */
  private checkDuplicateRefs (): CompileError[] {
    const errors: CompileError[] = [];
    const seenRefIds = new Map<string, SyntaxNode>();

    const reachableFiles = this.compiler.reachableFiles(this.ast.filepath);

    for (const filepath of reachableFiles) {
      const { ast } = this.compiler.parse(filepath).getValue();
      for (const element of ast.body) {
        if (!(element instanceof ElementDeclarationNode) || !element.type) continue;
        const decl = element as ElementDeclarationNode & { type: SyntaxToken };

        // Standalone Ref elements
        if (isElementNode(decl, ElementKind.Ref)) {
          const fields = getBody(decl);
          for (const field of fields) {
            if (!(field instanceof FunctionApplicationNode)) continue;
            if (!field.callee || !isBinaryRelationship(field.callee)) continue;
            const infix = field.callee as InfixExpressionNode;
            if (!infix.leftExpression || !infix.rightExpression) continue;

            const leftIds = this.getColumnSymbolIds(infix.leftExpression);
            const rightIds = this.getColumnSymbolIds(infix.rightExpression);
            if (!leftIds || !rightIds) continue;

            if (this.isSameEndpoint(leftIds, rightIds)) {
              errors.push(new CompileError(CompileErrorCode.SAME_ENDPOINT, 'Two endpoints are the same', decl));
              continue;
            }

            const refId = this.getRefId(leftIds, rightIds);
            const existing = seenRefIds.get(refId);
            if (existing) {
              errors.push(
                new CompileError(CompileErrorCode.CIRCULAR_REF, 'References with same endpoints exist', decl),
                new CompileError(CompileErrorCode.CIRCULAR_REF, 'References with same endpoints exist', existing),
              );
            } else {
              seenRefIds.set(refId, decl);
            }
          }
        }

        // Inline refs from table column settings
        if (isElementNode(decl, ElementKind.Table)) {
          const fields = getBody(decl);
          for (const field of fields) {
            if (!(field instanceof FunctionApplicationNode)) continue;
            if (!field.callee) continue;

            // Get the column's symbol
            const colResult = this.compiler.nodeSymbol(field);
            if (colResult.hasValue(UNHANDLED)) continue;
            const colSym = colResult.getValue();
            if (!colSym) continue;

            // Get settings for this field
            const settingsResult = this.compiler.settings(field);
            if (settingsResult.hasValue(UNHANDLED)) continue;
            const settingsMap = settingsResult.getValue();
            const refAttrs = settingsMap[SettingName.Ref];
            if (!refAttrs || refAttrs.length === 0) continue;

            for (const attr of refAttrs) {
              const refValue = attr.value;
              if (!(refValue instanceof PrefixExpressionNode)) continue;
              if (!refValue.op || !isRelationshipOp(refValue.op.value)) continue;
              if (!refValue.expression) continue;

              const rightIds = this.getColumnSymbolIds(refValue.expression);
              if (!rightIds) continue;
              const leftIds = [colSym.id];

              if (this.isSameEndpoint(leftIds, rightIds)) {
                errors.push(new CompileError(CompileErrorCode.SAME_ENDPOINT, 'Two endpoints are the same', attr));
                continue;
              }

              const refId = this.getRefId(leftIds, rightIds);
              const existing = seenRefIds.get(refId);
              if (existing) {
                errors.push(
                  new CompileError(CompileErrorCode.CIRCULAR_REF, 'References with same endpoints exist', attr),
                  new CompileError(CompileErrorCode.CIRCULAR_REF, 'References with same endpoints exist', existing),
                );
              } else {
                seenRefIds.set(refId, attr);
              }
            }
          }
        }

        // TablePartial: only check same-endpoint for bare column self-refs
        if (isElementNode(decl, ElementKind.TablePartial)) {
          const fields = getBody(decl);
          for (const field of fields) {
            if (!(field instanceof FunctionApplicationNode)) continue;
            if (!field.callee) continue;

            const colName = extractVariableFromExpression(field.callee);
            if (!colName) continue;

            const settingsResult = this.compiler.settings(field);
            if (settingsResult.hasValue(UNHANDLED)) continue;
            const settingsMap = settingsResult.getValue();
            const refAttrs = settingsMap[SettingName.Ref];
            if (!refAttrs || refAttrs.length === 0) continue;

            for (const attr of refAttrs) {
              const refValue = attr.value;
              if (!(refValue instanceof PrefixExpressionNode)) continue;
              if (!refValue.op || !isRelationshipOp(refValue.op.value)) continue;
              if (!refValue.expression) continue;

              // Only check bare column refs (single variable matching the field name)
              if (!isExpressionAVariableNode(refValue.expression)) continue;
              const targetName = refValue.expression.expression.variable?.value;
              if (targetName === colName) {
                errors.push(new CompileError(CompileErrorCode.SAME_ENDPOINT, 'Two endpoints are the same', attr));
              }
            }
          }
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
    const tableOwner = new Map<number, { groupName: string; node: SyntaxNode }>();

    const reachableFiles = this.compiler.reachableFiles(this.ast.filepath);

    for (const filepath of reachableFiles) {
      const { ast } = this.compiler.parse(filepath).getValue();
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
          const result = this.compiler.nodeReferee(lastFragment);
          if (result.hasValue(UNHANDLED)) continue;
          const tableSym = result.getValue();
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
            tableOwner.set(tableSym.id, { groupName, node: field });
          }
        }
      }
    }

    return errors;
  }
}
