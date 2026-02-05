import { makeTableConstraint } from '../../../../constraint_definition/index.js';

function makeDefault(_keyword, constExpression, _for, fieldName, _withValues) {
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
  value.fieldName = fieldName;
  return {
    type: 'dbdefault',
    value,
  };
}

export {
  makeTableConstraint,
  makeDefault,
};
