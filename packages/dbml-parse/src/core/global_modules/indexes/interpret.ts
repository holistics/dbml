import { last } from 'lodash-es';
import type Compiler from '@/compiler/index';
import { SettingName } from '@/core/types/keywords';
import { UNHANDLED } from '@/core/types/module';
import {
  BlockExpressionNode,
  CallExpressionNode,
  type ElementDeclarationNode,
  FunctionApplicationNode,
  ListExpressionNode,
} from '@/core/types/nodes';
import type { SyntaxNode } from '@/core/types/nodes';
import Report from '@/core/types/report';
import type { Index, SchemaElement, TokenPosition } from '@/core/types/schemaJson';
import {
  destructureIndexNode,
  extractQuotedStringToken,
  extractVariableNameFromPrimaryVariable,
  extractVariableFromExpression,
} from '@/core/utils/expression';
import { getTokenPosition } from '@/core/utils/interpret';

export default class IndexesInterpreter {
  private compiler: Compiler;
  private node: ElementDeclarationNode;

  constructor (compiler: Compiler, node: ElementDeclarationNode) {
    this.compiler = compiler;
    this.node = node;
  }

  interpret (): Report<SchemaElement | SchemaElement[] | undefined> {
    const body = this.node.body;
    if (!(body instanceof BlockExpressionNode)) return new Report([]);

    const indexes = body.body.flatMap((field) => {
      if (!(field instanceof FunctionApplicationNode)) return [];
      if (!field.callee) return [];

      const columns: Index['columns'] = [];
      const token = getTokenPosition(field);
      const args: SyntaxNode[] = [
        field.callee,
        ...field.args,
      ];

      // Extract settings from trailing list expression
      let pk: boolean | undefined;
      let unique: boolean | undefined;
      let name: string | undefined;
      let note: {
        value: string;
        token: TokenPosition;
      } | undefined;
      let type: string | undefined;

      // Pop trailing ListExpressionNode so it doesn't pollute column parsing
      if (last(args) instanceof ListExpressionNode) {
        args.pop();
      }

      const settingsMap = this.compiler.nodeSettings(field).getFiltered(UNHANDLED);
      if (settingsMap) {
        pk = !!settingsMap[SettingName.PK]?.length || undefined;
        unique = !!settingsMap[SettingName.Unique]?.length || undefined;

        name = extractQuotedStringToken(settingsMap[SettingName.Name]?.at(0)?.value);
        const noteNode = settingsMap[SettingName.Note]?.at(0);
        if (noteNode) {
          const noteValue = extractQuotedStringToken(noteNode.value);
          if (noteValue !== undefined) {
            note = {
              value: noteValue,
              token: getTokenPosition(noteNode),
            };
          }
        }
        type = extractVariableFromExpression(settingsMap[SettingName.Type]?.at(0)?.value);
      }

      // Flatten call expressions like (id, name)(age, weight) into individual column refs
      const flatArguments = args.flatMap((argument) => {
        if (!(argument instanceof CallExpressionNode)) return argument;
        const fragments: SyntaxNode[] = [];
        let current: SyntaxNode = argument;
        while (current instanceof CallExpressionNode) {
          if (current.argumentList) fragments.push(current.argumentList);
          if (!current.callee) break;
          current = current.callee;
        }
        fragments.push(current);
        return fragments;
      });

      // Parse each arg into index column entries (functional or non-functional)
      for (const argument of flatArguments) {
        const result = destructureIndexNode(argument);
        if (!result) continue;
        const argumentColumns: Index['columns'] = [];
        for (const { name, descending } of result.functional) {
          argumentColumns.push({
            value: name.value?.value ?? '',
            type: 'expression',
            ...(descending && { sortOrder: 'desc' }),
            token: getTokenPosition(name),
          });
        }
        for (const { name, descending } of result.nonFunctional) {
          argumentColumns.push({
            value: extractVariableNameFromPrimaryVariable(name) ?? '',
            type: 'column',
            ...(descending && { sortOrder: 'desc' }),
            token: getTokenPosition(name),
          });
        }
        // Keep the written order of columns and expressions
        argumentColumns.sort((left, right) => left.token.start.offset - right.token.start.offset);
        columns.push(...argumentColumns);
      }

      const index: Index = {
        columns,
        pk,
        unique,
        name,
        note,
        type,
        token,
      };
      return [
        index,
      ];
    });

    return new Report(indexes);
  }
}
