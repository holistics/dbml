import { CompileError, CompileErrorCode } from '../errors';
import {
  AttributeNode,
  BlockExpressionNode,
  CallExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  InfixExpressionNode,
  ListExpressionNode,
  ProgramNode,
  SyntaxNode,
} from '../parser/nodes';
import {
  Column,
  Database,
  Enum,
  EnumField,
  Index,
  InlineRef,
  Project,
  Ref,
  RefEndpoint,
  Table,
  TableGroup,
  TableGroupField,
  TokenPosition,
} from './types';
import Report from '../report';
import {
  destructureComplexVariable,
  destructureIndexNode,
  extractQuotedStringToken,
  extractVarNameFromPrimaryVariable,
} from '../analyzer/utils';
import collectAttribute from './attributeCollector';
import { ColumnSymbol } from '../analyzer/symbol/symbols';
import {
  convertRelationOpToCardinalities,
  extractTokenForInterpreter,
  getColumnSymbolsOfRefOperand,
  isCircular,
  isSameEndpoint,
  normalizeNoteContent,
  processRelOperand,
} from './utils';
import { None, Option, Some } from '../option';

// The interpreted format follows the old parser
export default class Interpreter {
  ast: ProgramNode;
  errors: CompileError[];
  db: Database;
  endpointPairSet: Set<string>;

  constructor(ast: ProgramNode) {
    this.ast = ast;
    this.db = {
      schemas: [],
      tables: [],
      refs: [],
      enums: [],
      tableGroups: [],
      aliases: [],
      project: {},
    };
    this.endpointPairSet = new Set();
    this.errors = [];
  }

  interpret(): Report<Database, CompileError> {
    this.ast.body.forEach((element) => {
      switch (element.type!.value.toLowerCase()) {
        case 'table':
          tryPush(this.table(element), this.db.tables);
          break;
        case 'ref':
          this.db.refs.push(...this.ref(element, null, null));
          break;
        case 'tablegroup':
          tryPush(this.tableGroup(element), this.db.tableGroups);
          break;
        case 'enum':
          tryPush(this.enum(element), this.db.enums);
          break;
        case 'project':
          this.db.project = this.project(element);
          if (this.db.project) {
            this.db.tables.push(...this.db.project.tables);
            this.db.enums.push(...this.db.project.enums);
            this.db.tableGroups.push(...this.db.project.tableGroups);
          }
          break;
        default:
          throw new Error('Unreachable - unknown element type');
      }
    });

    return new Report(this.db, this.errors);
  }

  private table(element: ElementDeclarationNode): Table | undefined {
    const maybeName = this.extractElementName(element.name!);
    if (!maybeName.isOk()) {
      return undefined;
    }
    const { name, schemaName } = maybeName.unwrap();
    const alias = element.alias ?
      extractVarNameFromPrimaryVariable(element.alias as any).unwrap_or(null) :
      null;
    if (alias) {
      this.db.aliases.push({
        name: alias,
        kind: 'table',
        value: {
          tableName: name,
          schemaName,
        },
      });
    }

    const collector = collectAttribute(element.attributeList, this.errors);
    const headerColor = collector.extractHeaderColor();
    const headerNote = collector.extractNote();
    let bodyNote: { value: string; token: TokenPosition } | undefined;
    const noteNode = collector.settingMap.getAttributeNode('note') as AttributeNode | undefined;
    const fields: Column[] = [];
    const indexes: Index[] = [];
    (element.body as BlockExpressionNode).body.forEach((sub) => {
      if (sub instanceof FunctionApplicationNode) {
        tryPush(this.column(sub, name, schemaName), fields);
      } else if (sub instanceof ElementDeclarationNode) {
        switch (sub.type!.value.toLowerCase()) {
          case 'ref':
            this.db.refs.push(...this.ref(sub, name, schemaName));
            break;
          case 'indexes':
            indexes.push(...this.indexes(sub));
            break;
          case 'note':
            if (headerNote !== undefined) {
              this.logError(
                sub,
                CompileErrorCode.NOTE_REDEFINED,
                'Note already appears as a setting of the table',
              );
            } else {
              bodyNote = this.note(sub);
            }
            break;
        }
      }
    });

    return {
      name,
      schemaName,
      alias,
      fields,
      token: extractTokenForInterpreter(element),
      indexes,
      headerColor,
      note:
        headerNote === undefined ?
          bodyNote :
          {
              value: headerNote,
              token: extractTokenForInterpreter(noteNode!),
            },
    };
  }

