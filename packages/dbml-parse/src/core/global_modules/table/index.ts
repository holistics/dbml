import {
  ElementKind, SettingName,
} from '@/core/types/keywords';
import {
  ElementDeclarationNode, FunctionApplicationNode, PrefixExpressionNode, InfixExpressionNode, ProgramNode,
} from '@/core/types/nodes';
import type {
  SyntaxNode,
} from '@/core/types/nodes';
import type {
  SyntaxToken,
} from '@/core/types/tokens';
import {
  NodeSymbol, SchemaSymbol, InjectedColumnSymbol, SymbolKind,
} from '@/core/types/symbol';
import type {
  GlobalModule,
} from '../types';
import {
  DEFAULT_SCHEMA_NAME, KEYWORDS_OF_DEFAULT_SETTING, PASS_THROUGH, type PassThrough, UNHANDLED,
} from '@/constants';
import Report from '@/core/types/report';
import type Compiler from '@/compiler/index';
import type {
  SchemaElement,
} from '@/core/types/schemaJson';
import {
  extractVariableFromExpression,
  extractVarNameFromPrimaryVariable,
  isInsideSettingValue,
  isElementNode,
  isInsideElementBody,
  getBody,
  isWithinNthArgOfField,
  isAccessExpression,
  isExpressionAVariableNode,
  isElementFieldNode,
  isTerminalAccessFragment,
} from '@/core/utils/expression';
import {
  lookupMember, nodeRefereeOfLeftExpression, shouldInterpretNode,
} from '../utils';
import {
  isValidPartialInjection,
} from '@/core/utils/validate';
import {
  CompileError, CompileErrorCode,
} from '@/core/types/errors';
import TableBinder from './bind';
import {
  TableInterpreter,
} from './interpret';

// Public utils that other modules can use
export const tableUtils = {
  getDuplicateError (name: string, schemaLabel: string, errorNode: SyntaxNode): CompileError {
    return new CompileError(CompileErrorCode.DUPLICATE_NAME, `Table name '${name}' already exists in schema '${schemaLabel}'`, errorNode);
  },
  getColumnDuplicateError (name: string, errorNode: SyntaxNode): CompileError {
    return new CompileError(CompileErrorCode.DUPLICATE_COLUMN_NAME, `Duplicate column ${name}`, errorNode);
  },
};

