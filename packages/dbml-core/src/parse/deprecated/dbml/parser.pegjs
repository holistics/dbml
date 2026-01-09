// This file is deprecated and should not be maintain.
// If you want to contribute to the DBML parser, modify the dbml-parse package instead.
{
  const data = {
    schemas: [],
    tables: [],
    refs: [],
    enums: [],
    tableGroups: [],
    aliases: [],
    project: {},
  };
  let projectCnt = 0;
  function getRelations(operator) {
    if(operator === '<>') return ['*','*'];
    if(operator === '>') return ['*','1'];
    if(operator === '<') return ['1','*'];
    if(operator === '-') return ['1','1'];
  }
}

rules
  = (expr)* {
    return data;
  }

expr
  = t:TableSyntax { data.tables.push(t) }
  / r:RefSyntax { data.refs.push(r) }
  / e:EnumSyntax { data.enums.push(e) }
  / tg:TableGroupSyntax { data.tableGroups.push(tg) }
  / p: ProjectSyntax {
    projectCnt += 1;
    if (projectCnt > 1) {
      error('Project is already defined');
    }
    data.project = p;
    data.tables = data.tables.concat(p.tables);
    data.refs = data.refs.concat(p.refs);
    data.enums = data.enums.concat(p.enums);
    data.tableGroups = data.tableGroups.concat(p.tableGroups);
  }
  / __

ProjectSyntax 
  = project name:(__ name)? _ "{" _ body:ProjectBody _ "}" {
    return {
      name: name ? name[1] : null,
      ...body
    }
  }

ProjectBody
  = _ elements: ProjectElement* _ {
    const tables = [];
    const refs = [];
    const enums = [];
    const tableGroups = [];
    let note = null;
    const projectFields = {};

    elements.forEach(ele => {
      if (ele.type === 'table') {
        tables.push(ele.value);
      } else if (ele.type === 'ref') {
        refs.push(ele.value);
      } else if (ele.type === 'enum') {
        enums.push(ele.value);
      } else if (ele.type === 'table_group') {
        tableGroups.push(ele.value);
      } else if (ele.type === 'note') {
        note = ele.value;
      } else {
        projectFields[ele.value.name] = ele.value.value;
      }
    });

    return {
      tables,
      refs,
      enums,
      tableGroups,
      note,
      ...projectFields
    }
  }

ProjectElement
  = _ note: ObjectNoteElement _ {
    return {
      type: 'note',
      value: note
    }
  }
  / _ t: TableSyntax _ {
    return {
      type: 'table',
      value: t
    }
  }
  / _ r: RefSyntax _ {
    return {
      type: 'ref',
      value: r
    }
  }
  / _ e: EnumSyntax _ {
    return {
      type: 'enum',
      value: e
    }
  }
  / tg: TableGroupSyntax _ {
    return {
      type: 'table_group',
      value: tg
    }
  }
  / _ element: ProjectField _ {
    return {
      type: 'element',
      value: element
    }
  }

ProjectField
  = name:name _ ":" _ value: StringLiteral {
    return {
      name,
      value: value.value
    }
  }

TableGroupSyntax = table_group sp+ schemaName:schema_name? name:name _ "{" _ body:table_group_body _ "}" {
  return {
    name: name,
    schemaName,
    tables: body,
    token: location()
  }
}

table_group_body = tables:(schema_name? name __)* {
  return tables.map(t => ({
    name: t[1],
    schemaName: t[0]
  }));
}

// References
RefSyntax
  = r: (ref_long / ref_short) {
    const schemaName = r.endpoints[0].schemaName;
    return {
      ...r,
      schemaName,
    }; 
  }

ref_long
  = ref name:(__ name)? _ "{" _ body:ref_body _ "}" {
      const ref = {
        name: name? name[1] : null,
        endpoints: body.endpoints,
        token: location()
      };
      Object.assign(ref, body.settings);
      return ref;
    }

ref_short
  = ref name:(sp+ name)? sp* ":" sp* body:ref_body {
      const ref = {
        name: name? name[1] : null,
        endpoints: body.endpoints,
        token: location()
      };
      Object.assign(ref, body.settings);
      return ref;
    }

