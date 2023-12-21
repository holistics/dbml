/* eslint-disable class-methods-use-this */
import { last, flatten } from 'lodash';
import MySQLParserVisitor from '../../parsers/mysql/MySqlParserVisitor';
import { Enum, Field, Index, Table } from '../AST';

const TABLE_CONSTRAINT_KIND = {
  FIELD: 'field',
  INDEX: 'index',
  FK: 'fk',
  UNIQUE: 'unique',
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
      ctx.createTable().accept(this);
    }
  }

  // CREATE TEMPORARY? TABLE ifNotExists? tableName (LIKE tableName | '(' LIKE parenthesisTable = tableName ')') # copyCreateTable
  // | CREATE TEMPORARY? TABLE ifNotExists? tableName createDefinitions? (tableOption (','? tableOption)*)? partitionDefinitions? keyViolate = (IGNORE | REPLACE)? AS? selectStatement # queryCreateTable
  // | CREATE TEMPORARY? TABLE ifNotExists? tableName createDefinitions (tableOption (','? tableOption)*)? partitionDefinitions? # columnCreateTable
  visitCopyCreateTable (ctx) {
    const names = ctx.tableName()[0].accept(this);
    const { tableName, schemaName } = getTableNames(names);

    console.log(0, tableName, schemaName);
  }

  visitQueryCreateTable (ctx) {
    const names = ctx.tableName().accept(this);
    const { tableName, schemaName } = getTableNames(names);

    if (ctx.createDefinitions()) {
      const definitions = ctx.createDefinitions().accept(this).filter(d => d);
      const [fieldsData] = definitions.reduce((acc, ele) => {
        if (ele.kind === TABLE_CONSTRAINT_KIND.FIELD) acc[0].push(ele.value);

        return acc;
      }, [[]]);

      const table = new Table({
        name: tableName,
        schemaName,
        fields: fieldsData.map(fd => fd.field),
      });

      this.data.tables.push(table.toJSON());
    }
  }

  visitColumnCreateTable (ctx) {
    const names = ctx.tableName().accept(this);
    const { tableName, schemaName } = getTableNames(names);

    const definitions = ctx.createDefinitions().accept(this).filter(d => d);
    const [fieldsData] = definitions.reduce((acc, ele) => {
      if (ele.kind === TABLE_CONSTRAINT_KIND.FIELD) acc[0].push(ele.value);

      return acc;
    }, [[]]);

    fieldsData.map(fieldData => {
      const { field, inline_refs } = fieldData;

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
    });

    const table = new Table({
      name: tableName,
      schemaName,
      fields: fieldsData.map(fd => fd.field),
    });

    this.data.tables.push(table.toJSON());
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

  // fullColumnName columnDefinition # columnDeclaration
  // | tableConstraint NOT? ENFORCED?  # constraintDeclaration
  // | indexColumnDefinition           # indexDeclaration
  visitColumnDeclaration (ctx) {
    const names = ctx.fullColumnName().accept(this);
    const { fieldName } = getFieldNames(names);

    const { type, constraints } = ctx.columnDefinition().accept(this);

    console.log(4, constraints);

    const field = new Field({
      name: fieldName,
      type,
    });

    return {
      kind: TABLE_CONSTRAINT_KIND.FIELD,
      value: {
        field,
        inline_refs: [],
      },
    };
  }

  visitConstraintDeclaration (ctx) {
  }

  visitIndexDeclaration (ctx) {
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

    const constraints = ctx.columnConstraint().map(c => c.accept(this));

    return {
      type,
      constraints,
    };
  }

  // dataType visits: stringDataType | nationalVaryingStringDataType | nationalStringDataType | dimensionDataType | simpleDataType | collectionDataType | spatialDataType | longVarcharDataType | longVarbinaryDataType

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
}
