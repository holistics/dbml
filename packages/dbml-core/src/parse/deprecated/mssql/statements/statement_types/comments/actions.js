const isSchema = (type) => type.toLowerCase() === 'schema';
const isTable = (type) => type.toLowerCase() === 'table';
const isColumn = (type) => type.toLowerCase() === 'column';

const isValidTableNote = (level) => level.length === 2 && isSchema(level[0].type) && isTable(level[1].type);
const isValidColumnNote = (level) => level.length === 3
  && isSchema(level[0].type)
  && isTable(level[1].type)
  && isColumn(level[2].type);

function handleComment({ note, level }) {
  let type = 'unsupported';
  let schemaName = null;
  let tableName = null;
  let columnName = null;
  if (isValidTableNote(level)) {
    schemaName = level[0].name;
    tableName = level[1].name;
    // Table Comment
    type = 'table';
  } else if (isValidColumnNote(level)) {
    schemaName = level[0].name;
    tableName = level[1].name;
    columnName = level[2].name;
    type = 'column';
  }
  return {
    type: 'comment',
    value: {
      type,
      note,
      schemaName,
      tableName,
      columnName,
    },
  };
}

export {
  handleComment,
};
