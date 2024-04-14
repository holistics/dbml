create_table_normal =
	_ CREATE __ ( (( GLOBAL __ / PRIVATE) __ TEMPORARY __) / SHARDED / DUPLICATED / IMMUTABLE/ IMMUTABLE_BLOCKCHAIN )? TABLE (__ IF_NOT_EXISTS)? __ table_name:table_name _ "(" _
	table_properties:table_properties _ ")"
	(__ SEGMENT __ CREATION __ (IMMEDIATE / DEFERRED))?
	(__ PCTFREE __ int:integer)?
	(__ PCTUSED __ int:integer)?
	(__ INITRANS __ int:integer)?
	(__ MAXTRANS __ int:integer)?
	(__ (COMPRESS / NOCOMPRESS) __ LOGGING)?
	(__ STORAGE _ "(" (INITIAL __ int:integer)? (__ NEXT __ int:integer)? (__ MINEXTENTS __ int:integer)? (__ MAXEXTENTS __ ( UNLIMITED / int:integer))? (__ PCTINCREASE __ int:integer)? (__ FREELISTS __ int:integer)? (__ FREELIST __ GROUPS __ int:integer)? (__ OPTIMAL __ (int:integer / NULL)?)? (__ BUFFER_POOL __ (KEEP / RECYCLE / DEFAULT))? (__ FLASH_CACHE __ (KEEP / NONE / DEFAULT))? (__ CELL_FLASH_CACHE __ (KEEP / NONE / DEFAULT))? (__ ENCRYPT)? _ ")" )?
	(__ TABLESPACE __ tablespace_name:identifier)?
	_ semicolon _ {
		const table = { name: table_name.name, schemaName: table_name.schemaName, fields: [], indexes: [] }
		// process table_properties
		table_properties.forEach(({ table_property_name, value }) => {
			switch(table_property_name.toLowerCase()) {
				case "column":
					// if column contains inline_refs
					// if(value.inline_refs && value.inline_refs.length > 0) {
					// 	value.inline_refs.forEach(({ endpoints }) => {
					// 		endpoints[0].tableName = table_name;
					// 	})
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

integer = digits:[0-9]+ {
    return parseInt(digits.join(''));
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
	/ column_name:column_name __ data_type:data_type column_constraints:(_ column_constraint)* {
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
	/ GENERATED __ (ALWAYS/ BY __ DEFAULT) __ (ON __ NULL __)? AS __ IDENTITY { return { type: "increment" } } // (_ "("_ sequence_options _ ")")? { return { type: "not_supported" } }
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
	) {
		return column_constraint;
	}

// return { type, t_value }
table_constraint = constraint_name:(CONSTRAINT __ constraint_name:identifier __ { return constraint_name })?
	table_constraint: ( CHECK _ "("_ expression _")" (__ NO __ INHERIT)? { return { type:"not_supported" } }
	/ UNIQUE _ "(" _ column_names:column_names _ ")" (__ index_parameters)? { return { type: "unique", t_value: column_names } }
	/ PRIMARY_KEY _ "("_ column_names:column_names _ ")" (__ index_parameters)? { return { type: "pk", t_value: column_names } }
	/ FOREIGN_KEY _ "(" _ column_names:column_names _ ")" _ REFERENCES __ reftable:table_name refcolumn:( _ "(" _ refcolumn:column_names _ ")" {return refcolumn})?
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
	) {
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

@import '../../Keywords.pegjs'
@import '../../Base_rules.pegjs'