ref_body
  = field1:field_identifier sp+ relation:relation sp+ field2:field_identifier sp* ref_settings:RefSettings? {
    const rel = getRelations(relation);
    const endpoints = [
      {
        schemaName: field1.schemaName,
        tableName: field1.tableName,
        fieldNames: field1.fieldNames,
        relation: rel[0],
        token: location()
      },
      {
        schemaName: field2.schemaName,
        tableName: field2.tableName,
        fieldNames: field2.fieldNames,
        relation: rel[1],
        token: location()
      }
    ];
    return {
      endpoints: endpoints,
      settings: ref_settings
    };
  }
//CHANGE
RefField
  = field:(RefSingleField/RefMultipleFields) { 
    if (typeof field === "string") field = [field];
    return field; 
  }

RefSingleField
  =  field:name { return field; }
 
RefMultipleFields
  = "(" sp* first:RefSingleField rest:(sp* Comma sp* RefSingleField)* sp* ")"  {
    let arrField = [first].concat(rest.map(el => el[3]));
    return arrField;
  }

RefSettings
  = "[" first:RefSetting rest:(Comma RefSetting)* "]" {
    let arrSettings = [first].concat(rest.map(el => el[1]));
    let res = {};
    arrSettings.forEach((ele) => {
      if (ele.type === "update") {
        res.onUpdate = ele.value;
      }
      if (ele.type === "delete") {
        res.onDelete = ele.value;
      }
    });
    return res;
  }

RefSetting
  = _ v:OnUpdate _ { return { type: 'update', value: v } }
  / _ v:OnDelete _ { return { type: 'delete', value: v } }
OnUpdate
  = "update:"i _ val:(no_action/restrict/cascade/set_null/set_default) { return val }
OnDelete
  = "delete:"i _ val:(no_action/restrict/cascade/set_null/set_default) { return val }

// Tables
TableSyntax
  = table sp+ schemaName:schema_name? name:name alias:alias_def? sp* table_settings:TableSettings? _ "{" body:TableBody "}" {
      let fields = body.fields || [];
      let indexes = body.indexes || [];
      // Handle list of partial inline_refs
      let refs = []

      fields.forEach((field) => {
        (field.inline_refs || []).forEach((iref) => {
          const rel = getRelations(iref.relation);
          const endpoints = [
          {
            schemaName: iref.schemaName,
            tableName: iref.tableName,
            fieldNames: iref.fieldNames,
            relation: rel[1],
            token: iref.token
          },
          {
            schemaName: schemaName,
            tableName: name,
            fieldNames: [field.name],
            relation: rel[0],
            token: iref.token
          }];

          let ref = {
            schemaName,
            name: null, // no name
            endpoints: endpoints,
            token: iref.token
          }
          data.refs.push(ref);
        })
      });

      if (alias) {
        if (data.aliases.find(a => a.name === alias)) error(`Alias "${alias}" is already defined`);
        data.aliases.push({
          name: alias,
          kind: 'table',
          value: {
            tableName: name,
            schemaName: schemaName,
          }
        })
      }

      let res = {
        name: name,
        schemaName,
        alias: alias,
        fields: fields,
        token: location(),
        indexes: indexes,
        ...table_settings,
      }
      if (body.note) {
        res = {
          ...res,
          note: body.note
        }
      }
      return res;
    }

TableBody
  = _ fields: Field+ _ elements: TableElement* _ {
    // concat all indexes
    const indexes = _.flatMap(elements.filter(ele => ele.type === 'indexes'), (ele => ele.value));
    // pick the last note
    const note = elements.slice().reverse().find(ele => ele.type === 'note');

    // process field for composite primary key:
    const primaryKeyList = [];
    fields.forEach(field => {
      if (field.pk) {
        primaryKeyList.push(field);
      }
    });
    if (primaryKeyList.length > 1) {
      const columns = primaryKeyList.map(field => ({
        value: field.name,
        type: 'column'
      }));
      // remove property `pk` for each field in this list
      primaryKeyList.forEach(field => delete field.pk);

      indexes.push({
        columns: columns,
        token: _.head(primaryKeyList).token,
        pk: true
      })
    }

    return {
      fields,
      indexes,
      note: note ? note.value : null
    }
  }

