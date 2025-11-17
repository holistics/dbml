-- Test CREATE FUNCTION with various return types and options

-- Simple function returning INT
CREATE FUNCTION simple_func()
RETURNS INT
BEGIN
  RETURN 42;
END;

-- Function with parameter
CREATE FUNCTION add_ten(x INT)
RETURNS INT
BEGIN
  RETURN x + 10;
END;

-- Function with multiple parameters
CREATE FUNCTION calculate_area(length DECIMAL(10,2), width DECIMAL(10,2))
RETURNS DECIMAL(10,2)
BEGIN
  RETURN length * width;
END;

-- Function returning VARCHAR
CREATE FUNCTION get_greeting(name VARCHAR(100))
RETURNS VARCHAR(200)
BEGIN
  RETURN CONCAT('Hello, ', name, '!');
END;

-- Function returning DECIMAL
CREATE FUNCTION calculate_tax(amount DECIMAL(10,2), rate DECIMAL(5,2))
RETURNS DECIMAL(10,2)
BEGIN
  RETURN ROUND(amount * rate / 100, 2);
END;

-- Function with DETERMINISTIC
CREATE FUNCTION deterministic_double(x INT)
RETURNS INT
DETERMINISTIC
BEGIN
  RETURN x * 2;
END;

-- Function with NOT DETERMINISTIC
CREATE FUNCTION random_number()
RETURNS INT
NOT DETERMINISTIC
BEGIN
  RETURN FLOOR(RAND() * 100);
END;

-- Function with NO SQL
CREATE FUNCTION no_sql_func(a INT, b INT)
RETURNS INT
NO SQL
BEGIN
  RETURN a + b;
END;

-- Function with CONTAINS SQL
CREATE FUNCTION contains_sql_func()
RETURNS INT
CONTAINS SQL
BEGIN
  DECLARE result INT;
  SELECT COUNT(*) INTO result FROM users;
  RETURN result;
END;

-- Function with READS SQL DATA
CREATE FUNCTION reads_sql_func(user_id INT)
RETURNS VARCHAR(100)
READS SQL DATA
BEGIN
  DECLARE user_name VARCHAR(100);
  SELECT name INTO user_name FROM users WHERE id = user_id;
  RETURN user_name;
END;

-- Function with MODIFIES SQL DATA
CREATE FUNCTION modifies_sql_func(user_id INT)
RETURNS INT
MODIFIES SQL DATA
BEGIN
  UPDATE users SET updated_at = NOW() WHERE id = user_id;
  RETURN ROW_COUNT();
END;

-- Function with SQL SECURITY DEFINER
CREATE FUNCTION security_definer_func()
RETURNS INT
SQL SECURITY DEFINER
BEGIN
  RETURN 1;
END;

-- Function with SQL SECURITY INVOKER
CREATE FUNCTION security_invoker_func()
RETURNS INT
SQL SECURITY INVOKER
BEGIN
  RETURN 1;
END;

-- Function with DEFINER
CREATE DEFINER = 'admin'@'localhost'
FUNCTION definer_func()
RETURNS INT
BEGIN
  RETURN 100;
END;

-- Function with DEFINER = CURRENT_USER
CREATE DEFINER = CURRENT_USER
FUNCTION current_user_func()
RETURNS VARCHAR(100)
BEGIN
  RETURN USER();
END;

-- Function with COMMENT
CREATE FUNCTION commented_func(x INT)
RETURNS INT
COMMENT 'Multiplies input by 3'
BEGIN
  RETURN x * 3;
END;

-- Function with all options
CREATE DEFINER = 'root'@'localhost'
FUNCTION full_options_func(input_val INT)
RETURNS INT
DETERMINISTIC
SQL SECURITY DEFINER
READS SQL DATA
COMMENT 'Complete function with all options'
BEGIN
  DECLARE result INT;
  SELECT COUNT(*) INTO result FROM users WHERE id <= input_val;
  RETURN result;
END;

-- Function returning DATE
CREATE FUNCTION get_tomorrow()
RETURNS DATE
DETERMINISTIC
BEGIN
  RETURN DATE_ADD(CURDATE(), INTERVAL 1 DAY);
END;

-- Function returning DATETIME
CREATE FUNCTION get_current_datetime()
RETURNS DATETIME
NOT DETERMINISTIC
BEGIN
  RETURN NOW();
END;

-- Function returning TIME
CREATE FUNCTION get_current_time()
RETURNS TIME
NOT DETERMINISTIC
BEGIN
  RETURN CURTIME();
END;

-- Function returning BOOLEAN/TINYINT
CREATE FUNCTION is_adult(age INT)
RETURNS BOOLEAN
DETERMINISTIC
BEGIN
  RETURN age >= 18;
