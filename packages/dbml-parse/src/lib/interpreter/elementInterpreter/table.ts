import { Column, ColumnType, ElementInterpreter, Index, InlineRef, InterpreterDatabase, Table } from '../types';
import { ArrayNode, AttributeNode, BlockExpressionNode, CallExpressionNode, ElementDeclarationNode, FunctionApplicationNode, FunctionExpressionNode, ListExpressionNode, PrefixExpressionNode, SyntaxNode } from '../../parser/nodes';
import { extractColor, extractElementName, getColumnSymbolsOfRefOperand, getMultiplicities, getRefId, getTokenPosition, isSameEndpoint } from '../utils';
import { destructureComplexVariable, destructureIndexNode, extractQuotedStringToken, extractVarNameFromPrimaryVariable } from '../../analyzer/utils';
import { CompileError, CompileErrorCode } from '../../errors';
import { aggregateSettingList, isExpressionANumber } from '../../analyzer/validator/utils';
import { isExpressionAQuotedString, isExpressionAnIdentifierNode } from '../../parser/utils';
import { NUMERIC_LITERAL_PREFIX } from '../../../constants';
import { ColumnSymbol } from '../../analyzer/symbol/symbols';
import _ from 'lodash';
import { RefInterpreter } from './ref';

export class TableInterpreter implements ElementInterpreter {
  private declarationNode: ElementDeclarationNode;
  private env: InterpreterDatabase;
  private table: Partial<Table>;
  private pkColumns: Column[];

  constructor(declarationNode: ElementDeclarationNode, env: InterpreterDatabase) {
    this.declarationNode = declarationNode;
    this.env = env;
    this.table = { alias: null, fields: [], indexes: [] };
    this.pkColumns = [];
  }

  interpret(): CompileError[] {
    const errors = [
      ...this.interpretName(this.declarationNode.name!),
      ...this.interpretAlias(this.declarationNode.alias),
      ...this.interpretSettingList(this.declarationNode.attributeList),
      ...this.interpretBody(this.declarationNode.body as BlockExpressionNode),
    ];

    // Handle cases where there are multiple primary columns
    // all the pk field of the columns are reset to false
    // and a new pk composite index is added
    if (this.pkColumns.length >= 2) {
      this.table.indexes!.push({
        columns: this.pkColumns.map(({ name }) => ({ value: name, type: 'column' })),
        token: {
          start: { offset: -1, line: -1, column: -1 }, // do not make sense to have a meaningful start (?)
          end: { offset: -1, line: -1, column: -1 }, // do not make sense to have a meaningful end (?)
        },
        pk: true,
      });
      this.pkColumns.forEach((column) => column.pk = false);
    }

    this.env.tables.set(this.declarationNode, this.table as Table);

    return errors;
  }

  private interpretName(nameNode: SyntaxNode): CompileError[] {
    const { name, schemaName } = extractElementName(nameNode);
    
    if (schemaName.length > 1) {
      this.table.name = name;
      this.table.schemaName = schemaName.join('.');
      return [new CompileError(CompileErrorCode.UNSUPPORTED, 'Nested schema is not supported', nameNode)];
    }

    this.table.name = name;
    this.table.schemaName = schemaName.length ? schemaName[0] : null;

    return [];
  }

  private interpretAlias(aliasNode?: SyntaxNode): CompileError[] {
    if (!aliasNode) {
      return [];
    }

    const alias = extractVarNameFromPrimaryVariable(aliasNode as any).unwrap_or(null);
    if (alias) {
      this.env.aliases.push({
        name: alias,
        kind: 'table',
        value: {
          tableName: this.table.name!,
          schemaName: this.table.schemaName!,
        },
      });
      this.table.alias = alias;
    }

    return [];
  }

  private interpretSettingList(settings?: ListExpressionNode): CompileError[] {
    const settingMap = aggregateSettingList(settings).getValue();

    this.table.headerColor = settingMap['headercolor']?.length ? extractColor(settingMap['headercolor']?.at(0)?.value as any) : undefined;
    
    const [noteNode] = settingMap['note'] || [];
    const noteValue = extractQuotedStringToken(noteNode).unwrap_or(undefined);
    this.table.note = noteNode && {
      token: getTokenPosition(noteNode),
      value: noteValue!,
    };

    return [];
  }

  private interpretBody(body: BlockExpressionNode): CompileError[] {
    const [fields, subs] = _.partition(body.body, (e) => e instanceof FunctionApplicationNode);
    return [...this.interpretFields(fields as FunctionApplicationNode[]), ...this.interpretSubElements(subs as ElementDeclarationNode[])];   
  }

