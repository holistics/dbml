{
  var pluralize = require('pluralize');
  var lodash = require('lodash');

  let data = {
    tables: [],
    refs: []
  }

  function pushTable(table) {
    if (data.tables.find(t => t.name == table.name)) {
      error("Duplicated table name");
    } else {
      const idField = table.fields.find(field => field.name === "id");
      if (!idField) {
        table.fields.unshift({
          name: "id",
          type: { type_name: "varchar" }
        });
      }
      data.tables.push(table);
    }
  }

  function addPrimaryKey(fields = [], props = []) {
    const primaryKey = props.find(prop => prop.name === 'primary_key');
    if (!primaryKey) return fields;
    if (fields.find(key => key.name === primaryKey.value)) {
      return fields.map(({ name, type}) => ({
        name, type,
        PK: primaryKey.value === field.name,
      }))
    }
    const newFields = [{
      name: primaryKey.value,
      type: { type_name: "varchar" },
      PK: true,
    }];
    return newFields.concat(fields);
  }

  function findTableByNameOrAlias(name) {
    const table = data.tables.find(t => t.name == name || t.alias == name);
    if (table === undefined) {
       error("Table " + name +" not found");
    }
    return table;
  }

  function isSameEndpoints (endpoint1, endpoint2) {
    return endpoint1.tableName == endpoint2.tableName && 
      lodash.isEqual(lodash.sortBy(endpoint1.fieldNames), lodash.sortBy(endpoint2.fieldNames))
  }

  function isSameEndpointsPairs (endpointsPair1, endpointsPair2) {
    return isSameEndpoints(endpointsPair1[0], endpointsPair2[0])
      && isSameEndpoints(endpointsPair1[1], endpointsPair2[1])
  }

  function isSameEndpointsRefs(ref1, ref2) {
     return isSameEndpointsPairs (ref1.endpoints, ref2.endpoints)
       || isSameEndpointsPairs(ref1.endpoints, ref2.endpoints.slice().reverse())
  }

  function pushRef(ref) {
    if (!ref) return;
    if (data.refs.find(p => isSameEndpointsRefs(p, ref))) {
      error("Duplicated references");
    }
    data.refs.push(ref);
  }
  function pushRefs(refs = []) {
    if (!refs || refs.length === 0) return
    for(let i = 0; i < refs.length; i += 1) {
      pushRef(refs[i]);
    }
  }
  function refactorForeign(ref) {
    // add relation
    const { tables } = data;
    const { endpoints } = ref;
    const fromTable = tables.find(table => table.name === endpoints[0].tableName)
    if (!fromTable) {
      // TODO: handle error
      // throw {
      //   message: `Table ${endpoints[0].table} not found`
      // }
      // return ref;
      return null;
    }
    const toTable = tables.find(table => table.name === endpoints[1].tableName)
    if (!toTable) {
      // TODO: handle error
      // throw {
      //   message: `Table ${endpoints[1].table} not found`
      // }
      // return ref;
      return null;
    }
    if (!endpoints[0].fieldNames) {
      const singleNameOfPrimaryTable = pluralize.singular(endpoints[1].tableName)
      const columnName = `${singleNameOfPrimaryTable}_id`;
      endpoints[0].fieldNames = [columnName];
      const columnField = fromTable.fields.find(field => field.name === columnName);
      if (!columnField) {
        // TODO: handle erro
        // throw {
        //   message: `Field ${columnName} not found in table ${endpoints[0].table}`
        // }
        // return ref;
        return null;
      }
      endpoints[0].fieldNames = [columnName];
    }
    if (!endpoints[1].fieldNames) {
      const primaryKey = 'id';
      endpoints[1].fieldNames = [primaryKey];
    }
    return ref;
  }

  function createForeign(fromTable, toTable, props) {
    const endpoints = ([{
      tableName: fromTable,
      relation: '1',
    },
    {
      tableName: toTable,
      relation: '1',
    }]);
    let refProp = {};
    for (let i = 0; i < props.length; i += 1) {
      const currentProp = props[i];
      if (currentProp.columnName) {
        endpoints[0].fieldNames = [currentProp.columnName];
      }
      if (currentProp.primaryKey) {
        endpoints[1].fieldNames = [currentProp.primaryKey];
      }
      if (currentProp.onDelete) {
        refProp = {
          ...refProp,
          onDelete: currentProp.onDelete
        }
      }
      if (currentProp.onUpdate) {
        refProp = {
          ...refProp,
          onUpdate: currentProp.onUpdate
        }
      }
    }
    return {
      name: `fk_rails_${fromTable}_${toTable}`,
      endpoints,
      ...refProp
    };
  }

  function createRefFromTableWithReference(table, references) {
    if (!references || references.length === 0) {
      return [];
    }
    const refs = [];
    for (let i = 0; i < references.length; i += 1) {
      const reference = references[i];
      const referenceTable = pluralize.plural(reference);
      const { tables } = data;

      const toTable = tables.find(table => table.name === referenceTable)

      if (!toTable) {
        continue;
      }
      // add field to table if not exists (`${reference}_id`)
      // auto add type of new field to be varchar if primaryKey not found
      const columnName = `${reference}_id`;
      const primaryKeyName = 'id';
      const column = table.fields.find(field => field.name === columnName);
      const primaryKey = toTable.fields.find(field => field.name === primaryKeyName);
      if (!column) {
        table.fields.push({
          name: columnName,
          type: { type_name: primaryKey ? primaryKey.type.type_name : 'varchar'},
        })
      }

      refs.push({
        name: `fk_rails_${table.name}_${referenceTable}`,
        endpoints: [
          {
            tableName: table.name,
            fieldNames: [columnName],
            relation: '1',
          },
          {
            tableName: referenceTable,
            fieldNames: [primaryKeyName],
            relation: '1',
          }
        ]
      })
    }
    return refs;
  }
  function implicityRef(data) {
    const { tables, refs } = data;
    const tableWithFieldName = tables.map(table => {
      const { name } = table;
      const singularName = pluralize.singular(name);
      return ({
        name,
        field: `${singularName}_id`
      });
    })
    for (let i = 0; i < tables.length; i += 1) {
      const table = tables[i];
      const { fields } = table;
      for (let j = 0; j < fields.length; j += 1) {
        const field = fields[j];
        const refWithTable = tableWithFieldName.find(table => table.field === field.name);
        if (refWithTable) {
          const newRef = ({
            name: `fk_rails_${table.name}_${refWithTable.name}`,
            endpoints: [
              {
                tableName: table.name,
                fieldNames: [field.name],
                relation: '1',
              },
              {
                tableName: refWithTable.name,
                fieldNames: ['id'],
                relation: '1',
              }
            ]
          });
          const duplicateRef = refs.find(ref => isSameEndpointsRefs(ref, newRef));
          if (!duplicateRef) {
            refs.push(newRef)
          }
        }
      }
    }
    return data;
  }
}

