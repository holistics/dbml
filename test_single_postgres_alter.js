const Parser = require('./packages/dbml-core/lib/parse/Parser').default;

const sql = `
CREATE TABLE products (
  id INT PRIMARY KEY,
  price DECIMAL(10,4)
);

ALTER TABLE products ADD CHECK (price > 0);
ALTER TABLE products ADD CONSTRAINT chk_price_upper CHECK (price <= 1000000);
`;

const output = Parser.parsePostgresToJSONv2(sql);
console.log(JSON.stringify(output, null, 2));
