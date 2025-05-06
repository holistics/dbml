-- Create users table as a transient table
CREATE OR REPLACE TRANSIENT TABLE users (
  user_id INT AUTOINCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(50),
  last_name VARCHAR(50),
  full_name VARCHAR(100),
  date_of_birth DATE,
  created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
  last_login TIMESTAMP_NTZ,
  is_active BOOLEAN DEFAULT TRUE
);

-- Create products table as a transient table
CREATE OR REPLACE TRANSIENT TABLE products (
  product_id INT AUTOINCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  category VARCHAR(50),
  created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
  is_available BOOLEAN DEFAULT TRUE
);

-- Create orders table as a transient table
CREATE OR REPLACE TRANSIENT TABLE orders (
  order_id INT AUTOINCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  order_date TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
  total_amount DECIMAL(12, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  shipping_address TEXT NOT NULL,
  billing_address TEXT NOT NULL,
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Create order_items table as a transient table
CREATE OR REPLACE TRANSIENT TABLE order_items (
  order_item_id INT AUTOINCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  CONSTRAINT fk_order FOREIGN KEY (order_id) REFERENCES orders(order_id),
  CONSTRAINT fk_product FOREIGN KEY (product_id) REFERENCES products(product_id)
);

-- Create table with all data types
CREATE OR REPLACE TABLE all_data_types (
  -- String Types
  string_col STRING DEFAULT 'default_string',
  varchar_col VARCHAR(100) DEFAULT 'default_varchar',
  char_col CHAR(10) DEFAULT 'default_char',
  nchar_col NCHAR(10) DEFAULT 'default_nchar',
  text_col TEXT DEFAULT 'default_text',
  binary_col BINARY,
  varbinary_col VARBINARY,
  array_col ARRAY DEFAULT ARRAY_CONSTRUCT('default_array1', 'default_array2'),
  json_col VARIANT DEFAULT PARSE_JSON('{"default_key": "default_value"}'),

  -- Numeric Types
  int_col INT DEFAULT 42,
  bigint_col BIGINT DEFAULT 9223372036854775807,
  smallint_col SMALLINT DEFAULT 32767,
  tinyint_col TINYINT DEFAULT 127,
  number_col NUMBER(10, 2) DEFAULT 99.99,
  decimal_col DECIMAL(10, 2) DEFAULT 99.99,
  real_col REAL DEFAULT 3.402823e+38,
  float_col FLOAT DEFAULT 1.7976931348623157e+308,
  double_col DOUBLE DEFAULT 1.7976931348623157e+308,

  -- Boolean Type
  boolean_col BOOLEAN DEFAULT TRUE,

  -- Date/Time Types
  date_col DATE DEFAULT CURRENT_DATE(),
  time_col TIME DEFAULT CURRENT_TIME(),
  timestamp_col TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
  timestamp_tz_col TIMESTAMP_TZ DEFAULT CURRENT_TIMESTAMP(),
  timestamp_ltz_col TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP()
);

-- Create table with user-defined data types
CREATE OR REPLACE TABLE user_define_data_types (
  id INT AUTOINCREMENT PRIMARY KEY,
  name VARCHAR(50),
  gender VARCHAR(10),  -- Enforcing enum-like behavior can be handled in application logic
  age_range VARIANT,  -- Example range check for age can be handled in application logic
  height FLOAT,
  weight FLOAT
);

-- Create table with comments
CREATE OR REPLACE TABLE table_with_comments (
  id INT AUTOINCREMENT PRIMARY KEY,
  name VARCHAR(100),
  description TEXT,
  created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- Add comments
COMMENT ON TABLE table_with_comments IS 'This table stores information about various items.';
COMMENT ON COLUMN table_with_comments.id IS 'Unique identifier for each item.';
COMMENT ON COLUMN table_with_comments.name IS 'Name of the item.';
COMMENT ON COLUMN table_with_comments.description IS 'Detailed description of the item.';
COMMENT ON COLUMN table_with_comments.created_at IS 'Timestamp when the item was created.';

-- Create Authors table
CREATE OR REPLACE TABLE Authors (
  AuthorID INT AUTOINCREMENT,
  NationalityID INT,
  AuthorName VARCHAR(100),
  BirthYear INT,
  PRIMARY KEY (AuthorID, NationalityID)  -- Composite primary key
);

-- Create Books table
CREATE OR REPLACE TABLE Books (
  BookID INT AUTOINCREMENT PRIMARY KEY,
  AuthorID INT,
  NationalityID INT,
  ISBN VARCHAR(20),
  Title VARCHAR(200),
  UNIQUE (ISBN),
  CONSTRAINT FK_AuthorNationality FOREIGN KEY (AuthorID, NationalityID)
    REFERENCES Authors (AuthorID, NationalityID)
);
