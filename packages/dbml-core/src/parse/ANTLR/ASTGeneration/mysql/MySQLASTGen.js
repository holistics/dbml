/* eslint-disable class-methods-use-this */
import { last, flatten } from 'lodash';
import MySQLParserVisitor from '../../parsers/mysql/MySqlParserVisitor';
import { Endpoint, Enum, Field, Index, Table, Ref } from '../AST';
import { TABLE_CONSTRAINT_KIND, COLUMN_CONSTRAINT_KIND, DATA_TYPE, CONSTRAINT_TYPE } from '../constants';

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

      const { tableName, schemaName, definitions } = createTableResult;

      const [fieldsData, indexes, tableRefs] = definitions.reduce((acc, ele) => {
        if (ele.kind === TABLE_CONSTRAINT_KIND.FIELD) acc[0].push(ele.value);
        else if (ele.kind === TABLE_CONSTRAINT_KIND.INDEX) acc[1].push(ele.value);
        else if (ele.kind === TABLE_CONSTRAINT_KIND.UNIQUE) acc[1].push(ele.value);
        else if (ele.kind === TABLE_CONSTRAINT_KIND.FK) acc[2].push(ele.value);
        return acc;
      }, [[], [], []]);

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

      const table = new Table({
        name: tableName,
        schemaName,
        fields: fieldsData.map(fd => fd.field),
        indexes,
      });

      this.data.tables.push(table.toJSON());
    }
  }

  // createTable:
  // CREATE TEMPORARY? TABLE ifNotExists? tableName (LIKE tableName | '(' LIKE parenthesisTable = tableName ')') # copyCreateTable
  // | CREATE TEMPORARY? TABLE ifNotExists? tableName createDefinitions? (tableOption (','? tableOption)*)? partitionDefinitions? keyViolate = (IGNORE | REPLACE)? AS? selectStatement # queryCreateTable
  // | CREATE TEMPORARY? TABLE ifNotExists? tableName createDefinitions (tableOption (','? tableOption)*)? partitionDefinitions? # columnCreateTable
  visitCopyCreateTable (ctx) {
    // not supported since there's no column definitions
    // const names = ctx.tableName()[0].accept(this);
    // const { tableName, schemaName } = getTableNames(names);
  }

  visitQueryCreateTable (ctx) {
    const names = ctx.tableName().accept(this);
    const { tableName, schemaName } = getTableNames(names);

    if (!ctx.createDefinitions()) return null;

    const definitions = ctx.createDefinitions().accept(this).filter(d => d);

    return { tableName, schemaName, definitions };
  }

  visitColumnCreateTable (ctx) {
    const names = ctx.tableName().accept(this);
    const { tableName, schemaName } = getTableNames(names);

    const definitions = ctx.createDefinitions().accept(this).filter(d => d);

    return { tableName, schemaName, definitions };
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
    // TODO
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
    const typeName = ctx.getText();

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
        value: ctx.NULL_LITERAL.getText(),
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

    return {
      value: ctx.getText(),
      type: DATA_TYPE.BOOLEAN,
    };
  }

  // stringLiteral | decimalLiteral | '-' decimalLiteral | hexadecimalLiteral | booleanLiteral
  // | REAL_LITERAL | BIT_STRING | NOT? nullLiteral = (NULL_LITERAL | NULL_SPEC_LITERAL)
  visitConstant (ctx) {
    if (ctx.stringLiteral()) {
      return {
        value: ctx.stringLiteral().getText(),
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

    const fieldNames = ctx.indexColumnNames().accept(this);

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
    if (ctx.uid()) return ctx.uid().accept(this);

    const quotedString = ctx.STRING_LITERAL().getText();
    return quotedString.slice(1, quotedString.length - 1);
  }

  // ON DELETE onDelete = referenceControlType (ON UPDATE onUpdate = referenceControlType)?
  // | ON UPDATE onUpdate = referenceControlType (ON DELETE onDelete = referenceControlType)?
  visitReferenceAction (ctx) {
    const r = {};
    if (ctx.DELETE()) r.onDelete = ctx.onDelete.text;
    if (ctx.UPDATE()) r.onUpdate = ctx.onUpdate.text;
    return r;
  }

  // tableConstraint:
  // (CONSTRAINT name = uid?)? PRIMARY KEY index = uid? indexType? indexColumnNames indexOption*                         # primaryKeyTableConstraint
  // | (CONSTRAINT name = uid?)? UNIQUE indexFormat = (INDEX | KEY)? index = uid? indexType? indexColumnNames indexOption* # uniqueKeyTableConstraint
  // | (CONSTRAINT name = uid?)? FOREIGN KEY index = uid? indexColumnNames referenceDefinition                             # foreignKeyTableConstraint
  // | (CONSTRAINT name = uid?)? CHECK '(' expression ')'                                                                  # checkTableConstraint

  // Note: In MySQL 8.0.16 and higher, 'index' is ignored. For maximum compability, we use both 'name' and 'index' for naming index
  // https://dev.mysql.com/doc/refman/8.0/en/create-table-foreign-keys.html
  visitPrimaryKeyTableConstraint (ctx) {
    const columns = ctx.indexColumnNames().accept(this).map(columnName => ({
      type: CONSTRAINT_TYPE.COLUMN,
      value: columnName,
    }));

    return {
      kind: TABLE_CONSTRAINT_KIND.INDEX,
      value: new Index({
        name: ctx.name?.accept(this) || ctx.index?.accept(this),
        pk: true,
        columns,
        type: ctx.indexType()?.accept(this),
      }),
    };
  }

  visitUniqueKeyTableConstraint (ctx) {
    // TODO
  }

  visitForeignKeyTableConstraint (ctx) {
    // TODO
  }

  visitCheckTableConstraint (ctx) {
    // TODO
  }

  // USING (BTREE | HASH)
  visitIndexType (ctx) {
    return ctx.getChild(1).getText();
  }
}
