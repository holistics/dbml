import Compiler from '@/compiler/index';
import { ElementKind, SettingName } from '@/core/types/keywords';
import { BlockExpressionNode, CallExpressionNode, ElementDeclarationNode, FunctionApplicationNode, ListExpressionNode } from '@/core/types/nodes';
import type { SyntaxNode } from '@/core/types/nodes';
import { PASS_THROUGH, UNHANDLED } from '@/constants';
import Report from '@/core/types/report';
import type { Index, TokenPosition, SchemaElement } from '@/core/types/schemaJson';
import { getTokenPosition } from '../utils';
import { isElementNode, extractQuotedStringToken, extractVariableFromExpression, destructureIndexNode, extractVarNameFromPrimaryVariable } from '@/core/utils/expression';
import { last } from 'lodash-es';

export default class IndexesInterpreter {
  private compiler: Compiler;
  private node: SyntaxNode;

  constructor (compiler: Compiler, node: SyntaxNode) {
    this.compiler = compiler;
    this.node = node;
  }

  interpret (): Report<SchemaElement | SchemaElement[] | undefined> | Report<typeof PASS_THROUGH> {
    if (!isElementNode(this.node, ElementKind.Indexes)) return Report.create(PASS_THROUGH);
    if (!(this.node instanceof ElementDeclarationNode)) return new Report(undefined);

    const body = this.node.body;
    if (!(body instanceof BlockExpressionNode)) return new Report([]);

    const indexes = body.body.flatMap((field) => {
      if (!(field instanceof FunctionApplicationNode)) return [];
      if (!field.callee) return [];

      const columns: Index['columns'] = [];
      const token = getTokenPosition(field);
      const args: SyntaxNode[] = [field.callee, ...field.args];

      // Extract settings from trailing list expression
      let pk: boolean | undefined;
      let unique: boolean | undefined;
      let name: string | undefined;
      let note: { value: string; token: TokenPosition } | undefined;
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
            note = { value: noteValue, token: getTokenPosition(noteNode) };
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
            token: getTokenPosition(s),
          });
        }
        for (const s of result.nonFunctional) {
          columns.push({
            value: extractVarNameFromPrimaryVariable(s) ?? '',
            type: 'column',
            token: getTokenPosition(s),
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
      return [idx];
    });

    return new Report(indexes);
  }
}
