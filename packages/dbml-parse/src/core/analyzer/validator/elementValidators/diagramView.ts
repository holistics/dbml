import {
  partition,
} from 'lodash-es';
import {
  destructureComplexVariable, extractVarNameFromPrimaryVariable,
} from '@/core/analyzer/utils';
import {
  ElementValidator,
} from '@/core/analyzer/validator/types';
import {
  isSimpleName,
} from '@/core/analyzer/validator/utils';
import {
  aggregateSettingList, registerSchemaStack,
} from '@/core/analyzer/validator/utils';
import {
  isExpressionAVariableNode, isWildcardExpression,
} from '@/core/parser/utils';
import {
  CompileError, CompileErrorCode, CompileWarning,
} from '@/core/types/errors';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, ListExpressionNode, SyntaxNode,
} from '@/core/types/nodes';
import SymbolFactory from '@/core/types/symbol/factory';
import {
  createDiagramViewFieldSymbolIndex, createDiagramViewSymbolIndex,
} from '@/core/types/symbol/symbolIndex';
import SymbolTable from '@/core/types/symbol/symbolTable';
import {
  DiagramViewFieldSymbol, DiagramViewSymbol,
} from '@/core/types/symbol/symbols';
import {
  SyntaxToken,
} from '@/core/types/tokens';

