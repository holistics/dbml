-- Test DROP PROCEDURE and DROP FUNCTION statements

-- Create procedures for testing
CREATE PROCEDURE proc1() BEGIN SELECT 1; END;
CREATE PROCEDURE proc2() BEGIN SELECT 2; END;
CREATE PROCEDURE proc3(IN x INT) BEGIN SELECT x; END;

-- Simple DROP PROCEDURE
DROP PROCEDURE proc1;

-- DROP PROCEDURE with IF EXISTS
DROP PROCEDURE IF EXISTS proc1;

-- DROP PROCEDURE with database prefix
DROP PROCEDURE mydb.proc2;

-- DROP PROCEDURE with IF EXISTS and database prefix
DROP PROCEDURE IF EXISTS mydb.proc2;

-- DROP PROCEDURE with backticks
DROP PROCEDURE `proc3`;

-- DROP PROCEDURE with backticks in name
DROP PROCEDURE `proc-with-dashes`;

-- DROP PROCEDURE with reserved word as name
DROP PROCEDURE `select`;

-- DROP PROCEDURE with database and procedure names backticked
DROP PROCEDURE `mydb`.`my_proc`;

-- Edge case: DROP non-existent procedure
DROP PROCEDURE IF EXISTS non_existent_proc;

-- Edge case: Very long procedure name
DROP PROCEDURE IF EXISTS very_long_procedure_name_at_maximum_length;

-- Edge case: Procedure with numbers
DROP PROCEDURE IF EXISTS proc123;
DROP PROCEDURE IF EXISTS proc_2023;

-- Edge case: Procedure name starting with number (quoted)
DROP PROCEDURE IF EXISTS `123proc`;

-- Edge case: Special characters in name
DROP PROCEDURE IF EXISTS `proc@test`;
DROP PROCEDURE IF EXISTS `proc#special`;
DROP PROCEDURE IF EXISTS `proc.with.dots`;

-- Edge case: Reserved words as procedure names
DROP PROCEDURE IF EXISTS `database`;
DROP PROCEDURE IF EXISTS `table`;
DROP PROCEDURE IF EXISTS `procedure`;
DROP PROCEDURE IF EXISTS `function`;

-- Multiple sequential drops
DROP PROCEDURE IF EXISTS p1;
DROP PROCEDURE IF EXISTS p2;
DROP PROCEDURE IF EXISTS p3;

-- DROP with various database prefixes
DROP PROCEDURE IF EXISTS db1.proc1;
DROP PROCEDURE IF EXISTS db2.proc2;
DROP PROCEDURE IF EXISTS db3.proc3;

-- Edge case: Single character name
DROP PROCEDURE IF EXISTS p;

-- Edge case: Name with only numbers (quoted)
DROP PROCEDURE IF EXISTS `12345`;

-- Edge case: Unicode in name
DROP PROCEDURE IF EXISTS `proc_用户`;

-- Create functions for testing
CREATE FUNCTION func1() RETURNS INT RETURN 1;
CREATE FUNCTION func2() RETURNS INT RETURN 2;
CREATE FUNCTION func3(x INT) RETURNS INT RETURN x * 2;

-- Simple DROP FUNCTION
DROP FUNCTION func1;

-- DROP FUNCTION with IF EXISTS
DROP FUNCTION IF EXISTS func1;

-- DROP FUNCTION with database prefix
DROP FUNCTION mydb.func2;

-- DROP FUNCTION with IF EXISTS and database prefix
DROP FUNCTION IF EXISTS mydb.func2;

-- DROP FUNCTION with backticks
DROP FUNCTION `func3`;

-- DROP FUNCTION with backticks in name
DROP FUNCTION `func-with-dashes`;

-- DROP FUNCTION with reserved word as name
DROP FUNCTION `select`;

-- DROP FUNCTION with database and function names backticked
DROP FUNCTION `mydb`.`my_func`;

-- Edge case: DROP non-existent function
DROP FUNCTION IF EXISTS non_existent_func;

-- Edge case: Very long function name
DROP FUNCTION IF EXISTS very_long_function_name_at_maximum_length;

-- Edge case: Function with numbers
DROP FUNCTION IF EXISTS func123;
DROP FUNCTION IF EXISTS func_2023;

-- Edge case: Function name starting with number (quoted)
DROP FUNCTION IF EXISTS `123func`;

-- Edge case: Special characters in name
DROP FUNCTION IF EXISTS `func@test`;
DROP FUNCTION IF EXISTS `func#special`;
DROP FUNCTION IF EXISTS `func.with.dots`;

-- Edge case: Reserved words as function names
DROP FUNCTION IF EXISTS `database`;
DROP FUNCTION IF EXISTS `table`;
DROP FUNCTION IF EXISTS `index`;
DROP FUNCTION IF EXISTS `function`;

-- Multiple sequential drops
DROP FUNCTION IF EXISTS f1;
DROP FUNCTION IF EXISTS f2;
DROP FUNCTION IF EXISTS f3;

-- DROP with various database prefixes
DROP FUNCTION IF EXISTS db1.func1;
DROP FUNCTION IF EXISTS db2.func2;
DROP FUNCTION IF EXISTS db3.func3;

-- Edge case: Single character name
DROP FUNCTION IF EXISTS f;

-- Edge case: Name with only numbers (quoted)
DROP FUNCTION IF EXISTS `67890`;

-- Edge case: Unicode in name
DROP FUNCTION IF EXISTS `func_データ`;

-- Mix of procedures and functions
DROP PROCEDURE IF EXISTS test_proc;
DROP FUNCTION IF EXISTS test_func;
DROP PROCEDURE IF EXISTS another_proc;
DROP FUNCTION IF EXISTS another_func;

-- Full qualification with backticks
DROP PROCEDURE IF EXISTS `mydb`.`myproc`;
DROP FUNCTION IF EXISTS `mydb`.`myfunc`;

-- Edge case: Same name for procedure and function in different databases
DROP PROCEDURE IF EXISTS db1.same_name;
DROP FUNCTION IF EXISTS db2.same_name;

-- Edge case: Case sensitivity (MySQL is case-insensitive for routine names by default)
DROP PROCEDURE IF EXISTS MyProc;
DROP PROCEDURE IF EXISTS myproc;
DROP PROCEDURE IF EXISTS MYPROC;

DROP FUNCTION IF EXISTS MyFunc;
DROP FUNCTION IF EXISTS myfunc;
DROP FUNCTION IF EXISTS MYFUNC;
