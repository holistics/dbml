import { last, partition } from 'lodash-es';
import Compiler from '@/compiler';
import { CompileError, CompileErrorCode, type CompileWarning } from '@/core/types/errors';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, InfixExpressionNode, ListExpressionNode, ProgramNode, SyntaxNode, WildcardNode,
} from '@/core/types/nodes';
import { SettingName } from '@/core/types/keywords';
import { UNHANDLED } from '@/core/types/module';
import Report from '@/core/types/report';
import { DEP_DOWNSTREAM, DEP_UPSTREAM } from '@/core/types/schemaJson';
import { destructureComplexVariableTuple } from '@/core/utils/expression';
import { isSimpleName } from '@/core/utils/validate';
import { legacyMetadataValueDiagnostic } from '@/core/utils/interpret';
import { DEP_METADATA_FIELDS } from '@/core/global_modules/metadata/registries';

export default class DepValidator {
  private declarationNode: ElementDeclarationNode;
  private compiler: Compiler;
  // Deprecation warnings (unquoted custom values), collected alongside the errors
  private warnings: CompileWarning[] = [];

  constructor (compiler: Compiler, declarationNode: ElementDeclarationNode) {
    this.compiler = compiler;
    this.declarationNode = declarationNode;
  }

  validate (): Report<void> {
    this.warnings = [];
    const errors = [
      ...this.validateContext(),
      ...this.validateName(this.declarationNode.name),
      ...this.validateAlias(this.declarationNode.alias),
      // Header settings list. Each edge's settings list is validated in validateFields
      ...this.validateSettings(this.declarationNode),
      ...this.validateBody(this.declarationNode.body),
      ...this.validateDuplicateKeys(),
    ];
    return new Report(undefined, errors, this.warnings);
  }

  private validateSettings (node: SyntaxNode): CompileError[] {
    const report = this.compiler.nodeSettings(node);
    this.warnings.push(...report.getWarnings());
    return report.getErrors();
  }

  // A Dep has one metadata map, so a key (case-insensitive) may appear in only one place:
  // the header list, one edge's list, or one block-body field.
  // Repeats within a single list are already reported by nodeSettings
  private validateDuplicateKeys (): CompileError[] {
    const body = this.declarationNode.body;
    const fields = body instanceof FunctionApplicationNode
      ? [
          body,
        ]
      : (body?.body ?? []).filter((e): e is FunctionApplicationNode => e instanceof FunctionApplicationNode);
    const subs = body instanceof BlockExpressionNode
      ? body.body.filter((e): e is ElementDeclarationNode => e instanceof ElementDeclarationNode)
      : [];

    const sources: [string, SyntaxNode[]][][] = [
      this.declarationNode,
      ...fields,
    ].map((node) => Object.entries(this.compiler.nodeSettings(node).getFiltered(UNHANDLED) ?? {}));
    subs.forEach((sub) => {
      const key = sub.type?.value?.toLowerCase();
      if (key) sources.push([
        [
          key,
          [
            sub,
          ],
        ],
      ]);
    });

    const occurrences = new Map<string, SyntaxNode[][]>();
    sources.forEach((source) => source.forEach(([key, nodes]) => {
      occurrences.set(key, [
        ...(occurrences.get(key) ?? []),
        nodes,
      ]);
    }));

    return [
      ...occurrences.entries(),
    ]
      .filter(([, groups]) => groups.length > 1)
      .flatMap(([key, groups]) => groups.flat().map((node) => new CompileError(CompileErrorCode.DUPLICATE_DEP_SETTING, `'${key}' can only appear once`, node)));
  }

  private validateContext (): CompileError[] {
    if (this.declarationNode.parent instanceof ProgramNode) {
      return [];
    }
    return [
      new CompileError(CompileErrorCode.INVALID_DEP_CONTEXT, 'A Dep must appear top-level', this.declarationNode),
    ];
  }

  private validateName (nameNode?: SyntaxNode): CompileError[] {
    if (!nameNode) return [];
    if (nameNode instanceof WildcardNode) {
      return [
        new CompileError(CompileErrorCode.INVALID_NAME, 'Wildcard (*) is not allowed as a Dep name', nameNode),
      ];
    }
    if (!isSimpleName(nameNode)) {
      return [
        new CompileError(CompileErrorCode.INVALID_NAME, 'A Dep\'s name is optional or must be an identifier or a quoted identifier', nameNode),
      ];
    }
    return [];
  }

  private validateAlias (aliasNode?: SyntaxNode): CompileError[] {
    if (aliasNode) {
      return [
        new CompileError(CompileErrorCode.UNEXPECTED_ALIAS, 'A Dep shouldn\'t have an alias', aliasNode),
      ];
    }
    return [];
  }

