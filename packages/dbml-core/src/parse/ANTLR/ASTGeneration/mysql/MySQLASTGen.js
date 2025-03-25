/* eslint-disable class-methods-use-this */
import { last, flatten, flattenDepth } from 'lodash';
import MySQLParserVisitor from '../../parsers/mysql/MySqlParserVisitor';
import { Endpoint, Enum, Field, Index, Table, Ref } from '../AST';
import { TABLE_CONSTRAINT_KIND, COLUMN_CONSTRAINT_KIND, DATA_TYPE, CONSTRAINT_TYPE } from '../constants';
import { shouldPrintSchemaName } from '../../../../model_structure/utils';

const TABLE_OPTIONS_KIND = {
  NOTE: 'note',
};

const ALTER_KIND = {
  ADD_PK: 'add_pk',
  ADD_FK: 'add_fk',
};

const INDEX_OPTION_KIND = {
  TYPE: 'type',
};

const getTableNames = (names) => {
  const tableName = last(names);
  const schemaName = names.length > 1 ? names[names.length - 2] : undefined;
  return {
    tableName,
    schemaName,
  };
};

const getFieldNames = (names) => {
  const fieldName = last(names);
  const tableName = names.length > 1 ? names[names.length - 2] : undefined;
  const schemaName = names.length > 2 ? names[names.length - 3] : undefined;

  return {
    fieldName,
    tableName,
    schemaName,
  };
};

export default class MySQLASTGen extends MySQLParserVisitor {
  constructor () {
    super();
    this.data = {
      schemas: [],
      tables: [],
      refs: [],
      enums: [],
      tableGroups: [],
      aliases: [],
      project: {},
      records: {},
    };
  }

  // TODO: support configurable default schema name other than 'public'
  findTable (schemaName, tableName) {
    const realSchemaName = schemaName || 'public';
    const table = this.data.tables.find(t => {
      const targetSchemaName = t.schemaName || 'public';
      return targetSchemaName === realSchemaName && t.name === tableName;
    });
    return table;
  }

  // sqlStatements? (MINUS MINUS)? EOF
  visitRoot (ctx) {
    ctx.sqlStatements()?.accept(this);
    return this.data;
  }

  // (sqlStatement (MINUS MINUS)? SEMI? | emptyStatement_)* (sqlStatement ((MINUS MINUS)? SEMI)? | emptyStatement_)
  visitSqlStatements (ctx) {
    ctx.sqlStatement().forEach(statement => {
      statement.accept(this);
    });
  }

  // ddlStatement | dmlStatement | transactionStatement | replicationStatement | preparedStatement | administrationStatement | utilityStatement
  visitSqlStatement (ctx) {
    if (ctx.ddlStatement()) {
      ctx.ddlStatement().accept(this);
      return;
    }

    if (ctx.dmlStatement()) {
      ctx.dmlStatement().accept(this);
    }
  }