TableElement
  = _ indexes: Indexes _ {
    return {
      type: 'indexes',
      value: indexes
    }
  }
  / _ note: ObjectNoteElement _ {
    return {
      type: 'note',
      value: note
    }
  }

Field
  = _ name:name sp+ typeSchemaName:schema_name? type:type constrains:(sp+ constrain)* field_settings:(sp+ FieldSettings)? sp* comment? newline {
    const field = {
      name: name,
      type:  {
        schemaName: typeSchemaName,
        ...type,
      },
      token: location(),
      inline_refs: []
    }
    Object.assign(field, ...constrains.map(c => c[1]));
    if (field_settings) {
      Object.assign(field, field_settings[1]);
    }
    return field;
  }

EnumSyntax
  = enum sp+ schemaName:schema_name? name:name _ "{" body: EnumBody "}" {
    return {
      name: name,
      schemaName,
      token: location(),
      values: body.enum_values
    };
  }

EnumBody
  = _ enum_values: EnumValue+ _ {
    return { enum_values: enum_values }
  }

EnumValue
  = _ name:name sp* enum_setting:EnumSetting? sp* comment? newline {
    const enum_value = {
      name: name,
      token: location(),
    }
    Object.assign(enum_value, enum_setting);
    return enum_value;
  }

EnumSetting
  = "[" _ v:ObjectNote _ "]" {
    return {
      note: v
    };
   }

// simply an array of FieldSetting(s)
FieldSettings
  = "[" first:FieldSetting rest:(Comma FieldSetting)* "]" {
    let arrSettings = [first].concat(rest.map(el => el[1]));
    let res = {
      inline_refs: [],
    };
    arrSettings.forEach((ele) => {
      if (typeof ele === 'string') {
        if (ele.toLowerCase() == "not null") {
          res.not_null = true;
        }
        if (ele.toLowerCase() == "null") {
          res.not_null = false;
        }
        if (ele.toLowerCase() == "primary key" || ele.toLowerCase() == 'pk') {
          res.pk = true;
        }
        if (ele.toLowerCase() == "unique") {
          res.unique = true;
        }
        if (ele.toLowerCase() == "increment") {
          res.increment = true;
        }
      } else {
        if (ele.type === "note") {
          res.note = ele.value;
        }
        if (ele.type === "ref_inline") {
          res.inline_refs.push(ele.value);
        }
        if (ele.type === "default") {
          res.dbdefault = ele.value;
        }
      }
    });
    return res;
  }

TableSettings
  = "[" first:TableSetting rest:(Comma TableSetting)* "]" {
    let settings = [first, ...rest.map(el => el[1])];
    const result = {};
    settings.forEach((el) => {
        if (typeof el === 'string') {
        if (el.startsWith('#')) {
          result.headerColor = el.toUpperCase();
        }
        } else {
         if (el.type === "note") {
           result.note = el.value;
          }
        }
    });
    return result;
  }

TableSetting
  = _ v:ObjectNote _ { return { type: 'note', value: v } }
  / _ c: HeaderColor _ { return c }

FieldSetting
  = _ a:"not null"i _ { return a }
  / _ a:"null"i _ { return a }
  / _ a:"primary key"i _ { return a }
  / _ a:"pk"i _ { return a }
  / _ a:"unique"i _ { return a }
  / _ a:"increment" _ { return a }
  / _ v:ObjectNote _ { return { type: 'note', value: v } }
  / _ v:RefInline _ { return { type: 'ref_inline', value: v } }
  / _ v:Default _ {return {type: 'default', value: v} }

Indexes
  = _ indexes _ "{" body:IndexesBody "}"
    {
      return body;
    }
    
IndexesBody = _ index: Index+ _ {
  return index;
}

Index
  = _ index:(SingleIndexSyntax/CompositeIndexSyntax) _ { return index }

SingleIndexSyntax = _ syntax:SingleIndex sp* index_settings:IndexSettings? {
  const index = {
    columns: [syntax],
    token: location()
  };
  Object.assign(index, index_settings);
  return index;
 }

// CompositeIndexSyntax includes normal composite index and composite primary key
CompositeIndexSyntax = _ syntax:CompositeIndex sp* index_settings:IndexSettings? {
  const index = {
    columns: syntax,
    token: location()
  };
  Object.assign(index, index_settings);
  return index;
}