export default class DiagramViewValidator implements ElementValidator {
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken };
  private publicSymbolTable: SymbolTable;
  private symbolFactory: SymbolFactory;

  constructor (declarationNode: ElementDeclarationNode & { type: SyntaxToken }, publicSymbolTable: SymbolTable, symbolFactory: SymbolFactory) {
    this.declarationNode = declarationNode;
    this.publicSymbolTable = publicSymbolTable;
    this.symbolFactory = symbolFactory;
  }

  validate (): {
    errors: CompileError[];
    warnings: CompileWarning[];
  } {
    const errors: CompileError[] = [
      ...this.validateContext(),
      ...this.validateName(this.declarationNode.name),
      ...this.validateAlias(this.declarationNode.alias),
      ...this.validateSettingList(this.declarationNode.attributeList),
      ...this.registerElement(),
    ];
    const bodyResult = this.validateBody(this.declarationNode.body);
    errors.push(...bodyResult.errors);
    return {
      errors,
      warnings: bodyResult.warnings,
    };
  }

  private validateContext (): CompileError[] {
    if (this.declarationNode.parent instanceof ElementDeclarationNode) {
      return [
        new CompileError(
          CompileErrorCode.INVALID_DIAGRAMVIEW_CONTEXT,
          'DiagramView must appear top-level',
          this.declarationNode,
        ),
      ];
    }
    return [];
  }

  private validateName (nameNode?: SyntaxNode): CompileError[] {
    if (!nameNode) {
      return [
        new CompileError(
          CompileErrorCode.NAME_NOT_FOUND,
          'A DiagramView must have a name',
          this.declarationNode,
        ),
      ];
    }
    if (!isSimpleName(nameNode)) {
      return [
        new CompileError(
          CompileErrorCode.INVALID_NAME,
          'A DiagramView name must be a single identifier',
          nameNode,
        ),
      ];
    }
    return [];
  }

  private validateAlias (aliasNode?: SyntaxNode): CompileError[] {
    if (aliasNode) {
      return [
        new CompileError(
          CompileErrorCode.UNEXPECTED_ALIAS,
          'A DiagramView shouldn\'t have an alias',
          aliasNode,
        ),
      ];
    }

    return [];
  }

  registerElement (): CompileError[] {
    const {
      name,
    } = this.declarationNode;
    this.declarationNode.symbol = this.symbolFactory.create(DiagramViewSymbol, {
      declaration: this.declarationNode,
      symbolTable: new SymbolTable(),
    });
    const maybeNameFragments = destructureComplexVariable(name);
    if (maybeNameFragments !== undefined) {
      const nameFragments = maybeNameFragments;
      const diagramViewName = nameFragments.pop()!;
      const symbolTable = registerSchemaStack(nameFragments, this.publicSymbolTable, this.symbolFactory);
      const diagramViewId = createDiagramViewSymbolIndex(diagramViewName);
      if (symbolTable.has(diagramViewId)) {
        return [new CompileError(CompileErrorCode.DUPLICATE_DIAGRAMVIEW_NAME, `DiagramView '${diagramViewName}' already exists`, name!)];
      }
      symbolTable.set(diagramViewId, this.declarationNode.symbol!);
    }

    return [];
  }

  private validateSettingList (settingList?: ListExpressionNode): CompileError[] {
    const aggReport = aggregateSettingList(settingList);
    const errors: CompileError[] = aggReport.getErrors();
    const settingMap = aggReport.getValue();

    // DiagramView doesn't have any supported settings yet
    for (const name of Object.keys(settingMap)) {
      errors.push(...settingMap[name].map((attr) => new CompileError(
        CompileErrorCode.UNEXPECTED_SETTINGS,
        `Unknown '${name}' setting for DiagramView`,
        attr,
      )));
    }
    return errors;
  }

  validateBody (body?: FunctionApplicationNode | BlockExpressionNode): {
    errors: CompileError[];
    warnings: CompileWarning[];
  } {
    if (!body) return {
      errors: [],
      warnings: [],
    };

    if (body instanceof FunctionApplicationNode) {
      return {
        errors: [
          new CompileError(
            CompileErrorCode.UNEXPECTED_SIMPLE_BODY,
            'A DiagramView\'s body must be a block',
            body,
          ),
        ],
        warnings: [],
      };
    }

    const [fields, subs] = partition(body.body, (e) => e instanceof FunctionApplicationNode);
    const subResult = this.validateSubElements(subs as ElementDeclarationNode[]);
    return {
      errors: [...this.validateFields(fields as FunctionApplicationNode[]), ...subResult.errors],
      warnings: subResult.warnings,
    };
  }

  validateFields (fields: FunctionApplicationNode[]): CompileError[] {
    return fields.flatMap((field) => {
      // Body-level {*} is valid shorthand for "show all entities"
      if (isWildcardExpression(field.callee)) {
        if (field.args.length > 0) {
          return field.args.map((arg) => new CompileError(
            CompileErrorCode.INVALID_DIAGRAMVIEW_FIELD,
            'DiagramView field should only have a single name',
            arg,
          ));
        }
        return [];
      }
      const errors: CompileError[] = [];
      // Fields at the top level of DiagramView are not allowed
      errors.push(new CompileError(
        CompileErrorCode.INVALID_DIAGRAMVIEW_FIELD,
        'Fields are not allowed at DiagramView level. Use Tables, Notes, TableGroups, or Schemas blocks instead.',
        field,
      ));
      return errors;
    });
  }

  private validateSubElements (subs: ElementDeclarationNode[]): {
    errors: CompileError[];
    warnings: CompileWarning[];
  } {
    const errors: CompileError[] = [];
    const warnings: CompileWarning[] = [];

    const allowedBlocks = [
      'tables',
      'notes',
      'tablegroups',
      'schemas',
    ];

    for (const sub of subs) {
      sub.parent = this.declarationNode;
      if (!sub.type) {
        continue;
      }

      const blockType = sub.type.value.toLowerCase();
      if (!allowedBlocks.includes(blockType)) {
        errors.push(new CompileError(
          CompileErrorCode.INVALID_DIAGRAMVIEW_FIELD,
          `Unknown block type "${sub.type.value}" in DiagramView. Allowed: Tables, Notes, TableGroups, Schemas`,
          sub,
        ));
        continue;
      }

      const subBlockResult = this.validateSubBlock(sub);
      errors.push(...subBlockResult.errors);
      warnings.push(...subBlockResult.warnings);
    }

    return {
      errors,
      warnings,
    };
  }

  private validateSubBlock (sub: ElementDeclarationNode): {
    errors: CompileError[];
    warnings: CompileWarning[];
  } {
    const errors: CompileError[] = [];
    const warnings: CompileWarning[] = [];

    if (!sub.body || !(sub.body instanceof BlockExpressionNode)) {
      return {
        errors,
        warnings,
      };
    }

    const body = sub.body as BlockExpressionNode;

    const hasWildcard = body.body.some(
      (e) => e instanceof FunctionApplicationNode && isWildcardExpression(e.callee),
    );
    const hasSpecificItems = body.body.some(
      (e) => e instanceof FunctionApplicationNode && !isWildcardExpression(e.callee),
    );

    if (hasWildcard && hasSpecificItems) {
      warnings.push(new CompileWarning(
        CompileErrorCode.INVALID_DIAGRAMVIEW_FIELD,
        `Wildcard (*) combined with specific items in ${sub.type?.value} block. Specific items will be ignored.`,
        sub,
      ));
    }

    errors.push(...this.registerSubBlockFields(sub));

    return {
      errors,
      warnings,
    };
  }

  registerSubBlockFields (sub: ElementDeclarationNode): CompileError[] {
    const errors: CompileError[] = [];

    if (!sub.body || !(sub.body instanceof BlockExpressionNode)) {
      return errors;
    }

    const body = sub.body as BlockExpressionNode;
    const fields = body.body.filter((e) => e instanceof FunctionApplicationNode) as FunctionApplicationNode[];

    for (const field of fields) {
      if (field.callee && isExpressionAVariableNode(field.callee)) {
        // Wildcards are per-sub-block and don't need uniqueness tracking
        if (isWildcardExpression(field.callee)) continue;

        const fieldName = extractVarNameFromPrimaryVariable(field.callee)!;
        const fieldId = createDiagramViewFieldSymbolIndex(fieldName);

        const fieldSymbol = this.symbolFactory.create(DiagramViewFieldSymbol, {
          declaration: field,
        });
        field.symbol = fieldSymbol;

        const symbolTable = this.declarationNode.symbol!.symbolTable!;
        if (symbolTable.has(fieldId)) {
          const symbol = symbolTable.get(fieldId);
          errors.push(
            new CompileError(CompileErrorCode.DUPLICATE_DIAGRAMVIEW_FIELD, `${fieldName} already exists in DiagramView`, field),
            new CompileError(CompileErrorCode.DUPLICATE_DIAGRAMVIEW_FIELD, `${fieldName} already exists in DiagramView`, symbol!.declaration!),
          );
        } else {
          symbolTable.set(fieldId, fieldSymbol);
        }
      }

      if (field.args.length > 0) {
        errors.push(...field.args.map((arg) => new CompileError(
          CompileErrorCode.INVALID_DIAGRAMVIEW_FIELD,
          'DiagramView field should only have a single name',
          arg,
        )));
      }
    }

    return errors;
  }
}
