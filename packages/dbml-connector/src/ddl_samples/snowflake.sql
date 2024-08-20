-- Create users table
CREATE TABLE users (
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
  is_active BOOLEAN DEFAULT TRUE,
  CONSTRAINT chk_email_format CHECK (email ILIKE '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$'),
  CONSTRAINT chk_age CHECK (date_of_birth <= CURRENT_DATE() - INTERVAL '13 years')
);

-- Create an index on the email column for faster lookups
CREATE INDEX idx_users_email ON users (email);

CREATE UNIQUE INDEX idx_users_user_id ON users (user_id);

CREATE INDEX idx_users_full_name ON users (full_name);

CREATE INDEX idx_users_is_active ON users (is_active, LOWER(full_name));

-- Create products table
CREATE TABLE products (
  product_id INT AUTOINCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  category VARCHAR(50),
  created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
  is_available BOOLEAN DEFAULT TRUE,
  CONSTRAINT chk_price_positive CHECK (price > 0),
  CONSTRAINT chk_stock_non_negative CHECK (stock_quantity >= 0)
);

-- Create an index on the category column for faster filtering
CREATE INDEX idx_products_category ON products (category);

-- Create orders table
CREATE TABLE orders (
  order_id INT AUTOINCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  order_date TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
  total_amount DECIMAL(12, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  shipping_address TEXT NOT NULL,
  billing_address TEXT NOT NULL,
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT chk_total_amount_positive CHECK (total_amount > 0),
  CONSTRAINT chk_status CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled'))
);

-- Create an index on the user_id and order_date columns for faster querying
CREATE INDEX idx_orders_user_date ON orders (user_id, order_date);

-- Create order_items table
CREATE TABLE order_items (
  order_item_id INT AUTOINCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  CONSTRAINT fk_order FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  CONSTRAINT fk_product FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
  CONSTRAINT chk_quantity_positive CHECK (quantity > 0),
  CONSTRAINT chk_unit_price_positive CHECK (unit_price > 0),
  CONSTRAINT uq_order_product UNIQUE (order_id, product_id)
);

-- Create a composite index on order_id and product_id for faster joins
CREATE INDEX idx_order_items_order_product ON order_items (order_id, product_id);

-- Create table with all data types
CREATE TABLE all_data_types (
  -- String Types
  string_col STRING DEFAULT 'default_string',
  varchar_col VARCHAR(100) DEFAULT 'default_varchar',
  char_col CHAR(10) DEFAULT 'default_char',
  nchar_col NCHAR(10) DEFAULT 'default_nchar',
  text_col TEXT DEFAULT 'default_text',
  binary_col BINARY DEFAULT CONVERT_FROM('default_binary', 'UTF-8'),
  varbinary_col VARBINARY DEFAULT CONVERT_FROM('default_varbinary', 'UTF-8'),
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
  timestamp_ltz_col TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
  interval_col INTERVAL DEFAULT INTERVAL 1 DAY,

  -- Semi-Structured Types
  object_col OBJECT DEFAULT PARSE_JSON('{"default_key": "default_value"}'),
  array_object_col ARRAY OF OBJECT DEFAULT ARRAY_CONSTRUCT(PARSE_JSON('{"default_key1": "default_value1"}'), PARSE_JSON('{"default_key2": "default_value2"}')),
  geography_col GEOGRAPHY DEFAULT ST_POINT(0, 0),
  uuid_col UUID DEFAULT UUID()
);

-- Create table with user-defined data types
CREATE TABLE user_define_data_types (
  id INT AUTOINCREMENT PRIMARY KEY,
  name VARCHAR(50),
  gender VARCHAR(10) CHECK (gender IN ('Male', 'Female', 'Other')),  -- Enforcing enum-like behavior
  age_range VARIANT CHECK (age_range IS NULL OR (age_range:lower >= 0 AND age_range:upper <= 120)),  -- Example range check for age
  height FLOAT,
  weight FLOAT
);

-- Create table with comments
CREATE TABLE table_with_comments (
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
CREATE TABLE Authors (
  AuthorID INT AUTOINCREMENT,
  NationalityID INT,
  AuthorName VARCHAR(100),
  BirthYear INT,
  PRIMARY KEY (AuthorID, NationalityID)  -- Composite primary key
);

-- Create Books table
CREATE TABLE Books (
  BookID INT AUTOINCREMENT PRIMARY KEY,
  AuthorID INT,
  NationalityID INT,
  ISBN VARCHAR(20),
  Title VARCHAR(200),
  UNIQUE (ISBN),
  CONSTRAINT FK_AuthorNationality FOREIGN KEY (AuthorID, NationalityID)
    REFERENCES Authors (AuthorID, NationalityID) ON DELETE CASCADE
);
