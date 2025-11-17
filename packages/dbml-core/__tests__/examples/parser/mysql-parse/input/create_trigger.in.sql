-- Test CREATE TRIGGER with various options and edge cases

-- Create test tables first
CREATE TABLE audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  table_name VARCHAR(50),
  action VARCHAR(10),
  user_id INT,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100),
  email VARCHAR(100),
  status VARCHAR(20),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE TABLE products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200),
  price DECIMAL(10,2),
  stock INT,
  last_updated TIMESTAMP
);

-- Simple BEFORE INSERT trigger
CREATE TRIGGER before_user_insert
BEFORE INSERT ON users
FOR EACH ROW
SET NEW.created_at = NOW();

-- Simple AFTER INSERT trigger
CREATE TRIGGER after_user_insert
AFTER INSERT ON users
FOR EACH ROW
INSERT INTO audit_log (table_name, action, user_id)
VALUES ('users', 'INSERT', NEW.id);

-- BEFORE UPDATE trigger
CREATE TRIGGER before_user_update
BEFORE UPDATE ON users
FOR EACH ROW
SET NEW.updated_at = CURRENT_TIMESTAMP;

-- AFTER UPDATE trigger
CREATE TRIGGER after_user_update
AFTER UPDATE ON users
FOR EACH ROW
INSERT INTO audit_log (table_name, action, user_id)
VALUES ('users', 'UPDATE', NEW.id);

-- BEFORE DELETE trigger
CREATE TRIGGER before_user_delete
BEFORE DELETE ON users
FOR EACH ROW
INSERT INTO audit_log (table_name, action, user_id)
VALUES ('users', 'DELETE', OLD.id);

-- AFTER DELETE trigger
CREATE TRIGGER after_user_delete
AFTER DELETE ON users
FOR EACH ROW
SET @deleted_user_id = OLD.id;

-- Trigger with DEFINER
CREATE DEFINER = 'admin'@'localhost'
TRIGGER definer_trigger
AFTER INSERT ON products
FOR EACH ROW
SET @last_product_id = NEW.id;

-- Trigger with DEFINER = CURRENT_USER
CREATE DEFINER = CURRENT_USER
TRIGGER current_user_trigger
BEFORE INSERT ON products
FOR EACH ROW
SET NEW.last_updated = NOW();

-- Trigger with multiple statements using BEGIN...END
CREATE TRIGGER multi_statement_trigger
AFTER INSERT ON users
FOR EACH ROW
BEGIN
  INSERT INTO audit_log (table_name, action, user_id) VALUES ('users', 'INSERT', NEW.id);
  SET @last_inserted_id = NEW.id;
  UPDATE products SET stock = stock + 1 WHERE id = 1;
END;

-- Trigger with IF condition
CREATE TRIGGER conditional_trigger
BEFORE UPDATE ON products
FOR EACH ROW
BEGIN
  IF NEW.price < 0 THEN
    SET NEW.price = 0;
  END IF;
  SET NEW.last_updated = NOW();
END;

-- Trigger with IF...ELSE
CREATE TRIGGER if_else_trigger
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
  IF NEW.status = 'inactive' THEN
    INSERT INTO audit_log (table_name, action, user_id) VALUES ('users', 'DEACTIVATED', NEW.id);
  ELSE
    INSERT INTO audit_log (table_name, action, user_id) VALUES ('users', 'STATUS_CHANGE', NEW.id);
  END IF;
END;

-- Trigger with CASE statement
CREATE TRIGGER case_trigger
AFTER INSERT ON products
FOR EACH ROW
BEGIN
  CASE
    WHEN NEW.price < 10 THEN
      SET @price_category = 'cheap';
    WHEN NEW.price >= 10 AND NEW.price < 100 THEN
      SET @price_category = 'medium';
    ELSE
      SET @price_category = 'expensive';
  END CASE;
END;

-- Trigger with SIGNAL (error handling)
CREATE TRIGGER validate_email_trigger
BEFORE INSERT ON users
FOR EACH ROW
BEGIN
  IF NEW.email NOT LIKE '%@%' THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Invalid email format';
  END IF;
END;

-- Trigger with DECLARE variable
CREATE TRIGGER declare_var_trigger
AFTER UPDATE ON products
FOR EACH ROW
BEGIN
  DECLARE price_diff DECIMAL(10,2);
  SET price_diff = NEW.price - OLD.price;
  IF price_diff > 0 THEN
    INSERT INTO audit_log (table_name, action) VALUES ('products', 'PRICE_INCREASE');
  END IF;
END;

-- Edge case: Trigger with backticks in name
CREATE TRIGGER `trigger-with-dashes`
AFTER INSERT ON users
FOR EACH ROW
SET @user_created = 1;

-- Edge case: Trigger with reserved word as name (quoted)
CREATE TRIGGER `select`
BEFORE UPDATE ON users
FOR EACH ROW
SET NEW.updated_at = NOW();