  private interpretSubElements(subs: ElementDeclarationNode[]): CompileError[] {
    return subs.flatMap((sub) => {
      switch (sub.type?.value.toLowerCase()) {
        case 'note':
          this.table.note = {
            token: getTokenPosition(sub),
            value: extractQuotedStringToken(sub.body instanceof BlockExpressionNode ? sub.body.body[0] : sub.body!.callee).unwrap(),
          }
          return [];
        case 'indexes':
          return this.interpretIndexes(sub);
        case 'ref':
          return (new RefInterpreter(sub, this.env)).interpret();
      }

      return [];
    })
  }

  private interpretFields(fields: FunctionApplicationNode[]): CompileError[] {
    return fields.flatMap((field) => this.interpretColumn(field));
  }

  private interpretColumn(field: FunctionApplicationNode): CompileError[] {
    const errors: CompileError[] = [];

    const column: Partial<Column> = {};
    
    column.name = extractVarNameFromPrimaryVariable(field.callee as any).unwrap();
    
    column.type = processColumnType(field.args[0]);
    
    const settings = field.args.slice(1);
    if (settings.length >= 1) {
      if (_.last(settings) instanceof ListExpressionNode) {
        const settingMap = aggregateSettingList(settings.pop() as ListExpressionNode).getValue();
        column.pk = !!settingMap['pk']?.length;
        column.increment = !!settingMap['increment']?.length;
        column.unique = !!settingMap['unique']?.length;
        column.not_null = !!settingMap['not null']?.length;
        column.dbdefault = processDefaultValue(settingMap['default']?.at(0)?.value);
        const noteNode = settingMap['note']?.at(0);
        column.note = noteNode && {
          token: getTokenPosition(noteNode),
          value: extractQuotedStringToken(noteNode.value).unwrap(),
        }
        const refs = settingMap['ref'] || [];
        column.inline_refs = refs.flatMap((ref) => {
          const [referredSymbol] = getColumnSymbolsOfRefOperand((ref.value as PrefixExpressionNode).expression!);
          if (isSameEndpoint(referredSymbol, field.symbol as ColumnSymbol)) {
            errors.push(new CompileError(CompileErrorCode.SAME_ENDPOINT, 'Two endpoints are the same', ref));
            return [];
          }

          const op = (ref.value as PrefixExpressionNode).op!;
          const fragments = destructureComplexVariable((ref.value as PrefixExpressionNode).expression).unwrap();
          
          let inlineRef: InlineRef | undefined;
          if (fragments.length === 1) {
            const [column] = fragments;

            inlineRef = {
              schemaName: this.table.schemaName!,
              tableName: this.table.name!,
              fieldNames: [column],
              relation: op.value as any,
              token: getTokenPosition(ref),
            };
          } else if (fragments.length === 2) {
            const [table, column] = fragments;
            inlineRef = {
              schemaName: this.table.schemaName!,
              tableName: table,
              fieldNames: [column],
              relation: op.value as any,
              token: getTokenPosition(ref),
            };
          } else if (fragments.length === 3) {
            const [schema, table, column] = fragments;
            inlineRef = {
              schemaName: schema,
              tableName: table,
              fieldNames: [column],
              relation: op.value as any,
              token: getTokenPosition(ref),
            };
          } else {
            errors.push(new CompileError(CompileErrorCode.UNSUPPORTED, 'Nested schema is not supported', ref));
            const column = fragments.pop()!;
            const table = fragments.pop()!;
            const schema = fragments.join('.');
            inlineRef = {
              schemaName: schema,
              tableName: table,
              fieldNames: [column],
              relation: op.value as any,
              token: getTokenPosition(ref),
            };
          }

          const errs = this.registerInlineRefToEnv(field, referredSymbol, inlineRef, ref);
          errors.push(...errs);

          return errs.length === 0 ? inlineRef : [];
        })
      } 
    }

    column.pk ||= settings.some((setting) => extractQuotedStringToken(setting).unwrap().toLowerCase() === 'pk');
    column.unique ||= settings.some((setting) => extractQuotedStringToken(setting).unwrap().toLowerCase() === 'unique');

    this.table.fields!.push(column as Column);
    if (column.pk) {
      this.pkColumns.push(column as Column);
    }
    return errors;
  }