  private column(
    field: FunctionApplicationNode,
    tableName: string,
    schemaName: string | null,
  ): Column | undefined {
    const name = extractVarNameFromPrimaryVariable(field.callee as any);
    let typeNode = field.args[0];
    let typeArgs: string | null = null;
    if (typeNode instanceof CallExpressionNode) {
      typeArgs = typeNode
        .argumentList!.elementList.map((e) => (e as any).expression.literal.value)
        .join(',');
      typeNode = typeNode.callee!;
    }

    const maybeName = this.extractElementName(typeNode);
    if (!maybeName.isOk()) {
      return undefined;
    }
    const { name: typeName, schemaName: typeSchemaName } = maybeName.unwrap();

    let pk: boolean | undefined;
    let increment: boolean | undefined;
    let unique: boolean | undefined;
    let notNull: boolean | undefined;
    let note: string | undefined;
    let noteNode: AttributeNode | undefined;
    let dbdefault:
      | {
          type: 'number' | 'string' | 'boolean' | 'expression';
          value: number | string;
        }
      | undefined;
    let inlineRefs: (InlineRef & { referee: ColumnSymbol; node: SyntaxNode })[] = [];
    // eslint-disable-next-line no-underscore-dangle
    const _inlineRefs: InlineRef[] = [];
    if (field.args.length === 2) {
      const collector = collectAttribute(field.args[1] as ListExpressionNode, this.errors);
      pk = collector.extractPk();
      increment = collector.extractIncrement();
      unique = collector.extractUnique();
      notNull = collector.extractNotNull();
      dbdefault = collector.extractDefault();
      note = collector.extractNote();
      noteNode = collector.settingMap.getAttributeNode('note') as AttributeNode | undefined;
      inlineRefs = collector.extractRef(tableName, schemaName);
      inlineRefs.forEach((ref) => {
        if (!this.logIfSameEndpoint(ref.node, [field.symbol as ColumnSymbol], [ref.referee])) {
          return;
        }
        if (!this.logIfCircularRefError(ref.node, [field.symbol as ColumnSymbol], [ref.referee])) {
          return;
        }
        _inlineRefs.push({
          schemaName: ref.schemaName,
          tableName: ref.tableName,
          fieldNames: ref.fieldNames,
          relation: ref.relation,
          token: ref.token,
        });
        this.registerInlineRefEndpoints(ref, field, tableName, schemaName);
      });
    }

    return {
      name: name.unwrap(),
      type: {
        schemaName: typeSchemaName,
        type_name: `${typeName}${typeArgs === null ? '' : `(${typeArgs})`}`,
        args: typeArgs,
      },
      token: extractTokenForInterpreter(field),
      inline_refs: _inlineRefs,
      pk,
      unique,
      not_null: notNull,
      dbdefault,
      increment,
      note:
        note === undefined ?
          undefined :
          {
              value: note,
              token: extractTokenForInterpreter(noteNode!),
            },
    };
  }

  private registerInlineRefEndpoints(
    inlRef: InlineRef,
    columnNode: FunctionApplicationNode,
    tableName: string,
    schemaName: string | null,
  ) {
    const [left, right] = convertRelationOpToCardinalities(inlRef.relation);
    const ref: Ref = {
      schemaName: null,
      name: null,
      endpoints: [
        {
          schemaName,
          tableName,
          fieldNames: [extractVarNameFromPrimaryVariable(columnNode.callee as any).unwrap()],
          relation: left,
          token: extractTokenForInterpreter(columnNode),
        },
        {
          schemaName: inlRef.schemaName,
          tableName: inlRef.tableName,
          fieldNames: inlRef.fieldNames,
          relation: right,
          token: inlRef.token,
        },
      ],
      token: inlRef.token,
    };
    this.db.refs.push(ref);
  }