schema = line_rule* {
  return implicityRef(data)
}

line_rule
  = whitespace* rule
  / comment_line
  / end_line
  / __

rule = tableData:create_table_syntax {
  const { table, refs } = tableData;
  pushTable(table);
  pushRefs(refs)
}
/ r:add_foreign_key_syntax {
    pushRef(r);
  }
/ other_class_prop

add_foreign_key_syntax
  = sp* add_foreign_key sp* fromTable:name","sp* toTable:name props:add_foreign_key_props_syntax* {
    const foreign = refactorForeign(createForeign(fromTable, toTable, props));
    return foreign;
  }

add_foreign_key_props_syntax
= "," sp* column":" sp* columnName:name { return ({ columnName }) }
/ "," sp* primary_key":" sp* primaryKey:name { return ({ primaryKey }) }
/ "," sp* r:referential_actions":" sp* value:symbol {
  switch (r.toLowerCase()) {
    case 'on_delete':
      return {
        onDelete: value.split('_').join(' ')
      }
    case 'on_update':
      return {
        onUpdate: value.split('_').join(' ')
      }
  }
 }

create_table_syntax
  = create_table sp* name:name whateters endline
    body:table_body
  end_line {
    const table = ({
      name,
      fields: addPrimaryKey(body.fields),
      // index: _.union(...body.index)
    })
    return {
      table,
      refs: createRefFromTableWithReference(table, body.references)
    };
  }

table_body = fields:field* {
    return ({
      fields: fields.filter(field => field.isField).map(field => field.field),
      index: fields.filter(field => field.isIndex).map(field => field.index),
      references: fields.filter(field => field.isReferences).map(field => field.reference),
    });
  }

field = whitespace* field:table_field_syntax whatever* endline { return field }

table_field_syntax
  = field_index_syntax
  / reference: field_reference_syntax { return ({ reference, isReferences: true })}
  / field:field_type_syntax { return ({ field, isField: true }) }

field_index_syntax = index sp+ whateters
field_reference_syntax = references sp+ reference:reference_value {
    return reference;
  }
field_type_syntax = type:field_type sp+ name:name {
    return ({
      name: name,
      type: {type_name: type},
    })
  }

reference_value = ":"reference:variable { return reference }
  / reference:name { return reference }

referential_actions = "on_delete"i / "on_update"i

// Keywords
add_index "add index" = "add_index"
schema_define "schema define" = "ActiveRecord::Schema.define"
create_table "create table" = "create_table"i
end_create_table "do |t|" = do sp+ abs character abs endline
index "index" = character ".index"
references "references" = character ".references"
add_foreign_key "add foreign key" = "add_foreign_key"i
column "column" = "column"
primary_key "primary key" = "primary_key"
version = "version"
do = "do"
end = "end"
lambda_function "lambda function" = "=>" / "->"
other_class_prop = variable whateters endline?

// normal syntax
name = double_quote_name / single_quote_name
double_quote_name = double_quote c:[^\"\n]* double_quote { return c.join("") }
single_quote_name = single_quote c:[^\'\n]* single_quote { return c.join("") }
symbol = ":" c:character* { return c.join("") }
variable = c:(character+) { return c.join("") }
field_type = character"."c:(character+) { return c.join("") }
not_whitespace = !whitespace . {return text()}
number = [0-9]i
character "letter, number or underscore" = [a-z0-9_.]i
end_line = whitespace* end endline?
whatever_line = whitespace* (whateters ! end) endline?
comment_line "comment line" = whitespace* "#" whateters endline?
whateters "whatever" = [^\t\r\n]*
whatever = [^\t\r\n]
single_quote = "'"
double_quote = "\""

// Ignored
_ = (comment/whitespace)*
__ = (comment/whitespace)+

abs = "|"
endline = sp* newline;
comment "comment" = "//" [^\n]?
newline "newline" = "\r\n"  / "\n"
whitespace "whitespace" = [ \t\r\n\r]
sp = " "
