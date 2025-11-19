-- Test CREATE PROCEDURE with various parameters and options

-- Simple procedure with no parameters
CREATE PROCEDURE simple_proc()
BEGIN
  SELECT 'Hello World';
END;

-- Procedure with IN parameter
CREATE PROCEDURE proc_with_in(IN user_id INT)
BEGIN
  SELECT * FROM users WHERE id = user_id;
END;

-- Procedure with OUT parameter
CREATE PROCEDURE proc_with_out(OUT user_count INT)
BEGIN
  SELECT COUNT(*) INTO user_count FROM users;
END;

-- Procedure with INOUT parameter
CREATE PROCEDURE proc_with_inout(INOUT counter INT)
BEGIN
  SET counter = counter + 1;
END;

-- Procedure with multiple parameters
CREATE PROCEDURE proc_multi_params(
  IN user_name VARCHAR(100),
  IN user_email VARCHAR(100),
  OUT new_id INT
)
BEGIN
  INSERT INTO users (name, email) VALUES (user_name, user_email);
  SET new_id = LAST_INSERT_ID();
END;

-- Procedure with mixed parameter types
CREATE PROCEDURE proc_mixed_params(
  IN search_term VARCHAR(50),
  OUT result_count INT,
  INOUT page_number INT
)
BEGIN
  SELECT COUNT(*) INTO result_count FROM users WHERE name LIKE CONCAT('%', search_term, '%');
  SET page_number = page_number + 1;
END;

-- Procedure with DEFINER
CREATE DEFINER = 'admin'@'localhost'
PROCEDURE definer_proc()
BEGIN
  SELECT * FROM users;
END;

-- Procedure with DEFINER = CURRENT_USER
CREATE DEFINER = CURRENT_USER
PROCEDURE current_user_proc()
BEGIN
  SELECT USER() as current_user;
END;

-- Procedure with SQL SECURITY DEFINER
CREATE PROCEDURE security_definer_proc()
SQL SECURITY DEFINER
BEGIN
  SELECT * FROM sensitive_data;
END;

-- Procedure with SQL SECURITY INVOKER
CREATE PROCEDURE security_invoker_proc()
SQL SECURITY INVOKER
BEGIN
  SELECT * FROM users;
END;

-- Procedure with DETERMINISTIC
CREATE PROCEDURE deterministic_proc(IN x INT, OUT result INT)
DETERMINISTIC
BEGIN
  SET result = x * 2;
END;

-- Procedure with NOT DETERMINISTIC
CREATE PROCEDURE not_deterministic_proc(OUT random_val INT)
NOT DETERMINISTIC
BEGIN
  SET random_val = FLOOR(RAND() * 100);
END;

-- Procedure with CONTAINS SQL
CREATE PROCEDURE contains_sql_proc()
CONTAINS SQL
BEGIN
  SELECT * FROM users;
END;

-- Procedure with NO SQL
CREATE PROCEDURE no_sql_proc(IN x INT, OUT result INT)
NO SQL
BEGIN
  SET result = x + 10;
END;

-- Procedure with READS SQL DATA
CREATE PROCEDURE reads_sql_proc()
READS SQL DATA
BEGIN
  SELECT COUNT(*) as user_count FROM users;
END;

-- Procedure with MODIFIES SQL DATA
CREATE PROCEDURE modifies_sql_proc(IN user_id INT)
MODIFIES SQL DATA
BEGIN
  UPDATE users SET updated_at = NOW() WHERE id = user_id;
END;

-- Procedure with COMMENT
CREATE PROCEDURE commented_proc()
COMMENT 'This procedure retrieves all active users'
BEGIN
  SELECT * FROM users WHERE status = 'active';
END;

-- Procedure with all options
CREATE DEFINER = 'root'@'localhost'
PROCEDURE full_options_proc(IN user_id INT, OUT user_name VARCHAR(100))
DETERMINISTIC
SQL SECURITY DEFINER
MODIFIES SQL DATA
COMMENT 'Get user name by ID'
BEGIN
  SELECT name INTO user_name FROM users WHERE id = user_id;
END;