  private ref(
    element: ElementDeclarationNode,
    ownerTableName: string | null,
    ownerSchemaName: string | null,
  ): Ref[] {
    let schemaName: string | null = null;
    let name: string | null = null;
    if (element.name) {
      const maybeName = this.extractElementName(element.name);
      if (!maybeName.isOk()) {
        return [];
      }
      schemaName = maybeName.unwrap().schemaName;
      name = maybeName.unwrap().name;
    }

    if (!(element.body instanceof BlockExpressionNode)) {
      const maybeRef = this.refField(
        element.body! as FunctionApplicationNode,
        schemaName,
        name,
        ownerTableName,
        ownerSchemaName,
      );

      return maybeRef ? [maybeRef] : [];
    }

    const res: Ref[] = [];
    // eslint-disable-next-line no-restricted-syntax
    for (const field of element.body.body) {
      const maybeRef = this.refField(
        field as FunctionApplicationNode,
        schemaName,
        name,
        ownerTableName,
        ownerSchemaName,
      );
      if (maybeRef) {
        res.push(maybeRef);
      }
    }

    return res;
  }

  private refField(
    field: FunctionApplicationNode,
    refSchemaName: string | null,
    refName: string | null,
    ownerTableName: string | null,
    ownerSchemaName: string | null,
  ): Ref | undefined {
    const args = [field.callee, ...field.args];
    const rel = args[0] as InfixExpressionNode;
    const [leftCardinality, rightCardinality] = convertRelationOpToCardinalities(rel.op!.value);
    const leftReferees = getColumnSymbolsOfRefOperand(rel.leftExpression!).unwrap();
    const rightReferees = getColumnSymbolsOfRefOperand(rel.rightExpression!).unwrap();
    if (!this.logIfUnequalFields(rel, leftReferees, rightReferees)) {
      return undefined;
    }
    if (!this.logIfSameEndpoint(rel, leftReferees, rightReferees)) {
      return undefined;
    }
    if (!this.logIfCircularRefError(rel, leftReferees, rightReferees)) {
      return undefined;
    }
    const left = processRelOperand(rel.leftExpression!, ownerTableName, ownerSchemaName);
    const right = processRelOperand(rel.rightExpression!, ownerTableName, ownerSchemaName);
    if (left instanceof CompileError) {
      this.errors.push(left);
    }
    if (right instanceof CompileError) {
      this.errors.push(right);
    }
    if (left instanceof CompileError || right instanceof CompileError) {
      return undefined;
    }

    const leftEndpoint: RefEndpoint = {
      schemaName: left.schemaName,
      tableName: left.tableName,
      fieldNames: left.columnNames,
      relation: leftCardinality,
      token: extractTokenForInterpreter(rel.leftExpression!),
    };
    const rightEndpoint: RefEndpoint = {
      schemaName: right.schemaName,
      tableName: right.tableName,
      fieldNames: right.columnNames,
      relation: rightCardinality,
      token: extractTokenForInterpreter(rel.rightExpression!),
    };
    let del: string | undefined;
    let update: string | undefined;
    if (args.length === 2) {
      const collector = collectAttribute(args[1] as ListExpressionNode, this.errors);
      del = collector.extractDelete();
      update = collector.extractUpdate();
    }

    return {
      name: refName,
      endpoints: [leftEndpoint, rightEndpoint],
      onDelete: del as any,
      onUpdate: update as any,
      token: extractTokenForInterpreter(rel),
      schemaName: refSchemaName,
    };
  }