export const tableModule: GlobalModule = {
  nodeSymbol (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.Table)) {
      return new Report(compiler.symbolFactory.create(NodeSymbol, {
        kind: SymbolKind.Table,
        declaration: node,
      }, node.filepath));
    }
    if (isElementFieldNode(node, ElementKind.Table)) {
      return !isValidPartialInjection(node.callee)
        ? new Report(compiler.symbolFactory.create(NodeSymbol, {
            kind: SymbolKind.Column,
            declaration: node,
          }, node.filepath))
        : new Report(compiler.symbolFactory.create(NodeSymbol, {
            kind: SymbolKind.PartialInjection,
            declaration: node,
          }, node.filepath));
    }
    return Report.create(PASS_THROUGH);
  },

  symbolMembers (compiler: Compiler, symbol: NodeSymbol): Report<NodeSymbol[]> | Report<PassThrough> {
    if (!symbol.isKind(SymbolKind.Table)) {
      return Report.create(PASS_THROUGH);
    }

    const node = symbol.declaration;
    if (!(node instanceof ElementDeclarationNode)) return new Report([]);
    const children = getBody(node);

    // Collect column symbols
    const members: NodeSymbol[] = [];
    const errors: CompileError[] = [];
    for (const child of children) {
      const res = compiler.nodeSymbol(child);
      if (res.hasValue(UNHANDLED)) continue;
      members.push(res.getValue());
      errors.push(...res.getErrors());
    }

    // Duplicate checking
    const seen = new Map<string, SyntaxNode>();
    for (const member of members) {
      if (!member.isKind(SymbolKind.Column) || !member.declaration) continue; // Ignore non-column members

      const name = compiler.symbolName(member);
      if (name !== undefined) {
        const errorNode = (
          member.declaration instanceof ElementDeclarationNode && member.declaration.name
        )
          ? member.declaration.name
          : member.declaration;

        const firstNode = seen.get(name);
        if (firstNode) {
          errors.push(tableUtils.getColumnDuplicateError(name, firstNode));
          errors.push(tableUtils.getColumnDuplicateError(name, errorNode));
        } else {
          seen.set(name, errorNode);
        }
      }
    }
    // Detect partial injections (~partial_name) and insert their columns at the injection position
    // Process in reverse so that insertion indices remain valid
    const injections: { index: number;
      partialMembers: NodeSymbol[]; }[] = [];
    for (let i = 0; i < members.length; i++) {
      const member = members[i];
      if (!(member.declaration instanceof FunctionApplicationNode)) continue;
      if (!isValidPartialInjection(member.declaration.callee)) continue;

      const tablePartialNameNode = (member.declaration.callee as PrefixExpressionNode).expression;
      const tablePartialName = extractVariableFromExpression(tablePartialNameNode);
      if (tablePartialNameNode === undefined || tablePartialName === undefined) continue;

      // Look up the TablePartial symbol among direct program elements
      const tablePartialSymbol = compiler.nodeReferee(tablePartialNameNode).getFiltered(UNHANDLED);

      if (!tablePartialSymbol) {
        errors.push(new CompileError(CompileErrorCode.BINDING_ERROR, `TablePartial '${tablePartialName}' does not exist in Schema 'public'`, tablePartialNameNode || node));
        continue;
      }

      const tablePartialMembers = compiler.symbolMembers(tablePartialSymbol).getFiltered(UNHANDLED);
      if (tablePartialMembers) {
        const injectedMembers = tablePartialMembers.flatMap((m) => {
          if (!m.declaration) return [];

          const name = compiler.symbolName(m);
          if (name === undefined) return m;

          return compiler.symbolFactory.create(
            InjectedColumnSymbol,
            {
              kind: SymbolKind.Column,
              injectionDeclaration: member.declaration!,
              declaration: m.declaration,
              name,
            },
            node.filepath,
          );
        });
        injections.push({
          index: i,
          partialMembers: injectedMembers,
        });
      }
    }

    // Insert partial members at injection positions (process in reverse to keep indices valid)
    for (let j = injections.length - 1; j >= 0; j--) {
      const {
        index, partialMembers: pMembers,
      } = injections[j];
      members.splice(index, 0, ...pMembers);
    }

    return new Report(members, errors);
  },

  nodeReferee (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol | undefined> | Report<PassThrough> {
    if (!isInsideElementBody(node, ElementKind.Table)) {
      return Report.create(PASS_THROUGH);
    }

    const programNode = compiler.parseFile(node.filepath).getValue().ast;
    const globalSymbol = compiler.nodeSymbol(programNode).getValue();

    if (globalSymbol === UNHANDLED) {
      return Report.create(undefined);
    }

    // Case 0: Partial injection (~partial_name)
    if (isExpressionAVariableNode(node)
      && node.parentNode instanceof PrefixExpressionNode
      && node.parentNode.op?.value === '~') {
      return nodeRefereeOfPartialInjection(compiler, globalSymbol, node);
    }

    // Case 1: Column's enum type
    if (isWithinNthArgOfField(node, 1)) {
      return nodeRefereeOfEnumType(compiler, globalSymbol, node);
    }

    // Case 2: Column's inline ref
    if (isInsideSettingValue(node, SettingName.Ref)) {
      return nodeRefereeOfInlineRef(compiler, globalSymbol, node);
    }

    // Case 3: Column's default value being an enum value
    // Skip column name position (callee of the field's FunctionApplicationNode)
    if (isWithinNthArgOfField(node, 0)) {
      return Report.create(PASS_THROUGH);
    }
    return nodeRefereeOfEnumDefault(compiler, globalSymbol, node);
  },

  bindNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Table)) return Report.create(PASS_THROUGH);

    return Report.create(
      undefined,
      new TableBinder(compiler, node as ElementDeclarationNode & { type: SyntaxToken }).bind(),
    );
  },

  interpretNode (compiler: Compiler, node: SyntaxNode): Report<SchemaElement | SchemaElement[] | undefined> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Table)) return Report.create(PASS_THROUGH);

    if (!shouldInterpretNode(compiler, node)) return Report.create(undefined);

    return new TableInterpreter(compiler, node).interpret();
  },
};

