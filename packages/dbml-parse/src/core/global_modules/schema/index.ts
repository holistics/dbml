import { ElementDeclarationNode } from '@/core/parser/nodes';
import type { SyntaxNode } from '@/core/parser/nodes';
import { NodeSymbol, SchemaSymbol, SymbolKind } from '@/core/types/symbols';
import type { GlobalModule } from '../types';
import { DEFAULT_SCHEMA_NAME, PASS_THROUGH, type PassThrough, UNHANDLED } from '@/constants';
import Report from '@/core/types/report';
import type Compiler from '@/compiler/index';
import { CompileError, CompileErrorCode } from '@/core/types/errors';
import { tableUtils } from '../table';
import { enumUtils } from '../enum';
import { tablePartialUtils } from '../tablePartial';
import { tableGroupUtils } from '../tableGroup';

export const schemaModule: GlobalModule = {
  symbolMembers (compiler: Compiler, symbol: NodeSymbol): Report<NodeSymbol[]> | Report<PassThrough> {
    if (!symbol.isKind(SymbolKind.Schema) || !(symbol instanceof SchemaSymbol)) return Report.create(PASS_THROUGH);
    const qualifiedName = symbol.qualifiedName;

    const members: NodeSymbol[] = [];
    const errors: CompileError[] = [];
    const { ast } = compiler.parseFile().getValue();

    const childSchemas = new Map<string, SchemaSymbol>();

    for (const element of ast.body) {
      if (!(element instanceof ElementDeclarationNode)) continue;
      const nestedSchemaName = shouldElementBelongToThisSchema(compiler, symbol, element);
      if (nestedSchemaName === false) continue;

      if (nestedSchemaName === true) {
        // Direct member of this schema
        const symbol = compiler.nodeSymbol(element).getFiltered(UNHANDLED);
        if (!symbol) continue;
        members.push(symbol);
      } else {
        // Element belongs to a child schema - create it if not yet seen
        if (!childSchemas.has(nestedSchemaName)) {
          childSchemas.set(
            nestedSchemaName,
            compiler.symbolFactory.create(
              SchemaSymbol,
              {
                name: nestedSchemaName,
                parent: symbol as SchemaSymbol,
              },
            ),
          );
        }
      }
    }

    members.push(...childSchemas.values());

    // Duplicate checking and alias conflict detection (alias is only checked for `public`)
    const seen = new Map<string, NodeSymbol>();
    for (const member of members) {
      const isPublicSchema = symbol.qualifiedName.join('.') === DEFAULT_SCHEMA_NAME;

      const fullname = (member.declaration && compiler.fullname(member.declaration).getFiltered(UNHANDLED)) || [];
      if (fullname.length > 1 && fullname[0] === DEFAULT_SCHEMA_NAME) {
        fullname.shift();
      }

      const canonicalName = isPublicSchema
        ? (fullname.length <= 1 ? compiler.symbolName(member) : undefined) // only include canonical name for public schema if the name is not qualified, or is qualified with DEFAULT_SCHEMA_NAME
        : compiler.symbolName(member);

      const alias = (
        isPublicSchema && member.declaration
      )
        ? compiler.alias(member.declaration).getFiltered(UNHANDLED)
        : undefined;

      const names = [canonicalName, alias].filter(Boolean);
      for (const name of names) {
        const key = `${member.kind}:${name}`;
        const existing = seen.get(key);
        if (existing) {
          // Report only on the duplicate (second) declaration
          const errorNode = (
            member.declaration && member.declaration instanceof ElementDeclarationNode
            && member.declaration.name
          )
            ? member.declaration.name
            : member.declaration;
          if (errorNode) {
            errors.push(getDuplicateSchemaMemberError(member.kind, name!, qualifiedName.join('.'), errorNode));
          }
        } else {
          seen.set(key, member);
        }
      }
    }

    return new Report(members, errors);
  },
};

function getDuplicateSchemaMemberError (kind: SymbolKind, name: string, schemaLabel: string, errorNode: SyntaxNode): CompileError {
  switch (kind) {
    case SymbolKind.Table:
      return tableUtils.getDuplicateError(name, schemaLabel, errorNode);
    case SymbolKind.Enum:
      return enumUtils.getDuplicateError(name, schemaLabel, errorNode);
    case SymbolKind.TablePartial:
      return tablePartialUtils.getDuplicateError(name, schemaLabel, errorNode);
    case SymbolKind.TableGroup:
      return tableGroupUtils.getDuplicateError(name, schemaLabel, errorNode);
    default:
      return new CompileError(CompileErrorCode.DUPLICATE_NAME, `Duplicate ${kind} '${name}' in schema '${schemaLabel}'`, errorNode);
  }
}

// Return if this node introduces a declaration belong to schemaSymbol
// - Return true if the declaration belongs directly to the schemaSymbol
// - Return false if the declaration doesn't belong to the schemaSymbol
// - Return a string for the directly nested schema name that the declaration belongs to
function shouldElementBelongToThisSchema (compiler: Compiler, schemaSymbol: SchemaSymbol, element: ElementDeclarationNode): boolean | string {
  if (schemaSymbol.qualifiedName.join('.') === DEFAULT_SCHEMA_NAME && element.alias) return true;

  const qualifiedName = schemaSymbol.qualifiedName;
  const fullname = compiler.fullname(element).getFiltered(UNHANDLED);
  if (!fullname) return false;

  // Elements with no name or no schema prefix belong to the default (public) schema
  // e.g. anonymous Refs, Notes, etc.
  const elementSchemaChain = !fullname || fullname.length <= 1 ? [DEFAULT_SCHEMA_NAME] : fullname.slice(0, -1);

  // Must start with this schema's qualified name
  if (elementSchemaChain.length < qualifiedName.length) return false;
  if (!qualifiedName.every((seg, i) => seg === elementSchemaChain[i])) return false;

  if (elementSchemaChain.length === qualifiedName.length) {
    // Direct member of this schema
    return true;
  } else {
    // Element belongs to a child schema - create it if not yet seen
    return elementSchemaChain[qualifiedName.length];
  }
}
