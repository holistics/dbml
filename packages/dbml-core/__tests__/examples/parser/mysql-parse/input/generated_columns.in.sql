-- Test GENERATED/VIRTUAL/STORED columns with various expressions

-- Simple generated column (VIRTUAL by default)
CREATE TABLE gen_simple (
  id INT PRIMARY KEY,
  first_name VARCHAR(50),
  last_name VARCHAR(50),
  full_name VARCHAR(101) AS (CONCAT(first_name, ' ', last_name))
);

-- Explicitly VIRTUAL generated column
CREATE TABLE gen_virtual (
  id INT PRIMARY KEY,
  price DECIMAL(10,2),
  quantity INT,
  total DECIMAL(10,2) AS (price * quantity) VIRTUAL
);

-- STORED generated column
CREATE TABLE gen_stored (
  id INT PRIMARY KEY,
  price DECIMAL(10,2),
  tax_rate DECIMAL(5,2) DEFAULT 0.10,
  tax_amount DECIMAL(10,2) AS (price * tax_rate) STORED
);

-- Generated column with GENERATED ALWAYS AS syntax
CREATE TABLE gen_always (
  id INT PRIMARY KEY,
  radius DECIMAL(10,2),
  area DECIMAL(10,2) GENERATED ALWAYS AS (PI() * radius * radius) STORED
);

-- Multiple generated columns
CREATE TABLE gen_multiple (
  id INT PRIMARY KEY,
  width DECIMAL(10,2),
  height DECIMAL(10,2),
  depth DECIMAL(10,2),
  area DECIMAL(10,2) AS (width * height) VIRTUAL,
  volume DECIMAL(10,2) AS (width * height * depth) VIRTUAL,
  perimeter DECIMAL(10,2) AS (2 * (width + height)) VIRTUAL
);

-- Generated column with string functions
CREATE TABLE gen_strings (
  id INT PRIMARY KEY,
  email VARCHAR(100),
  domain VARCHAR(100) AS (SUBSTRING_INDEX(email, '@', -1)) VIRTUAL,
  username VARCHAR(100) AS (SUBSTRING_INDEX(email, '@', 1)) VIRTUAL,
  email_upper VARCHAR(100) AS (UPPER(email)) VIRTUAL
);

-- Generated column with date functions
CREATE TABLE gen_dates (
  id INT PRIMARY KEY,
  birth_date DATE,
  age INT AS (YEAR(CURDATE()) - YEAR(birth_date)) VIRTUAL,
  birth_year INT AS (YEAR(birth_date)) STORED,
  birth_month INT AS (MONTH(birth_date)) STORED
);

-- Generated column with JSON functions
CREATE TABLE gen_json (
  id INT PRIMARY KEY,
  data JSON,
  name VARCHAR(100) AS (JSON_UNQUOTE(JSON_EXTRACT(data, '$.name'))) VIRTUAL,
  age INT AS (JSON_EXTRACT(data, '$.age')) VIRTUAL,
  city VARCHAR(100) AS (data->>'$.address.city') VIRTUAL
);

-- Generated column with CASE expression
CREATE TABLE gen_case (
  id INT PRIMARY KEY,
  score INT,
  grade CHAR(1) AS (
    CASE
      WHEN score >= 90 THEN 'A'
      WHEN score >= 80 THEN 'B'
      WHEN score >= 70 THEN 'C'
      WHEN score >= 60 THEN 'D'
      ELSE 'F'
    END
  ) STORED
);

-- Generated column with IF function
CREATE TABLE gen_if (
  id INT PRIMARY KEY,
  age INT,
  is_adult BOOLEAN AS (IF(age >= 18, TRUE, FALSE)) VIRTUAL,
  category VARCHAR(20) AS (IF(age < 18, 'minor', 'adult')) VIRTUAL
);

-- Generated column with NULL handling
CREATE TABLE gen_null_safe (
  id INT PRIMARY KEY,
  price DECIMAL(10,2),
  discount DECIMAL(10,2),
  final_price DECIMAL(10,2) AS (price - COALESCE(discount, 0)) VIRTUAL
);

-- Generated column with mathematical functions
CREATE TABLE gen_math (
  id INT PRIMARY KEY,
  x DECIMAL(10,2),
  y DECIMAL(10,2),
  distance DECIMAL(10,2) AS (SQRT(x * x + y * y)) VIRTUAL,
  abs_x DECIMAL(10,2) AS (ABS(x)) VIRTUAL,
  rounded DECIMAL(10,0) AS (ROUND(SQRT(x * x + y * y))) STORED
);

