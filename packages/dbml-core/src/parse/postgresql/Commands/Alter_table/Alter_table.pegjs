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