  // createDatabase | createEvent | createIndex | createLogfileGroup | createProcedure | createFunction | createServer | createTable | createTablespaceInnodb | createTablespaceNdb | createTrigger | createView | createRole
  // | alterDatabase | alterEvent | alterFunction | alterInstance | alterLogfileGroup | alterProcedure | alterServer | alterTable | alterTablespace | alterView
  // | dropDatabase | dropEvent | dropIndex | dropLogfileGroup | dropProcedure | dropFunction | dropServer | dropTable | dropTablespace | dropTrigger | dropView | dropRole
  // | setRole| renameTable | truncateTable
  visitDdlStatement (ctx) {
    if (ctx.createTable()) {
      const createTableResult = ctx.createTable().accept(this);
      if (!createTableResult) return;

      const {
        tableName,
        schemaName,
        definitions,
        options,
      } = createTableResult;

      const [fieldsData, indexes, tableRefs, singlePkIndex] = definitions.reduce((acc, ele) => {
        if (ele.kind === TABLE_CONSTRAINT_KIND.FIELD) acc[0].push(ele.value);
        else if (ele.kind === TABLE_CONSTRAINT_KIND.INDEX) acc[1].push(ele.value);
        else if (ele.kind === TABLE_CONSTRAINT_KIND.UNIQUE) acc[1].push(ele.value);
        else if (ele.kind === TABLE_CONSTRAINT_KIND.FK) acc[2].push(ele.value);
        else if (ele.kind === TABLE_CONSTRAINT_KIND.PK) {
          /** @type {Index} */
          const index = ele.value;
          if (index.columns.length > 1) acc[1].push(ele.value);
          else acc[3] = index;
        }
        return acc;
      }, [[], [], [], null]);

      const inlineRefsOfFields = fieldsData.map(fieldData => {
        const { field, inlineRefs } = fieldData;

        if (field.type.type_name?.toLowerCase() === 'enum') {
          const values = field.type.args.map(arg => {
            const newValue = arg.replace(/'|"|`/g, '').trim();
            return {
              name: newValue,
            };
          });

          const _enum = new Enum({
            name: `${tableName}_${field.name}_enum`,
            schemaName,
            values,
          });

          field.type.type_name = _enum.name;
          field.type.schemaName = _enum.schemaName;

          this.data.enums.push(_enum);
        }

        inlineRefs.forEach((inlineRef) => {
          inlineRef.endpoints[0].tableName = tableName;
          inlineRef.endpoints[0].schemaName = schemaName;
          inlineRef.endpoints[0].fieldNames = [field.name];
        });

        return inlineRefs;
      });
      this.data.refs.push(...flatten(inlineRefsOfFields));

      this.data.refs.push(...tableRefs.map(tableRef => {
        tableRef.endpoints[0].tableName = tableName;
        tableRef.endpoints[0].schemaName = schemaName;
        return tableRef;
      }));

      const tableOptions = options.reduce((acc, option) => {
        acc[option.kind] = option.value;
        return acc;
      }, {});

      const table = new Table({
        name: tableName,
        schemaName,
        fields: fieldsData.map(fd => fd.field),
        indexes,
        ...tableOptions,
      });

      if (singlePkIndex) {
        const field = table.fields.find(f => f.name === singlePkIndex.columns[0].value);
        if (field) field.pk = true;
      }

      this.data.tables.push(table.toJSON());
    } else if (ctx.alterTable()) {
      ctx.alterTable().accept(this);
    } else if (ctx.createIndex()) {
      ctx.createIndex().accept(this);
    }
  }

  // createTable:
  // CREATE TEMPORARY? TABLE ifNotExists? tableName (LIKE tableName | '(' LIKE parenthesisTable = tableName ')') # copyCreateTable
  // | CREATE TEMPORARY? TABLE ifNotExists? tableName createDefinitions? (tableOption (','? tableOption)*)? partitionDefinitions? keyViolate = (IGNORE | REPLACE)? AS? selectStatement # queryCreateTable
  // | CREATE TEMPORARY? TABLE ifNotExists? tableName createDefinitions (tableOption (','? tableOption)*)? partitionDefinitions? # columnCreateTable
  visitCopyCreateTable (ctx) {
    // not supported
  }

  visitQueryCreateTable (ctx) {
    const names = ctx.tableName().accept(this);
    const { tableName, schemaName } = getTableNames(names);

    if (!ctx.createDefinitions()) return null;

    const definitions = ctx.createDefinitions().accept(this).filter(d => d?.kind);
    const options = ctx.tableOption()?.map(to => to.accept(this)).filter(o => o?.kind) || [];

    return {
      tableName,
      schemaName,
      definitions,
      options,
    };
  }

  visitColumnCreateTable (ctx) {
    const names = ctx.tableName().accept(this);
    const { tableName, schemaName } = getTableNames(names);

    const definitions = ctx.createDefinitions().accept(this).filter(d => d?.kind);
    const options = ctx.tableOption().map(to => to.accept(this)).filter(o => o?.kind);

    return {
      tableName,
      schemaName,
      definitions,
      options,
    };
  }

  // tableOption visits: check MySqlParser.g4 line 491.
  // Out of all these rules, We only care about tableOptionComment

  // COMMENT '='? STRING_LITERAL
  visitTableOptionComment (ctx) {
    const quotedString = ctx.STRING_LITERAL().getText();
    return {
      kind: TABLE_OPTIONS_KIND.NOTE,
      value: { value: quotedString.slice(1, quotedString.length - 1) },
    };
  }

  // fullId
  visitTableName (ctx) {
    return ctx.fullId().accept(this);
  }

  // uid (DOT_ID | '.' uid)?
  visitFullId (ctx) {
    const names = ctx.uid().map((u) => u.accept(this));

    if (ctx.DOT_ID()) {
      // DOT_ID: '.' ID_LITERAL
      const text = ctx.DOT_ID().getText();
      names.push(text.slice(1));
    }

    return names;
  }

  // simpleId | CHARSET_REVERSE_QOUTE_STRING | STRING_LITERAL
  visitUid (ctx) {
    if (ctx.simpleId()) return ctx.simpleId().accept(this);

    // both CHARSET_REVERSE_QOUTE_STRING and STRING_LITERAL contain outside quotes like '...', "..." or `...`
    const quotedString = ctx.getChild(0).getText();
    return quotedString.slice(1, quotedString.length - 1);
  }

  // ID | charsetNameBase | transactionLevelBase | engineNameBase | privilegesBase
  // | intervalTypeBase | dataTypeBase | keywordsCanBeId | scalarFunctionName
  visitSimpleId (ctx) {
    return ctx.getChild(0).getText();
  }

  // '(' createDefinition (',' createDefinition)* ')'
  visitCreateDefinitions (ctx) {
    return ctx.createDefinition().map(cd => cd.accept(this));
  }

  // createDefinition:
  // fullColumnName columnDefinition # columnDeclaration
  // | tableConstraint NOT? ENFORCED?  # constraintDeclaration
  // | indexColumnDefinition           # indexDeclaration
  visitColumnDeclaration (ctx) {
    const names = ctx.fullColumnName().accept(this);
    const { fieldName } = getFieldNames(names);

    const { type, constraints } = ctx.columnDefinition().accept(this);

    const field = new Field({
      name: fieldName,
      type,
      ...constraints,
    });

    return {
      kind: TABLE_CONSTRAINT_KIND.FIELD,
      value: {
        field,
        inlineRefs: constraints.inlineRefs,
      },
    };
  }

  visitConstraintDeclaration (ctx) {
    return ctx.tableConstraint().accept(this);
  }

  visitIndexDeclaration (ctx) {
    return ctx.indexColumnDefinition().accept(this);
  }

  // uid (dottedId dottedId?)? | .? dottedId dottedId?
  visitFullColumnName (ctx) {
    const names = [];

    if (ctx.uid()) names.push(ctx.uid().accept(this));

    names.push(...ctx.dottedId().map(dId => dId.accept(this)));

    return names;
  }

  // DOT_ID | '.' uid
  visitDottedId (ctx) {
    if (ctx.DOT_ID()) {
      // DOT_ID: '.' ID_LITERAL
      const text = ctx.DOT_ID().getText();
      return text.slice(1);
    }

    return ctx.uid().accept(this);
  }

  // dataType columnConstraint* NOT? ENFORCED?
  visitColumnDefinition (ctx) {
    const type = ctx.dataType().accept(this);

    const constraints = { inlineRefs: [] };

    ctx.columnConstraint().forEach(c => {
      const constraint = c.accept(this);
      if (!constraint) return;

      if (constraint.kind === COLUMN_CONSTRAINT_KIND.INLINE_REF) {
        constraints.inlineRefs.push(constraint.value);
        return;
      }

      constraints[constraint.kind] = constraint.value;
    });

    return {
      type,
      constraints,
    };
  }

  // dataType visits:
  // stringDataType | nationalVaryingStringDataType | nationalStringDataType | dimensionDataType | simpleDataType
  // | collectionDataType | spatialDataType | longVarcharDataType | longVarbinaryDataType

  // typeName = ( CHAR | CHARACTER | VARCHAR | TINYTEXT | TEXT | MEDIUMTEXT | LONGTEXT | NCHAR | NVARCHAR | LONG )
  // VARYING? lengthOneDimension? BINARY? (charSet charsetName)? (COLLATE collationName | BINARY)? # stringDataType
  visitStringDataType (ctx) {
    let typeName = ctx.typeName.text;

    if (ctx.lengthOneDimension()) typeName += ctx.lengthOneDimension().getText();

    return {
      type_name: typeName,
      schemaName: null,
    };
  }

  // NATIONAL typeName = (CHAR | CHARACTER) VARYING lengthOneDimension? BINARY?
  visitNationalVaryingStringDataType (ctx) {
    let typeName = ctx.typeName.text;

    if (ctx.lengthOneDimension()) typeName += ctx.lengthOneDimension().getText();

    return {
      type_name: typeName,
      schemaName: null,
    };
  }

  // NATIONAL typeName = (VARCHAR | CHARACTER | CHAR) lengthOneDimension? BINARY?
  // | NCHAR typeName = VARCHAR lengthOneDimension? BINARY?
  visitNationalStringDataType (ctx) {
    let typeName = ctx.typeName.text;

    if (ctx.lengthOneDimension()) typeName += ctx.lengthOneDimension().getText();

    return {
      type_name: typeName,
      schemaName: null,
    };
  }

  // typeName = (TINYINT | SMALLINT | MEDIUMINT | INT | INTEGER | BIGINT | MIDDLEINT | INT1 | INT2 | INT3 | INT4 | INT8) lengthOneDimension? (SIGNED | UNSIGNED | ZEROFILL)*
  // | typeName = REAL lengthTwoDimension? (SIGNED | UNSIGNED | ZEROFILL)*
  // | typeName = DOUBLE PRECISION? lengthTwoDimension? (SIGNED | UNSIGNED | ZEROFILL)*
  // | typeName = (DECIMAL | DEC | FIXED | NUMERIC | FLOAT | FLOAT4 | FLOAT8) lengthTwoOptionalDimension? (SIGNED | UNSIGNED | ZEROFILL)*
  // | typeName = (BIT | TIME | TIMESTAMP | DATETIME | BINARY | VARBINARY | BLOB | YEAR) lengthOneDimension?
  visitDimensionDataType (ctx) {
    let typeName = ctx.typeName.text;

    if (ctx.lengthOneDimension()) typeName += ctx.lengthOneDimension().getText();
    if (ctx.lengthTwoDimension()) typeName += ctx.lengthTwoDimension().getText();
    if (ctx.lengthTwoOptionalDimension()) typeName += ctx.lengthTwoOptionalDimension().getText();

    return {
      type_name: typeName,
      schemaName: null,
    };
  }

  // typeName = (DATE | TINYBLOB | MEDIUMBLOB | LONGBLOB | BOOL | BOOLEAN | SERIAL)
  visitSimpleDataType (ctx) {
    const typeName = ctx.typeName.text;

    return {
      type_name: typeName,
      schemaName: null,
    };
  }

  // typeName = (ENUM | SET) collectionOptions BINARY? (charSet charsetName)?
  visitCollectionDataType (ctx) {
    if (ctx.SET()) {
      const typeName = ctx.typeName.text + ctx.collectionOptions().getText();

      return {
        type_name: typeName,
        schemaName: null,
      };
    }

    const typeName = ctx.typeName.text;
    const args = ctx.collectionOptions().accept(this);

    return {
      type_name: typeName,
      args,
      schemaName: null,
    };
  }

  // '(' STRING_LITERAL (',' STRING_LITERAL)* ')'
  visitCollectionOptions (ctx) {
    return ctx.STRING_LITERAL().map(s => s.getText());
  }

  // typeName = (GEOMETRYCOLLECTION | GEOMCOLLECTION | LINESTRING | MULTILINESTRING | MULTIPOINT | MULTIPOLYGON | POINT | POLYGON | JSON | GEOMETRY) (SRID decimalLiteral)?
  visitSpatialDataType (ctx) {
    const typeName = ctx.typeName.text;

    return {
      type_name: typeName,
      schemaName: null,
    };
  }

  // typeName = LONG VARCHAR? BINARY? (charSet charsetName)? (COLLATE collationName)?
  visitLongVarcharDataType (ctx) {
    const typeName = ctx.typeName.text;

    return {
      type_name: typeName,
      schemaName: null,
    };
  }

  // LONG VARBINARY
  visitLongVarbinaryDataType (ctx) {
    const typeName = `${ctx.LONG().getText()} ${ctx.VARBINARY().getText()}`;

    return {
      type_name: typeName,
      schemaName: null,
    };
  }

  // columnConstraint visits:
  //   : nullNotnull                                                   # nullColumnConstraint
  //   | DEFAULT defaultValue                                          # defaultColumnConstraint
  //   | VISIBLE                                                       # visibilityColumnConstraint
  //   | INVISIBLE                                                     # invisibilityColumnConstraint
  //   | (AUTO_INCREMENT | ON UPDATE currentTimestamp)                 # autoIncrementColumnConstraint
  //   | PRIMARY? KEY                                                  # primaryKeyColumnConstraint
  //   | UNIQUE KEY?                                                   # uniqueKeyColumnConstraint
  //   | COMMENT STRING_LITERAL                                        # commentColumnConstraint
  //   | COLUMN_FORMAT colformat = (FIXED | DYNAMIC | DEFAULT)         # formatColumnConstraint
  //   | STORAGE storageval = (DISK | MEMORY | DEFAULT)                # storageColumnConstraint
  //   | referenceDefinition                                           # referenceColumnConstraint
  //   | COLLATE collationName                                         # collateColumnConstraint
  //   | (GENERATED ALWAYS)? AS '(' expression ')' (VIRTUAL | STORED)? # generatedColumnConstraint
  //   | SERIAL DEFAULT VALUE                                          # serialDefaultColumnConstraint
  //   | (CONSTRAINT name = uid?)? CHECK '(' expression ')'            # checkColumnConstraint

  // nullColumnConstraint: nullNotnull
  visitNullColumnConstraint (ctx) {
    return ctx.nullNotnull().accept(this);
  }

  // NOT? (NULL_LITERAL | NULL_SPEC_LITERAL)
  visitNullNotnull (ctx) {
    let notNull = false;
    if (ctx.NOT()) notNull = true;
    return { kind: COLUMN_CONSTRAINT_KIND.NOT_NULL, value: notNull };
  }

  // defaultColumnConstraint: DEFAULT defaultValue
  visitDefaultColumnConstraint (ctx) {
    return {
      kind: COLUMN_CONSTRAINT_KIND.DEFAULT,
      value: ctx.defaultValue().accept(this),
    };
  }

  // autoIncrementColumnConstraint: (AUTO_INCREMENT | ON UPDATE currentTimestamp)
  visitAutoIncrementColumnConstraint (ctx) {
    if (ctx.AUTO_INCREMENT()) {
      return {
        kind: COLUMN_CONSTRAINT_KIND.INCREMENT,
        value: true,
      };
    }

    return null;
  }

  // primaryKeyColumnConstraint: PRIMARY? KEY
  visitPrimaryKeyColumnConstraint (ctx) {
    if (ctx.PRIMARY()) {
      return {
        kind: COLUMN_CONSTRAINT_KIND.PK,
        value: true,
      };
    }

    return null;
  }

  // uniqueKeyColumnConstraint: UNIQUE KEY?
  visitUniqueKeyColumnConstraint (ctx) {
    return {
      kind: COLUMN_CONSTRAINT_KIND.UNIQUE,
      value: true,
    };
  }

  // commentColumnConstraint: COMMENT STRING_LITERAL
  visitCommentColumnConstraint (ctx) {
    const quotedString = ctx.STRING_LITERAL().getText();
    return {
      kind: COLUMN_CONSTRAINT_KIND.NOTE,
      value: { value: quotedString.slice(1, quotedString.length - 1) },
    };
  }

  // referenceColumnConstraint: referenceDefinition
  visitReferenceColumnConstraint (ctx) {
    const value = ctx.referenceDefinition().accept(this);
    return {
      kind: COLUMN_CONSTRAINT_KIND.INLINE_REF,
      value,
    };
  }

  // NULL_LITERAL | CAST '(' expression AS convertedDataType ')' | unaryOperator? constant
  // | currentTimestamp (ON UPDATE currentTimestamp)? | '(' expression ')' | '(' fullId ')'
  visitDefaultValue (ctx) {
    if (ctx.NULL_LITERAL()) {
      return {
        value: ctx.NULL_LITERAL().getText(),
        type: DATA_TYPE.BOOLEAN, // same behavior as the legacy parser
      };
    }

    if (ctx.expression()) {
      return {
        value: ctx.expression().getText(),
        type: DATA_TYPE.EXPRESSION,
      };
    }

    if (ctx.constant()) {
      if (ctx.unaryOperator()) {
        return {
          value: ctx.getText(),
          type: DATA_TYPE.EXPRESSION,
        };
      }

      const { value, type } = ctx.constant().accept(this);

      return {
        value,
        type,
      };
    }

    if (ctx.currentTimestamp()?.length) {
      return {
        value: ctx.currentTimestamp()[0].getText(),
        type: DATA_TYPE.EXPRESSION,
      };
    }

    return {
      value: ctx.getText(),
      type: DATA_TYPE.EXPRESSION,
    };
  }

  // stringLiteral | decimalLiteral | '-' decimalLiteral | hexadecimalLiteral | booleanLiteral
  // | REAL_LITERAL | BIT_STRING | NOT? nullLiteral = (NULL_LITERAL | NULL_SPEC_LITERAL)
  visitConstant (ctx) {
    if (ctx.stringLiteral()) {
      const quotedString = ctx.stringLiteral().getText();
      return {
        value: quotedString.slice(1, quotedString.length - 1),
        type: DATA_TYPE.STRING,
      };
    }

    if (ctx.decimalLiteral()) {
      if (ctx.getChildCount() > 1) {
        return {
          value: ctx.getText(),
          type: DATA_TYPE.EXPRESSION,
        };
      }

      return {
        value: ctx.decimalLiteral().getText(),
        type: DATA_TYPE.NUMBER,
      };
    }

    if (ctx.hexadecimalLiteral()) {
      return {
        value: ctx.hexadecimalLiteral().getText(),
        type: DATA_TYPE.NUMBER,
      };
    }

    if (ctx.booleanLiteral()) {
      return {
        value: ctx.booleanLiteral().getText(),
        type: DATA_TYPE.BOOLEAN,
      };
    }

    if (ctx.REAL_LITERAL()) {
      return {
        value: ctx.REAL_LITERAL().getText(),
        type: DATA_TYPE.NUMBER,
      };
    }

    if (ctx.BIT_STRING()) {
      return {
        value: ctx.BIT_STRING().getText(),
        type: DATA_TYPE.STRING,
      };
    }

    return {
      value: ctx.getText(),
      type: DATA_TYPE.STRING,
    };
  }

  // REFERENCES tableName indexColumnNames? (MATCH matchType = (FULL | PARTIAL | SIMPLE))? referenceAction?
  visitReferenceDefinition (ctx) {
    const names = ctx.tableName().accept(this);
    const { tableName, schemaName } = getTableNames(names);

    if (!ctx.indexColumnNames()) return null;

    const actions = ctx.referenceAction()?.accept(this) || {};

    const fieldNames = ctx.indexColumnNames().accept(this).map(icn => icn.value);

    const endpoint0 = new Endpoint({
      tableName: null,
      schemaName: null,
      fieldNames: null,
      relation: '*',
    });

    const endpoint1 = new Endpoint({
      tableName,
      schemaName,
      fieldNames,
      relation: '1',
    });

    return new Ref({
      endpoints: [
        endpoint0,
        endpoint1,
      ],
      onUpdate: actions.onUpdate,
      onDelete: actions.onDelete,
    });
  }

  // '(' indexColumnName (',' indexColumnName)* ')'
  visitIndexColumnNames (ctx) {
    return ctx.indexColumnName().map(indexColumnName => indexColumnName.accept(this));
  }

  // ((uid | STRING_LITERAL) ('(' decimalLiteral ')')? | expression) sortType = (ASC | DESC)?
  visitIndexColumnName (ctx) {
    if (ctx.uid()) {
      return {
        type: CONSTRAINT_TYPE.COLUMN,
        value: ctx.uid().accept(this),
      };
    }

    if (ctx.STRING_LITERAL()) {
      const quotedString = ctx.STRING_LITERAL().getText();
      return {
        type: CONSTRAINT_TYPE.STRING,
        value: quotedString.slice(1, quotedString.length - 1),
      };
    }

    return {
      type: CONSTRAINT_TYPE.EXPRESSION,
      value: ctx.expression().getText(),
    };
  }

  // ON DELETE onDelete = referenceControlType (ON UPDATE onUpdate = referenceControlType)?
  // | ON UPDATE onUpdate = referenceControlType (ON DELETE onDelete = referenceControlType)?
  visitReferenceAction (ctx) {
    const r = {};
    r.onDelete = ctx.onDelete?.accept(this);
    r.onUpdate = ctx.onUpdate?.accept(this);
    return r;
  }

  // RESTRICT | CASCADE  | SET NULL_LITERAL | NO ACTION | SET DEFAULT
  visitReferenceControlType (ctx) {
    const childIndices = [...Array(ctx.getChildCount()).keys()];
    const text = childIndices.reduce((acc, i) => `${acc}${ctx.getChild(i).getText()} `, '');
    return text.slice(0, text.length - 1); // remove the last whitespace
  }

  // tableConstraint:
  // (CONSTRAINT name = uid?)? PRIMARY KEY index = uid? indexType? indexColumnNames indexOption*                         # primaryKeyTableConstraint
  // | (CONSTRAINT name = uid?)? UNIQUE indexFormat = (INDEX | KEY)? index = uid? indexType? indexColumnNames indexOption* # uniqueKeyTableConstraint
  // | (CONSTRAINT name = uid?)? FOREIGN KEY index = uid? indexColumnNames referenceDefinition                             # foreignKeyTableConstraint
  // | (CONSTRAINT name = uid?)? CHECK '(' expression ')'                                                                  # checkTableConstraint

  // Note: In MySQL 8.0.16 and higher, 'index' is ignored. For maximum compability, we use both 'name' and 'index' for naming index
  // https://dev.mysql.com/doc/refman/8.0/en/create-table-foreign-keys.html
  visitPrimaryKeyTableConstraint (ctx) {
    const name = ctx.name?.accept(this) || ctx.index?.accept(this);

    let type = ctx.indexType()?.accept(this);
    if (ctx.indexOption()?.length) {
      const indexOptions = ctx.indexOption().map(io => io.accept(this));
      const typeOption = indexOptions.find(io => io?.kind === INDEX_OPTION_KIND.TYPE);
      if (typeOption) type = typeOption.value;
    }

    const columns = ctx.indexColumnNames().accept(this);

    return {
      kind: TABLE_CONSTRAINT_KIND.PK,
      value: new Index({
        name,
        pk: true,
        columns,
        type,
      }),
    };
  }

  visitUniqueKeyTableConstraint (ctx) {
    const name = ctx.name?.accept(this) || ctx.index?.accept(this);

    let type = ctx.indexType()?.accept(this);
    if (ctx.indexOption()?.length) {
      const indexOptions = ctx.indexOption().map(io => io.accept(this));
      const typeOption = indexOptions.find(io => io?.kind === INDEX_OPTION_KIND.TYPE);
      if (typeOption) type = typeOption.value;
    }

    const columns = ctx.indexColumnNames().accept(this);

    return {
      kind: TABLE_CONSTRAINT_KIND.UNIQUE,
      value: new Index({
        name,
        unique: true,
        columns,
        type,
      }),
    };
  }

  visitForeignKeyTableConstraint (ctx) {
    const ref = ctx.referenceDefinition().accept(this);
    ref.name = ctx.name?.accept(this) || ctx.index?.accept(this);
    ref.endpoints[0].fieldNames = ctx.indexColumnNames().accept(this).map(icn => icn.value);

    return {
      kind: TABLE_CONSTRAINT_KIND.FK,
      value: ref,
    };
  }

  visitCheckTableConstraint (ctx) {
    // ignored
  }

  // USING (BTREE | HASH)
  visitIndexType (ctx) {
    return ctx.getChild(1).getText();
  }

  // KEY_BLOCK_SIZE EQUAL_SYMBOL? fileSizeLiteral | indexType | WITH PARSER uid | COMMENT STRING_LITERAL | (VISIBLE | INVISIBLE)
  // | ENGINE_ATTRIBUTE EQUAL_SYMBOL? STRING_LITERAL | SECONDARY_ENGINE_ATTRIBUTE EQUAL_SYMBOL? STRING_LITERAL
  visitIndexOption (ctx) {
    if (ctx.indexType()) {
      return {
        kind: INDEX_OPTION_KIND.TYPE,
        value: ctx.indexType().accept(this),
      };
    }
    return null;
  }

  // indexColumnDefinition:
  // indexFormat = (INDEX | KEY) uid? indexType? indexColumnNames indexOption*            # simpleIndexDeclaration
  // | (FULLTEXT | SPATIAL) indexFormat = (INDEX | KEY)? uid? indexColumnNames indexOption* # specialIndexDeclaration
  visitSimpleIndexDeclaration (ctx) {
    const name = ctx.uid()?.accept(this);

    let type = ctx.indexType()?.accept(this);
    if (ctx.indexOption()?.length) {
      const indexOptions = ctx.indexOption().map(io => io.accept(this));
      const typeOption = indexOptions.find(io => io?.kind === INDEX_OPTION_KIND.TYPE);
      if (typeOption) type = typeOption.value;
    }

    const columns = ctx.indexColumnNames().accept(this);

    return {
      kind: TABLE_CONSTRAINT_KIND.INDEX,
      value: new Index({
        name,
        columns,
        type,
      }),
    };
  }

  visitSpecialIndexDeclaration (ctx) {
    const name = ctx.uid()?.accept(this);

    let type = null;
    if (ctx.indexOption()?.length) {
      const indexOptions = ctx.indexOption().map(io => io.accept(this));
      const typeOption = indexOptions.find(io => io?.kind === INDEX_OPTION_KIND.TYPE);
      if (typeOption) type = typeOption.value;
    }

    const columns = ctx.indexColumnNames().accept(this);

    return {
      kind: TABLE_CONSTRAINT_KIND.INDEX,
      value: new Index({
        name,
        columns,
        type,
      }),
    };
  }

  // ALTER intimeAction = (ONLINE | OFFLINE)? IGNORE? TABLE tableName waitNowaitClause? (alterSpecification (',' alterSpecification)*)? partitionDefinitions?
  visitAlterTable (ctx) {
    const names = ctx.tableName().accept(this);
    const { tableName, schemaName } = getTableNames(names);

    /** @type {Table} */
    const table = this.findTable(schemaName, tableName);
    if (!table) return;

    const alterSpecs = ctx.alterSpecification()?.map(spec => spec.accept(this)).filter(spec => spec?.kind) || [];

    alterSpecs.forEach(alter => {
      if (alter.kind === ALTER_KIND.ADD_PK) {
        /** @type {Index} */
        const index = alter.value;

        if (index.columns.length > 1) return table.indexes.push(index);

        const field = table.fields.find(f => f.name === index.columns[0].value);
        field.pk = true;
      } else if (alter.kind === ALTER_KIND.ADD_FK) {
        /** @type {Ref} */
        const ref = alter.value;

        ref.endpoints[0].schemaName = schemaName;
        ref.endpoints[0].tableName = tableName;

        this.data.refs.push(ref);
      }
      return null;
    });
  }

  // alterSpecification: for full rules breakdown check MySqlParser.g4 line 660.
  // The list below only containt alterSpecification rules that we will supported (should have same behaviors as the legacy parser):
  // alterByAddPrimaryKey | alterByAddForeignKey

  // ADD (CONSTRAINT name = uid?)? PRIMARY KEY index = uid? indexType? indexColumnNames indexOption*
  visitAlterByAddPrimaryKey (ctx) {
    const name = ctx.name?.accept(this) || ctx.index?.accept(this);

    let type = ctx.indexType()?.accept(this);
    if (ctx.indexOption()?.length) {
      const indexOptions = ctx.indexOption().map(io => io.accept(this));
      const typeOption = indexOptions.find(io => io?.kind === INDEX_OPTION_KIND.TYPE);
      if (typeOption) type = typeOption.value;
    }

    const columns = ctx.indexColumnNames().accept(this);

    return {
      kind: ALTER_KIND.ADD_PK,
      value: new Index({
        name,
        pk: true,
        columns,
        type,
      }),
    };
  }

  // ADD (CONSTRAINT name = uid?)? FOREIGN KEY indexName = uid? indexColumnNames referenceDefinition
  visitAlterByAddForeignKey (ctx) {
    const ref = ctx.referenceDefinition().accept(this);
    ref.name = ctx.name?.accept(this) || ctx.index?.accept(this);
    ref.endpoints[0].fieldNames = ctx.indexColumnNames().accept(this).map(icn => icn.value);

    return {
      kind: ALTER_KIND.ADD_FK,
      value: ref,
    };
  }

  // CREATE intimeAction = (ONLINE | OFFLINE)? indexCategory = (UNIQUE | FULLTEXT | SPATIAL)? INDEX uid indexType? ON tableName indexColumnNames
  // indexOption* (ALGORITHM EQUAL_SYMBOL? algType = (DEFAULT | INPLACE | COPY) | LOCK EQUAL_SYMBOL? lockType = (DEFAULT | NONE | SHARED | EXCLUSIVE))*
  visitCreateIndex (ctx) {
    const tableNames = ctx.tableName().accept(this);
    const { tableName, schemaName } = getTableNames(tableNames);

    const table = this.findTable(schemaName, tableName);
    if (!table) return;

    const name = ctx.uid().accept(this);

    let type = ctx.indexType()?.accept(this);
    if (ctx.indexOption()?.length) {
      const indexOptions = ctx.indexOption().map(io => io.accept(this));
      const typeOption = indexOptions.find(io => io?.kind === INDEX_OPTION_KIND.TYPE);
      if (typeOption) type = typeOption.value;
    }

    const columns = ctx.indexColumnNames().accept(this);

    const index = new Index({
      name,
      columns,
      unique: !!ctx.UNIQUE(),
      type,
    });

    table.indexes.push(index);
  }

  // dmlStatement
  //   : selectStatement | insertStatement | updateStatement | deleteStatement | replaceStatement |
  // callStatement | loadDataStatement | loadXmlStatement | doStatement | handlerStatement | valuesStatement | withStatement | tableStatement ;
  visitDmlStatement (ctx) {
    if (ctx.insertStatement()) {
      ctx.insertStatement().accept(this);
      return;
    }
  }

  // insertStatement
  //   : INSERT priority = (LOW_PRIORITY | DELAYED | HIGH_PRIORITY)? IGNORE? INTO? tableName (
  //       PARTITION '(' partitions = uidList? ')'
  //   )? (
  //       ('(' columns = fullColumnNameList? ')')? insertStatementValue (AS? uid)?
  //       | SET setFirst = updatedElement (',' setElements += updatedElement)*
  //   ) (
  //       ON DUPLICATE KEY UPDATE duplicatedFirst = updatedElement (
  //           ',' duplicatedElements += updatedElement
  //       )*
  //   )?
  //   ;
  visitInsertStatement (ctx) {
    const names = ctx.tableName().accept(this);
    const tableName = last(names);
    const schemaName = names.length > 1 ? names[names.length - 2] : undefined;
    const fullTableName = `${schemaName && shouldPrintSchemaName(schemaName) ? `${schemaName}.` : ''}${tableName}`;

    // insert without specified columns
    const columns = ctx.fullColumnNameList()?.accept(this) || [];
    const values = ctx.insertStatementValue().accept(this);

    if (columns.length === 0 || values.length === 0) {
      return;
    }

    if (!this.data.records[fullTableName]) {
      this.data.records[fullTableName] = {
        schemaName,
        tableName,
        columns,
        values: [],
      };
    }
    this.data.records[fullTableName].values.push(...values);
  }

  // fullColumnNameList
  //   : fullColumnName (',' fullColumnName)*
  //   ;
  visitFullColumnNameList (ctx) {
    // [ [ 'id' ], [ 'name' ], [ 'email' ], [ 'created_at' ] ]
    const columns = ctx.fullColumnName().map((fullColumn) => fullColumn.accept(this));
    return flattenDepth(columns, 1);
  }

  // insertStatementValue
  //   : selectStatement
  //   | insertFormat = (VALUES | VALUE) '(' expressionsWithDefaults? ')' (
  //       ',' '(' expressionsWithDefaults? ')'
  //   )*
  //   ;
  visitInsertStatementValue (ctx) {
    return ctx.expressionsWithDefaults().map((expression) => {
      // [
      //   [ { value: '1', type: 'number' } ],
      //   [ { value: 'Alice', type: 'string' } ],
      //   [ { value: 'alice@host', type: 'string' } ],
      //   [ { value: '2021-01-01', type: 'string' } ],
      //   [ { value: '2021-01-01', type: 'string' } ],
      // ]
      const rowValues = expression.accept(this);
      return flattenDepth(rowValues, 1);
    });
  }

  // expressionsWithDefaults
  //   : expressionOrDefault (',' expressionOrDefault)*
  //   ;
  visitExpressionsWithDefaults (ctx) {
    return ctx.expressionOrDefault().map((expressionOrDefault) => {
      const rawValues = expressionOrDefault.accept(this);

      // We get the value of the column (constantExpressionAtom or functionCallExpressionAtom) through:
      // expression->predicate->expressionAtom
      const FLATTEN_DEPTH = 3;
      const rawColumnValues = flattenDepth(rawValues, FLATTEN_DEPTH);
      // [ { value: '["555-1234", "555-5678"]', type: 'string' } ]
      return rawColumnValues;
    });
  }

  // predicate
  //   : predicate NOT? IN '(' (selectStatement | expressions) ')'                            # inPredicate
  //   | predicate IS nullNotnull                                                             # isNullPredicate
  //   | left = predicate comparisonOperator right = predicate                                # binaryComparisonPredicate
  //   | predicate comparisonOperator quantifier = (ALL | ANY | SOME) '(' selectStatement ')' # subqueryComparisonPredicate
  //   | predicate NOT? BETWEEN predicate AND predicate                                       # betweenPredicate
  //   | predicate SOUNDS LIKE predicate                                                      # soundsLikePredicate
  //   | predicate NOT? LIKE predicate (ESCAPE STRING_LITERAL)?                               # likePredicate
  //   | predicate NOT? regex = (REGEXP | RLIKE) predicate                                    # regexpPredicate
  //   | predicate MEMBER OF '(' predicate ')'                                                # jsonMemberOfPredicate
  //   | expressionAtom                                                                       # expressionAtomPredicate
  //   ;

  // expressionAtom
  //   : constant                                                  # constantExpressionAtom
  //   | fullColumnName                                            # fullColumnNameExpressionAtom
  //   | functionCall                                              # functionCallExpressionAtom
  //   | expressionAtom COLLATE collationName                      # collateExpressionAtom
  //   | mysqlVariable                                             # mysqlVariableExpressionAtom
  //   | unaryOperator expressionAtom                              # unaryExpressionAtom
  //   | BINARY expressionAtom                                     # binaryExpressionAtom
  //   | LOCAL_ID VAR_ASSIGN expressionAtom                        # variableAssignExpressionAtom
  //   | '(' expression (',' expression)* ')'                      # nestedExpressionAtom
  //   | ROW '(' expression (',' expression)+ ')'                  # nestedRowExpressionAtom
  //   | EXISTS '(' selectStatement ')'                            # existsExpressionAtom
  //   | '(' selectStatement ')'                                   # subqueryExpressionAtom
  //   | INTERVAL expression intervalType                          # intervalExpressionAtom
  //   | left = expressionAtom bitOperator right = expressionAtom  # bitExpressionAtom
  //   | left = expressionAtom multOperator right = expressionAtom # mathExpressionAtom
  //   | left = expressionAtom addOperator right = expressionAtom  # mathExpressionAtom
  //   | left = expressionAtom jsonOperator right = expressionAtom # jsonExpressionAtom
  //   ;

  // functionCall
  //   : specificFunction                         # specificFunctionCall
  //   | aggregateWindowedFunction                # aggregateFunctionCall
  //   | nonAggregateWindowedFunction             # nonAggregateFunctionCall
  //   | scalarFunctionName '(' functionArgs? ')' # scalarFunctionCall
  //   | fullId '(' functionArgs? ')'             # udfFunctionCall
  //   | passwordFunctionClause                   # passwordFunctionCall
  //   ;
  visitFunctionCallExpressionAtom (ctx) {
    return {
      value: ctx.getText(),
      type: DATA_TYPE.EXPRESSION,
    }
  }
}