-- Generated column with CONCAT_WS
CREATE TABLE gen_concat_ws (
  id INT PRIMARY KEY,
  first_name VARCHAR(50),
  middle_name VARCHAR(50),
  last_name VARCHAR(50),
  full_name VARCHAR(152) AS (CONCAT_WS(' ', first_name, middle_name, last_name)) VIRTUAL
);

-- Generated column indexable (STORED only)
CREATE TABLE gen_indexed (
  id INT PRIMARY KEY,
  price DECIMAL(10,2),
  quantity INT,
  total DECIMAL(10,2) AS (price * quantity) STORED,
  INDEX idx_total (total)
);

-- Generated column with CHAR_LENGTH
CREATE TABLE gen_length (
  id INT PRIMARY KEY,
  description TEXT,
  char_count INT AS (CHAR_LENGTH(description)) VIRTUAL,
  word_count INT AS (LENGTH(description) - LENGTH(REPLACE(description, ' ', '')) + 1) VIRTUAL
);

-- Generated column with date arithmetic
CREATE TABLE gen_date_calc (
  id INT PRIMARY KEY,
  start_date DATE,
  duration_days INT,
  end_date DATE AS (DATE_ADD(start_date, INTERVAL duration_days DAY)) VIRTUAL,
  is_expired BOOLEAN AS (end_date < CURDATE()) VIRTUAL
);

-- Generated column with timestamp
CREATE TABLE gen_timestamps (
  id INT PRIMARY KEY,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_year INT AS (YEAR(created_at)) STORED,
  created_month VARCHAR(20) AS (MONTHNAME(created_at)) STORED,
  created_day VARCHAR(20) AS (DAYNAME(created_at)) VIRTUAL
);

-- Generated column with LPAD/RPAD
CREATE TABLE gen_padding (
  id INT PRIMARY KEY,
  code INT,
  padded_code VARCHAR(10) AS (LPAD(code, 8, '0')) VIRTUAL,
  formatted_code VARCHAR(15) AS (CONCAT('ID-', LPAD(code, 6, '0'))) STORED
);

-- Edge case: Generated column referencing another generated column
CREATE TABLE gen_chained (
  id INT PRIMARY KEY,
  base_price DECIMAL(10,2),
  markup DECIMAL(10,2) AS (base_price * 0.5) VIRTUAL,
  final_price DECIMAL(10,2) AS (base_price + markup) VIRTUAL
);

-- Generated column with SUBSTRING
CREATE TABLE gen_substring (
  id INT PRIMARY KEY,
  full_code VARCHAR(20),
  prefix VARCHAR(5) AS (SUBSTRING(full_code, 1, 5)) VIRTUAL,
  suffix VARCHAR(5) AS (SUBSTRING(full_code, -5)) VIRTUAL
);

-- Generated column with REPLACE
CREATE TABLE gen_replace (
  id INT PRIMARY KEY,
  phone VARCHAR(20),
  phone_clean VARCHAR(20) AS (REPLACE(REPLACE(REPLACE(phone, '-', ''), ' ', ''), '(', '')) VIRTUAL
);

-- Generated column with TRIM
CREATE TABLE gen_trim (
  id INT PRIMARY KEY,
  raw_text VARCHAR(200),
  trimmed_text VARCHAR(200) AS (TRIM(raw_text)) VIRTUAL,
  trimmed_lower VARCHAR(200) AS (LOWER(TRIM(raw_text))) VIRTUAL
);

-- Generated column with MOD operator
CREATE TABLE gen_mod (
  id INT PRIMARY KEY,
  value INT,
  is_even BOOLEAN AS (MOD(value, 2) = 0) VIRTUAL,
  is_divisible_by_5 BOOLEAN AS (MOD(value, 5) = 0) VIRTUAL
);

-- Generated column with COALESCE
CREATE TABLE gen_coalesce (
  id INT PRIMARY KEY,
  primary_email VARCHAR(100),
  secondary_email VARCHAR(100),
  contact_email VARCHAR(100) AS (COALESCE(primary_email, secondary_email, 'noemail@example.com')) VIRTUAL
);

-- Generated column with GREATEST/LEAST
CREATE TABLE gen_greatest_least (
  id INT PRIMARY KEY,
  score1 INT,
  score2 INT,
  score3 INT,
  best_score INT AS (GREATEST(score1, score2, score3)) VIRTUAL,
  worst_score INT AS (LEAST(score1, score2, score3)) VIRTUAL
);

-- Generated column with HEX/UNHEX
CREATE TABLE gen_hex (
  id INT PRIMARY KEY,
  value INT,
  hex_value VARCHAR(20) AS (HEX(value)) VIRTUAL
);

