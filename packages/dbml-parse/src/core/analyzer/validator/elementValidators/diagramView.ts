import { partition } from 'lodash-es';
import { CompileError, CompileErrorCode, CompileWarning } from '@/core/errors';
import {
  isSimpleName, pickValidator,
} from '@/core/analyzer/validator/utils';
import { registerSchemaStack, aggregateSettingList } from '@/core/analyzer/validator/utils';
import { ElementValidator } from '@/core/analyzer/validator/types';
import SymbolTable from '@/core/analyzer/symbol/symbolTable';
import { SyntaxToken } from '@/core/lexer/tokens';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, ListExpressionNode, PrimaryExpressionNode, SyntaxNode, VariableNode,
} from '@/core/parser/nodes';
import SymbolFactory from '@/core/analyzer/symbol/factory';
import { createDiagramViewFieldSymbolIndex, createDiagramViewSymbolIndex } from '@/core/analyzer/symbol/symbolIndex';
import { destructureComplexVariable, extractVarNameFromPrimaryVariable } from '@/core/analyzer/utils';
import { DiagramViewFieldSymbol, DiagramViewSymbol } from '@/core/analyzer/symbol/symbols';
import { isExpressionAVariableNode } from '@/core/parser/utils';

/**
 * Check if a node is a wildcard expression (*)
 */
function isWildcardExpression (node: SyntaxNode | undefined): boolean {
  if (!node) return false;
  if (node instanceof PrimaryExpressionNode && node.expression instanceof VariableNode) {
    return node.expression.variable?.value === '*';
  }
  return false;
}

export default class DiagramViewValidator implements ElementValidator {
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken };
  private publicSymbolTable: SymbolTable;
  private symbolFactory: SymbolFactory;

  constructor (declarationNode: ElementDeclarationNode & { type: SyntaxToken }, publicSymbolTable: SymbolTable, symbolFactory: SymbolFactory) {
    this.declarationNode = declarationNode;
    this.publicSymbolTable = publicSymbolTable;
    this.symbolFactory = symbolFactory;
  }

  validate (): CompileError[] {
    return [
      ...this.validateContext(),
      ...this.validateName(this.declarationNode.name),
      ...this.validateAlias(this.declarationNode.alias),
      ...this.validateSettingList(this.declarationNode.attributeList),
      ...this.registerElement(),
      ...this.validateBody(this.declarationNode.body) as CompileError[],
    ];
  }

  private validateContext (): CompileError[] {
    if (this.declarationNode.parent instanceof ElementDeclarationNode) {
      return [new CompileError(
        CompileErrorCode.INVALID_DIAGRAMVIEW_CONTEXT,
        'DiagramView must appear top-level',
        this.declarationNode,
      )];
    }
    return [];
  }

  private validateName (nameNode?: SyntaxNode): CompileError[] {
    if (!nameNode) {
      return [new CompileError(
        CompileErrorCode.NAME_NOT_FOUND,
        'A DiagramView must have a name',
        this.declarationNode,
      )];
    }
    if (!isSimpleName(nameNode)) {
      return [new CompileError(
        CompileErrorCode.INVALID_NAME,
        'A DiagramView name must be a single identifier',
        nameNode,
      )];
    }
    return [];
  }

  private validateAlias (aliasNode?: SyntaxNode): CompileError[] {
    if (aliasNode) {
      return [new CompileError(
        CompileErrorCode.UNEXPECTED_ALIAS,
        'A DiagramView shouldn\'t have an alias',
        aliasNode,
      )];
    }

    return [];
  }

  registerElement (): CompileError[] {
    const { name } = this.declarationNode;
    this.declarationNode.symbol = this.symbolFactory.create(DiagramViewSymbol, { declaration: this.declarationNode, symbolTable: new SymbolTable() });
    const maybeNameFragments = destructureComplexVariable(name);
    if (maybeNameFragments.isOk()) {
      const nameFragments = maybeNameFragments.unwrap();
      const diagramViewName = nameFragments.pop()!;
      const symbolTable = registerSchemaStack(nameFragments, this.publicSymbolTable, this.symbolFactory);
      const diagramViewId = createDiagramViewSymbolIndex(diagramViewName);
      if (symbolTable.has(diagramViewId)) {
        return [new CompileError(CompileErrorCode.DUPLICATE_DIAGRAMVIEW_NAME, `DiagramView name '${diagramViewName}' already exists`, name!)];
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

  validateBody (body?: FunctionApplicationNode | BlockExpressionNode): (CompileError | CompileWarning)[] {
    if (!body) return [];

    if (body instanceof FunctionApplicationNode) {
      return [new CompileError(
        CompileErrorCode.UNEXPECTED_SIMPLE_BODY,
        'A DiagramView\'s body must be a block',
        body,
      )];
    }

    const [fields, subs] = partition(body.body, (e) => e instanceof FunctionApplicationNode);
    return [
      ...this.validateFields(fields as FunctionApplicationNode[]),
      ...this.validateSubElements(subs as ElementDeclarationNode[]),
    ];
  }

  validateFields (fields: FunctionApplicationNode[]): (CompileError | CompileWarning)[] {
    return fields.flatMap((field) => {
      // Body-level {*} is valid shorthand for "show all entities"
      if (isWildcardExpression(field.callee)) {
        return [];
      }
      const errors: (CompileError | CompileWarning)[] = [];
      // Fields at the top level of DiagramView are not allowed
      errors.push(new CompileError(
        CompileErrorCode.INVALID_DIAGRAMVIEW_FIELD,
        'Fields are not allowed at DiagramView level. Use Tables, Notes, TableGroups, or Schemas blocks instead.',
        field,
      ));
      return errors;
    });
  }

  private validateSubElements (subs: ElementDeclarationNode[]): (CompileError | CompileWarning)[] {
    const errors: (CompileError | CompileWarning)[] = [];

    // Validate allowed sub-blocks: Tables, Notes, TableGroups, Schemas
    const allowedBlocks = ['tables', 'notes', 'tablegroups', 'schemas'];

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

      // Validate the sub-block body
      errors.push(...this.validateSubBlock(sub));

      // Register fields in the sub-block
      errors.push(...this.registerSubBlockFields(sub));
    }

    return errors;
  }

  private validateSubBlock (sub: ElementDeclarationNode): (CompileError | CompileWarning)[] {
    const errors: (CompileError | CompileWarning)[] = [];

    if (!sub.body || !(sub.body instanceof BlockExpressionNode)) {
      return errors;
    }

    const body = sub.body as BlockExpressionNode;

    // Check for * combined with specific items (warning)
    const hasWildcard = body.body.some(
      (e) => e instanceof FunctionApplicationNode && isWildcardExpression(e.callee),
    );
    const hasSpecificItems = body.body.some(
      (e) => e instanceof FunctionApplicationNode && !isWildcardExpression(e.callee),
    );

    if (hasWildcard && hasSpecificItems) {
      errors.push(new CompileWarning(
        CompileErrorCode.INVALID_DIAGRAMVIEW_FIELD,
        `Wildcard (*) combined with specific items in ${sub.type?.value} block. Specific items will be ignored.`,
        sub,
      ));
    }

    return errors;
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

        const fieldName = extractVarNameFromPrimaryVariable(field.callee).unwrap();
        const fieldId = createDiagramViewFieldSymbolIndex(fieldName);

        const fieldSymbol = this.symbolFactory.create(DiagramViewFieldSymbol, { declaration: field });
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
