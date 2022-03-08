create_type_enum = 
	_ CREATE __ TYPE __ enumName:enum_name __ AS __ ENUM _
	"(" _ labels:labels _ ")" 
	_ semicolon _ {
		const values = labels.map(name => ({ name }))
		return {
			syntax_name: "create_type_enum",
			value: {
				...enumName,
				values,
			}
		}
	}

labels = first:label rest:(_ comma _ label)* {
	return [first, ...rest.map(r => r[3])]
}

label = string_constant