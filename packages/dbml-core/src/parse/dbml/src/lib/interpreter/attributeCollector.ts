/* A utility module to ease the attribute processing in the main `interpreter` module */

import { KEYWORDS_OF_DEFAULT_SETTING, NUMERIC_LITERAL_PREFIX } from '../../constants';
import {
  AttributeNode,
  FunctionExpressionNode,
  IdentiferStreamNode,
  ListExpressionNode,
  PrefixExpressionNode,
  PrimaryExpressionNode,
  SyntaxNode,
  VariableNode,
} from '../parser/nodes';
import { extractQuotedStringToken } from '../analyzer/utils';
import { CompileError, CompileErrorCode } from '../errors';
import { isExpressionANumber } from '../analyzer/validator/utils';
import { extractStringFromIdentifierStream, isExpressionAQuotedString } from '../parser/utils';
import { InlineRef } from './types';
import { ColumnSymbol } from '../analyzer/symbol/symbols';
import {
  extractTokenForInterpreter,
  getColumnSymbolsOfRefOperand,
  processRelOperand,
} from './utils';

class AttributeMap {
  private map: Map<string, AttributeNode[]> = new Map();

  insert(name: string, attribute: AttributeNode) {
    const curEntry = this.map.get(name);
    if (curEntry === undefined) {
      this.map.set(name, [attribute]);
    } else {
      curEntry.push(attribute);
    }
  }

  getValue(name: string): SyntaxNode | SyntaxNode[] | boolean | undefined {
    const entry = this.map.get(name);
    if (entry === undefined) {
      return undefined;
    }
    if (entry[0].value === undefined) {
      return true;
    }
    if (entry.length >= 2) {
      return entry.map((e) => e.value!);
    }

    return entry[0].value!;
  }

  getAttributeNode(name: string): AttributeNode | AttributeNode[] | undefined {
    const entry = this.map.get(name);
    if (entry === undefined) {
      return undefined;
    }
    if (entry.length >= 2) {
      return entry;
    }

    return entry[0];
  }
}

export default function collectAttribute(
  settingNode: ListExpressionNode | undefined,
  errors: CompileError[],
): AttributeCollector {
  const attrMap = new AttributeMap();

  if (!settingNode) {
    return new AttributeCollector(attrMap, errors);
  }
  // eslint-disable-next-line no-restricted-syntax
  for (const attribute of settingNode.elementList) {
    const attrName = extractStringFromIdentifierStream(attribute.name).unwrap_or('').toLowerCase();
    attrMap.insert(attrName, attribute);
  }

  return new AttributeCollector(attrMap, errors);
}

class AttributeCollector {
  settingMap: AttributeMap;
  errors: CompileError[];

  constructor(attrMap: AttributeMap, errors: CompileError[]) {
    this.settingMap = attrMap;
    this.errors = errors;
  }

  extractNote(): string | undefined {
    const note = this.settingMap.getValue('note');

    return note !== undefined ?
      extractQuotedStringToken(note as SyntaxNode | undefined).unwrap() :
      undefined;
  }

  extractDefault():
    | { type: 'number' | 'string' | 'expression' | 'boolean'; value: number | string }
    | undefined {
    const deflt = this.settingMap.getValue('default');

    if (deflt === undefined) {
      return undefined;
    }

    // eslint-disable-next-line no-underscore-dangle
    const _deflt = deflt as SyntaxNode;

    if (
      _deflt instanceof PrimaryExpressionNode &&
      _deflt.expression instanceof VariableNode &&
      KEYWORDS_OF_DEFAULT_SETTING.includes(_deflt.expression.variable?.value as any)
    ) {
      return {
        type: 'boolean',
        value: _deflt.expression.variable!.value,
      };
    }

    if (isExpressionANumber(_deflt)) {
      return {
        type: 'number',
        value: Number(_deflt.expression.literal.value),
      };
    }

    if (
      _deflt instanceof PrefixExpressionNode &&
      NUMERIC_LITERAL_PREFIX.includes(_deflt.op?.value as any) &&
      isExpressionANumber(_deflt.expression)
    ) {
      return {
        type: 'number',
        value:
          Number(_deflt.expression.expression.literal.value) * (_deflt.op?.value === '+' ? 1 : -1),
      };
    }

    if (isExpressionAQuotedString(_deflt)) {
      return {
        value: extractQuotedStringToken(_deflt as SyntaxNode).unwrap(),
        type: 'string',
      };
    }

    if (_deflt instanceof FunctionExpressionNode) {
      return {
        value: _deflt.value!.value,
        type: 'expression',
      };
    }

    // `value` must be a complex variable now
    // as allowed by the validator
    // to potentially support enum default value
    // e.g
    // Enum status {
    //   new
    //   churn
    // }
    // Table Users {
    //   status public.status [default: status.new]
    // }
    // currently the interpreter doesn't support this
    this.errors.push(
      new CompileError(CompileErrorCode.UNSUPPORTED, 'Unsupported default value', _deflt),
    );

    return undefined;
  }

