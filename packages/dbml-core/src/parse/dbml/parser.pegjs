{
  const data = {
  	tables: [],
    refs: [],
    enums: [],
    tableGroups: []
  };
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
  / __

TableGroupSyntax = table_group sp+ name:name _ "{" _ body:table_group_body _ "}" {
  return {
    name: name,
    tableNames: body,
    token: location()
  }
}

table_group_body = tables:(name __)* {
  return tables.map(t => t[0]);
}

// References
RefSyntax
  = r: (ref_long / ref_short) { return r; }

ref_long
  = ref name:(__ name)? _ "{" _ body:ref_body _ "}" {
      return {
        name: name? name[2] : null,
        endpoints: body,
        token: location()
      }
    }

ref_short
  = ref name:(sp+ name)? sp* ":" sp* body:ref_body {
      return {
        name: name? name[1] : null,
        endpoints: body,
        token: location()
      }
    }

ref_body
  = table1:name "." field1:name sp+ relation:relation sp+ table2:name "." field2:name {
    const endpoints = [
      {
        tableName: table1,
        fieldName: field1,
        relation: relation === ">" ? "*" : "1",
        token: location()
      },
      {
        tableName: table2,
        fieldName: field2,
        relation: relation === "<" ? "*" : "1",
        token: location()
      }
    ];
    return endpoints;
  }

// Tables
TableSyntax
  = table sp+ name:name alias:alias_def? headerColor:(__ c:HeaderColor{return c})? _ "{" body:TableBody "}" {
      let fields = body.fields || [];
      let indexes = body.indexes || [];
      headerColor = headerColor || '#316896'
      // Handle list of partial inline_refs
      let refs = []

      fields.forEach((field) => {
        (field.inline_refs || []).forEach((iref) => {
          const endpoints = [
          {
            tableName: iref.tableName,
            fieldName: iref.fieldName,
            relation: iref.relation === "<" ? "*" : "1",
            token: iref.token
          },
          {
            tableName: name,
            fieldName: field.name,
            relation: iref.relation === ">" ? "*" : "1",
            token: iref.token
          }];

          let ref = {
            name: null, // no name
            endpoints: endpoints,
            token: iref.token
          }
          data.refs.push(ref);
        })
      });

      return {
        name: name,
        alias: alias,
        fields: fields,
        token: location(),
        indexes: indexes,
        headerColor: headerColor
      };
    }

TableBody
  = _ fields: Field + _ indexes:(Indexes)? _ {

    return {fields: fields, indexes : indexes }}

Field
  = _ name:name sp+ type:type constrains:(sp+ constrain)* sp* field_settings:FieldSettings? sp* comment? newline {
    const field = {
      name: name,
      type: type,
      token: location(),
      inline_refs: []
    }
    Object.assign(field, ...constrains.map(c => c[1]));
    Object.assign(field, field_settings);
    return field;
  }

EnumSyntax
  = enum sp+ name:name _ "{" body: EnumBody "}" {
    return {
      name: name,
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

FieldSetting
  = _ a:"not null"i _ { return a }
  / _ a:"null"i _ { return a }
  / _ a:"primary key"i _ { return a }
  / _ a:"pk"i _ { return a }
  / _ a:"unique"i _ { return a }
  / _ a:"increment" _ { return a }
  / _ v:ObjectNote _ { return { type: 'note', value: v } }
  / _ v:RefInline { return { type: 'ref_inline', value: v } }
  / _ v:Default _ {return {type: 'default', value: v} }

Indexes
  = _ indexes _ "{" newline first: Index rest:(sp* newline Index)* _ "}" sp* newline
    {
      let result= [first].concat(rest.map(el => el[2]));
      return result;
    }

Index
 =  _ syntax:IndexSyntax  sp* index_settings:(IndexSettings)? {
  	if (!Array.isArray(syntax)) {
    	syntax = [syntax];
    }
    
    const index = {
    	columns: syntax,
      token: location()
    };
    Object.assign(index, index_settings);
    return index;
 }

IndexSyntax
= SingleIndex
/ CompositeIndex

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
        if (ele.toLowerCase() == "unique") {
          res.unique = true;
        }
      } else {
        if (ele.type === "name") {
          res.name = ele.value;
        }
        if (ele.type === "type") {
          res.type = ele.value;
        }
        if (ele.type === "default") {
          res.dbdefault = ele.value;
        }
      }
    });
    return res;
  }

IndexSetting
  =
    _ a:"unique"i _ { return a }
  / _ v:IndexName _ { return { type: 'name', value: v } }
  / _ v:IndexType _ { return { type: 'type', value: v } }
IndexName
  = "name:"i _ val:StringLiteral { return val.value }
ObjectNote
  = "note:"i _ val:StringLiteral { return val.value }
IndexType
  = "type:"i _ val:(btree/hash) { return val }
RefInline
  = "ref:" sp* relation:relation sp+ table2:name "." field2:name {
      return {
        tableName: table2,
        fieldName: field2,
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
  = _ "[" _ header_color ":" _ s:sharp color:hex_color _ "]" {return s + color.join('')}

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

// Commonly used tokens
relation ">, - or <" = [>\-<]
name "valid name"
  = c:(character+) { return c.join("") }
  / quote c:[^\"\n]+ quote { return c.join("") }

type "type" = c:type_name { return c }
type_name = type_name:name args:(sp* "(" sp* expression sp* ")")? {
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
character "letter, number or underscore" = [a-z0-9_]i

hex_char = c:[0-9a-fA-F] {return c.toLowerCase()}
quote = "\""

// Ignored
_ = (comment/whitespace)*
__ = (comment/whitespace)+

endline "endline" = sp* newline
tab = "\t"
comment "comment" = "//" [^\n]*
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
  / "'" chars:SingleStringCharacter* "'" {
      return { value: chars.join(''), type: 'string' } ;
    }
DoubleStringCharacter
  = '\\' '"' { return '"'; }
  / !'"' SourceCharacter { return text(); }

SingleStringCharacter
  = '\\' "'" { return "'"; }
  / !"'" SourceCharacter { return text(); }

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
NumberLiteral = number:(float / integer) {
  return {
    type: 'number',
    value: number
  };
}
float
    = left:[0-9]+ "." right:[0-9]+ { return parseFloat(left.join("") + "." +   right.join("")); }

integer
     = digits:[0-9]+ { return parseInt(digits.join(""), 10); }
