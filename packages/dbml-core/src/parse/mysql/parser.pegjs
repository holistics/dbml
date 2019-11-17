{
  const _ = require('lodash');
	const tables = [];
	const refs = [];
	const enums = [];

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
    return arrAfterTrim.join(',');
  }
}

Rule = (Expr)* {
  return {tables, refs, enums};
}

Expr = 
	t:TableSyntax { tables.push(t) }
	/AlterSyntax
	/IndexSyntax
	/IgnoreSyntax
	/__
    
// 				TableSyntax: support "CREATE TABLE" syntax.
// Try to support as mush as possible syntax in MySQL offical documents.
// https://dev.mysql.com/doc/refman/8.0/en/create-table.html
// Return: table object: {name, fields, [,indexes]}
TableSyntax 
	= create_table (__ if_not_exist)? __ name:table_name _ 
    "(" _ body:TableBody _ ")" _ TableOptions? _ semicolon endline?
{
	const fields = body.fields;
	const indexes = body.indexes;
	// push inline_ref to refs
	fields.forEach((field)=>{
		(field.inline_ref || []).forEach(ref => {
			const endpoints = [
				{
					tableName: name,
					fieldName: field.name,
					relation: "*", //set by default
				},
				ref.endpoint,
			]
			refs.push({
				endpoints,
				onUpdate: ref.onUpdate,
				onDelete: ref.onDelete,
			});
		})
		
		// process enum: rename enum and push to array `enums`
		if (field.type.type_name.toLowerCase() === 'enum') {
			let enumValuesArr = field.type.args.split(/[\s\r\n\n]*,[\s\r\n\n]*/);
			const values = [];

			enumValuesArr.forEach(ele => {
				const newValue = ele.replace(/'|"|`/g, "").trim();
				const enumValue = {
					name: newValue
				}
				values.push(enumValue);
			});

			const _enum = {
				name: `${name}_${field.name}_enum`,
				values
			};
			enums.push(_enum);
			field.type.type_name = _enum.name;
		}

    })
    // return statement
    return indexes ? 
    	{name, fields, indexes} 
      : {name, fields}
}

// TableBody: this is the part between parenthesis.
// TableBody contains many lines, so we will classify Line and process.
// Output: covert all lines into object {fields, indexes}, which is the table body.
TableBody = _ lines:Line* _ {
	// classify lines into pk, fk, unique, index and fields
	const pks = _.flatten(lines.filter(l => l.type === "pk").map(l => l.pk));
	const fks = _.flatten(lines.filter(l => l.type === "fk").map(l => l.fk));
	const indexes = _.flatten(lines.filter(l => l.type === "index").map(l => l.index));
	const fields = lines.filter(l => l.type === "field").map(l => l.field);
	const refs = [];
	// process primary key. If it's composite key, push it into indexes
	if (pks.length > 1) {
		const index = {
			columns: pks.map(field => ({
				value: field,
				type: 'column'
			})),
			pk: true
		};

		indexes.push(index);
	} else {
		pks.forEach(key => fields.find(f => f.name === key).pk = true);
	}
					
	// Set inline_ref for fields
	fks.map(key => {
		const field = fields.find(f => f.name === key.endpoints[0].fieldName);
		if(!field.inline_ref) {
			field.inline_ref = [];
		}
		field.inline_ref.push({
			endpoint: key.endpoints[1],
			onUpdate: key.onUpdate,
			onDelete: key.onDelete,
		});
	})
	
	return {fields, indexes}
}

// Line: is create_definition in MySQL documents.
Line "fields" = pk:PKSyntax _ (comma/&")"/&(endline")")) {return { type: "pk", pk } }
	/ fk:FKSyntax _ (comma/&")"/&(endline")")) {return { type: "fk", fk } }
	/ index:IndexInLineSyntax _ (comma/&")"/&(endline")")) { return { type:"index", index }}
	/ field:Field _ (comma/&")"/&(endline")")) {return { type: "field", field } }
	/ CheckConstraintSyntax _ (comma/&")"/&(endline")"))
	/ __
    
// PKSyntax: Support "PRIMARY KEY (field[, field]*)"
// return: list of field
PKSyntax = _ primary_key _ "(" _ names:ListOfNames _ ")"
{return names}

// FKSyntax: Support "FOREIGN KEY (field[, field]*) REFERENCES `table`(field[, field]*)"
FKSyntax = _ constraint:("CONSTRAINT"i _ name)? _ foreign_key _ 
	"(" _ fields:ListOfNames _ ")" _
	references _ table2:table_name _ "(" _ fields2:ListOfNames _ ")" _
	fkActions:FKAction*
{
	const name = constraint ? constraint[2] : null;
	const arr = [];
	fields.forEach((field, index) => {
		const fkObj = {
			name: name,
			endpoints: [
				{
					tableName: null,
					fieldName: field,
					relation: "*",
				},
				{
					tableName: table2,
					fieldName: fields2[index],
					relation: "1",
				}
			],
		};
		fkActions.forEach(fkAction => {
			if (fkAction.type === 'delete') {
				fkObj.onDelete = fkAction.action;
				return;
			}
			fkObj.onUpdate = fkAction.action;
		});
		arr.push(fkObj);
	})
  return arr
}

FKAction
  = _ "ON"i _ type:("UPDATE"i / "DELETE"i) _ action:references_options { return {type: type.toLowerCase(), action: action.toLowerCase()} }

// UniqueSyntax: Support "UNIQUE(field[, field]*)"
UniqueSyntax 
	= _ ("CONSTRAINT"i _ name _)? "UNIQUE"i _ ("KEY"i _)? "(" name:ListOfNames ")" { return name }

// IndexInLineSyntax: Support "[UNIQUE] (INDEX/KEY) `indexName`(`field` (ASC/DESC)?)"
// "KEY is normally a synonym for INDEX".
IndexInLineSyntax = _ unique:index_in_line
	_ name:name? _ type1:index_type?
	"(" _ columns:IndexColumnValues _")" IndexOption? type2:index_type?
{
	const index = { columns };
	if(name) {
		index.name = name;
	}
	if(unique) {
		index.unique = true;
	}
	const type = type2 || type1;
	if(type)
		index.type = type;
	return index;
}
index_in_line // keyword
	= unique:"UNIQUE"i? _ ("INDEX"i/"KEY"i) {return unique}
	/ "UNIQUE"i _ ("INDEX"i/"KEY"i)? {return "unique"}
IndexInLineValues = first:IndexInLineValue rest:(comma _ IndexInLineValue)*
{
	return [first, ...rest.map(r => r[2])].join(",");
}
IndexInLineValue = column:type_name _ ("ASC"/"DESC")? {return column.type_name}

// Field
Field = _ name:name _ type:type _ fieldSettings:FieldSettings? _ 
{
	let field = {name, type};
	if (fieldSettings) {
		Object.assign(field, fieldSettings);
	}
	return field
}
FieldSettings = fieldSettingsArray:FieldSetting*
{
	const fieldSettings = {};
	fieldSettingsArray.forEach(field => {
		if(field === "null")
			fieldSettings["not_null"] = false;
		else if(field.type === "default")
			fieldSettings.dbdefault = field.value;
		else if(field.type === "comment")
			fieldSettings.note = field.value;
		else if (field !== "not_supported") {
			fieldSettings[field] = true;
		}
	})
	return fieldSettings;
} 
FieldSetting "field setting"
	= _ a:"NOT"i _ "NULL"i _{return "not_null"}
	/ _ a:"NULL"i _ { return "null" }
	/ _ a:primary_key _ { return "pk" }
	/ _ a:unique _ { return "unique" }
	/ _ a:"AUTO_INCREMENT"i _ { return "increment" }
	/ _ a:"UNSIGNED"i _ { return "unsigned"}
	/ _ (
      _ "COLLATE"i _ name _ 
    / _ "COLUMN_FORMAT"i _ StringLiteral _ 
    / _ "STORAGE"i _ StringLiteral _ 
    / _ "CHECK"i _ "(" expression")" _ 
    / _ "GENERATED_ALWAYS"i? _ "AS"i _ "(" expression ")"
    / _ "VIRTUAL"i _
    / _ "STORED"i 
    ) { return "not_supported" }
	/ _ v:Default {return {type: "default", value: v} }
	/ _ v:Comment { return {type: "comment", value: v }}

// Default: Support "DEFAULT (value|expr)" syntax
Default
  = "DEFAULT"i _ val: DefaultVal {return val}
DefaultVal = val:StringLiteral { return { value: val, type: 'string' }}
  / val: NumberLiteral { return { value: val, type: 'number' }}
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

// End of FieldSetting


// TableOptions: is a list of TableOption
TableOptions = first:TableOption _ rest:(comma? _ TableOption)*
{
	let options = first;
  rest.forEach(r => Object.assign(options, r[2]));
  return options;
}
// TableOptions: is field `table
TableOption "table option"
	= "AUTO_INCREMENT"i _ ("=" _)? auto_increment:NumberLiteral { return { auto_increment } }
	/ "AVG_ROW_LENGTH"i _ ("=" _)? avg_row_length:NumberLiteral { return { avg_row_length } }
	/ ("DEFAULT"i _)? ("CHARACTER"i _ "SET"i/"CHARSET"i) _ ("=" _)? charset_name:name { return { charset_name }}
	/ ("DEFAULT"i _)? "COLLATE"i _ ("=" _)? collation_name:name { return { collation_name }}
	/ "COMPRESSION"i _ ("=" _)? compression:('ZLIB'i/'LZ4'i/'NONE'i) { return { compression: compression.toUpperCase()}}
	/ "CONNECTION"i _ ("=" _)? connect_string:'connect_string' { return { connect_string } }
	/ "ENCRYPTION"i _ ("=" _)? encryption:('Y'i/'N'i) { return {encryption: encryption.toUpperCase()}}
	/ "ENGINE"i _ ("=" _)? engine:name { return { engine } }
	/ "INSERT_METHOD"i _ ("=" _)? insert_method:("NO"i/"FIRST"i/"LAST"i) {return {insert_method: insert_method.toUpperCase()}}
	/ "MAX_ROWS"i _ ("=" _)? max_rows:NumberLiteral { return { max_rows } }
	/ "MIN_ROWS"i _ ("=" _)? min_rows:NumberLiteral { return { min_rows } }
	/ "TABLESPACE"i tablespace:name ("STORAGE" _ ("DISK"i/"MEMORY"i))? { return { tablespace } }
	/ comment: Comment { return { comment } }

// CheckConstraintSyntax: Support "[CONSTRAINT [symbol]] CHECK (expr) [[NOT] ENFORCED]"
// We do not process this syntax.
CheckConstraintSyntax = _ ("CONSTRAINT"i name _)? "CHECK"i _ expression _ ("NOT"i? _ "ENFORCE"i)?
// 			End of TableSyntax

// 			AlterSyntax: support "ALTER TABLE" syntax
// We will support ADD_COLUMN, ADD_FOREIGN_KEY, ADD_INDEX
// https://dev.mysql.com/doc/refman/8.0/en/alter-table.html
AlterSyntax = alter_table _ table:name _ 
	options:(AddOptions/ChangeOptions/DropOptions) _
  semicolon
{
	const fks = _.flatten(options.filter(o => o.type === "add_fk").map(o => o.fks));
	fks.forEach(fk => {fk.endpoints[0].tableName = table});
	refs.push(...fks)

	const pks = _.flatten(options.filter(o => o.type === "add_pk").map(o => o.pks));
	const tableAlter = tables.find((t) => t.name === table);
	
	const index = {
		columns: pks.map(field => ({
			value: field,
			type: 'column'
		})),
		pk: true
	};

	if (pks.length > 1) {
		if (tableAlter.indexes) {
			tableAlter.indexes.push(index);
		} else {
			tableAlter.indexes = [index];
		}
	} else if (pks.length === 1) {
		const pkField = tableAlter.fields.find(field => field.name === pks[0]);
		pkField.pk = true;
	}
}

AddOptions = "ADD"i _ 
	( ("CONSTRAINT"i __ name)? _ fks:FKSyntax { return {type:"add_fk", fks} }
	/ ("CONSTRAINT"i __ name)? _ pks:PKSyntax { return {type:"add_pk", pks} }
	/ ("COLUMN"i)? _ col_name:name _ col_type:type { return {type:"add_column", field:{col_name, col_type}}}
	/ ("INDEX"i/"KEY"i) _ index_name:name _ column:IndexColumn { return { type: "add_index", index: {column} } }
	/ ("CONSTRAINT"i __ name)? "UNIQUE"i ("INDEX"i/"KEY"i)
	)

ChangeOptions = "CHANGE"i [^;]

DropOptions = "DROP"i [^;]
// 			End of AlterSyntax

// 			IndexSyntax: support "CREATE INDEX" syntax
IndexSyntax = constraint:create_index _ indexName:name _
	"ON"i _ tableName:name _ indexType:index_type? _
	columns: IndexColumn _
	option:IndexOption? semicolon
{
	const index = {columns};
	const typeInOption = option && option.type === "index_type" ? option.value : null;
    
	if(indexName)
		index.name = indexName;
	
	if(constraint.toLowerCase() === "unique")
		index.unique = true;

	const type = typeInOption || indexType;
	if(type) 
		index.type = type;

	const table = tables.find(table => table.name === tableName);
	if(table.indexes) {
		table.indexes.push(index);
	} else {
		table.indexes = [index];
	}
}

IndexColumn
	= "(" _ e:IndexColumnValues _ ")" {return e}
IndexColumnValues = first:IndexColumnValue rest:(_ comma _ IndexColumnValue)* {
	return [first, ...rest.map(r => r[3])];
}
IndexColumnValue 
	= columns:( 
    c:name "(" c1:(name/__/comma)* ")" {return {value: `${c}(${removeReduntdantSpNewline(_.flattenDeep(c1).join(""))})`, type: "expression" }}
    / c:name { return {value: `${c}`, type: "string" }}
    / e:expression {return { value:`${e}`, type: "expression"}}) // need to checkout this one because expression will collect all
	(__ "COLLATE" __ collation:name)? // (__ opclass)? - Need to check the meaning opclass
	(__ "ASC"/__ "DESC")? (__ "NULLS" __ ("FIRST"/"LAST"))? {
	return columns;
}

IndexOption
  = "KEY_BLOCK_SIZE"i _ ("=" _)? type
	/ "WITH"i _ "PARSER"i _ parser_name:name
	/ "COMMENT"i _ "string"
	/ ("VISIBLE"i / "INVISIBLE"i)
	/ type: index_type { return { type: "index_type", value: type } }
// 			End of IndexSyntax


// 			IgnoreSyntax: these are syntax that dbdiagram does not to process
IgnoreSyntax 
	= (InsertSyntax
	/ SetSyntax
	/ CreateSchemaSyntax
	/ DropSyntax
	/ UseSyntax
	/ BeginSyntax
	/ CommitSyntax
	/ RollbackSyntax
	) semicolon newline?

// InsertSyntax: "INSERTO INTO" syntax
InsertSyntax = _ "INSERT"i (!(")" _ ";") .)* ")"

// SetSyntax: "SET" syntax
SetSyntax = _ "SET"i [^;]*

// CreateSchemaSyntax: "CREATE SCHEMA" syntax
CreateSchemaSyntax = _ "CREATE"i _ ("SCHEMA"i/"DATABASE"i) [^;]*

// DropSyntax: "DROP" syntax
DropSyntax = _ "DROP"i [^;]*

// UseSyntax: "USE" syntax
UseSyntax = _ "USE"i [^;]*

// BeginSyntax: "BEGIN TRANSACTION" syntax
BeginSyntax = _ "BEGIN"i [^;]*

// CommitSyntax: "COMMIT" syntax
CommitSyntax = _ "COMMIT"i [^;]*

// RollbackSyntax: "ROLLBACK" syntax
RollbackSyntax = _ "ROLLBACK"i [^;]*
// 			End of IgnoreSyntax


//			Useful Expression
// ListOfNames: support list of names in PK, FK and Unique
// Ex: Unique(`abc`, `def`)
// Output: ["abc", "def"]
ListOfNames = first:name rest:(comma _ name)*
{return [first, ...rest.map(n => n[2])]}

// Comment Syntax: Support "COMMENT 'this is a comment'"
Comment 
	= "COMMENT" _ ("=" _)? comment: "'" c:[^']* "'" {return c.join('')}
	/ "COMMENT" _ ("=" _)? comment: "\"" c:[^"]* "\"" {return c.join('')}
// 			End of Useful Expression


// 			Keywords:
create_table "CREATE TABLE" = "CREATE"i _ "TEMPORARY"i? _"TABLE"i
if_not_exist "IF NOT EXISTS" = "IF"i _ "NOT"i _ "EXISTS"i
alter_table "ALTER TABLE" = "ALTER"i _ "TABLE"i
create_index "CREATE INDEX" 
	= "CREATE"i _ type:name _ "INDEX"i {return type}
  / "CREATE"i _ "INDEX"i {return 'INDEX'}
primary_key = "PRIMARY"i _ "KEY"i
foreign_key = "FOREIGN"i _ "KEY"i
references = "REFERENCES"i
unique = "UNIQUE"i
references_options = $ ("RESTRICT"i/"CASCADE"i/"SET"i _ "NULL"i/"NO"i _ "ACTION"i/"SET"i _ "DEFAULT"i)
index_type "index type" = "USING"i _ type:("BTREE"i/"HASH"i) { return type.toUpperCase() }
name "valid name"
  = c:(character)+ { return c.join("") }
  / quote c:[^`]+ quote { return c.join("") }
table_name "valid table name"
  = (name _ "." _)* name:name { return name }
type "type" = c:type_name { return c }
	/  c:name { return { type_name: c } }
type_name = type_name:name _ args:("(" _ expression _ ")")? {
  args = args ? args[2] : null;

	if (type_name.toLowerCase() !== 'enum') {
		type_name = args ? type_name + '(' + args + ')' : type_name;
	}
	
	return {
		type_name,
		args
	}
}
expression "expression" = factors:factor* {
	return removeReduntdantSpNewline(_.flattenDeep(factors).join(""));
}
factor = factors:(character+ _ "(" expression ")"
    / "(" expression ")"
    / (exprCharNoCommaSpace+ &(_/","/");"/endline");")) / exprChar+ &.) {
    	return _.flattenDeep(factors).join("");
    }   
exprChar = [\',.a-z0-9_+-\`]i
    / sp
    / newline
    / tab
exprCharNoCommaSpace = [\'.a-z0-9_+-]i

character "letter, number or underscore" = [a-z0-9_]i
sp = " "
quote = "`"/"\""
comma = ","
tab = "\t"
semicolon = ";"
endline "endline" = sp* newline
newline "newline" = "\r\n" / "\n"
// Ignored
_ "space" = (comment/sp/tab/newline)*
__ "space" = (comment/sp/tab/newline)+
comment "comment" = "--" [^\n]* / "/*" (!"*/" .)* "*/" semicolon?
// Copied from https://github.com/pegjs/pegjs/issues/292
StringLiteral "string"
  = '"' chars:DoubleStringCharacter* '"' {
      return chars.join('') ;
    }
  / "'" chars:SingleStringCharacter* "'" {
      return chars.join('') ;
    }
DoubleStringCharacter
  = '\\' '"' { return '"'; }
  / !'"' SourceCharacter { return text(); }
SingleStringCharacter
  = '\\' "'" { return "'"; }
  / !"'" SourceCharacter { return text(); }
SourceCharacter
  = .
NumberLiteral
	= float
	/ integer
float 
  = left:[0-9]+ "." right:[0-9]+ { return parseFloat(left.join("") + "." +   right.join("")); }
integer 
	= digits:[0-9]+ { return parseInt(digits.join(""), 10); }
