create_index =
    _ CREATE unique:(__ UNIQUE)? __ INDEX (__ IF_NOT_EXISTS)?
    name:(__ ON {return null} / __ name:identifier __ ON {return name}) // to solve problem of identifier(accept "id" and id)
    (__ ONLY)? __ table_name:table_name
    type:(__ USING __ type:index_method {return type})? _
    "(" _ index_properties:index_properties _ ")"
    (__ INCLUDE _ "(" _ column_names _ ")")? // reuse collumn_names
    (__ WITH _ "("_ index_storage_parameters _")")?
    (__ TABLESPACE __ tablespace_name:identifier)?
    (__ WHERE _ "(" _ predicate:expression _ ")")?
    _ semicolon _ {
        const value = {
            syntax_name: "create_table",
            value: {
                table_name,
                columns: index_properties
            }
        }

        if (name)
            value.value.name = name;

        if (unique)
            value.value.unique = true;

        if (type)
            value.value.type = type.toUpperCase();

        return {
            command_name: "create_index",
            value
        }
    }

index_properties = first:index_property rest:(_ comma _ index_property)* {
    return [first, ...rest.map(r => r[3])];
}

index_property =
    column : (
        c:column_name { return {value: `${c}`, type: "string" }}
        / e:expression {return { value:`${e}`, type: "expression"}})
    (__ "ASC"/__ "DESC")? {
    return column;
}

index_storage_parameters = first:(index_storage_parameter _ "=" _ value:expression) rest:(_ comma _ index_storage_parameter _ "=" value:expression)*

index_storage_parameter =
    "fillfactor"i