-- Generated column with date comparison
CREATE TABLE gen_date_compare (
  id INT PRIMARY KEY,
  expiry_date DATE,
  days_until_expiry INT AS (DATEDIFF(expiry_date, CURDATE())) VIRTUAL,
  is_expired BOOLEAN AS (expiry_date < CURDATE()) VIRTUAL,
  expires_soon BOOLEAN AS (DATEDIFF(expiry_date, CURDATE()) BETWEEN 0 AND 30) VIRTUAL
);

-- Edge case: Generated column with backticks in name
CREATE TABLE gen_backticks (
  id INT PRIMARY KEY,
  price DECIMAL(10,2),
  `price-with-tax` DECIMAL(10,2) AS (price * 1.1) VIRTUAL
);

-- Generated column with FLOOR/CEIL
CREATE TABLE gen_floor_ceil (
  id INT PRIMARY KEY,
  value DECIMAL(10,2),
  floored INT AS (FLOOR(value)) VIRTUAL,
  ceiled INT AS (CEIL(value)) VIRTUAL
);

-- Generated column with complex expression
CREATE TABLE gen_complex (
  id INT PRIMARY KEY,
  a DECIMAL(10,2),
  b DECIMAL(10,2),
  c DECIMAL(10,2),
  result DECIMAL(10,2) AS (
    ROUND((a * b + c) / NULLIF(a + b, 0), 2)
  ) VIRTUAL
);

-- Generated column with IN operator
CREATE TABLE gen_in (
  id INT PRIMARY KEY,
  status VARCHAR(20),
  is_active BOOLEAN AS (status IN ('active', 'pending', 'verified')) VIRTUAL
);

-- Generated column with BETWEEN
CREATE TABLE gen_between (
  id INT PRIMARY KEY,
  age INT,
  is_adult BOOLEAN AS (age BETWEEN 18 AND 150) VIRTUAL,
  is_senior BOOLEAN AS (age BETWEEN 65 AND 150) VIRTUAL
);

-- Generated column with LIKE
CREATE TABLE gen_like (
  id INT PRIMARY KEY,
  email VARCHAR(100),
  is_gmail BOOLEAN AS (email LIKE '%@gmail.com') VIRTUAL
);

-- Generated column with REGEXP (MySQL 8.0+)
CREATE TABLE gen_regexp (
  id INT PRIMARY KEY,
  code VARCHAR(20),
  is_valid_code BOOLEAN AS (code REGEXP '^[A-Z]{3}-[0-9]{4}$') VIRTUAL
);

-- ALTER TABLE to add generated column
CREATE TABLE gen_alter_test (
  id INT PRIMARY KEY,
  price DECIMAL(10,2),
  quantity INT
);

ALTER TABLE gen_alter_test
ADD COLUMN total DECIMAL(10,2) AS (price * quantity) STORED;

-- ALTER TABLE to add multiple generated columns
ALTER TABLE gen_alter_test
ADD COLUMN tax DECIMAL(10,2) AS (total * 0.1) VIRTUAL,
ADD COLUMN grand_total DECIMAL(10,2) AS (total * 1.1) VIRTUAL;

-- ALTER TABLE to modify generated column
ALTER TABLE gen_alter_test
MODIFY COLUMN tax DECIMAL(10,2) AS (total * 0.15) VIRTUAL;

-- ALTER TABLE to change generated column
ALTER TABLE gen_alter_test
CHANGE COLUMN grand_total final_total DECIMAL(10,2) AS (total * 1.15) STORED;

-- Edge case: Generated column with NOT NULL
CREATE TABLE gen_not_null (
  id INT PRIMARY KEY,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  full_name VARCHAR(101) AS (CONCAT(first_name, ' ', last_name)) VIRTUAL NOT NULL
);

-- Edge case: Generated column with UNIQUE constraint (STORED only)
CREATE TABLE gen_unique (
  id INT PRIMARY KEY,
  email VARCHAR(100),
  normalized_email VARCHAR(100) AS (LOWER(TRIM(email))) STORED UNIQUE
);

-- Edge case: Generated column with COMMENT
CREATE TABLE gen_comment (
  id INT PRIMARY KEY,
  radius DECIMAL(10,2),
  area DECIMAL(10,2) AS (PI() * radius * radius) STORED COMMENT 'Calculated circle area'
);

-- Generated column with UTC_TIMESTAMP
CREATE TABLE gen_utc (
  id INT PRIMARY KEY,
  local_time TIMESTAMP,
  utc_time TIMESTAMP AS (UTC_TIMESTAMP()) VIRTUAL
);

-- Generated column with BIN/OCT
CREATE TABLE gen_bin_oct (
  id INT PRIMARY KEY,
  value INT,
  binary_repr VARCHAR(64) AS (BIN(value)) VIRTUAL,
  octal_repr VARCHAR(64) AS (OCT(value)) VIRTUAL
);
