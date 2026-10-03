import {
  Expression,
  IndexExpr,
  IndexParametersExpr,
  OrderedExpr,
} from 'sqlingo';
import type { Index } from '@dbml/parse';
import {
  getIdentifierName, getNodeText, getTokenPosition, buildZeroToken, buildIndexColumn,
} from '../ast';

export function buildIndex (index: IndexExpr): Index | undefined {
  const params = index.args.params;
  if (!(params instanceof IndexParametersExpr)) return undefined;
  const columns = params.args.columns ?? [];
  const using = params.args.using;
  const nameExpression = index.args.this;

  return {
    name: nameExpression instanceof Expression ? getNodeText(nameExpression) : undefined,
    unique: index.args.unique ?? false,
    pk: index.args.primary || undefined,
    type: using instanceof Expression ? getIdentifierName(using) : undefined,
    token: nameExpression instanceof Expression ? getTokenPosition(nameExpression) : buildZeroToken(),
    columns: columns.map((column): Index['columns'][number] => {
      const inner =
        column instanceof OrderedExpr && column.args.this instanceof Expression
          ? column.args.this
          : column;
      if (!(inner instanceof Expression))
        return { type: 'column', value: String(inner), token: buildZeroToken() };
      return buildIndexColumn(inner);
    }),
  };
}