END;

-- Function returning TEXT
CREATE FUNCTION generate_description(name VARCHAR(100), type VARCHAR(50))
RETURNS TEXT
BEGIN
  RETURN CONCAT('Product: ', name, ', Type: ', type, ', Generated at: ', NOW());
END;

-- Function with IF statement
CREATE FUNCTION grade_score(score INT)
RETURNS CHAR(1)
BEGIN
  IF score >= 90 THEN
    RETURN 'A';
  ELSEIF score >= 80 THEN
    RETURN 'B';
  ELSEIF score >= 70 THEN
    RETURN 'C';
  ELSEIF score >= 60 THEN
    RETURN 'D';
  ELSE
    RETURN 'F';
  END IF;
END;

-- Function with CASE statement
CREATE FUNCTION day_type(day_num INT)
RETURNS VARCHAR(20)
BEGIN
  RETURN CASE day_num
    WHEN 1 THEN 'Monday'
    WHEN 2 THEN 'Tuesday'
    WHEN 3 THEN 'Wednesday'
    WHEN 4 THEN 'Thursday'
    WHEN 5 THEN 'Friday'
    WHEN 6 THEN 'Saturday'
    WHEN 7 THEN 'Sunday'
    ELSE 'Invalid'
  END;
END;

-- Function with DECLARE variables
CREATE FUNCTION complex_calculation(x INT, y INT)
RETURNS INT
BEGIN
  DECLARE sum_val INT;
  DECLARE product_val INT;
  DECLARE result INT;

  SET sum_val = x + y;
  SET product_val = x * y;
  SET result = sum_val + product_val;

  RETURN result;
END;

-- Function with WHILE loop
CREATE FUNCTION factorial(n INT)
RETURNS BIGINT
BEGIN
  DECLARE result BIGINT DEFAULT 1;
  DECLARE counter INT DEFAULT 1;

  WHILE counter <= n DO
    SET result = result * counter;
    SET counter = counter + 1;
  END WHILE;

  RETURN result;
END;

-- Function with REPEAT loop
CREATE FUNCTION power_of_two(exponent INT)
RETURNS BIGINT
BEGIN
  DECLARE result BIGINT DEFAULT 1;
  DECLARE i INT DEFAULT 0;

  REPEAT
    SET result = result * 2;
    SET i = i + 1;
  UNTIL i >= exponent
  END REPEAT;

  RETURN result;
END;

-- Function with LOOP
CREATE FUNCTION sum_to_n(n INT)
RETURNS INT
BEGIN
  DECLARE sum INT DEFAULT 0;
  DECLARE i INT DEFAULT 1;

  my_loop: LOOP
    SET sum = sum + i;
    SET i = i + 1;

    IF i > n THEN
      LEAVE my_loop;
    END IF;
  END LOOP;

  RETURN sum;
END;

-- Function with nested IF
CREATE FUNCTION categorize_temp(celsius DECIMAL(5,2))
RETURNS VARCHAR(20)
BEGIN
  IF celsius < 0 THEN
    RETURN 'Freezing';
  ELSE
    IF celsius < 15 THEN
      RETURN 'Cold';
    ELSEIF celsius < 25 THEN
      RETURN 'Moderate';
    ELSEIF celsius < 35 THEN
      RETURN 'Warm';
    ELSE
      RETURN 'Hot';
    END IF;
  END IF;
END;

-- Function returning JSON (MySQL 5.7+)
CREATE FUNCTION create_json_object(id INT, name VARCHAR(100))
RETURNS JSON
BEGIN
  RETURN JSON_OBJECT('id', id, 'name', name);
END;

-- Function with string operations
CREATE FUNCTION format_phone(phone VARCHAR(20))
RETURNS VARCHAR(20)
BEGIN
  DECLARE cleaned VARCHAR(20);
  SET cleaned = REPLACE(REPLACE(REPLACE(phone, '-', ''), ' ', ''), '(', '');
  SET cleaned = REPLACE(cleaned, ')', '');
  RETURN cleaned;
END;

-- Function with mathematical operations
CREATE FUNCTION circle_area(radius DECIMAL(10,2))
RETURNS DECIMAL(10,2)
BEGIN
  RETURN ROUND(3.14159 * radius * radius, 2);
END;

-- Function with date calculations
CREATE FUNCTION days_until_birthday(birth_date DATE)
RETURNS INT
BEGIN
  DECLARE next_birthday DATE;
  DECLARE today DATE DEFAULT CURDATE();

  SET next_birthday = DATE_ADD(birth_date, INTERVAL YEAR(today) - YEAR(birth_date) YEAR);

  IF next_birthday < today THEN
    SET next_birthday = DATE_ADD(next_birthday, INTERVAL 1 YEAR);
  END IF;

  RETURN DATEDIFF(next_birthday, today);
