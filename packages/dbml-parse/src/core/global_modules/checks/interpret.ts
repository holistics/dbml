import Compiler from '@/compiler/index';
import {
  SettingName,
} from '@/core/types/keywords';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, FunctionExpressionNode, ListExpressionNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import type {
  SchemaElement,
} from '@/core/types/schemaJson';
import {
  extractQuotedStringToken,
} from '@/core/utils/expression';
import {
  aggregateSettingList,
} from '@/core/utils/validate';
import {
  getTokenPosition,
} from '@/core/utils/interpret';

export default class ChecksInterpreter {
  private compiler: Compiler;
  private declarationNode: ElementDeclarationNode;

  constructor (compiler: Compiler, declarationNode: ElementDeclarationNode) {
    this.compiler = compiler;
    this.declarationNode = declarationNode;
  }

  interpret (): Report<SchemaElement | SchemaElement[] | undefined> {
    const body = this.declarationNode.body;
    if (!(body instanceof BlockExpressionNode)) return new Report([]);

    const checks = body.body.flatMap((field) => {
      if (!(field instanceof FunctionApplicationNode)) return [];

      const token = getTokenPosition(field);

      // Extract the backtick expression as the check body
      const expression = field.callee instanceof FunctionExpressionNode
        ? (field.callee.value?.value ?? '')
        : '';

      // Extract optional name from settings (e.g. [name: 'check_name'])
      let name: string | undefined;
      const settingsList = field.args.find((a): a is ListExpressionNode => a instanceof ListExpressionNode);
      if (settingsList) {
        const settingsReport = aggregateSettingList(settingsList);
        const settingMap = settingsReport.getValue();
        name = extractQuotedStringToken(settingMap[SettingName.Name]?.at(0)?.value);
      }
      return {
        expression,
        name,
        token,
      };
    });

    return new Report(checks);
  }
}