  private enum(element: ElementDeclarationNode): Enum | undefined {
    const maybeName = this.extractElementName(element.name!);
    if (!maybeName.isOk()) {
      return undefined;
    }
    const { name, schemaName } = maybeName.unwrap();
    const values = (element.body as BlockExpressionNode).body.map((sub) =>
      this.enumField(sub as FunctionApplicationNode),
    );

    return {
      name,
      schemaName,
      token: extractTokenForInterpreter(element),
      values,
    };
  }

  private enumField(field: FunctionApplicationNode): EnumField {
    const args = [field.callee, ...field.args];
    let note: string | undefined;
    let noteNode: AttributeNode | undefined;
    if (args.length === 2) {
      const collector = collectAttribute(args[1] as ListExpressionNode, this.errors);
      note = collector.extractNote();
      noteNode = collector.settingMap.getAttributeNode('note') as AttributeNode | undefined;
    }

    return {
      name: extractVarNameFromPrimaryVariable(args[0] as any).unwrap(),
      token: extractTokenForInterpreter(field),
      note:
        note === undefined ?
          undefined :
          {
              value: note,
              token: extractTokenForInterpreter(noteNode!),
            },
    };
  }

  private project(element: ElementDeclarationNode): Project {
    const proj: Project = {
      name:
        (element.name && extractVarNameFromPrimaryVariable(element.name as any))?.unwrap() || null,
      tables: [],
      refs: [],
      enums: [],
      tableGroups: [],
      note: undefined,
    };

    (element.body as BlockExpressionNode).body.forEach((sub) => {
      // eslint-disable-next-line no-underscore-dangle
      const _sub = sub as ElementDeclarationNode;
      const type = _sub.type!.value.toLowerCase();
      switch (type) {
        case 'table':
          tryPush(this.table(_sub), proj.tables);
          break;
        case 'ref':
          proj.refs.push(...this.ref(_sub, null, null));
          break;
        case 'tablegroup':
          tryPush(this.tableGroup(_sub), proj.tableGroups);
          break;
        case 'enum':
          tryPush(this.enum(_sub), proj.enums);
          break;
        case 'note':
          proj.note = this.note(_sub);
          break;
        default:
          proj[type as any] = this.custom(_sub);
          break;
      }
    });

    return proj;
  }

  // eslint-disable-next-line class-methods-use-this
  private custom(element: ElementDeclarationNode): string {
    return extractQuotedStringToken((element.body as FunctionApplicationNode).callee).unwrap_or('');
  }

  private tableGroup(element: ElementDeclarationNode): TableGroup | undefined {
    const maybeName = this.extractElementName(element.name!);
    if (!maybeName.isOk()) {
      return undefined;
    }
    const { name, schemaName } = maybeName.unwrap();
    const tables: TableGroupField[] = [];
    // eslint-disable-next-line no-restricted-syntax
    for (const field of (element.body as BlockExpressionNode).body) {
      const maybeTableGroupField = this.tableGroupField(field as FunctionApplicationNode);
      if (maybeTableGroupField) {
        tables.push(maybeTableGroupField);
      }
    }

    return {
      name,
      schemaName,
      tables,
      token: extractTokenForInterpreter(element),
    };
  }

  private tableGroupField(field: FunctionApplicationNode): TableGroupField | undefined {
    const maybeName = this.extractElementName(field.callee!);
    if (!maybeName.isOk()) {
      return undefined;
    }
    const { name, schemaName } = maybeName.unwrap();

    return {
      name,
      schemaName,
    };
  }

  // eslint-disable-next-line class-methods-use-this
  private note(
    element: ElementDeclarationNode,
  ): { value: string; token: TokenPosition } | undefined {
    const content =
      element.body instanceof BlockExpressionNode ?
        extractQuotedStringToken(
            ((element.body as BlockExpressionNode).body[0] as FunctionApplicationNode).callee,
          ) :
        extractQuotedStringToken((element.body as FunctionApplicationNode).callee);

    return {
      value: normalizeNoteContent(content.unwrap()),
      token: extractTokenForInterpreter(element),
    };
  }