END;

-- Edge case: Function with backticks in name
CREATE FUNCTION `func-with-dashes`(x INT)
RETURNS INT
BEGIN
  RETURN x;
END;

-- Edge case: Function with reserved word as name (quoted)
CREATE FUNCTION `select`(param INT)
RETURNS INT
BEGIN
  RETURN param * 2;
END;

-- Function returning BIGINT
CREATE FUNCTION large_number()
RETURNS BIGINT
BEGIN
  RETURN 9223372036854775807;
END;

-- Function returning FLOAT
CREATE FUNCTION calculate_percentage(part FLOAT, total FLOAT)
RETURNS FLOAT
BEGIN
  IF total = 0 THEN
    RETURN 0;
  END IF;
  RETURN (part / total) * 100;
END;

-- Function returning DOUBLE
CREATE FUNCTION precise_calculation(x DOUBLE, y DOUBLE)
RETURNS DOUBLE
BEGIN
  RETURN x * y + x / y;
END;

-- Function with NULL handling
CREATE FUNCTION safe_divide(numerator DECIMAL(10,2), denominator DECIMAL(10,2))
RETURNS DECIMAL(10,2)
BEGIN
  IF denominator = 0 OR denominator IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN numerator / denominator;
END;

-- Function with error signaling
CREATE FUNCTION validate_age(age INT)
RETURNS INT
BEGIN
  IF age < 0 OR age > 150 THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Invalid age value';
  END IF;
  RETURN age;
END;

-- Function with CURSOR (edge case)
CREATE FUNCTION count_active_users()
RETURNS INT
READS SQL DATA
BEGIN
  DECLARE done INT DEFAULT FALSE;
  DECLARE user_count INT DEFAULT 0;
  DECLARE user_id INT;
  DECLARE cur CURSOR FOR SELECT id FROM users WHERE status = 'active';
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

  OPEN cur;

  read_loop: LOOP
    FETCH cur INTO user_id;
    IF done THEN
      LEAVE read_loop;
    END IF;
    SET user_count = user_count + 1;
  END LOOP;

  CLOSE cur;
  RETURN user_count;
END;

-- Function with multiple RETURN paths
CREATE FUNCTION max_of_three(a INT, b INT, c INT)
RETURNS INT
BEGIN
  IF a >= b AND a >= c THEN
    RETURN a;
  ELSEIF b >= a AND b >= c THEN
    RETURN b;
  ELSE
    RETURN c;
  END IF;
END;

-- Function returning ENUM (edge case - returns string)
CREATE FUNCTION get_status_enum()
RETURNS VARCHAR(20)
BEGIN
  RETURN 'active';
END;

-- Function with complex expression
CREATE FUNCTION compound_interest(
  principal DECIMAL(10,2),
  rate DECIMAL(5,2),
  time_years INT,
  compounds_per_year INT
)
RETURNS DECIMAL(10,2)
BEGIN
  DECLARE result DECIMAL(10,2);
  SET result = principal * POW(1 + (rate / 100 / compounds_per_year), compounds_per_year * time_years);
  RETURN ROUND(result, 2);
END;

-- Function with ITERATE (edge case)
CREATE FUNCTION sum_even_numbers(max_num INT)
RETURNS INT
BEGIN
  DECLARE sum INT DEFAULT 0;
  DECLARE i INT DEFAULT 0;

  my_loop: LOOP
    SET i = i + 1;

    IF i > max_num THEN
      LEAVE my_loop;
    END IF;

    IF i % 2 != 0 THEN
      ITERATE my_loop;
    END IF;

    SET sum = sum + i;
  END LOOP;

  RETURN sum;
END;

-- Function returning CHAR
CREATE FUNCTION get_first_char(str VARCHAR(100))
RETURNS CHAR(1)
BEGIN
  RETURN LEFT(str, 1);
END;

-- Function with exception handler
CREATE FUNCTION safe_get_user_name(user_id INT)
RETURNS VARCHAR(100)
READS SQL DATA
BEGIN
  DECLARE user_name VARCHAR(100);
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET user_name = 'Unknown';

  SELECT name INTO user_name FROM users WHERE id = user_id;
  RETURN user_name;
END;

-- Edge case: Simple one-liner function
CREATE FUNCTION triple(x INT) RETURNS INT RETURN x * 3;

-- Edge case: Function returning constant
CREATE FUNCTION get_pi() RETURNS DECIMAL(10,8) RETURN 3.14159265;