-- Procedure with IF statement
CREATE PROCEDURE if_proc(IN age INT, OUT category VARCHAR(20))
BEGIN
  IF age < 18 THEN
    SET category = 'minor';
  ELSEIF age >= 18 AND age < 65 THEN
    SET category = 'adult';
  ELSE
    SET category = 'senior';
  END IF;
END;

-- Procedure with CASE statement
CREATE PROCEDURE case_proc(IN grade CHAR(1), OUT description VARCHAR(50))
BEGIN
  CASE grade
    WHEN 'A' THEN SET description = 'Excellent';
    WHEN 'B' THEN SET description = 'Good';
    WHEN 'C' THEN SET description = 'Average';
    WHEN 'D' THEN SET description = 'Below Average';
    ELSE SET description = 'Fail';
  END CASE;
END;

-- Procedure with WHILE loop
CREATE PROCEDURE while_proc(IN max_val INT)
BEGIN
  DECLARE counter INT DEFAULT 0;
  WHILE counter < max_val DO
    INSERT INTO audit_log (table_name, action) VALUES ('test', CONCAT('iteration_', counter));
    SET counter = counter + 1;
  END WHILE;
END;

-- Procedure with REPEAT loop
CREATE PROCEDURE repeat_proc(IN iterations INT)
BEGIN
  DECLARE i INT DEFAULT 0;
  REPEAT
    SET i = i + 1;
  UNTIL i >= iterations
  END REPEAT;
  SELECT i as final_count;
END;

-- Procedure with LOOP
CREATE PROCEDURE loop_proc(IN limit_val INT)
BEGIN
  DECLARE counter INT DEFAULT 0;

  my_loop: LOOP
    SET counter = counter + 1;
    IF counter >= limit_val THEN
      LEAVE my_loop;
    END IF;
  END LOOP;

  SELECT counter;
END;

-- Procedure with CURSOR
CREATE PROCEDURE cursor_proc()
BEGIN
  DECLARE done INT DEFAULT FALSE;
  DECLARE user_name VARCHAR(100);
  DECLARE cur CURSOR FOR SELECT name FROM users WHERE status = 'active';
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

  OPEN cur;

  read_loop: LOOP
    FETCH cur INTO user_name;
    IF done THEN
      LEAVE read_loop;
    END IF;
    -- Process user_name
  END LOOP;

  CLOSE cur;
END;

-- Procedure with error handling
CREATE PROCEDURE error_handler_proc(IN user_id INT)
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    SELECT 'An error occurred' as error_message;
  END;

  DELETE FROM users WHERE id = user_id;
END;

-- Procedure with SIGNAL
CREATE PROCEDURE signal_proc(IN amount DECIMAL(10,2))
BEGIN
  IF amount < 0 THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Amount cannot be negative';
  END IF;
END;

-- Procedure with DECLARE variables
CREATE PROCEDURE declare_proc()
BEGIN
  DECLARE var_int INT DEFAULT 0;
  DECLARE var_varchar VARCHAR(100) DEFAULT 'test';
  DECLARE var_decimal DECIMAL(10,2);
  DECLARE var_date DATE;
  DECLARE var_bool BOOLEAN DEFAULT TRUE;

  SET var_int = 42;
  SET var_decimal = 99.99;
  SET var_date = CURDATE();
END;

-- Procedure with SELECT INTO
CREATE PROCEDURE select_into_proc(IN user_id INT)
BEGIN
  DECLARE user_name VARCHAR(100);
  DECLARE user_email VARCHAR(100);

  SELECT name, email INTO user_name, user_email
  FROM users WHERE id = user_id;

  SELECT user_name, user_email;
END;

-- Procedure with multiple SELECT statements
CREATE PROCEDURE multi_select_proc()
BEGIN
  SELECT * FROM users WHERE status = 'active';
  SELECT * FROM users WHERE status = 'inactive';
  SELECT COUNT(*) as total FROM users;
END;

-- Procedure with INSERT
CREATE PROCEDURE insert_proc(IN user_name VARCHAR(100), IN user_email VARCHAR(100))
BEGIN
  INSERT INTO users (name, email, created_at)
  VALUES (user_name, user_email, NOW());

  SELECT LAST_INSERT_ID() as new_id;
