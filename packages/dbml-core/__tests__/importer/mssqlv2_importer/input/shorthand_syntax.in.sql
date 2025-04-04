CREATE TABLE [booking_reference] (
  [reference_id] NVARCHAR(10) NOT NULL,
  [cust_id] DECIMAL(10) NOT NULL,
  [status] NVARCHAR (1) NOT NULL,
  PRIMARY KEY ([reference_id], [cust_id])
)
GO

CREATE TABLE [br_flight] (
  [reference_id] NVARCHAR(10) NOT NULL,
  [cust_id] DECIMAL(10) NOT NULL,
  [flight_id] NVARCHAR (10) NOT NULL,
  PRIMARY KEY ([reference_id], [flight_id])
)
GO

CREATE TABLE [countries] (
  [code] int PRIMARY KEY,
  [name] varchar,
  [continent_name] varchar
)
GO

CREATE TABLE [users] (
  [id] int PRIMARY KEY,
  [full_name] varchar,
  [email] varchar UNIQUE,
  [gender] varchar,
  [date_of_birth] varchar,
  [created_at] varchar,
  [modified_at] time(2),
  [country_code] int,
  CONSTRAINT [fk_country_code]
    FOREIGN KEY ([country_code])
      REFERENCES [countries] ([code])
)
GO

ALTER TABLE [br_flight] ADD CONSTRAINT [fk_composite] FOREIGN KEY ([reference_id], [cust_id]) REFERENCES [booking_reference] ([reference_id], [cust_id])
GO
