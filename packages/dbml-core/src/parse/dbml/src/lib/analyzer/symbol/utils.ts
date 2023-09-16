import { SyntaxNode } from '../../parser/nodes';
import { ValidatorContext } from '../validator/validatorContext';
import {
  NodeSymbolIndex,
  createColumnSymbolIndex,
  createEnumFieldSymbolIndex,
  createEnumSymbolIndex,
  createTableGroupSymbolIndex,
  createTableSymbolIndex,
} from './symbolIndex';
import SymbolTable from './symbolTable';
import {
  ColumnSymbol,
  EnumFieldSymbol,
  EnumSymbol,
  NodeSymbol,
  TableGroupFieldSymbol,
  TableGroupSymbol,
  TableSymbol,
} from './symbols';

export function createIdFromContext(
  name: string,
  context: ValidatorContext,
): NodeSymbolIndex | undefined {
  switch (context) {
    case ValidatorContext.TableContext:
      return createTableSymbolIndex(name);
    case ValidatorContext.EnumContext:
      return createEnumSymbolIndex(name);
    case ValidatorContext.TableGroupContext:
      return createTableGroupSymbolIndex(name);
    default:
      return undefined;
  }
}

export function createSubfieldId(
  name: string,
  context: ValidatorContext,
): NodeSymbolIndex | undefined {
  switch (context) {
    case ValidatorContext.TableContext:
      return createColumnSymbolIndex(name);
    case ValidatorContext.EnumContext:
      return createEnumFieldSymbolIndex(name);
    case ValidatorContext.TableGroupContext:
      return createTableGroupSymbolIndex(name);
    default:
      return undefined;
  }
}

export function createSymbolFromContext(
  declaration: SyntaxNode,
  context: ValidatorContext,
): NodeSymbol | undefined {
  switch (context) {
    case ValidatorContext.TableContext:
      return new TableSymbol(new SymbolTable(), declaration);
    case ValidatorContext.EnumContext:
      return new EnumSymbol(new SymbolTable(), declaration);
    case ValidatorContext.TableGroupContext:
      return new TableGroupSymbol(new SymbolTable(), declaration);
    default:
      return undefined;
  }
}

export function createSubfieldSymbol(
  declaration: SyntaxNode,
  context: ValidatorContext,
): NodeSymbol | undefined {
  switch (context) {
    case ValidatorContext.TableContext:
      return new ColumnSymbol(declaration);
    case ValidatorContext.EnumContext:
      return new EnumFieldSymbol(declaration);
    case ValidatorContext.TableGroupContext:
      return new TableGroupFieldSymbol(declaration);
    default:
      return undefined;
  }
}
