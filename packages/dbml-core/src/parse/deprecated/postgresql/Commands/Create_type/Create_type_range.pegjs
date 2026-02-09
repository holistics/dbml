create_type_range = 
	_ CREATE __ TYPE __ name:identifier __ AS __ RANGE _ "(" _
		SUBTYPE _ "=" _ subtype:expression
		(_ comma _ SUBTYPE_OPCLASS _ "=" _ subtype_operator_class:expression)?
		(_ comma _ COLLATE _ "=" _ collation:identifier)?
		(_ comma _ CANONICAL _ "=" _ canonical_function:expression)? // should be more clearly
		(_ comma _ SUBTYPE_DIFF _ "=" _ subtype_diff_function:expression)? // should be more clearly
	_ ")" _ semicolon _ {
		return {
			syntax_name: "create_table_range"
		}
	}