  private indexes(element: ElementDeclarationNode): Index[] {
    const res: Index[] = [];

    // eslint-disable-next-line no-restricted-syntax
    for (const sub of (element.body as BlockExpressionNode).body) {
      const maybeIndexField = this.indexField(sub as FunctionApplicationNode);
      if (maybeIndexField) {
        res.push(maybeIndexField);
      }
    }

    return res;
  }

  private indexField(field: FunctionApplicationNode): Index {
    const args = [field.callee, ...field.args];

    const { functional, nonFunctional } = destructureIndexNode(args[0]!).unwrap();
    let pk: boolean | undefined;
    let unique: boolean | undefined;
    let name: string | undefined;
    let note: string | undefined;
    let noteNode: AttributeNode | undefined;
    let type: string | undefined;
    if (args.length === 2) {
      const collector = collectAttribute(args[1] as ListExpressionNode, this.errors);
      pk = collector.extractPk();
      unique = collector.extractUnique();
      name = collector.extractIdxName();
      note = collector.extractNote();
      noteNode = collector.settingMap.getAttributeNode('note') as AttributeNode | undefined;
      type = collector.extractIndexType();
    }

    return {
      columns: [
        ...functional.map((s) => ({
          value: s.value!.value,
          type: 'expression',
        })),
        ...nonFunctional.map((s) => ({
          value: extractVarNameFromPrimaryVariable(s).unwrap(),
          type: 'column',
        })),
      ],
      token: extractTokenForInterpreter(field),
      type,
      pk,
      unique,
      name,
      note:
        note === undefined ?
          undefined :
          {
              value: note,
              token: extractTokenForInterpreter(noteNode!),
            },
    };
  }

  private extractElementName(
    nameNode: SyntaxNode,
  ): Option<{ schemaName: string | null; name: string }> {
    const fragments = destructureComplexVariable(nameNode).unwrap();
    const name = fragments.pop()!;
    const schemaName = fragments.pop();
    if (fragments.length > 0) {
      this.logError(
        nameNode,
        CompileErrorCode.UNSUPPORTED,
        'Nested schemas are currently not allowed',
      );

      return new None();
    }

    return new Some({
      name,
      // eslint-disable-next-line no-unneeded-ternary
      schemaName: schemaName ? schemaName : null,
    });
  }

  private logIfUnequalFields(
    node: SyntaxNode,
    firstColumnSymbols: ColumnSymbol[],
    secondColumnSymbols: ColumnSymbol[],
  ): boolean {
    if (firstColumnSymbols.length !== secondColumnSymbols.length) {
      this.logError(node, CompileErrorCode.UNEQUAL_FIELDS_BINARY_REF, 'Two endpoints have unequal number of fields');

      return false;
    }

    return true;
  }

  private logIfSameEndpoint(
    node: SyntaxNode,
    firstColumnSymbols: ColumnSymbol[],
    secondColumnSymbols: ColumnSymbol[],
  ): boolean {
    if (isSameEndpoint(firstColumnSymbols, secondColumnSymbols)) {
      this.logError(node, CompileErrorCode.SAME_ENDPOINT, 'Two endpoints are the same');

      return false;
    }

    return true;
  }

  private logIfCircularRefError(
    node: SyntaxNode,
    firstColumnSymbols: ColumnSymbol[],
    secondColumnSymbols: ColumnSymbol[],
  ): boolean {
    if (isCircular(firstColumnSymbols, secondColumnSymbols, this.endpointPairSet)) {
      this.logError(
        node,
        CompileErrorCode.UNSUPPORTED,
        'Reference with the same endpoints already exists',
      );

      return false;
    }

    return true;
  }

  private logError(node: SyntaxNode, code: CompileErrorCode, message: string) {
    this.errors.push(new CompileError(code, message, node));
  }
}

function tryPush<T>(element: T | undefined, list: T[]) {
  if (element === undefined) {
    return;
  }

  list.push(element);
}