SingleIndex
 =  column:name sp* {
    const singleIndex = {
      value: column,
      type: 'column'
    }
    return singleIndex
  }
 / Expression


Expression
 = "`" text:([^\`])* "`" { return { value:  text.join(""), type: 'expression'} }

CompositeIndex
= "(" sp* first:SingleIndex rest:(Comma sp* SingleIndex)* ")"  {
   let arrIndex = [first].concat(rest.map(el => el[2]));
   return arrIndex;
}

IndexSettings
  = "[" first:IndexSetting rest:(Comma IndexSetting)* "]" {
    let arrSettings = [first].concat(rest.map(el => el[1]));
        let res = {};
    arrSettings.forEach((ele) => {
      if (typeof ele === 'string') {
        res[ele.toLowerCase()] = true;
      } else {
        res[ele.type] = ele.value;
      }
    });
    return res;
  }

IndexSetting
  =
    _ a:"unique"i _ { return a }
  / _ v:IndexName _ { return { type: 'name', value: v } }
  / _ v:IndexType _ { return { type: 'type', value: v } }
  / _ v:ObjectNote _ { return { type: 'note', value: v } }
  / _ pk _ { return { type: 'pk', value: true } }
IndexName
  = "name:"i _ val:StringLiteral { return val.value }
ObjectNoteElement
  = note: ObjectNote { return note }
  / "note"i _ "{" _ val:StringLiteral _ "}" {
    return {
      value: val.value,
      token: location(),
    }
  }
ObjectNote
  = "note:"i _ val:StringLiteral {
    return {
      value: val.value,
      token: location(),
    }
  }
IndexType
  = "type:"i _ val:(btree/hash) { return val }
RefInline
  = "ref:" sp* relation:relation sp+ field:inline_field_identifier{
      return {
        schemaName: field.schemaName,
        tableName: field.tableName,
        fieldNames: [field.fieldName],
        relation: relation,
        token: location(),
      }
  }
Default
  = "default:"i _ val: DefaultVal {return val}

DefaultVal = (StringLiteral / Expression / BooleanLiteral/ NumberLiteral)


alias_def
  = sp+ "as" sp+ alias:name {
      return alias
    }

HeaderColor
  = _ header_color ":" _ s:sharp color:hex_color _ {return s + color.join('')}

hex_color
  = six_char / three_char

three_char
  = hex_char hex_char hex_char

six_char
  = hex_char hex_char hex_char hex_char hex_char hex_char

// To be deprecated
constrain
  = unique
  / pk

// Keywords
project "project" = "project"i
table "table" = "table"i
as = "as"i
ref "references" = "ref"i
unique "unique" = "unique"i { return {unique: true} }
pk "PK" = "pk"i {return {pk: true}}
indexes "indexes" = "indexes"i
btree "btree" = "btree"i
hash "hash" = "hash"i
enum "enum" = "enum"i
header_color = "headercolor"i
table_group "Table Group" = "TableGroup"i
no_action "no action" = "no action"i
restrict "restrict" = "restrict"i
cascade "cascade" = "cascade"i
set_null "set null" = "set null"i
set_default "set default" = "set default"i

// Commonly used tokens
relation "<>, >, - or <" = '<>' / '>' / '<' / '-'
name "valid name"
  = c:(character+) { return c.join("") }
  / quote c:[^\"\n]+ quote { return c.join("") }

schema_name "schema name" = name:name "." { return name }

field_identifier = 
  schemaName:name "." tableName:name "." fieldNames:RefField { return { schemaName, tableName, fieldNames } } /
  tableName:name "." fieldNames:RefField { return { schemaName: null, tableName, fieldNames } }

inline_field_identifier = 
  schemaName:name "." tableName:name "." fieldName:name { return { schemaName, tableName, fieldName } } /
  tableName:name "." fieldName:name { return { schemaName: null, tableName, fieldName } }

type_name "valid name"
  = c:(type_character+) { return c.join("") }
  / quote c:[^\"\n]+ quote { return c.join("") }

type "type" = type_name:type_name args:(sp* "(" sp* expression sp* ")")? {
  args = args ? args[3] : null;

	if (type_name.toLowerCase() !== 'enum') {
		type_name = args ? type_name + '(' + args + ')' : type_name;
	}

	return {
		type_name,
		args
	}
}
expression "expression" = factors:factor* {
	return _.flattenDeep(factors).join("");
}
factor = factors:(character+ sp* "(" expression ")"
    / "(" expression ")"
    / (exprCharNoCommaSpace+ &(sp*/","/");"/endline");")) / exprChar+ &.) {
    	return _.flattenDeep(factors).join("");
    }
exprChar = [\',.a-z0-9_+-\`]i
    / sp
    / newline
    / tab
exprCharNoCommaSpace = [\'.a-z0-9_+-]i
allowed_chars = (! ('{'/ '}'/ whitespace_quote)) . {return text()}
type_character = character / [\[\]]
character "letter, number or underscore" = [a-z0-9_]i

hex_char = c:[0-9a-fA-F] {return c.toLowerCase()}
quote = "\""

// Ignored
_ = (comment/whitespace)*
__ = (comment/whitespace)+

endline "endline" = sp* newline
tab = "\t"
single_line_comment = "//" [^\n]*
multi_lime_comment = "/*" (!"*/" .)* "*/"
comment "comment" = single_line_comment / multi_lime_comment
newline "newline" = "\r\n" / "\n"
whitespace "whitespace" = [ \t\r\n\r]
whitespace_quote "whitespace" = [ \t\r\n\r\"]
sp = " "
Comma = ","
sharp = "#" {return "#"}

// Copied from https://github.com/pegjs/pegjs/issues/292
StringLiteral "string"
  = '"' chars:DoubleStringCharacter* '"' {
      return { value: chars.join(''), type: 'string' } ;
    }
    / "'''" chars: MultiLineStringCharacter* "'''" {
        let str = chars.join('');
        // // replace line continuation using look around, but this is not compatible with firefox, safari.
        // str = str.replace(/(?<!\\)\\(?!\\)(?:\n|\r\n)?/g, ''); 
        // str = str.replace(/\\\\/, '\\');

        let lines = str.split(/\n|\r\n?/);

        const leadingSpaces = (str) => {
          let i = 0;
          while (i < str.length && str[i] === ' ') {
            i += 1;
          }
          return i;
        }

        const minLeadingSpaces = lines.filter(line => line.replace(/\s+/g, ''))
          .reduce((acc, cur) => Math.min(acc, leadingSpaces(cur)), Number.MAX_SAFE_INTEGER);
        lines = lines.map(line => line ? line.slice(minLeadingSpaces) : line);

        const countLeadingEmptyLine = (lines) => {
          let i = 0;
          while (i < lines.length && !lines[i].replace(/\s+/g, '')) {
            i += 1;
          }
          return i;
        }
        lines.splice(0, countLeadingEmptyLine(lines));
        lines.splice(lines.length - countLeadingEmptyLine(lines.slice().reverse()));

        const finalStr = lines.join('\n');
        return { value: finalStr, type: 'string' } ;
    }
  / "'" chars:SingleStringCharacter* "'" {
      return { value: chars.join(''), type: 'string' } ;
    }
DoubleStringCharacter
  = '\\' '"' { return '"'; }
  / !'"' SourceCharacter { return text(); }

SingleStringCharacter
  = "\\'" { return "'"; }
  / !"'" SourceCharacter { return text(); }
MultiLineStringCharacter
 = "\\'" { return "'"; }
 / "\\" bl:"\\"+ { // escape character \. \\n => \n. Remove one backslash in the result string.
   return bl.join('');
 }
 / "\\" "\n"? { // replace line continuation
   return ''
 }
 / !"'''" SourceCharacter { return text(); }

SourceCharacter
  = .

digit = [0-9]
decimal_point = dot
equal = '='
dot = '.'
BooleanLiteral = boolean: ('true'i/'false'i/'null'i) {
  return {
    type: 'boolean',
    value: boolean
  };
}
NumberLiteral = minus:"-"? number:(float / integer) {
  return {
    type: 'number',
    value: minus ? -number : number
  };
}
float
    = left:[0-9]+ "." right:[0-9]+ { return parseFloat(left.join("") + "." +   right.join("")); }

integer
     = digits:[0-9]+ { return parseInt(digits.join(""), 10); }
