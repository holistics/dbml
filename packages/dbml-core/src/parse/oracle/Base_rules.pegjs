// Base rules:
// collumn_name, table_name
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

@import './Expression.pegjs'
