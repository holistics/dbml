import {
  last,
} from 'lodash-es';
import Compiler from '@/compiler/index';
import {
  SettingName,
} from '@/core/types/keywords';
import {
  UNHANDLED,
} from '@/core/types/module';
import {
  BlockExpressionNode, CallExpressionNode, ElementDeclarationNode, FunctionApplicationNode, ListExpressionNode,
} from '@/core/types/nodes';
import type {
  SyntaxNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import type {
  Index, SchemaElement, TokenPosition,
} from '@/core/types/schemaJson';
import {
  destructureIndexNode, extractQuotedStringToken, extractVarNameFromPrimaryVariable, extractVariableFromExpression,
} from '@/core/utils/expression';
import {
  tokenPositionOf,
} from '@/core/utils/interpret';

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
      const token = tokenPositionOf(field);
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
        pk = !!settingsMap[SettingName.PK]?.length;
        unique = !!settingsMap[SettingName.Unique]?.length;

        name = extractQuotedStringToken(settingsMap[SettingName.Name]?.at(0)?.value);
        const noteNode = settingsMap[SettingName.Note]?.at(0);
        if (noteNode) {
          const noteValue = extractQuotedStringToken(noteNode.value);
          if (noteValue !== undefined) {
            note = {
              value: noteValue,
              token: tokenPositionOf(noteNode),
            };
          }
        }
        type = extractVariableFromExpression(settingsMap[SettingName.Type]?.at(0)?.value);
      }

      // Flatten call expressions like (id, name)(age, weight) into individual column refs
      const flatArgs = args.flatMap((arg) => {
        if (!(arg instanceof CallExpressionNode)) return arg;
        const fragments: SyntaxNode[] = [];
        let current: SyntaxNode = arg;
        while (current instanceof CallExpressionNode) {
          if (current.argumentList) fragments.push(current.argumentList);
          if (!current.callee) break;
          current = current.callee;
        }
        fragments.push(current);
        return fragments;
      });

      // Parse each arg into index column entries (functional or non-functional)
      for (const arg of flatArgs) {
        const result = destructureIndexNode(arg);
        if (!result) continue;
        for (const s of result.functional) {
          columns.push({
            value: s.value?.value ?? '',
            type: 'expression',
            token: tokenPositionOf(s),
          });
        }
        for (const s of result.nonFunctional) {
          columns.push({
            value: extractVarNameFromPrimaryVariable(s) ?? '',
            type: 'column',
            token: tokenPositionOf(s),
          });
        }
      }

      const idx: Index = {
        columns,
        pk,
        unique,
        name,
        note,
        type,
        token,
      };
      return [
        idx,
      ];
    });

    return new Report(indexes);
  }
}
