SET QUOTED_IDENTIFIER ON;
GO

CREATE DATABASE dbml_test;
GO

USE dbml_test;
GO

-- Create users table
CREATE TABLE users (
  user_id INT IDENTITY(1,1) PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(50),
  last_name VARCHAR(50),
  full_name VARCHAR(100),
  full_name_lower AS LOWER(full_name) PERSISTED, -- Computed column with PERSISTED option
  date_of_birth DATE,
  created_at DATETIME2 DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME2,
  is_active BIT DEFAULT 1,
  CONSTRAINT chk_email_format CHECK (email LIKE '%_@_%._%'),
  CONSTRAINT chk_age CHECK (date_of_birth <= DATEADD(YEAR, -13, GETDATE()))
);
GO

-- Create an index on the email column for faster lookups
CREATE INDEX idx_users_email ON users (email);
GO

CREATE UNIQUE INDEX idx_users_user_id ON users (user_id);
GO

CREATE INDEX idx_users_full_name ON users (full_name);
GO

CREATE INDEX idx_users_is_active_full_name ON users (is_active, full_name_lower);
GO

-- Create products table
CREATE TABLE products (
  product_id INT IDENTITY(1,1) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  stock_quantity INT NOT NULL DEFAULT 0,
  category VARCHAR(50),
  created_at DATETIME2 DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME2 DEFAULT CURRENT_TIMESTAMP,
  is_available BIT DEFAULT 1,
  CONSTRAINT chk_price_positive CHECK (price > 0),
  CONSTRAINT chk_stock_non_negative CHECK (stock_quantity >= 0)
);
GO

-- Create an index on the category column for faster filtering
CREATE INDEX idx_products_category ON products (category);
GO

