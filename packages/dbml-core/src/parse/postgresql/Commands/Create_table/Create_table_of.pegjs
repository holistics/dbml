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
