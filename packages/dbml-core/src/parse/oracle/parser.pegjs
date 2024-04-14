{
	const tables = [];
	const refs = [];
	const enums = [];
	const warnings = [];
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
					case "table":	{
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

@import "./Commands/Commands.pegjs"
@import "./InitializerUtils.pegjs"
@import "./Keywords.pegjs"
@import "./Base_rules.pegjs"
@import "./Expression.pegjs"
