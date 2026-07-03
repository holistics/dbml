import type Compiler from '@/compiler';
import type {
  CodeActionProvider, CodeActionList, CodeActionContext,
  TextModel, Range, CancellationToken,
} from '../types';

export default class DBMLCodeActionProvider implements CodeActionProvider {
  private compiler: Compiler;

  constructor (compiler: Compiler) {
    this.compiler = compiler;
  }

  provideCodeActions (
    model: TextModel,
    range: Range,
    context: CodeActionContext,
    token: CancellationToken,
  ): CodeActionList | undefined {
    return undefined;
  }
}
