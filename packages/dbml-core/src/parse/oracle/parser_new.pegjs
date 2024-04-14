{

        const tables = [];
        const refs = [];
        const enums = [];
        const warnings = [];


  // intput:
  // `
  //      'created'
  //                   ,
  //         'pending',          'done'
  //  `
  //  => `'created', 'pending', 'done'`
  const removeReduntdantSpNewline = (str) => {
    const arr = str.split(/[\s\r\n]*,[\s\r\n]*/);
    // need to trim spaces and newlines of the first and last element
    const arrAfterTrim = arr.map(ele => {
      return ele.replace(/^[\s]+|[\s]+$|[\r\n]|\s(?=\s)/g, '');
    });
    return arrAfterTrim.join(', ');
  }

  // TODO: support configurable default schema name other than 'public'
  const findTable = (schemaName, tableName) => {
    const realSchemaName = schemaName || 'public';
    const table = tables.find(table => {
      const targetSchemaName = table.schemaName || 'public';
      return targetSchemaName === realSchemaName && table.name === tableName;
    });
    return table;
  };

  const findField = (table, fieldName) => table.fields.find(field => field.name === fieldName);

}
parser = commands:command* {
        commands.forEach((cmd) => {
                const { command_name, value: { syntax_name, value }, warning } = cmd;
                switch(command_name.toLowerCase()){
                        case "create_table":
                                const table = value;
                                switch(syntax_name.toLowerCase()) {
                                        case "create_table_normal":
                                                tables.push(table);

                                                const pkList = [];

                                                table.fields.forEach(field => {
                                                        // process inline_refs
                                                        if (field.inline_refs) {
                                                                refs.push(...field.inline_refs.map(ref => {
                                                                        return {
                                                                                name: ref.name,
                                                                                endpoints: [
                                                                                        {
                                                                                                tableName: table.name,
                                                                                                schemaName: table.schemaName,
                                                                                                fieldNames: [field.name],
                                                                                                relation: "*",
                                                                                        },
                                                                                        ref.endpoint
                                                                                ],
                                                                                onDelete: ref.onDelete,
                                                                                onUpdate: ref.onUpdate
                                                                        }
                                                                }));
                                                        }

                                                        // process composite primary key, if primary key is in composite form, push it into indexes
                                                        if (field.pk) {
                                                                pkList.push(field);
                                                        }
                                                });

                                                if (pkList.length > 1) {
                                                        table.fields = table.fields.map((field) => {
                                                                delete field.pk
                                                                return field;
                                                        });

                                                        const index = {
                                                                columns: pkList.map(field => ({
                                                                        value: field.name,
                                                                        type: 'column'
                                                                })),
                                                                pk: true
                                                        };

                                                        if (table.indexes) {
                                                                table.indexes.push(index);
                                                        } else {
                                                                table.indexes = [index];
                                                        }
                                                }
                                                break;
                                        case "create_table_of":
                                                break;
                                        case "create_table_partition_of":
                                                break;
                                }
                                break;
                        case "create_index":
                                const { table_name } = value;
                                delete value.table_name; // remove table_name from column
        const table_index = findTable(table_name.schemaName, table_name.name);
                                if (table_index.indexes) {
                                        table_index.indexes.push(value);
                                } else {
                                        table_index.indexes = [value];
                                }
                                break;
                        case "create_type":
                                switch(syntax_name.toLowerCase()) {
                                        case "create_type_enum":
                                                enums.push(value);
                                                break;
                                        case "create_type_range":
                                                break;
                                }
                                break;
                        case "alter_table":
                                switch(syntax_name.toLowerCase()) {
                                        case "alter_table_action":
                                                value.forEach(v => {
                                                        const { type } = v;
                                                        switch(type.toLowerCase()) {
                                                                case "fk":
                                                                        v.t_value.forEach(endpoints => {
                                                                                refs.push(endpoints);
                                                                        })
                                                        }
                                                })
                                                break;
                                }
                                break;
                        case "comment":
                                switch(syntax_name.toLowerCase()) {
                                        case "column": {
                                                const { schemaName, tableName, columnName } = value;
                                                const foundTable = findTable(schemaName, tableName);
                                                if (foundTable) {
                                                        const foundField = findField(foundTable, columnName);
                                                        if (foundField) foundField.note = value.text ? { value: value.text } : null;
                                                }
                                                break;
                                        }
                                        case "table":   {
                                                const { schemaName, name: tableName } = value.table_name;
                                                const foundTable = findTable(schemaName, tableName);
                                                if (foundTable) foundTable.note = value.text ? { value: value.text } : null;
                                                break;
                                        }
                                }
                                break;
                        case "ignore_syntax":
                                // warnings.push(warning);
                                break;
                }
        })

        return {tables, refs, enums};
}


