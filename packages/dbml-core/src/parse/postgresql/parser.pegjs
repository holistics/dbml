{
	const tables = [];
	const refs = [];
	const enums = [];
}

parser = commands:command* {
	commands.forEach(({ command_name, value: { syntax_name, value } }) => {
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
								refs.push(...field.inline_refs.map(ref => ({
									endpoints: [
									{
										tableName: table.name,
										fieldName: field.name,
										relation: "1",
									},
									ref]
								})));
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
				const table_index = tables.find(table => table.name === table_name);
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
					case "column":
						const table_comment = tables.find(table => table.name === value.relation_name);
						const field_comment = table_comment.fields.find(field => field.name === value.column_name);
						field_comment.note = value.text;
						break;
				}
				break;
			case "ignore_commands":
				break;
		}
	})
	// console.log({tables, refs, enums, indexes});
	return {tables, refs, enums};
}

@import "./Commands/Commands.pegjs"
@import "./InitializerUtils.pegjs"
@import "./Keywords.pegjs"
@import "./Base_rules.pegjs"
@import "./Expression.pegjs"
