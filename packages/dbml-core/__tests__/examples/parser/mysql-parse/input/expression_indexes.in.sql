-- Test expression/functional indexes (MySQL 8.0.13+)

-- Simple expression index with LOWER
CREATE TABLE expr_lower (
  id INT PRIMARY KEY,
  email VARCHAR(100),
  INDEX idx_lower_email ((LOWER(email)))
);

-- Expression index with UPPER
CREATE TABLE expr_upper (
  id INT PRIMARY KEY,
  name VARCHAR(100),
  INDEX idx_upper_name ((UPPER(name)))
);

-- Expression index with SUBSTRING
CREATE TABLE expr_substring (
  id INT PRIMARY KEY,
  code VARCHAR(50),
  INDEX idx_prefix ((SUBSTRING(code, 1, 5)))
);

-- Expression index with CONCAT
CREATE TABLE expr_concat (
  id INT PRIMARY KEY,
  first_name VARCHAR(50),
  last_name VARCHAR(50),
  INDEX idx_full_name ((CONCAT(first_name, ' ', last_name)))
);

-- Expression index with arithmetic
CREATE TABLE expr_arithmetic (
  id INT PRIMARY KEY,
  price DECIMAL(10,2),
  tax_rate DECIMAL(5,2),
  INDEX idx_total ((price * (1 + tax_rate)))
);

-- Expression index with ROUND
CREATE TABLE expr_round (
  id INT PRIMARY KEY,
  value DECIMAL(10,5),
  INDEX idx_rounded ((ROUND(value, 2)))
);

-- Expression index with FLOOR
CREATE TABLE expr_floor (
  id INT PRIMARY KEY,
  amount DECIMAL(10,2),
  INDEX idx_floored ((FLOOR(amount)))
);

-- Expression index with CEIL
CREATE TABLE expr_ceil (
  id INT PRIMARY KEY,
  price DECIMAL(10,2),
  INDEX idx_ceiled ((CEIL(price)))
);

-- Expression index with ABS
CREATE TABLE expr_abs (
  id INT PRIMARY KEY,
  delta INT,
  INDEX idx_absolute ((ABS(delta)))
);

-- Expression index with date functions
CREATE TABLE expr_date (
  id INT PRIMARY KEY,
  created_at TIMESTAMP,
  INDEX idx_year ((YEAR(created_at))),
  INDEX idx_month ((MONTH(created_at))),
  INDEX idx_day ((DAY(created_at)))
);

-- Expression index with DATE_FORMAT
CREATE TABLE expr_date_format (
  id INT PRIMARY KEY,
  event_date DATE,
  INDEX idx_year_month ((DATE_FORMAT(event_date, '%Y-%m')))
);

-- Expression index with JSON extraction
CREATE TABLE expr_json (
  id INT PRIMARY KEY,
  data JSON,
  INDEX idx_json_name ((CAST(data->>'$.name' AS CHAR(100)))),
  INDEX idx_json_age ((CAST(data->>'$.age' AS UNSIGNED)))
);