CREATE = "CREATE"i
ALTER = "ALTER"i
UNIQUE = "UNIQUE"i
INDEX = "INDEX"i
TYPE = "TYPE"i
ENUM = "ENUM"i
CONCURRENTLY = "CONCURRENLY"i
FOREIGN_KEY = "FOREIGN"i __ "KEY"i
REFERENCES = "REFERENCES"i
ON = "ON"i
USING = "USING"i
TABLE = "TABLE"i
IF_NOT_EXISTS = "IF"i __ "NOT"i __ "EXISTS"i
IF_EXISTS = "IF"i __ "EXISTS"i
GLOBAL = "GLOBAL"i
LOCAL = "LOCAL"i
TEMPORARY = "TEMPORARY"i
TEMP = "TEMP"i
UNLOGGED = "UNLOGGED"i
COLLATE = "COLLATE"i
COLLATION = "COLLATION"i
PARTITION = "PARTITION"i
BY = "BY"i
RANGE = "RANGE"i
LIST = "LIST"i
HASH = "HASH"i
LIKE = "LIKE"i
INHERITS = "INHERITS"i
INHERIT = "INHERIT"i
WITH = "WITH"i
WITHOUT = "WITHOUT"i
OIDS = "OIDS"i
COMMIT = "COMMIT"i
PRESERVE = "PRESERVE"i
ROWS = "ROWS"i
DELETE = "DELETE"i
DROP = "DROP"i
TABLESPACE = "TABLESPACE"i
CONSTRAINT = "CONSTRAINT"i
NO = "NO"i
NOT = "NOT"i
NULL = "NULL"i
CHECK = "CHECK"i
DEFAULT = "DEFAULT"i
PRIMARY_KEY = "PRIMARY"i __ "KEY"i
MATCH = "MATCH"i
FULL = "FULL"i
PARTIAL = "PARTIAL"i
SIMPLE = "SIMPLE"i
UPDATE = "UPDATE"i
DEFERRABLE = "DEFERRABLE"i
INITIALLY = "INITIALLY"i
DEFERRED = "DEFERRED"i
IMMEDIATE = "IMMEDIATE"i
EXCLUDE = "EXCLUDE"i
WHERE = "WHERE"i
INCLUDING = "INCLUDING"i
EXCLUDING = "EXCLUDING"i
COMMENTS = "COMMENTS"i
CONSTRAINTS = "CONSTRAINTS"i
GENERATED = "GENERATED"i
ALWAYS = "ALWAYS"i
AS = "AS"i
ADD = "ADD"i
ONLY = "ONLY"i
DEFAULTS = "DEFAULTS"i
IDENTITY = "IDENTITY"i
INDEXES = "INDEXES"i
STATISTICS = "STATISTICS"i
STORAGE = "STORAGE"i
INCLUDE = "INCLUDE"i
INCLUDES = "INCLUDES"i
ALL = "ALL"i
OF = "OF"i
OPTIONS = "OPTIONS"i
FOR = "FOR"i
VALUES = "VALUES"i
IN = "IN"i
FROM = "FROM"i
TO = "TO"i
MODULUS = "MODULUS"i
REMAINDER = "REMAINDER"i
TRUE = "TRUE"i
FALSE = "FALSE"i
MAXVALUE = "MAXVALUE"i
MINVALUE = "MINVALUE"i
SUBTYPE = "SUBTYPE"i
SUBTYPE_OPCLASS = "SUBTYPE_OPCLASS"i
CANONICAL = "CANONICAL"i
SUBTYPE_DIFF = "SUBTYPE_DIFF"i
VALID = "VALID"i
COLUMN = "COLUMN"i
SET = "SET"i
DATA = "DATA"i
RESET = "RESET"i
PLAIN = "PLAIN"i
EXTERNAL = "EXTERNAL"i
EXTENDED = "EXTENDED"i
MAIN = "MAIN"i
ASC = "ASC"i
DESC = "DESC"i
NULLS = "NULLS"i
FIRST = "FIRST"i
LAST = "LAST"i
COMMENT = "COMMENT"i
IS = "IS"
INSERT = "INSERT"i
SELECT = "SELECT"i
USE = "USE"i
SEQUENCE = "SEQUENCE"i
SCHEMA = "SCHEMA"i
VIEW = "VIEW"i
RENAME = "RENAME"i
OWNED = "OWNED"i
ATTACH = "ATTACH"i
DETACH = "DETACH"i
expression "expression" = factors:factor* {
        return removeReduntdantSpNewline(_.flattenDeep(factors).join(""));
}
factor = factors:(character+ _ "(" expression ")"
        / "(" expression ")"
        / (exprCharNoCommaSpace+ &(_/","/");"/endline");")) / exprChar+ &.) {
        return _.flattenDeep(factors).join("");
}