  private interpretIndexes(indexes: ElementDeclarationNode): CompileError[] {
    this.table.indexes!.push(...(indexes.body as BlockExpressionNode).body.map((_indexField) => {
      const index: Partial<Index> = { columns: [] };

      const indexField = _indexField as FunctionApplicationNode;
      const args = [indexField.callee!, ...indexField.args];
      if (_.last(args) instanceof ListExpressionNode) {
        const settingMap = aggregateSettingList(args.pop() as ListExpressionNode).getValue();
        index.pk = !!settingMap['pk']?.length;
        index.unique = !!settingMap['unique']?.length;
        index.name = extractQuotedStringToken(settingMap['name']?.at(0)?.value).unwrap_or(undefined);
        const noteNode = settingMap['note']?.at(0);
        index.note = noteNode && {
          token: getTokenPosition(noteNode),
          value: extractQuotedStringToken(noteNode.value).unwrap(),
        };
        index.type = extractQuotedStringToken(settingMap['type']?.at(0)?.value).unwrap_or(undefined); 
      }

      args.forEach((arg) => {
        const { functional, nonFunctional } = destructureIndexNode(arg).unwrap();
        index.columns!.push(
          ...functional.map((s) => ({
            value: s.value!.value,
            type: 'expression',
          })),
          ...nonFunctional.map((s) => ({
            value: extractVarNameFromPrimaryVariable(s).unwrap(),
            type: 'column',
          })),
        );
      });
       
      return index as Index;
    }));
    
    return [];
  }

  private registerInlineRefToEnv(column: FunctionApplicationNode, referredSymbol: ColumnSymbol, inlineRef: InlineRef, ref: AttributeNode): CompileError[] {
    const refId = getRefId(column.symbol as ColumnSymbol, referredSymbol);
    if (this.env.refIds[refId]) {
      return [
        new CompileError(CompileErrorCode.CIRCULAR_REF, 'References with same endpoints exist', ref),
        new CompileError(CompileErrorCode.CIRCULAR_REF, 'References with same endpoints exist', this.env.refIds[refId]),
      ];
    }

    const multiplicities = getMultiplicities(inlineRef.relation);
    this.env.refIds[refId] = this.declarationNode;
    this.env.ref.set(this.declarationNode, {
      name: null,
      schemaName: null,
      token: inlineRef.token,
      endpoints: [
        {
          schemaName: this.table.schemaName!,
          tableName: this.table.name!,
          fieldNames: [extractQuotedStringToken(column.callee!).unwrap()],
          token: getTokenPosition(column),
          relation: multiplicities[0],
        },
        {
          ...inlineRef,
          relation: multiplicities[1],
        },
      ]
    });

    return [];
  }
}

function processColumnType(typeNode: SyntaxNode): ColumnType {
  let typeArgs: string | null = null;
  if (typeNode instanceof CallExpressionNode) {
      typeArgs = typeNode
          .argumentList!.elementList.map((e) => (e as any).expression.literal.value)
          .join(',');
      typeNode = typeNode.callee!;
    }
  let typeIndexer: string = '';
  while (typeNode instanceof ArrayNode) {
    typeIndexer = `[${
      typeNode
        .indexer!.elementList.map((e) => (e.name as any).expression.literal.value)
        .join(',')
    }]${typeIndexer}`;
    typeNode = typeNode.array!;
  }

  const { name: typeName, schemaName: typeSchemaName } = extractElementName(typeNode);
  if (typeSchemaName.length > 1) {
    throw [new CompileError(CompileErrorCode.UNSUPPORTED, 'Nested schema is not supported', typeNode)];
  }

  return {
    args: typeArgs,
    schemaName: typeSchemaName.length === 0 ? null : typeSchemaName[0],
    type_name: typeName
  };
}

function processDefaultValue(valueNode?: SyntaxNode):
  {
    type: "string" | "number" | "boolean" | "expression";
    value: string | number;
  } | undefined {
  if (!valueNode) {
    return undefined;
  }

  if (isExpressionAQuotedString(valueNode)) {
    return {
      type: "string",
      value: extractQuotedStringToken(valueNode).unwrap(),
    };
  }

  if (isExpressionANumber(valueNode)) {
    return {
      type: "number",
      value: Number.parseInt(valueNode.expression.literal.value, 10),
    }
  }

  if (isExpressionAnIdentifierNode(valueNode)) {
    const value = valueNode.expression.variable.value;
    switch (value) {
      case 'true':
      case 'false':
        return {
          type: 'boolean',
          value, 
        };
      case 'null':
        return {
          type: 'expression',
          value
        }
    }
  }

  if (
    valueNode instanceof PrefixExpressionNode &&
    NUMERIC_LITERAL_PREFIX.includes(valueNode.op?.value as any) &&
    isExpressionANumber(valueNode.expression)
  ) {
    const number = Number.parseInt(valueNode.expression.expression.literal.value, 10);
    return {
      type: 'number',
      value: valueNode.op?.value === '-' ? 0 - number : number, 
    };
  }

  if (valueNode instanceof FunctionExpressionNode) {
    return {
      type: 'expression',
      value: valueNode.value?.value!,
    }
  }

  throw new Error('Unreachable');
}
