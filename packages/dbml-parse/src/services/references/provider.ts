import { Uri } from '@/services/types';
import { uniq } from 'lodash-es';
import Compiler from '@/compiler';
import { Filepath } from '@/core/types/filepath';
import { UNHANDLED } from '@/core/types/module';
import { ElementDeclarationNode, SyntaxNode, SyntaxNodeKind } from '@/core/types/nodes';
import {
  Location, Position, ReferenceProvider, TextModel,
} from '@/services/types';
import { getOffsetFromMonacoPosition, getNamedTargetsAt } from '@/services/utils';
import { MetadataElementMetadata } from '@/core/types';

export default class DBMLReferencesProvider implements ReferenceProvider {
  private compiler: Compiler;

  constructor (compiler: Compiler) {
    this.compiler = compiler;
  }

  provideReferences (model: TextModel, position: Position): Location[] {
    const {
      uri,
    } = model;
    const filepath = Filepath.fromUri(String(uri));
    const offset = getOffsetFromMonacoPosition(model, position);

    // Ensure binding is done before resolving references
    this.compiler.bindProject();

    const containers = [
      ...this.compiler.container.stack(filepath, offset),
    ];
    while (containers.length !== 0) {
      const node = containers.pop();
      if (
        node
        && [
          SyntaxNodeKind.ELEMENT_DECLARATION,
          SyntaxNodeKind.FUNCTION_APPLICATION,
          SyntaxNodeKind.PRIMARY_EXPRESSION,
        ].includes(node?.kind)
      ) {
        const symbol = this.compiler.nodeSymbol(node).getFiltered(UNHANDLED) ?? this.compiler.nodeReferee(node).getFiltered(UNHANDLED);
        let references: SyntaxNode[] | undefined;
        if (symbol) {
          references = this.compiler.symbolReferences(symbol);
        } else {
          // A named Ref/Dep has no symbol: its references are its declaration name and the `Metadata Ref|Dep` header names
          const targets = getNamedTargetsAt(this.compiler, node);
          references = targets.length
            ? uniq(targets.flatMap((target) => [
                ...(target.declaration instanceof ElementDeclarationNode && target.declaration.name ? [target.declaration.name] : []),
                ...this.compiler.symbolMetadata(target)
                  .filter((m) => m instanceof MetadataElementMetadata)
                  .flatMap((m) => m.declaration.name ?? []),
              ]))
            : undefined;
        }
        if (references && references.length > 0) {
          return references.map((refNode: SyntaxNode) => {
            // Use filepath from reference node if available and in multi-file mode (uri is set)
            let refUri: Uri = uri;
            if (uri && refNode.filepath) {
              refUri = Uri.parse(refNode.filepath.toUri({ protocol: uri.scheme }));
            }

            return {
              range: {
                startColumn: refNode.startPos.column + 1,
                startLineNumber: refNode.startPos.line + 1,
                endColumn: refNode.endPos.column + 1,
                endLineNumber: refNode.endPos.line + 1,
              },
              uri: refUri,
            };
          });
        }
      }
    }

    return [];
  }
}