exprChar = [\"\',.a-z0-9_+-:<>=!*]i
        / sp
        / newline
        / tab
exprCharNoCommaSpace = [\'.a-z0-9_+-]i
column_name "valid column name" = identifier

path_name = names:(identifier _ "." _)* {
  let dbName = null;
  let schemaName = null;
  if (names && names.length > 0) {
    if (names.length === 1) schemaName = names[0][0];
    else {
      dbName = names[0][0];
      schemaName = names[1][0];
    }
  }
  return { dbName, schemaName }
}

table_name "valid table name" = pathName:path_name name:identifier {
  return { ...pathName, name }
}

enum_name "valid enum name" = pathName:path_name? name:identifier {
  return { ...pathName, name }
}

// string constant
string_constant "string" = "'" c:char_inside_single_quote+ "'" {
        return c.join('');
}
char_inside_single_quote = "''" { return "'" }
        / [^\']

// identifier (table name, column name)
identifier = '"' c:char_inside_double_quote+ '"' {
                return c.join('');
        }
        / c:character+ {
                return c.join('');
        }
char_inside_double_quote = '""' { return '"' }
        / [^\"]

// numeric constant
numeric_constant "number" = a:(digits "." digits? ("e" ("+"/"-")? digits)?
        / digits? "." digits ("e" ("+"/"-")? digits)?
        / digits "e" ("+"/"-")? digits) {
                return _.flattenDeep(a).filter(ele => ele).join('');
        }
        / digits
digits = d:digit+ { return d.join('') }
digit = [0-9]

// type
data_type "VALID TYPE" = c1:"CHARACTER"i _ c2:"VARYING"i _ args:("("expression")")? dimensions:(array_extension)? {
  let c = `${c1} ${c2}`;
  c = args ? c + '(' + args[1] + ')' : c;
  return {
    type_name: c + (dimensions ? dimensions.map((dimension) => '[' + dimension + ']').join('') : ''),
    args: args ? args[1] : null
  }
}
/ "timestamptz"i _ number:("(" _ numeric_constant _ ")" _)? dimensions:(array_extension)? {
    const args = number ? number[2] : null;
    return {
      type_name: (args !== null ? `timestamptz(${args})`: `timestamptz`) + (dimensions ? dimensions.map((dimension) => '[' + dimension + ']').join('') : ''),
      args
    }
  }
/ "timestamp"i _ number:("(" _ numeric_constant _ ")" _)? (("without"i/"with"i) _ "time"i _ "zone"i)? dimensions:(array_extension)? {
  const args = number ? number[2] : null;
  return {
    type_name: (args !== null ? `timestamp(${args})`: `timestamp`) + (dimensions ? dimensions.map((dimension) => '[' + dimension + ']').join('') : ''),
    args
  }
}
/ "timetz"i _ number:("(" _ numeric_constant _ ")" _)? dimensions:(array_extension)? {
    const args = number ? number[2] : null;
    return {
      type_name: (args !== null ? `timetz(${args})`: `timetz`) + (dimensions ? dimensions.map((dimension) => '[' + dimension + ']').join('') : ''),
      args
    }
  }
/ "time"i _ number:("(" _ numeric_constant _ ")" _)? (("without"i/"with"i) _ "time"i _ "zone"i)? dimensions:(array_extension)? {
  const args = number ? number[2] : null;
  return {
    type_name: (args !== null ? `time(${args})`: `time`) + (dimensions ? dimensions.map((dimension) => '[' + dimension + ']').join('') : ''),
    args
  }
}

/ c:type_name dimensions:(array_extension)? {
          const args = c.args;
    return {
      type_name: c.type_name + (dimensions ? dimensions.map((dimension) => '[' + dimension + ']').join('') : ''),
      schemaName: c.schemaName,
      args
    };
        }
/ double_quote c:[^\"\n]+ double_quote {
  return {
    type_name: c.join(""),
    args: null
  }
}

type_name = pathName:path_name? c:(character)+ _ args:("(" expression ")")? {
        let type_name = c.join("");
        args = args ? args[1] : null;
        if (type_name.toLowerCase() !== 'enum') {
                type_name = args ? type_name + '(' + args + ')' : type_name;
        }

        return {
    ...pathName,
                type_name,
                args
        }
}
//https://www.postgresql.org/docs/13/arrays.html
array_extension = _ "array"i  singledimenson:(_ "[" _ expression _ "]")? {
    return [singledimenson ? singledimenson[3] : ''];
        }
        / _ multidimenson:("[" _ expression _ "]")+ {
    // this will parse into Array(Array('[', _ , expression , _ ']'))
    return multidimenson.map((dimension) => dimension[2]);
  }

// Default
default_expr = val:string_constant { return { value: val, type: 'string' }}
        / val: numeric_constant { return { value: val, type: 'number' }}
        / val:("TRUE"i / "FALSE"i /"NULL"i) { return { value: val, type: 'boolean' }}
        / val:factor {
                let str = val;
                if (val && val.length > 2 && val[0] === '(' && val[val.length - 1] === ')') {
                        str = val.slice(1, -1);
                }
                return {
                        value: str,
                        type: 'expression'
                };
        }

sp = " "
double_quote = "\""
single_quote = "'"
comma = ","
tab = "\t"
semicolon = ";"
endline "endline" = sp* newline
newline "newline" = "\r\n" / "\n"
_ "space" = (cmt/sp/tab/newline)*
__ "space" = (cmt/sp/tab/newline)+
cmt "comment" = "--" [^\n]* / "/*" (!"*/" .)* "*/" semicolon?
character "letter, number or underscore" = [a-z0-9_]i
operator = "&&" / "=" // using for EXCLUDE in Create_table


create_table_normal =
        _ CREATE __ ( ( GLOBAL __ / LOCAL __ )? ( TEMPORARY / TEMP ) __ / UNLOGGED __)? TABLE (__ IF_NOT_EXISTS)? __ table_name:table_name _ "(" _
        table_properties:table_properties _ ")"
        (__ INHERITS _ "(" _ parent_tables:table_names _ ")")?
        (__ PARTITION __ BY __ (RANGE/LIST/HASH) _ "(" _ (column_name/"("_ expression _ ")") (__ COLLATE __ collation:identifier)? (__ opclasses)? _ ")" )?
        (__ WITH _ "(" _ storage_parameters _ ")"/__ WITH __ OIDS/__ WITHOUT __ OIDS)?
        (__ ON __ COMMIT __ (PRESERVE __ ROWS/ DELETE __ ROWS/ DROP))?
        (__ TABLESPACE __ tablespace_name:identifier)?
        _ semicolon _ {
                const table = { name: table_name.name, schemaName: table_name.schemaName, fields: [], indexes: [] }
                // process table_properties
                table_properties.forEach(({ table_property_name, value }) => {
                        switch(table_property_name.toLowerCase()) {
                                case "column":
                                        // if column contains inline_refs
                                        // if(value.inline_refs && value.inline_refs.length > 0) {
                                        //      value.inline_refs.forEach(({ endpoints }) => {
                                        //              endpoints[0].tableName = table_name;
                                        //      })
                                        // }
                                        table.fields.push(value);
                                        break;
                                case "table_constraint":
                                        const { type, t_value } = value;
                                        switch (type.toLowerCase()) {
                                                case "unique": // set property unique for column
                                                        t_value.forEach(value => {
                                                                const field = table.fields.find(field => field.name === value);
                                                                if(field) {
                                                                        field.unique = true;
                                                                } else {
                                                                        //throw Error(`${table_name}: UNIQUE - Can not find column ${value}.`);
                                                                }
                                                        })
                                                        break;
                                                case "pk": // set property pk for column, pk: PRIMARY KEY
                                                        t_value.forEach(value => {
                                                                const field = table.fields.find(field => field.name === value);
                                                                if(field) {
                                                                        field.pk = true;
                                                                } else {
                                                                        //throw Error(`${table_name}: PRIMARY KEY - Can not find column ${value}.`);
                                                                }
                                                        })
                                                        break;
                                                case "fk": // set inline_ref for column
                                                        t_value.forEach((ref) => {
                                                                const { fieldNames } = ref.endpoints[0];
                                                                // set tableName for endpoints[0];
                                                                // endpoints[0].tableName = table_name;
                                                                const field = table.fields.find(field => field.name === fieldNames[0]);
                                                                if(!field) {
                                                                        //throw Error(`${table_name}: FOREIGN KEY - Can not find column ${fieldNames}`);
                                                                }
                                                                if(!field.inline_refs) {
                                                                        field.inline_refs = [];
                                                                }
                                                                field.inline_refs.push({
                                                                        name: ref.name,
                                                                        endpoint: ref.endpoints[1],
                                                                        onDelete: ref.onDelete,
                                                                        onUpdate: ref.onUpdate
                                                                });
                                                        })
                                                        break;
                                        }
                                        break;
                                case "like":
                                        break;
                        }
                })
                return {
                        syntax_name: "create_table_normal",
                        value: table
                }
        }

table_properties = first:table_property rest: (_ comma _ table_property)* {
        return [first, ...rest.map(r => r[3])];
}

table_property =
        table_constraint:table_constraint {
                return {
                        table_property_name: "table_constraint",
                        value: table_constraint
                }
        }
        / LIKE __ source_table:table_name (__ like_option)* {
                return {
                        table_property_name: "like",
                        value: source_table
                }
        }
        / column_name:column_name __ data_type:data_type (__ COLLATE __ collation:identifier)? column_constraints:(_ column_constraint)* {
                const column = { name: column_name , type: data_type};
                const columnTypeName = column.type.type_name.toLowerCase();
                const serialIncrementType = new Set(['serial', 'smallserial', 'bigserial']);
                // process type for increment
                if (serialIncrementType.has(columnTypeName)) {
                        column.increment = true;
                }
                // map from grammar to right object
                column_constraints = column_constraints.map(c => c[1]);
                // process column_constraints
                column_constraints.forEach(({ type, value }) => {
                        switch(type.toLowerCase()) {
                                case "not_null":
                                        column.not_null = value;
                                        break;
                                case "increment":
                                        column.increment = true;
                                        break;
                                case "dbdefault":
                                        column.dbdefault = value;
                                        break;
                                case "unique":
                                        column.unique = true;
                                        break;
                                case "pk":
                                        column.pk  = true;
                                        break;
                                case "fk":
                                        if (!column.inline_refs) {
                                                column.inline_refs = [];
                                        }
                                        column.inline_refs.push(value);
                                        break;
                        }
                })
                return {
                        table_property_name: "column",
                        value: column
                }
        }

// return { type, value}
column_constraint = constraint_name:(CONSTRAINT __ constraint_name:identifier __ { return constraint_name })?
        column_constraint:( NOT __ NULL { return { type: "not_null" , value: true } }
        / NULL { return { type: "not_null" , value: false } }
        / CHECK _ "("_ expression _")" (__ NO __ INHERIT)? { return { type: "not_supported" } }
        / DEFAULT __ default_expr:default_expr { return { type: "dbdefault", value: default_expr } }
        / GENERATED __ (ALWAYS/ BY __ DEFAULT) __ AS __ IDENTITY { return { type: "increment" } } // (_ "("_ sequence_options _ ")")? { return { type: "not_supported" } }
        / UNIQUE (__ index_parameters)? { return { type: "unique" } }
        / PRIMARY_KEY (__ index_parameters)? { return { type: "pk" } }
        / REFERENCES __ reftable:table_name refcolumn:(_ "(" _ refcolumn:column_name _ ")" {return refcolumn})? (__ MATCH __ FULL/__ MATCH __ PARTIAL/__ MATCH __ SIMPLE)?
                fk_actions:fk_action* {
                        let ref_actions = {};

                        fk_actions.forEach(fkAction => {
                                if (fkAction.type === 'delete') {
                                                ref_actions.onDelete = fkAction.action;
                                                return;
                                        }
                                        ref_actions.onUpdate = fkAction.action;
                        });

                        return {
                                type: "fk",
                                value: {
                                        name: constraint_name,
                                        endpoint: {
                                                tableName: reftable.name,
            schemaName: reftable.schemaName,
                                                fieldNames: refcolumn ? [refcolumn] : null,
                                                relation: "1"
                                        },
                                        ...ref_actions
                                }
                        }
                }
        ) (__ DEFERRABLE /__ NOT DEFERRABLE)? (__ INITIALLY __ DEFERRED /__ INITIALLY __ IMMEDIATE)? {
                return column_constraint;
        }

// return { type, t_value }
table_constraint = constraint_name:(CONSTRAINT __ constraint_name:identifier __ { return constraint_name })?
        table_constraint: ( CHECK _ "("_ expression _")" (__ NO __ INHERIT)? { return { type:"not_supported" } }
        / UNIQUE _ "(" _ column_names:column_names _ ")" (__ index_parameters)? { return { type: "unique", t_value: column_names } }
        / PRIMARY_KEY _ "("_ column_names:column_names _ ")" (__ index_parameters)? { return { type: "pk", t_value: column_names } }
        / EXCLUDE (__ USING __ index_method)? __ "(" exclude_element_with_operator_list  ")" __ index_parameters (__ WHERE _ "(" _ predicate:expression _ ")")? { return { type: "not_supported" }}
        / FOREIGN_KEY _ "(" _ column_names:column_names _ ")" _ REFERENCES __ reftable:table_name refcolumn:( _ "(" _ refcolumn:column_names _ ")" {return refcolumn})?
                (__ MATCH __ FULL/__ MATCH __ PARTIAL/__ MATCH __ SIMPLE)?
                fk_actions:fk_action* {
                        const value = [];
                        if(refcolumn && refcolumn.length > column_names.length) {
                                //throw Error(`Line ${location().start.line}: There are extra ${refcolumn.length - column_names.length} refer column(s) not matched.`);
                        }
                        //if(refcolumn && key >= refcolumn.length) {
                                //throw Error(`Line ${location().start.line}: ${column_name} do not have referenced column.`)
                        //}
                        const v = {
                                name: constraint_name,
                                endpoints: [
                                        {
                                                tableName: null,
                                                fieldNames: column_names,
                                                relation: "*",
                                        },
                                        {
                                                tableName: reftable.name,
            schemaName: reftable.schemaName,
                                                fieldNames: refcolumn,// ? refcolumn[key] : null,
                                                relation: "1",
                                        },
                                ],
                        };
                        fk_actions.forEach(fkAction => {
                                if (fkAction.type === 'delete') {
                                        v.onDelete = fkAction.action;
                                        return;
                                }
                                v.onUpdate = fkAction.action;
                        });
                        value.push(v);
                        return {
                                type: "fk",
                                t_value: value
                        }
                }
        ) (__  DEFERRABLE /__ NOT __ DEFERRABLE)? (__ INITIALLY __ DEFERRED /__ INITIALLY __ IMMEDIATE)? {
                return table_constraint
        }

like_option = (INCLUDING / EXCLUDING) __ (COMMENTS / CONSTRAINTS / DEFAULTS / IDENTITY / INDEXES / STATISTICS/ STORAGE / ALL)

fk_action = __ ON __  type:(UPDATE / DELETE) __ action:fk_action_options { return { type: type.toLowerCase(), action: action.toLowerCase() } }

fk_action_options = $ ("RESTRICT"i / "CASCADE"i / "NO"i __ "ACTION"i / "SET"i __ "NULL"i / "SET"i __ "DEFAULT"i)

index_method = index_method:("HASH"i / "BTREE"i / "GIST"i / "GIN"i / "BRIN"i / "SP-GIST"i) {
        return index_method;
}

index_parameters = index_parameters:(INCLUDES _ "(" _ column_names _ ")"
        / WITH _ "("_ storage_parameters _")"
        / USING __ INDEX __ TABLESPACE __ tablespace_name:identifier)? {
                return index_parameters;
        }

table_names = first:table_name rest: (_ comma _ table_name)* {
        return [first, ...rest.map(r => r[3])];
}

opclasses = first:opclass rest: (_ comma _ opclass)* {
        return [first, ...rest.map(r => r[3])];
}

opclass = identifier

column_names = first:column_name rest: (_ comma _ column_name)* {
        return [first, ...rest.map(r => r[3])];
}

exclude_element_with_operator_list = first:exclude_element_with_operator rest:(_ comma _ exclude_element_with_operator)* {
        return [first, ...rest.map(r => r[3])];
}

exclude_element_with_operator = exclude_element:identifier _ WITH _ operator

storage_parameters = first:storage_parameter rest:(_ comma _ storage_parameter)*

storage_parameter = ("fillfactor"i / "parallel_worlers"i
        / "autovacuum_enabled"i / "toast.autovacuum_enabled"i
        / "autovacuum_vacuum_threshold"i / "toast.autovacuum_vacuum_threshold"i
        / "autovacuum_vacuum_scale_factor"i / "toast.autovacuum_vacuum_scale_factor"i
        / "autovacuum_analyze_threshold"i / "autovacuum_analyze_scale_factor"i
        / "autovacuum_vacuum_cost_delay"i / "toast.autovacuum_vacuum_cost_delay"i
        / "autovacuum_vacuum_cost_limit"i / "toast.autovacuum_vacuum_cost_limit"i
        / "autovacuum_freeze_min_age"i / "toast.autovacuum_freeze_min_age"i
        / "autovacuum_freeze_max_age"i / "toast.autovacuum_freeze_max_age"i
        / "autovacuum_freeze_table_age"i / "toast.autovacuum_freeze_table_age"i
        / "autovacuum_multixact_freeze_min_age"i / "toast.autovacuum_multixact_freeze_min_age"i
        / "autovacuum_multixact_freeze_max_age"i / "toast.autovacuum_multixact_freeze_max_age"i
        / "autovacuum_multixact_freeze_table_age"i / "toast.autovacuum_multixact_freeze_table_age"i
        / "log_autovacuum_min_duration"i / "toast.log_autovacuum_min_duration"i
        / "user_catalog_table"i) (_ "=" _ expression)?


create_table_of =
        _ CREATE __ ( ( GLOBAL __ / LOCAL __ )? ( TEMPORARY / TEMP ) __ / UNLOGGED __)? TABLE (__ IF_NOT_EXISTS)? __ table_name:table_name __
        OF __ type_name:identifier ( _ "(" _ table_properties_of _ ")")?
        (__ PARTITION __ BY __ (RANGE/LIST/HASH) _ "(" _ (column_name/"("_ expression _ ")") (__ COLLATE __ collation:identifier)? (__ opclasses)? _ ")" )?
        (__ WITH _ "(" _ storage_parameters _ ")"/__ WITH __ OIDS/__ WITHOUT __ OIDS)?
        (__ ON __ COMMIT __ (PRESERVE __ ROWS/ DELETE __ ROWS/ DROP))?
        (__ TABLESPACE __ tablespace_name:identifier)?
        _ semicolon _ {
                const table = { name: table_name.name, schemaName: table_name.schemaName, type: type_name}
                return {
                        syntax_name: "create_table_of",
                        value: table
                }
        }

table_properties_of = first:table_property_of rest: (_ comma _ table_property_of _)* {
        return [first, ...rest.map(r => r[3])];
}

table_property_of =
        table_constraint:table_constraint {
                return {
                        table_property_name: "table_constraint",
                        value: table_constraint
                }
        }
        / column_name:column_name __ (WITH __ OPTIONS)? column_constraints:(_ column_constraint)* {
                return {
                        table_property_name: "table_constraint",
                        value: {
                                name: column_name,
                                column_constraints
                        }
                }
        }

create_table_partition_of =
        _ CREATE __ ( ( GLOBAL __ / LOCAL __ )? ( TEMPORARY / TEMP ) __ / UNLOGGED __)? TABLE (__ IF_NOT_EXISTS)? __ table_name:table_name __
        PARTITION __ OF __ parent_table:table_name ( _ "(" _ table_properties_of _ ")")?
        (__ FOR __ VALUES __ partition_bound_spec / __ DEFAULT)
        (__ PARTITION __ BY __ (RANGE/LIST/HASH) _ "(" _ (column_name/"("_ expression _ ")") (__ COLLATE __ collation:identifier)? (__ opclasses)? _ ")" )?
        (__ WITH _ "(" _ storage_parameters _ ")"/__ WITH __ OIDS/__ WITHOUT __ OIDS)?
        (__ ON __ COMMIT __ (PRESERVE __ ROWS/ DELETE __ ROWS/ DROP))?
        (__ TABLESPACE __ tablespace_name:identifier)?
        _ semicolon _ {
                const table = { name: table_name.name, schemaName: table_name.schemaName, parent_table: parent_table}
                return {
                        syntax_name: "create_table_partition_of",
                        value: table
                }
        }

partition_bound_spec = IN _ "(" _ in_bound_spec_list _ ")"
        / FROM _ "(" _ from_to_bound_spec_list _ ")" _ TO _ "(" _ from_to_bound_spec_list _ ")"
        / WITH _ "(" _ MODULUS __ numeric_constant _ comma _ REMAINDER __ numeric_constant _ ")"

in_bound_spec_list = first:in_bound_spec rest:(_ comma _ in_bound_spec)* {
        return [first, ...rest.map(r => r[3])];
}

in_bound_spec = numeric_constant / string_constant / TRUE / FALSE / NULL

from_to_bound_spec_list = first:from_to_bound_spec rest:(_ comma _ from_to_bound_spec)* {
        return [first, ...rest.map(r => r[3])];
}

from_to_bound_spec = numeric_constant / string_constant / TRUE / FALSE / MINVALUE / MAXVALUE

create_table = create_table_normal:create_table_normal {
    return {
      command_name: "create_table",
      value: create_table_normal
    }
  }
  / create_table_of:create_table_of {
    return {
      command_name: "create_table",
      value: create_table_of
    }
  }
  / create_table_partition_of:create_table_partition_of {
    return {
      command_name: "create_table",
      value: create_table_partition_of
    }
  }


alter_table = alter_sub_syntax:(
        alter_table_action /
        alter_table_rename /
        alter_table_set_schema /
        alter_table_set_tablespace /
        alter_table_attach /
        alter_table_detach
) {
        return {
                command_name: "alter_table",
                value: alter_sub_syntax
        }
}

alter_table_rename = _ ALTER __ TABLE (__ IF_EXISTS)? (__ ONLY)? __ table_name (_ "*")? __ RENAME (cmt / !semicolon .)* _ semicolon _ {
        return {
                syntax_name: "alter_table_rename",
        }
}

alter_table_set_schema = _ ALTER __ TABLE (__ IF_EXISTS)? __ table_name __ SET __ SCHEMA (cmt / !semicolon .)* _ semicolon _ {
        return {
                syntax_name: "alter_table_set_schema",
        }
}

alter_table_set_tablespace = _ ALTER __ TABLE __ ALL __ IN __ TABLESPACE __ table_name
        (__ OWNED __ BY __ identifier (_ comma _ identifier)*)? __ SET __ TABLESPACE
        (cmt / !semicolon .)* _ semicolon _ {
        return {
                syntax_name: "alter_set_tablespace",
        }
}

alter_table_attach = _ ALTER __ TABLE (__ IF_EXISTS)? __ table_name __ ATTACH __ PARTITION (cmt / !semicolon .)* _ semicolon _ {
        return {
                syntax_name: "alter_table_attach",
        }
}

alter_table_detach = _ ALTER __ TABLE (__ IF_EXISTS)? __ table_name __ DETACH __ PARTITION (cmt / !semicolon .)* _ semicolon _ {
        return {
                syntax_name: "alter_table_detach",
        }
}

alter_table_action = _ ALTER __ TABLE (__ IF_EXISTS)? (__ ONLY)? __ name:table_name (_ "*")? __
        actions:actions _ semicolon _ {
                actions.forEach(({ type, t_value}) => {
                        switch(type.toLowerCase()) {
                                case "fk":
                                        t_value.forEach(({ endpoints }) => {
                                                endpoints[0].tableName = name.name;
                                                endpoints[0].schemaName = name.schemaName;
                                        })
                        }
                })
                return {
                        syntax_name: "alter_table_action",
                        value: actions
                }
        }

actions = first:action rest:(_ comma _ action)* {
        return [first, ...rest.map(r => r[3])];
}

action = ADD __ table_constraint:table_constraint (__ NOT __ VALID)? { // reuse table_constraint in Create_table_normal.pegjs
                return table_constraint;
        }
        / ALTER __ (COLUMN __)? column_name:column_name __ (SET __ DATA __)? TYPE __ data_type:data_type (__ COLLATE collation:identifier)? expression:(__ USING e:alter_expression {return e})? {
                return {
                        type: "type",
                        expression
                }
        }
        / ALTER __ (COLUMN __)? column_name:column_name __ SET __ DEFAULT __ expression:alter_expression {
                return {
                        type: "set_default",
                        expression
                }
        }
        / ALTER __ (COLUMN __)? column_name:column_name __ DROP __ DEFAULT {
                return {
                        type: "drop_default"
                }
        }
        / ALTER __ (COLUMN __)? column_name:column_name __ action:( SET / DROP ) __ NOT __ NULL {
                if(action.toUpperCase() === "SET") {
                        return {
                                type: "set_not_null"
                        }
                } else {
                        return {
                                type: "drop_not_null"
                        }
                }
        }
        / ALTER __ (COLUMN __)? column_name:column_name __ SET __ STATISTICS value:numeric_constant {
                return {
                        type: "set_statistics",
                        value
                }
        }
        / ALTER __ (COLUMN __)? column_name:column_name __ SET _ "(" _ set_attribute_options _ ")" {
                return {
                        type: "set_options"
                }
        }
  / ALTER __ (COLUMN __)? column_name:column_name __ RESET _ "(" _ reset_attribute_options _ ")" {
                return {
                        type: "reset_options"
                }
        }
  / ALTER __ (COLUMN __)? column_name:column_name __ SET __ STORAGE __ value:( PLAIN / EXTERNAL / EXTENDED / MAIN ) {
                return {
                        type: "set_storage",
                        value: value.toLowerCase()
                }
        }
        / (cmt / !semicolon .)* {
                return {
                        type: "unknown",
                }
        }


set_attribute_options = first:set_attribute_option rest:(_ comma _ set_attribute_option)* {
        return [first, ...rest.map(r => r[3])];
}

set_attribute_option = attribute_option _ "=" _ value:expression

reset_attribute_options = first:attribute_option rest:(_ comma _ attribute_option) {
        return [first, ...rest.map(r => r[3])];
}

attribute_option = identifier // docs is not clear about this, so I assume it is identifier

alter_expression = c:[^,;]+ {
        return removeReduntdantSpNewline(c.join(''));
}

create_index =
        _ CREATE unique:(__ UNIQUE)? __ INDEX (__ CONCURRENTLY)?
        name:(__ ON {return null}/(__ IF_NOT_EXISTS)? __ name:identifier __ ON {return name}) // to solve problem of identifier(accept "id" and id)
        (__ ONLY)? __ table_name:table_name
        type:(__ USING __ type:index_method {return type})? _
        "(" _ index_properties:index_properties _ ")"
        (__ INCLUDE _ "(" _ column_names _ ")")? // reuse collumn_names
        (__ WITH _ "("_ index_storage_parameters _")")?
        (__ TABLESPACE __ tablespace_name:identifier)?
        (__ WHERE _ "(" _ predicate:expression _ ")")?
        _ semicolon _ {
                const value = {
                        syntax_name: "create_table",
                        value: {
                                table_name,
                                columns: index_properties
                        }
                }

                if (name)
                        value.value.name = name;

                if (unique)
                        value.value.unique = true;

                if (type)
                        value.value.type = type.toUpperCase();

                return {
                        command_name: "create_index",
                        value
                }
        }

index_properties = first:index_property rest:(_ comma _ index_property)* {
        return [first, ...rest.map(r => r[3])];
}

index_property =
        column : (
    c:column_name "(" c1:(column_name/__/comma)* ")" {return {value: `${c}(${removeReduntdantSpNewline(_.flattenDeep(c1).join(""))})`, type: "expression" }}
    / c:column_name { return {value: `${c}`, type: "string" }}
    / e:expression {return { value:`${e}`, type: "expression"}}) // need to checkout this one because expression will collect all
        (__ "COLLATE" __ collation:identifier)? // (__ opclass)? - Need to check the meaning opclass
        (__ "ASC"/__ "DESC")? (__ "NULLS" __ ("FIRST"/"LAST"))? {
        return column;
}

index_storage_parameters = first:(index_storage_parameter _ "=" _ value:expression) rest:(_ comma _ index_storage_parameter _ "=" value:expression)*

index_storage_parameter =
        ("fillfactor"i / "vacuum_cleanup_index_scale_factor"i
        / "buffering"i / "fastupdate"i / "gin_pending_list_limit"i
        / "pages_per_range"i / "autosummarize"i)
comment = _ COMMENT __ ON __ comment_option:comment_option __ IS __ text:(string_constant/NULL)
  _ semicolon _ {
  if (text.toLowerCase() !== "null") {
    comment_option.value.text = text;
  } else comment_option.value.text = null;

  return {
    command_name: "comment",
    value: comment_option
  }
}

comment_option = (
  COLUMN __ path:(identifier '.')+ column_name:column_name {
    let dbName = null, schemaName = null, tableName;
    if (path.length === 1) {
      tableName = path[0][0];
    } else if (path.length === 2) {
      schemaName = path[0][0];
      tableName = path[1][0];
    }
    else {
      dbName = path[0][0];
      schemaName = path[1][0];
      tableName = path[2][0];
    }
    return {
      syntax_name: "column",
      value: {
        dbName,
        schemaName,
        tableName,
        columnName: column_name
      }
    }
  }
  / TABLE __ object_name:table_name {
    return {
      syntax_name: "table",
      value: {
        table_name: object_name
      }
    }
  }
)
ignore_syntax = _ value:(
  INSERT [^;]* { return { syntax_name: "insert" } }
  / SET [^;]* { return { syntax_name: "set" } }
  / RESET [^;]* { return { syntax_name: "reset" } }
  / SELECT [^;]* { return { syntax_name: "select" } }
  / DROP [^;]* { return { syntax_name: "drop" } }
  / USE [^;]* { return { syntax_name: "use" } }
  / CREATE __ SEQUENCE [^;]* { return { syntax_name: "create_sequence" } }
  / CREATE __ SCHEMA [^;]* { return { syntax_name: "create_schema" } }
  / CREATE __ VIEW [^;]* { return { syntax_name: "create_view" } }
  / ALTER __ (cmt / !(semicolon) .)* { return { syntax_name: "alter_not_table" } }
  / __ { return { syntax_name: "comment_and_space" } }
) semicolon _ {
  const loc = location();
  const t = text();
  return {
    command_name: "ignore_syntax",
    value,
    warning: {
      type: 'ignore',
      location: loc,
      text: t,
      message: `ignoring "${t}" at line: ${loc.start.line}`,
    },
  }
}
command = create_table:create_table { return create_table }
        / alter_table:alter_table { return alter_table }
        / create_index:create_index { return create_index }
        / comment:comment { return comment }
        / ignore_syntax:ignore_syntax { return ignore_syntax }
