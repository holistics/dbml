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
