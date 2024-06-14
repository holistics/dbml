CREATE TABLE "booking_reference" (
  reference_id NVARCHAR2(10) NOT NULL,
  cust_id NUMBER(10) NOT NULL,
  status NVARCHAR2(1) NOT NULL,
  PRIMARY KEY (reference_id, cust_id)
);

CREATE TABLE "br_flight" (
  "reference_id" NVARCHAR2(10) NOT NULL,
  "cust_id" NUMBER(10)NOT NULL,
  "flight_id" NVARCHAR2 (10) NOT NULL,
  PRIMARY KEY ("reference_id", "flight_id")
);

CREATE TABLE users (
  id NUMBER PRIMARY KEY,
  full_name VARCHAR2(255),
  email VARCHAR2(255) UNIQUE,
  gender VARCHAR2(10),
  date_of_birth DATE,
  created_at TIMESTAMP,
  modified_at TIMESTAMP,
  country_code NUMBER,
  CONSTRAINT fk_country_code
    FOREIGN KEY (country_code)
      REFERENCES countries(code)
);

CREATE TABLE countries (
  code NUMBER PRIMARY KEY,
  name VARCHAR2(255),
  continent_name VARCHAR2(255)
);

ALTER TABLE "br_flight" ADD CONSTRAINT "fk_composite" FOREIGN KEY ("reference_id", "cust_id") REFERENCES "booking_reference";