-- Trigger accessing both NEW and OLD
CREATE TRIGGER old_new_trigger
AFTER UPDATE ON products
FOR EACH ROW
BEGIN
  IF OLD.stock != NEW.stock THEN
    INSERT INTO audit_log (table_name, action) VALUES ('products', 'STOCK_CHANGED');
  END IF;
END;

-- Trigger with nested IF
CREATE TRIGGER nested_if_trigger
BEFORE UPDATE ON users
FOR EACH ROW
BEGIN
  IF NEW.status != OLD.status THEN
    IF NEW.status = 'active' THEN
      SET NEW.updated_at = NOW();
    ELSEIF NEW.status = 'inactive' THEN
      SET NEW.updated_at = NOW();
    ELSE
      SET NEW.status = OLD.status;
    END IF;
  END IF;
END;

-- Trigger with WHILE loop
CREATE TRIGGER while_loop_trigger
AFTER INSERT ON products
FOR EACH ROW
BEGIN
  DECLARE counter INT DEFAULT 0;
  WHILE counter < 3 DO
    SET counter = counter + 1;
  END WHILE;
  SET @loop_count = counter;
END;

-- Trigger with REPEAT loop
CREATE TRIGGER repeat_loop_trigger
AFTER INSERT ON users
FOR EACH ROW
BEGIN
  DECLARE i INT DEFAULT 0;
  REPEAT
    SET i = i + 1;
  UNTIL i >= 5
  END REPEAT;
END;

-- Trigger with LOOP and LEAVE
CREATE TRIGGER loop_leave_trigger
AFTER UPDATE ON products
FOR EACH ROW
BEGIN
  DECLARE done INT DEFAULT FALSE;
  DECLARE counter INT DEFAULT 0;

  my_loop: LOOP
    SET counter = counter + 1;
    IF counter >= 10 THEN
      LEAVE my_loop;
    END IF;
  END LOOP;
END;

-- Trigger with ITERATE
CREATE TRIGGER iterate_trigger
BEFORE DELETE ON users
FOR EACH ROW
BEGIN
  DECLARE i INT DEFAULT 0;

  my_loop: LOOP
    SET i = i + 1;
    IF i < 5 THEN
      ITERATE my_loop;
    END IF;
    LEAVE my_loop;
  END LOOP;
END;

-- Trigger with multiple DECLARE statements
CREATE TRIGGER multi_declare_trigger
AFTER INSERT ON products
FOR EACH ROW
BEGIN
  DECLARE product_name VARCHAR(200);
  DECLARE product_price DECIMAL(10,2);
  DECLARE is_expensive BOOLEAN;

  SET product_name = NEW.name;
  SET product_price = NEW.price;
  SET is_expensive = product_price > 100;
END;

-- Edge case: Trigger with complex expression
CREATE TRIGGER complex_expr_trigger
BEFORE INSERT ON products
FOR EACH ROW
BEGIN
  DECLARE calculated_price DECIMAL(10,2);
  SET calculated_price = ROUND(NEW.price * 1.2 + 5.99, 2);
  IF calculated_price > NEW.price * 1.5 THEN
    SET NEW.price = calculated_price;
  END IF;
END;

-- Trigger with CURSOR (edge case)
CREATE TRIGGER cursor_trigger
AFTER INSERT ON users
FOR EACH ROW
BEGIN
  DECLARE done INT DEFAULT FALSE;
  DECLARE user_count INT;
  DECLARE cur CURSOR FOR SELECT COUNT(*) FROM users WHERE status = 'active';
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

  OPEN cur;
  FETCH cur INTO user_count;
  SET @active_users = user_count;
  CLOSE cur;
END;

-- Trigger with exception handler
CREATE TRIGGER handler_trigger
AFTER UPDATE ON products
FOR EACH ROW
BEGIN
  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION
  BEGIN
    INSERT INTO audit_log (table_name, action) VALUES ('products', 'ERROR');
  END;

  UPDATE users SET name = 'test' WHERE id = NEW.id;
END;

-- Edge case: Trigger referencing table columns with backticks
CREATE TRIGGER backtick_columns_trigger
BEFORE INSERT ON users
FOR EACH ROW
SET NEW.`name` = UPPER(NEW.`name`);

-- Edge case: Trigger with string concatenation
CREATE TRIGGER concat_trigger
BEFORE INSERT ON users
FOR EACH ROW
SET NEW.email = CONCAT(NEW.name, '@example.com');

-- Trigger with date/time functions
CREATE TRIGGER datetime_trigger
BEFORE UPDATE ON users
FOR EACH ROW
BEGIN
  IF YEAR(NOW()) - YEAR(NEW.created_at) > 1 THEN
    SET @is_old_account = TRUE;
  END IF;
END;

-- Edge case: Empty trigger body (technically valid but unusual)
CREATE TRIGGER minimal_trigger
AFTER INSERT ON audit_log
FOR EACH ROW
BEGIN
END;

-- Trigger with SET multiple variables
CREATE TRIGGER multi_set_trigger
AFTER INSERT ON products
FOR EACH ROW
SET @product_id = NEW.id, @product_name = NEW.name, @product_price = NEW.price;