// Look up a member in the default (public) schema, falling back to direct program search
function lookupInDefaultSchema (compiler: Compiler, globalSymbol: NodeSymbol, name: string, opts: { kinds?: SymbolKind[];
  ignoreNotFound?: boolean;
  errorNode?: SyntaxNode; }): Report<NodeSymbol | undefined> {
  const members = compiler.symbolMembers(globalSymbol);
  if (!members.hasValue(UNHANDLED)) {
    const publicSchema = members.getValue().find((m: NodeSymbol) => m.isPublicSchema());
    if (publicSchema) {
      return lookupMember(compiler, publicSchema, name, opts);
    }
  }
  return lookupMember(compiler, globalSymbol, name, opts);
}

// nodeReferee utils
function nodeRefereeOfPartialInjection (compiler: Compiler, globalSymbol: NodeSymbol, node: SyntaxNode): Report<NodeSymbol | undefined> {
  const name = extractVariableFromExpression(node) ?? '';
  const members = compiler.symbolMembers(globalSymbol);
  if (!members.hasValue(UNHANDLED)) {
    const publicSchema = members.getValue().find((m: NodeSymbol) => m.isPublicSchema() && m.isKind(SymbolKind.Schema));
    if (publicSchema) {
      return lookupMember(compiler, publicSchema, name, {
        kinds: [SymbolKind.TablePartial],
        errorNode: node,
      });
    }
  }
  return lookupMember(compiler, globalSymbol, name, {
    kinds: [SymbolKind.TablePartial],
    errorNode: node,
  });
}

function nodeRefereeOfEnumType (compiler: Compiler, globalSymbol: NodeSymbol, node: SyntaxNode): Report<NodeSymbol | undefined> {
  if (!isExpressionAVariableNode(node)) return new Report(undefined);
  const name = extractVarNameFromPrimaryVariable(node) ?? '';

  // Standalone: try as enum in default schema, ignore if not found (could be a raw type like varchar)
  if (!isAccessExpression(node.parentNode)) {
    return lookupInDefaultSchema(compiler, globalSymbol, name, {
      kinds: [SymbolKind.Enum],
      ignoreNotFound: true,
      errorNode: node,
    });
  }

  // Right side of access - resolve via left sibling
  const left = nodeRefereeOfLeftExpression(compiler, node);
  if (left) {
    if (left.isKind(SymbolKind.Schema)) {
      const isTerminal = isTerminalAccessFragment(node);
      return lookupMember(compiler, left, name, {
        kinds: isTerminal ? [SymbolKind.Enum] : [SymbolKind.Schema],
        errorNode: node,
      });
    }
    return new Report(undefined);
  }

  // Left side of access - look up as Schema in program scope
  const parent = node.parentNode as InfixExpressionNode;
  if (parent.leftExpression === node) {
    return lookupMember(compiler, globalSymbol, name, {
      kinds: [SymbolKind.Schema],
      ignoreNotFound: true,
      errorNode: node,
    });
  }

  return new Report(undefined);
}

