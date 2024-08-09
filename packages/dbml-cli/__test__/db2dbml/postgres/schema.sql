-- Create users table
CREATE TABLE users (
  user_id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(50),
  last_name VARCHAR(50),
  full_name VARCHAR(100),
  date_of_birth DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  CONSTRAINT chk_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$'),
  CONSTRAINT chk_age CHECK (date_of_birth <= CURRENT_DATE - INTERVAL '13 years')
);

-- Create an index on the email column for faster lookups
CREATE INDEX idx_users_email ON users (email);

CREATE UNIQUE INDEX ON "users" ("user_id");

CREATE INDEX "User Name" ON "users" ("full_name");

CREATE INDEX ON "users" ("is_active", ((lower(full_name))));

-- Create products table
CREATE TABLE products (
  product_id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  category VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_available BOOLEAN DEFAULT TRUE,
  CONSTRAINT chk_price_positive CHECK (price > 0),
  CONSTRAINT chk_stock_non_negative CHECK (stock_quantity >= 0)
);

-- Create an index on the category column for faster filtering
CREATE INDEX idx_products_category ON products (category);

-- Create orders table
CREATE TABLE orders (
  order_id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  order_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
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
  order_item_id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
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

-- Create a table with default values for string types
CREATE TABLE all_string_types (
  text_col TEXT DEFAULT 'default_text',
  varchar_col VARCHAR(100) DEFAULT 'default_varchar',
  char_col CHAR(10) DEFAULT 'default_char',
  character_varying_col CHARACTER VARYING(50) DEFAULT 'default_character_varying',
  character_col CHARACTER(5) DEFAULT 'default_character',
  name_col NAME DEFAULT 'default_name',
  bpchar_col BPCHAR(15) DEFAULT 'default_bpchar',
  text_array_col TEXT[] DEFAULT ARRAY['default_text1', 'default_text2'],
  json_col JSON DEFAULT '{"default_key": "default_value"}',
  jsonb_col JSONB DEFAULT '{"default_key": "default_value"}'
);

-- Create a table with default value for number type, boolean type, date type
CREATE TABLE all_default_values (
  id SERIAL PRIMARY KEY,  -- A primary key column
  boolean_col BOOLEAN DEFAULT TRUE,  -- BOOLEAN type with default value
  integer_col INTEGER DEFAULT 42,  -- INTEGER type with default value
  numeric_col NUMERIC(10, 2) DEFAULT 99.99,  -- NUMERIC type with default value
  date_col DATE DEFAULT CURRENT_DATE,  -- DATE type with default value
  date_col_specific DATE DEFAULT '2024-01-01',  -- DATE with a specific default value
  timestamp_col TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- TIMESTAMP with default value
  timestamp_col_specific TIMESTAMP DEFAULT '2024-01-01 12:00:00',  -- TIMESTAMP with a specific default value
  -- New columns that calculate default values based on formulas
  date_plus_7_days DATE DEFAULT (CURRENT_DATE + INTERVAL '7 days'),  -- 7 days from current date
  date_minus_30_days DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days'),  -- 30 days before current date
  timestamp_plus_1_hour TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '1 hour'),  -- 1 hour from current timestamp
  timestamp_minus_15_minutes TIMESTAMP DEFAULT (CURRENT_TIMESTAMP - INTERVAL '15 minutes')  -- 15 minutes before current timestamp
);

-- Create a table with user-defined data types
CREATE TYPE gender_type AS ENUM ('Male', 'Female', 'Other');

CREATE TABLE user_define_data_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50),
  gender gender_type,
  age int4range,  -- Using built-in int4range for age range
  height FLOAT,
  weight FLOAT
);

-- Create table with comments
CREATE TABLE table_with_comments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add comments
COMMENT ON TABLE table_with_comments IS 'This table stores information about various items.';
COMMENT ON COLUMN table_with_comments.id IS 'Unique identifier for each item.';
COMMENT ON COLUMN table_with_comments.name IS 'Name of the item.';
COMMENT ON COLUMN table_with_comments.description IS 'Detailed description of the item.';
COMMENT ON COLUMN table_with_comments.created_at IS 'Timestamp when the item was created.';

-- Create Authors table
CREATE TABLE Authors (
  AuthorID SERIAL,
  NationalityID INT,
  AuthorName VARCHAR(100),
  BirthYear INT,
  PRIMARY KEY (AuthorID, NationalityID) -- Use composite primary key
);

-- Create Books table
CREATE TABLE Books (
  BookID SERIAL PRIMARY KEY,
  AuthorID INT,
  NationalityID INT,
  ISBN VARCHAR(20),
  Title VARCHAR(200),
  UNIQUE (ISBN),
  CONSTRAINT FK_AuthorNationality FOREIGN KEY (AuthorID, NationalityID)
    REFERENCES Authors (AuthorID, NationalityID) ON DELETE CASCADE
);
