create_type_enum = 
	_ CREATE __ TYPE __ name:identifier __ AS __ ENUM _
	"(" _ labels:labels _ ")" 
	_ semicolon _ {
		const values = labels.map(name => ({ name }))
		return {
			syntax_name: "create_type_enum",
			value: {
				name,
				values,
			}
		}
	}

labels = first:label rest:(_ comma _ label)* {
	return [first, ...rest.map(r => r[3])]
}

label = string_constant