END;

-- Procedure with UPDATE
CREATE PROCEDURE update_proc(IN user_id INT, IN new_name VARCHAR(100))
BEGIN
  UPDATE users SET name = new_name, updated_at = NOW()
  WHERE id = user_id;

  SELECT ROW_COUNT() as affected_rows;
END;

-- Procedure with DELETE
CREATE PROCEDURE delete_proc(IN user_id INT)
BEGIN
  DELETE FROM users WHERE id = user_id;
  SELECT ROW_COUNT() as deleted_count;
END;

-- Procedure with transaction
CREATE PROCEDURE transaction_proc(IN from_id INT, IN to_id INT, IN amount DECIMAL(10,2))
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    SELECT 'Transaction rolled back' as status;
  END;

  START TRANSACTION;
  UPDATE accounts SET balance = balance - amount WHERE id = from_id;
  UPDATE accounts SET balance = balance + amount WHERE id = to_id;
  COMMIT;

  SELECT 'Transaction completed' as status;
END;

-- Procedure with nested blocks
CREATE PROCEDURE nested_blocks_proc()
BEGIN
  DECLARE x INT DEFAULT 0;

  BEGIN
    DECLARE y INT DEFAULT 10;
    SET x = x + y;
  END;

  BEGIN
    DECLARE z INT DEFAULT 5;
    SET x = x + z;
  END;

  SELECT x as result;
END;

-- Edge case: Procedure with backticks in name
CREATE PROCEDURE `proc-with-dashes`()
BEGIN
  SELECT 1;
END;

-- Edge case: Procedure with reserved word as name (quoted)
CREATE PROCEDURE `select`(IN param INT)
BEGIN
  SELECT param;
END;

-- Procedure with complex parameter types
CREATE PROCEDURE complex_params_proc(
  IN json_data JSON,
  IN text_data TEXT,
  IN blob_data BLOB,
  IN enum_val ENUM('A', 'B', 'C')
)
BEGIN
  SELECT json_data, text_data, enum_val;
END;

-- Procedure with default parameter behavior (NULL)
CREATE PROCEDURE null_param_proc(IN optional_param INT)
BEGIN
  IF optional_param IS NULL THEN
    SELECT 'Parameter is NULL' as message;
  ELSE
    SELECT optional_param;
  END IF;
END;

-- Procedure calling another procedure
CREATE PROCEDURE calling_proc()
BEGIN
  CALL simple_proc();
  CALL proc_with_in(1);
END;

-- Procedure with ITERATE
CREATE PROCEDURE iterate_proc(IN max_val INT)
BEGIN
  DECLARE i INT DEFAULT 0;

  my_loop: LOOP
    SET i = i + 1;

    IF i > max_val THEN
      LEAVE my_loop;
    END IF;

    IF i % 2 = 0 THEN
      ITERATE my_loop;
    END IF;

    -- Process odd numbers
  END LOOP;
END;

-- Procedure with PREPARE/EXECUTE (dynamic SQL)
CREATE PROCEDURE dynamic_sql_proc(IN table_name VARCHAR(64))
BEGIN
  SET @sql = CONCAT('SELECT * FROM ', table_name);
  PREPARE stmt FROM @sql;
  EXECUTE stmt;
  DEALLOCATE PREPARE stmt;
END;

-- Edge case: Empty procedure body
CREATE PROCEDURE empty_proc()
BEGIN
END;

-- Procedure with multiple handlers
CREATE PROCEDURE multi_handler_proc()
BEGIN
  DECLARE CONTINUE HANDLER FOR SQLWARNING
    SET @warning_count = @warning_count + 1;

  DECLARE CONTINUE HANDLER FOR NOT FOUND
    SET @not_found = TRUE;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
  END;

  -- Procedure logic here
  SELECT * FROM users;
END;

-- Procedure with complex expression in parameter default
CREATE PROCEDURE expr_proc(IN input_val INT)
BEGIN
  DECLARE computed_val INT DEFAULT input_val * 2 + 10;
  SELECT computed_val;
END;
