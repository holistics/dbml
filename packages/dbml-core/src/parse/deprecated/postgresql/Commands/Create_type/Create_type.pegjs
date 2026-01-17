create_type = create_type_enum:create_type_enum {
		return {
			command_name: "create_type",
			value: create_type_enum
		}
	}
	/ create_type_range:create_type_range {
		return {
			command_name: "create_type",
			value: create_type_range
		}
	}

@import './Create_type_enum.pegjs'
@import './Create_type_range.pegjs'