  validateBody (body?: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
    if (!body) return [];
    if (body instanceof FunctionApplicationNode) {
      return this.validateFields([
        body,
      ]);
    }

    const [
      fields,
      subs,
    ] = partition(body.body, (e) => e instanceof FunctionApplicationNode);
    return [
      ...this.validateFields(fields as FunctionApplicationNode[]),
      ...this.validateSubElements(subs as ElementDeclarationNode[]),
    ];
  }

  validateFields (fields: FunctionApplicationNode[]): CompileError[] {
    const errors: CompileError[] = [];

    fields.forEach((field) => {
      errors.push(...this.validateSettings(field));

      if (!field.callee) {
        errors.push(new CompileError(CompileErrorCode.INVALID_DEP_FIELD, 'A Dep field must be a binary relationship', field));
        return;
      }
      if (!(field.callee instanceof InfixExpressionNode)) {
        errors.push(new CompileError(CompileErrorCode.INVALID_DEP_FIELD, 'A Dep field must be a binary relationship', field.callee));
        return;
      }

      const infix = field.callee;
      if (infix.op?.value !== DEP_DOWNSTREAM && infix.op?.value !== DEP_UPSTREAM) {
        errors.push(new CompileError(CompileErrorCode.INVALID_DEP_FIELD, 'Dep edges must use the \'->\' or \'<-\' operator', field.callee));
      }

      const leftFragment = destructureComplexVariableTuple(infix.leftExpression) ?? { variables: [], tupleElements: [] };
      const rightFragment = destructureComplexVariableTuple(infix.rightExpression) ?? { variables: [], tupleElements: [] };
      if (leftFragment.variables.length === 0 && leftFragment.tupleElements.length === 0) {
        errors.push(new CompileError(CompileErrorCode.INVALID_DEP_FIELD, 'Invalid Dep endpoint', infix.leftExpression || field.callee));
      }
      if (rightFragment.variables.length === 0 && rightFragment.tupleElements.length === 0) {
        errors.push(new CompileError(CompileErrorCode.INVALID_DEP_FIELD, 'Invalid Dep endpoint', infix.rightExpression || field.callee));
      }

      const args = [
        ...field.args,
      ];
      if (last(args) instanceof ListExpressionNode) args.pop();
      else if (args[0] instanceof ListExpressionNode) args.shift();

      if (args.length > 0) {
        errors.push(...args.map((arg) => new CompileError(CompileErrorCode.INVALID_DEP_FIELD, 'A Dep field should only have a single binary relationship', arg)));
      }
    });

    return errors;
  }

  private validateSubElements (subs: ElementDeclarationNode[]): CompileError[] {
    return subs.flatMap((sub) => {
      if (!sub.type) return [];
      const key = sub.type.value?.toLowerCase();
      const subBody = sub.body;
      if (!key) return [];

      switch (key) {
        case SettingName.Color: {
          const field = DEP_METADATA_FIELDS[SettingName.Color];
          if (sub.name || !(subBody instanceof FunctionApplicationNode) || field.parse(subBody.callee) === undefined) {
            return [
              new CompileError(CompileErrorCode.INVALID_DEP_SETTING_VALUE, field.message, sub),
            ];
          }
          return [];
        }
        case SettingName.Note: {
          let noteValue: SyntaxNode | undefined;
          if (subBody instanceof FunctionApplicationNode) {
            noteValue = subBody.callee;
          } else if (subBody instanceof BlockExpressionNode && subBody.body[0] instanceof FunctionApplicationNode) {
            noteValue = subBody.body[0].callee;
          }
          const field = DEP_METADATA_FIELDS[SettingName.Note];
          if (field.parse(noteValue) === undefined) {
            return [
              new CompileError(CompileErrorCode.INVALID_DEP_SETTING_VALUE, field.message, sub),
            ];
          }
          return [];
        }
        default: {
          if (sub.name || subBody instanceof BlockExpressionNode) {
            return [
              new CompileError(CompileErrorCode.INVALID_SETTINGS, `'${key}' must be a simple field (e.g. ${key}: value). Block syntax is not allowed`, sub),
            ];
          }
          // Any non-builtin field is free-form custom metadata, with the same values as an inline custom setting.
          // Unquoted text is still accepted, with a deprecation warning
          const { errors, warnings } = legacyMetadataValueDiagnostic(
            { invalid: CompileErrorCode.INVALID_DEP_SETTING_VALUE, deprecated: CompileErrorCode.DEPRECATED_DEP_SETTING_VALUE },
            `Custom setting '${sub.type.value}'`,
            subBody instanceof FunctionApplicationNode ? subBody.callee : undefined,
            sub,
            this.compiler.getSource(sub.filepath),
          );
          this.warnings.push(...warnings);
          return errors;
        }
      }
    });
  }
}
