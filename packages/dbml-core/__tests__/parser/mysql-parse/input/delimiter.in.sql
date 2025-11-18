CREATE TABLE Table_0 (
  id INT DEFAULT 'default value with semicolon ;'
);

DELIMITER ;;

CREATE TABLE Table_1 (
  id INT
);;

DELIMITER @@

CREATE TABLE Table_2 (
  id INT
)@@

DELIMITER @

CREATE TABLE Table_3 (
  id INT
)@

DELIMITER ;

CREATE TABLE Table_4 (
  id INT
);

DELIMITER ';' -- Delimiter with a quote ';'

CREATE TABLE Table_5 (
  id INT
)';'

DELIMITER ;

-- This will not take effect ;;
-- DELIMITER @@
CREATE TABLE Table_6 (
  id INT
);

DELIMITER GO

CREATE TABLE Table_7 (
  id INT
)GO

DELIMITER END

CREATE TABLE Table_8 (
  id INT
)END

-- This is not allowed
-- DELIMITER ' '

DELIMITER COMMENT -- Try a keyword

CREATE TABLE Table_9 (
  id INT
)COMMENT

DELIMITER '
CREATE TABLE Table_10 (
  id INT
)'

DELIMITER "
CREATE TABLE Table_11 (
  id INT
)"

DELIMITER `
CREATE TABLE Table_12 (
  id INT
)`

DELIMITER [
CREATE TABLE Table_13 (
  id INT
)[

DELIMITER ]
CREATE TABLE Table_14 (
  id INT
)]

DELIMITER ((
CREATE TABLE Table_15 (
  id INT
)((

DELIMITER ))
CREATE TABLE Table_16 (
  id INT
) ))

DELIMITER ,
CREATE TABLE Table_17 (
  id INT
),

DELIMITER --
CREATE TABLE Table_18 (
  id INT # To comment, you must do this
)--

DELIMITER ;
-- Now you can make comment

DELIMITER .
CREATE TABLE Table_19 (
  id INT
).

DELIMITER # 
CREATE TABLE Table_20 (
  id INT -- To comment, you must do this
)#

DELIMITER ;
# Now you can make comment

DELIMITER /*
CREATE TABLE Table_21 (
  id INT
)/*

DELIMITER ;

/* Now 
you
can
make comment again
*/

DELIMITER */
CREATE TABLE Table_22 (
  id INT
)*/

DELIMITER ;

/* Now 
you
can
make comment again
*/

CREATE TABLE Table_23 (
 id INT DEFAULT 'default value with semicolon ;'
);

DELIMITER @@

CREATE TABLE Table_24 (
  id INT DEFAULT 'default value with new delimiter @@'
);

-- There is no way out after this

DELIMITER DELIMITER
CREATE TABLE Table_inf (
  id INT DEFAULT 'there is no way out'
)DELIMITER
