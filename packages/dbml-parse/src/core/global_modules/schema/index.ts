import { ElementDeclarationNode } from '@/core/parser/nodes';
import type { SyntaxNode } from '@/core/parser/nodes';
import { NodeSymbol, SchemaSymbol, SymbolKind } from '@/core/types/symbols';
import type { GlobalModule } from '../types';
import { DEFAULT_SCHEMA_NAME, PASS_THROUGH, type PassThrough, UNHANDLED } from '@/constants';
import Report from '@/core/report';
import type Compiler from '@/compiler/index';
import { CompileError, CompileErrorCode } from '@/core/errors';
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
    const { ast } = compiler.parse(symbol.filepath).getValue();

    const childSchemas = new Map<string, SchemaSymbol>();

    for (const element of ast.body) {
      const fullname = compiler.fullname(element).getValue();
      if (fullname === UNHANDLED) continue;

      // Elements with no name or no schema prefix belong to the default (public) schema
      // e.g. anonymous Refs, Notes, etc.
      const elementSchemaChain = !fullname || fullname.length <= 1 ? [DEFAULT_SCHEMA_NAME] : fullname.slice(0, -1);

      // Must start with this schema's qualified name
      if (elementSchemaChain.length < qualifiedName.length) continue;
      if (!qualifiedName.every((seg, i) => seg === elementSchemaChain[i])) continue;

      if (elementSchemaChain.length === qualifiedName.length) {
        // Direct member of this schema
        const symbolResult = compiler.nodeSymbol(element);
        if (symbolResult.hasValue(UNHANDLED)) continue;
        members.push(symbolResult.getValue());
      } else {
        // Element belongs to a child schema - create it if not yet seen
        const childName = elementSchemaChain[qualifiedName.length];
        if (!childSchemas.has(childName)) {
          childSchemas.set(
            childName,
            compiler.symbolFactory.create(
              SchemaSymbol,
              {
                name: childName,
                parent: symbol as SchemaSymbol,
              },
              symbol.filepath,
            ),
          );
        }
      }
    }

    members.push(...childSchemas.values());

    // Duplicate checking and alias conflict detection
    const seen = new Map<string, NodeSymbol>();
    for (const member of members) {
      if (!member.declaration) continue;

      const name = compiler.fullname(member.declaration).getFiltered(UNHANDLED)?.at(-1);
      if (!name) continue;

      const key = `${member.kind}:${name}`;
      const existing = seen.get(key);
      if (existing) {
        // Report only on the duplicate (second) declaration
        const errorNode = (
          member.declaration instanceof ElementDeclarationNode
          && member.declaration.name
        )
          ? member.declaration.name
          : member.declaration;
        errors.push(getDuplicateSchemaMemberError(member.kind, name, qualifiedName.join('.'), errorNode));
      } else {
        seen.set(key, member);
      }

      // Check alias conflicts (e.g. Table users as U)
      const alias = compiler.alias(member.declaration).getFiltered(UNHANDLED);
      if (alias) {
        const aliasKey = `${member.kind}:${alias}`;
        const existingAlias = seen.get(aliasKey);
        if (existingAlias) {
          const errorNode = (
            member.declaration instanceof ElementDeclarationNode
            && member.declaration.alias
          )
            ? member.declaration.alias
            : member.declaration;
          errors.push(
            new CompileError(
              CompileErrorCode.DUPLICATE_NAME,
              `${member.kind} alias '${alias}' conflicts with an existing ${member.kind} name or alias`,
              errorNode,
            ),
          );
        } else {
          seen.set(aliasKey, member);
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