-- Expression index with JSON_EXTRACT
CREATE TABLE expr_json_extract (
  id INT PRIMARY KEY,
  metadata JSON,
  INDEX idx_json_type ((JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.type'))))
);

-- Expression index with CAST
CREATE TABLE expr_cast (
  id INT PRIMARY KEY,
  value VARCHAR(50),
  INDEX idx_as_int ((CAST(value AS SIGNED))),
  INDEX idx_as_decimal ((CAST(value AS DECIMAL(10,2))))
);

-- Expression index with COALESCE
CREATE TABLE expr_coalesce (
  id INT PRIMARY KEY,
  primary_val INT,
  secondary_val INT,
  INDEX idx_coalesce ((COALESCE(primary_val, secondary_val, 0)))
);

-- Expression index with TRIM
CREATE TABLE expr_trim (
  id INT PRIMARY KEY,
  text_data VARCHAR(200),
  INDEX idx_trimmed ((TRIM(text_data)))
);

-- Expression index with LTRIM/RTRIM
CREATE TABLE expr_ltrim_rtrim (
  id INT PRIMARY KEY,
  data VARCHAR(100),
  INDEX idx_ltrim ((LTRIM(data))),
  INDEX idx_rtrim ((RTRIM(data)))
);

-- Expression index with REPLACE
CREATE TABLE expr_replace (
  id INT PRIMARY KEY,
  phone VARCHAR(20),
  INDEX idx_clean_phone ((REPLACE(REPLACE(phone, '-', ''), ' ', '')))
);

-- Expression index with IF
CREATE TABLE expr_if (
  id INT PRIMARY KEY,
  age INT,
  INDEX idx_is_adult ((IF(age >= 18, 1, 0)))
);

-- Expression index with CASE
CREATE TABLE expr_case (
  id INT PRIMARY KEY,
  score INT,
  INDEX idx_grade ((
    CASE
      WHEN score >= 90 THEN 'A'
      WHEN score >= 80 THEN 'B'
      WHEN score >= 70 THEN 'C'
      ELSE 'F'
    END
  ))
);

-- Expression index with CHAR_LENGTH
CREATE TABLE expr_char_length (
  id INT PRIMARY KEY,
  description TEXT,
  INDEX idx_length ((CHAR_LENGTH(description)))
);

-- Expression index with LEFT/RIGHT
CREATE TABLE expr_left_right (
  id INT PRIMARY KEY,
  code VARCHAR(50),
  INDEX idx_left5 ((LEFT(code, 5))),
  INDEX idx_right5 ((RIGHT(code, 5)))
);

-- Expression index with MOD
CREATE TABLE expr_mod (
  id INT PRIMARY KEY,
  value INT,
  INDEX idx_mod10 ((MOD(value, 10)))
);

-- Expression index with GREATEST/LEAST
CREATE TABLE expr_greatest_least (
  id INT PRIMARY KEY,
  val1 INT,
  val2 INT,
  val3 INT,
  INDEX idx_max ((GREATEST(val1, val2, val3))),
  INDEX idx_min ((LEAST(val1, val2, val3)))
);

-- Expression index with NULLIF
CREATE TABLE expr_nullif (
  id INT PRIMARY KEY,
  numerator INT,
  denominator INT,
  INDEX idx_safe_div ((numerator / NULLIF(denominator, 0)))
);

-- Expression index with LPAD/RPAD
CREATE TABLE expr_pad (
  id INT PRIMARY KEY,
  code INT,
  INDEX idx_padded ((LPAD(code, 8, '0')))
);

-- Complex expression index
CREATE TABLE expr_complex (
  id INT PRIMARY KEY,
  a DECIMAL(10,2),
  b DECIMAL(10,2),
  c DECIMAL(10,2),
  INDEX idx_formula ((ROUND((a * b + c) / NULLIF(a + b, 0), 2)))
);

-- Expression index with REVERSE
CREATE TABLE expr_reverse (
  id INT PRIMARY KEY,
  code VARCHAR(50),
  INDEX idx_reversed ((REVERSE(code)))
);

-- Expression index with HEX
CREATE TABLE expr_hex (
  id INT PRIMARY KEY,
  value INT,
  INDEX idx_hex ((HEX(value)))
);

-- Expression index on TIMESTAMP difference
CREATE TABLE expr_timestamp_diff (
  id INT PRIMARY KEY,
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  INDEX idx_duration ((TIMESTAMPDIFF(SECOND, start_time, end_time)))
);

-- Expression index with DATEDIFF
CREATE TABLE expr_datediff (
  id INT PRIMARY KEY,
  start_date DATE,
  end_date DATE,
  INDEX idx_days_diff ((DATEDIFF(end_date, start_date)))
);

-- CREATE INDEX with expression
CREATE TABLE expr_create_test (
  id INT PRIMARY KEY,
  email VARCHAR(100),
  name VARCHAR(100),
  price DECIMAL(10,2)
);

CREATE INDEX idx_lower_email ON expr_create_test((LOWER(email)));
CREATE INDEX idx_upper_name ON expr_create_test((UPPER(name)));
CREATE INDEX idx_rounded_price ON expr_create_test((ROUND(price)));

-- ALTER TABLE to add expression index
CREATE TABLE expr_alter_test (
  id INT PRIMARY KEY,
  data VARCHAR(100)
);

ALTER TABLE expr_alter_test ADD INDEX idx_lower ((LOWER(data)));
ALTER TABLE expr_alter_test ADD INDEX idx_trim ((TRIM(data)));

-- Expression index with VISIBLE
CREATE TABLE expr_visible (
  id INT PRIMARY KEY,
  email VARCHAR(100),
  INDEX idx_lower_email ((LOWER(email))) VISIBLE
);

-- Expression index with INVISIBLE
CREATE TABLE expr_invisible (
  id INT PRIMARY KEY,
  name VARCHAR(100),
  INDEX idx_upper_name ((UPPER(name))) INVISIBLE
);

-- Expression index with COMMENT
CREATE TABLE expr_comment (
  id INT PRIMARY KEY,
  data VARCHAR(100),
  INDEX idx_lower ((LOWER(data))) COMMENT 'Lowercase index'
);

-- Expression index with all options
CREATE TABLE expr_all_options (
  id INT PRIMARY KEY,
  text_col VARCHAR(200),
  INDEX idx_expr ((TRIM(LOWER(text_col))))
    VISIBLE
    COMMENT 'Trimmed lowercase index'
);

-- Multiple expression indexes
CREATE TABLE expr_multiple (
  id INT PRIMARY KEY,
  first_name VARCHAR(50),
  last_name VARCHAR(50),
  email VARCHAR(100),
  price DECIMAL(10,2),
  INDEX idx_lower_first ((LOWER(first_name))),
  INDEX idx_lower_last ((LOWER(last_name))),
  INDEX idx_lower_email ((LOWER(email))),
  INDEX idx_full_name ((CONCAT(first_name, ' ', last_name))),
  INDEX idx_rounded_price ((ROUND(price, 2)))
);

-- Unique expression index
CREATE TABLE expr_unique (
  id INT PRIMARY KEY,
  email VARCHAR(100),
  UNIQUE INDEX uk_lower_email ((LOWER(email)))
);

-- Expression index with DESC
CREATE TABLE expr_desc (
  id INT PRIMARY KEY,
  created_at TIMESTAMP,
  INDEX idx_year_desc ((YEAR(created_at)) DESC)
);

-- Expression index on generated column reference (edge case)
CREATE TABLE expr_on_generated (
  id INT PRIMARY KEY,
  base_val INT,
  computed_val INT AS (base_val * 2) STORED,
  INDEX idx_expr ((computed_val + 10))
);

-- Edge case: Expression with nested functions
CREATE TABLE expr_nested (
  id INT PRIMARY KEY,
  text_data VARCHAR(200),
  INDEX idx_nested ((UPPER(TRIM(SUBSTRING(text_data, 1, 50)))))
);

-- Edge case: Expression with multiple columns and functions
CREATE TABLE expr_multi_col (
  id INT PRIMARY KEY,
  first_name VARCHAR(50),
  last_name VARCHAR(50),
  suffix VARCHAR(10),
  INDEX idx_complex ((CONCAT(UPPER(first_name), ' ', UPPER(last_name), ' ', COALESCE(suffix, ''))))
);

-- Expression index with SOUNDEX
CREATE TABLE expr_soundex (
  id INT PRIMARY KEY,
  name VARCHAR(100),
  INDEX idx_soundex ((SOUNDEX(name)))
);

-- Expression index with MD5
CREATE TABLE expr_md5 (
  id INT PRIMARY KEY,
  data VARCHAR(200),
  INDEX idx_hash ((MD5(data)))
);

-- Expression index with SHA1/SHA2
CREATE TABLE expr_sha (
  id INT PRIMARY KEY,
  sensitive_data VARCHAR(200),
  INDEX idx_sha1 ((SHA1(sensitive_data)))
);

-- Expression index with INET_ATON (IP address)
CREATE TABLE expr_ip (
  id INT PRIMARY KEY,
  ip_address VARCHAR(15),
  INDEX idx_ip_num ((INET_ATON(ip_address)))
);

-- Edge case: Expression index with backticks
CREATE TABLE `expr-backticks` (
  id INT PRIMARY KEY,
  `col-name` VARCHAR(100),
  INDEX `idx-expr` ((LOWER(`col-name`)))
);

-- Expression index with ELT
CREATE TABLE expr_elt (
  id INT PRIMARY KEY,
  status_code INT,
  INDEX idx_status_text ((ELT(status_code, 'pending', 'active', 'inactive')))
);

-- Expression index with FIELD
CREATE TABLE expr_field (
  id INT PRIMARY KEY,
  priority VARCHAR(20),
  INDEX idx_priority_order ((FIELD(priority, 'high', 'medium', 'low')))
);

-- DROP expression index
DROP INDEX idx_lower_email ON expr_create_test;
DROP INDEX idx_expr ON expr_alter_test;
