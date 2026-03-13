import { DEFAULT_SCHEMA_NAME } from '@/constants';
import { SyntaxToken } from '@/core/lexer/tokens';
import { ElementDeclarationNode } from '@/core/parser/nodes';
import { createSchemaSymbolIndex } from '@/core/analyzer/symbol/symbolIndex';
import { SchemaSymbol } from '@/core/analyzer/symbol/symbols';
import SymbolTable from '@/core/analyzer/symbol/symbolTable';
import SymbolFactory from '@/core/analyzer/symbol/factory';
import { ElementKind } from '@/core/analyzer/types';
import CustomValidator from './elementValidators/custom';
import EnumValidator from './elementValidators/enum';
import IndexesValidator from './elementValidators/indexes';
import NoteValidator from './elementValidators/note';
import ProjectValidator from './elementValidators/project';
import RefValidator from './elementValidators/ref';
import TableValidator from './elementValidators/table';
import TableGroupValidator from './elementValidators/tableGroup';
import TablePartialValidator from './elementValidators/tablePartial';
import ChecksValidator from './elementValidators/checks';
import RecordsValidator from './elementValidators/records';

// Re-export from new utils locations
export {
  isRelationshipOp,
  isTupleOfVariables,
} from '@/utils/node';
export {
  isValidColor,
  isVoid,
  isValidAlias,
  isSimpleName,
  isValidSettingList,
  hasComplexBody,
  hasSimpleBody,
  isValidPartialInjection,
  isSignedNumberExpression,
  aggregateSettingList,
  type SignedNumberExpression,
} from '@/utils/element';
export {
  isValidName,
  isUnaryRelationship,
  isValidColumnType,
  isValidDefaultValue,
} from '@/utils/expression';

export function pickValidator (element: ElementDeclarationNode & { type: SyntaxToken }) {
  switch (element.type.value.toLowerCase() as ElementKind) {
    case ElementKind.Enum:
      return EnumValidator;
    case ElementKind.Table:
      return TableValidator;
    case ElementKind.TableGroup:
      return TableGroupValidator;
    case ElementKind.Project:
      return ProjectValidator;
    case ElementKind.Ref:
      return RefValidator;
    case ElementKind.Note:
      return NoteValidator;
    case ElementKind.Indexes:
      return IndexesValidator;
    case ElementKind.TablePartial:
      return TablePartialValidator;
    case ElementKind.Check:
      return ChecksValidator;
    case ElementKind.Records:
      return RecordsValidator;
    default:
      return CustomValidator;
  }
}

// Register the `variables` array as a stack of schema, the following nested within the former
export function registerSchemaStack (
  variables: string[],
  globalSchema: SymbolTable,
  symbolFactory: SymbolFactory,
): SymbolTable {
  // public schema is already global schema
  if (variables[0] === DEFAULT_SCHEMA_NAME) {
    variables = variables.slice(1);
  }

  let prevSchema = globalSchema;

  for (const curName of variables) {
    let curSchema: SymbolTable | undefined;
    const curId = createSchemaSymbolIndex(curName);

    if (!prevSchema.has(curId)) {
      curSchema = new SymbolTable();
      const curSymbol = symbolFactory.create(SchemaSymbol, { symbolTable: curSchema });
      prevSchema.set(curId, curSymbol);
    } else {
      curSchema = prevSchema.get(curId)?.symbolTable;
      if (!curSchema) {
        throw new Error('Expect a symbol table in a schema symbol');
      }
    }
    prevSchema = curSchema;
  }

  return prevSchema;
}
