function makeDefaultConstraint (_keyword, constExpression) {
  const value = {};
  if (constExpression.type) {
    switch (constExpression.type) {
      case 'string':
      case 'number':
      case 'boolean':
        value.type = constExpression.type;
        break;

      default:
        value.type = 'expression';
        break;
    }
  } else {
    value.type = 'expression';
  }
  value.value = constExpression.value;
  return {
    type: 'dbdefault',
    value,
  };
}

function makeConstraintCheckEnum (fieldName, _ununsed, values) {
  const valuesProp = [];
  values.forEach(value => {
    valuesProp.push({
      name: value.value.value,
      token: value.value.token,
    });
  });
  return {
    type: 'enums',
    value: {
      name: `${fieldName}_enum`,
      values: valuesProp,
      fieldName, // for alter table add enum
    },
  };
}

function makeTableConstraint (constraintName, option) {
  if (!option) return null;
  return {
    type: option.type,
    value: {
      // prop ordering important for tableConstraintIndex
      ...option.value,
      name: constraintName,
    },
  };
}

module.exports = {
  makeConstraintCheckEnum,
  makeDefaultConstraint,
  makeTableConstraint,
};