-- Create orders table
CREATE TABLE orders (
  order_id INT IDENTITY(1,1) PRIMARY KEY,
  user_id INT NOT NULL,
  order_date DATETIME2 DEFAULT CURRENT_TIMESTAMP,
  total_amount DECIMAL(12, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  shipping_address TEXT NOT NULL,
  billing_address TEXT NOT NULL,
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE -- Delete orders if the user is deleted
    ON UPDATE CASCADE, -- Update user_id in orders if user_id in users is updated
  CONSTRAINT chk_total_amount_positive CHECK (total_amount > 0),
  CONSTRAINT chk_status CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled'))
);
GO

-- Create an index on the user_id and order_date columns for faster querying
CREATE INDEX idx_orders_user_date ON orders (user_id, order_date);
GO

-- Create order_items table
CREATE TABLE order_items (
  order_item_id INT IDENTITY(1,1) PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  CONSTRAINT fk_order FOREIGN KEY (order_id) REFERENCES orders(order_id)
    ON DELETE CASCADE -- Delete order items if the order is deleted
    ON UPDATE CASCADE, -- Update order_id in order_items if order_id in orders is updated
  CONSTRAINT fk_product FOREIGN KEY (product_id) REFERENCES products(product_id)
    ON DELETE NO ACTION -- Default behavior: Prevent deletion of products that are referenced in order items
    ON UPDATE CASCADE, -- Update product_id in order_items if product_id in products is updated
  CONSTRAINT chk_quantity_positive CHECK (quantity > 0),
  CONSTRAINT chk_unit_price_positive CHECK (unit_price > 0),
  CONSTRAINT uq_order_product UNIQUE (order_id, product_id)
);
GO

-- Create a composite index on order_id and product_id for faster joins
CREATE INDEX idx_order_items_order_product ON order_items (order_id, product_id);
GO

-- Create a table with default values for string types
CREATE TABLE StringTypes (
  Id INT PRIMARY KEY IDENTITY(1,1), -- Auto-incrementing primary key
  CharField CHAR(10) DEFAULT 'N/A', -- Fixed-length non-Unicode string
  VarcharField VARCHAR(50) DEFAULT '{"default_key": "default_value"}', -- Variable-length non-Unicode string
  VarcharMaxField VARCHAR(MAX) DEFAULT 'N/A', -- Variable-length non-Unicode string with max size
  TextField TEXT DEFAULT 'N/A', -- Variable-length non-Unicode string (deprecated)
  NCharField NCHAR(10) DEFAULT N'N/A', -- Fixed-length Unicode string
  NVarCharField NVARCHAR(50) DEFAULT N'N/A', -- Variable-length Unicode string
  NVarCharMaxField NVARCHAR(MAX) DEFAULT N'N/A', -- Variable-length Unicode string with max size
  NTextField NTEXT DEFAULT N'N/A' -- Variable-length Unicode string (deprecated)
);
GO

-- Create a table with default value for number type and boolean type
CREATE TABLE NumberTypes (
  ID INT IDENTITY(1,1) PRIMARY KEY,
  TINYINTCol TINYINT DEFAULT 0,
  SMALLINTCol SMALLINT DEFAULT 0,
  INTCol INT DEFAULT 0,
  BIGINTCol BIGINT DEFAULT 0,
  DECIMALCol DECIMAL(10, 2) DEFAULT 0.00,
  NUMERICCol NUMERIC(10, 2) DEFAULT 0.00,
  FLOATCol FLOAT DEFAULT 0.0,
  REALCol REAL DEFAULT 0.0,
  BITCol BIT DEFAULT 0 -- Using BIT for boolean
);
GO

-- Create a table with default values for date and time types
CREATE TABLE DatetimeTypes (
  ID INT IDENTITY(1,1) PRIMARY KEY,
  DATECol DATE DEFAULT GETDATE(),
  TIMECol TIME DEFAULT CAST(GETDATE() AS TIME),
  DATETIMECol DATETIME DEFAULT GETDATE(),
  DATETIME2Col DATETIME2 DEFAULT SYSDATETIME(),
  SMALLDATETIMECol SMALLDATETIME DEFAULT GETDATE(),
  ROWVERSIONCol ROWVERSION, -- Automatically generated unique value
  DATETIMEOFFSETCol DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET()
);
GO

-- Create a table with default values for other data types
CREATE TABLE ObjectTypes (
  Id INT PRIMARY KEY IDENTITY(1,1), -- Auto-incrementing primary key
  XmlField XML DEFAULT '<Books>
    <Book>
      <Title>The Great Gatsby</Title>
      <Author>F. Scott Fitzgerald</Author>
      <Year>1925</Year>
      <Price>10.99</Price>
      <Publisher>Scribner</Publisher>
      <Location>New York</Location>
      <Genre>Fiction</Genre>
      <Subgenre>Classic</Subgenre>
    </Book>
    <Book>
      <Title>1984</Title>
      <Author>George Orwell</Author>
      <Year>1949</Year>
      <Price>8.99</Price>
      <Publisher>Secker & Warburg</Publisher>
      <Location>London</Location>
      <Genre>Dystopian</Genre>
      <Subgenre>Political Fiction</Subgenre>
    </Book>
  </Books>', -- Complex XML structure
  JsonField NVARCHAR(MAX) DEFAULT N'{"defaultKey": "defaultValue", "status": "active", "count": 0}',
  BinaryField BINARY(50) DEFAULT 0x00, -- Fixed-length binary data with a default value of zero
  VarBinaryField VARBINARY(50) DEFAULT 0x00, -- Variable-length binary data with a default value of zero
  VarBinaryMaxField VARBINARY(MAX) DEFAULT 0x00, -- Variable-length binary data with a default value of zero
  ImageField IMAGE DEFAULT 0x00 -- Variable-length binary data (deprecated) with a default value of zero
);
GO

-- Create a reference table for gender
CREATE TABLE gender_reference (
  value NVARCHAR(10) PRIMARY KEY
);
GO

-- Populate the gender_reference table with the values 'Male', 'Female', and 'Other'
INSERT INTO gender_reference (value) VALUES ('Male'), ('Female'), ('Other');
GO

-- Create the table user_define_data_types with the necessary data types and constraints
CREATE TABLE user_define_data_types (
  id INT IDENTITY(1,1) PRIMARY KEY, -- Using IDENTITY for auto-incrementing column
  name NVARCHAR(50),
  gender NVARCHAR(10),
  age_start INT, -- Start of age range
  age_end INT, -- End of age range
  height FLOAT,
  weight FLOAT,
  CONSTRAINT chk_gender CHECK (gender IN ('Male', 'Female', 'Other')), -- Using CHECK constraint for ENUM-like behavior
  CONSTRAINT chk_age_range CHECK (age_start <= age_end) -- Ensure that the start of the range is less than or equal to the end
);
GO

-- Add foreign key constraint to ensure gender values are valid
ALTER TABLE user_define_data_types
ADD CONSTRAINT fk_gender FOREIGN KEY (gender) REFERENCES gender_reference(value);
GO

-- Create table with comments
CREATE TABLE table_with_comments (
  id INT IDENTITY(1,1) PRIMARY KEY,
  name VARCHAR(100),
  description TEXT,
  created_at DATETIME2 DEFAULT CURRENT_TIMESTAMP
);
GO

-- Add comments
EXEC sys.sp_addextendedproperty
  @name=N'MS_Description',
  @value=N'This table stores information about various items.',
  @level0type=N'SCHEMA',
  @level0name=N'dbo',
  @level1type=N'TABLE',
  @level1name=N'table_with_comments';
GO

-- Add comments to the columns of table_with_comments
EXEC sys.sp_addextendedproperty
  @name=N'MS_Description',
  @value=N'Unique identifier for each item.',
  @level0type=N'SCHEMA',
  @level0name=N'dbo',
  @level1type=N'TABLE',
  @level1name=N'table_with_comments',
  @level2type=N'COLUMN',
  @level2name=N'id';
GO

EXEC sys.sp_addextendedproperty
  @name=N'MS_Description',
  @value=N'Name of the item.',
  @level0type=N'SCHEMA',
  @level0name=N'dbo',
  @level1type=N'TABLE',
  @level1name=N'table_with_comments',
  @level2type=N'COLUMN',
  @level2name=N'name';
GO

EXEC sys.sp_addextendedproperty
  @name=N'MS_Description',
  @value=N'Detailed description of the item.',
  @level0type=N'SCHEMA',
  @level0name=N'dbo',
  @level1type=N'TABLE',
  @level1name=N'table_with_comments',
  @level2type=N'COLUMN',
  @level2name=N'description';
GO

EXEC sys.sp_addextendedproperty
  @name=N'MS_Description',
  @value=N'Timestamp when the item was created.',
  @level0type=N'SCHEMA',
  @level0name=N'dbo',
  @level1type=N'TABLE',
  @level1name=N'table_with_comments',
  @level2type=N'COLUMN',
  @level2name=N'created_at';
GO

-- Add composite primary key, composite unique constraint, and composite foreign key constraint
CREATE TABLE Authors (
  AuthorID INT,
  NationalityID INT,
  AuthorName NVARCHAR(100),
  BirthYear INT,
  PRIMARY KEY (AuthorID, NationalityID),
  UNIQUE (AuthorName, BirthYear)
);
GO

CREATE TABLE Books (
  BookID INT,
  AuthorID INT,
  NationalityID INT,
  ISBN NVARCHAR(20),
  Title NVARCHAR(200),
  PRIMARY KEY (BookID, AuthorID),
  UNIQUE (ISBN),
  CONSTRAINT FK_AuthorNationality FOREIGN KEY (AuthorID, NationalityID)
  REFERENCES Authors (AuthorID, NationalityID)
);
GO
