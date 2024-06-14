command = create_table:create_table { return create_table }
	/ alter_table:alter_table { return alter_table }
	/ create_index:create_index { return create_index }
	/ comment:comment { return comment }
	/ ignore_syntax:ignore_syntax { return ignore_syntax }

@import "./Create_table/Create_table.pegjs"
@import "./Alter_table/Alter_table.pegjs"
@import "./Create_index.pegjs"
@import "./Comment.pegjs"
@import "./Ignore_syntax.pegjs"