// Inline ref: table.column or schema.table.column
// Always report errors, never ignore not found
function nodeRefereeOfInlineRef (compiler: Compiler, globalSymbol: NodeSymbol, node: SyntaxNode): Report<NodeSymbol | undefined> {
  if (!isExpressionAVariableNode(node)) return new Report(undefined);
  const name = extractVarNameFromPrimaryVariable(node) ?? '';

  // Standalone variable in inline ref - look up in the enclosing table
  if (!isAccessExpression(node.parentNode)) {
    const enclosingTable = node.parent;
    if (enclosingTable instanceof ElementDeclarationNode && enclosingTable.isKind(ElementKind.Table)) {
      const tableSymbol = compiler.nodeSymbol(enclosingTable);
      if (!tableSymbol.hasValue(UNHANDLED)) {
        return lookupMember(compiler, tableSymbol.getValue(), name, {
          kinds: [SymbolKind.Column],
          ignoreNotFound: false,
          errorNode: node,
        });
      }
    }
    return lookupMember(compiler, globalSymbol, name, {
      kinds: [SymbolKind.Column],
      ignoreNotFound: true,
      errorNode: node,
    });
  }

  // Right side of access expression - resolve via left sibling
  const left = nodeRefereeOfLeftExpression(compiler, node);
  if (left) {
    if (left.isKind(SymbolKind.Schema)) {
      return lookupMember(compiler, left, name, {
        kinds: [SymbolKind.Table, SymbolKind.Schema],
        errorNode: node,
      });
    }
    if (left.isKind(SymbolKind.Table)) {
      return lookupMember(compiler, left, name, {
        kinds: [SymbolKind.Column],
        errorNode: node,
      });
    }
    return new Report(undefined);
  }

  // Left side of access expression - look up as Table or Schema in program scope
  const parent = node.parentNode as InfixExpressionNode;
  if (parent.leftExpression === node) {
    // If our parent is also a left side of another access, this is a schema
    if (isAccessExpression(parent.parentNode) && (parent.parentNode as InfixExpressionNode).leftExpression === parent) {
      return lookupMember(compiler, globalSymbol, name, {
        kinds: [SymbolKind.Schema],
        errorNode: node,
      });
    }
    // First try by table name, then by alias
    const tableResult = lookupInDefaultSchema(compiler, globalSymbol, name, {
      kinds: [SymbolKind.Table],
      ignoreNotFound: true,
      errorNode: node,
    });
    if (tableResult.getValue()) return tableResult;
    return lookupInDefaultSchema(compiler, globalSymbol, name, {
      kinds: [SymbolKind.Table],
      errorNode: node,
    });
  }

  return new Report(undefined);
}

// Default value: enum.field or schema.enum.field
function nodeRefereeOfEnumDefault (compiler: Compiler, globalSymbol: NodeSymbol, node: SyntaxNode): Report<NodeSymbol | undefined> {
  if (!isExpressionAVariableNode(node)) return new Report(undefined);
  const name = extractVarNameFromPrimaryVariable(node) ?? '';

  // Standalone: ignore default keywords (true/false/null), everything else is an enum lookup
  if (!isAccessExpression(node.parentNode)) {
    if (KEYWORDS_OF_DEFAULT_SETTING.includes(name.toLowerCase())) {
      return new Report(undefined);
    }
    return lookupInDefaultSchema(compiler, globalSymbol, name, {
      kinds: [SymbolKind.Enum],
      ignoreNotFound: true,
      errorNode: node,
    });
  }

  // Right side of access - resolve via left sibling
  const left = nodeRefereeOfLeftExpression(compiler, node);
  if (left) {
    if (left.isKind(SymbolKind.Schema)) {
      return lookupMember(compiler, left, name, {
        kinds: [SymbolKind.Enum, SymbolKind.Schema],
        errorNode: node,
      });
    }
    if (left.isKind(SymbolKind.Enum)) {
      return lookupMember(compiler, left, name, {
        kinds: [SymbolKind.EnumField],
        errorNode: node,
      });
    }
    return new Report(undefined);
  }

  // Left side of access - look up as Enum in program scope (report errors since it's clearly an enum access)
  const parent = node.parentNode as InfixExpressionNode;
  if (parent.leftExpression === node) {
    // If parent is also left of another access, this is a schema
    if (isAccessExpression(parent.parentNode) && (parent.parentNode as InfixExpressionNode).leftExpression === parent) {
      return lookupMember(compiler, globalSymbol, name, {
        kinds: [SymbolKind.Schema],
        errorNode: node,
      });
    }
    return lookupInDefaultSchema(compiler, globalSymbol, name, {
      kinds: [SymbolKind.Enum],
      errorNode: node,
    });
  }

  return new Report(undefined);
}