  extractRef(
    ownerTableName: string,
    ownerSchemaName: string | null,
  ): (InlineRef & { referee: ColumnSymbol; node: SyntaxNode })[] {
    const refs = this.settingMap.getValue('ref');
    if (refs === undefined) {
      return [];
    }
    const refList = Array.isArray(refs) ? refs : [refs as SyntaxNode];
    const res: (InlineRef & { referee: ColumnSymbol; node: SyntaxNode })[] = [];
    // eslint-disable-next-line no-restricted-syntax
    for (const ref of refList) {
      const operand = (ref as PrefixExpressionNode).expression;
      const maybeName = processRelOperand(operand!, ownerTableName, ownerSchemaName);
      if (maybeName instanceof CompileError) {
        this.errors.push(maybeName);
      } else {
        const { columnNames, tableName, schemaName } = maybeName;
        const relation = (ref as PrefixExpressionNode).op!.value as any;
        res.push({
          schemaName,
          tableName,
          fieldNames: columnNames,
          relation,
          token: extractTokenForInterpreter(ref),
          referee: getColumnSymbolsOfRefOperand(
            (ref as PrefixExpressionNode).expression!,
          ).unwrap()[0],
          node: ref,
        });
      }
    }

    return res;
  }

  extractHeaderColor(): string | undefined {
    const headerColor = this.settingMap.getValue('headercolor');

    if (headerColor === undefined) {
      return undefined;
    }

    return (headerColor as any).expression.literal.value;
  }

  extractUpdate(): string | undefined {
    const update = this.settingMap.getValue('update');

    if (update === undefined) {
      return undefined;
    }

    if (update instanceof IdentiferStreamNode) {
      return extractStringFromIdentifierStream(update).unwrap_or('');
    }

    return (update as any).expression.variable.value;
  }

  extractDelete(): string | undefined {
    const del = this.settingMap.getValue('delete');

    if (del === undefined) {
      return undefined;
    }

    if (del instanceof IdentiferStreamNode) {
      return extractStringFromIdentifierStream(del).unwrap_or('');
    }

    return (del as any).expression.variable.value;
  }

  extractIndexType(): string | undefined {
    const idxType = this.settingMap.getValue('type');

    if (idxType === undefined) {
      return undefined;
    }

    return (idxType as any).expression.variable.value;
  }

  extractPk(): boolean | undefined {
    const pk = this.settingMap.getValue('pk') || this.settingMap.getValue('primary key');

    if (pk === undefined) {
      return undefined;
    }

    return true;
  }

  extractUnique(): boolean | undefined {
    const uniq = this.settingMap.getValue('unique');

    if (uniq === undefined) {
      return undefined;
    }

    return true;
  }

  extractIncrement(): boolean | undefined {
    const increment = this.settingMap.getValue('increment');

    if (increment === undefined) {
      return undefined;
    }

    return true;
  }

  extractNotNull(): boolean | undefined {
    const notNull = this.settingMap.getValue('not null');
    const isNull = this.settingMap.getValue('null');
    if (notNull === undefined && isNull === undefined) {
      return undefined;
    }
    if (notNull && isNull) {
      this.errors.push(
        new CompileError(
          CompileErrorCode.CONFLICTING_SETTING,
          'null and not null can not be set at the same time',
          this.settingMap.getAttributeNode('not null') as AttributeNode,
        ),
      );

      return undefined;
    }

    return !!notNull;
  }

  extractIdxName(): string | undefined {
    const idxName = this.settingMap.getValue('name');

    if (idxName === undefined) {
      return undefined;
    }

    return extractQuotedStringToken(idxName as SyntaxNode).unwrap();
  }
}
