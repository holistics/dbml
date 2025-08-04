-- src: https://github.com/dtaivpp/car_company_database/blob/master/Create_Tables.sql
Create Table Customers(
  customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  gender STRING CHECK(gender = "Male" or gender = "Female"),
  household_income INTEGER,
  birthdate DATE NOT NULL,
  phone_number INTEGER NOT NULL,
  email VARCHAR(128)
);

Create Table Car_Vins(
  vin INTEGER PRIMARY KEY AUTOINCREMENT,
  model_id INTEGER NOT NULL,
  option_set_id INTEGER NOT NULL,
  manufactured_date DATE NOT NULL,
  manufactured_plant_id INTEGER NOT NULL,
  FOREIGN KEY (model_id) REFERENCES Models(model_id),
  FOREIGN KEY (manufactured_plant_id) REFERENCES Manufacture_Plant(manufacture_plant_id),
  FOREIGN KEY (option_set_id) REFERENCES Car_Options(option_set_id)
);

Create Table Car_Options(
  option_set_id INTEGER PRIMARY KEY AUTOINCREMENT,
  model_id INTEGER NULL,
  engine_id INTEGER NOT NULL,
  transmission_id INTEGER NOT NULL,
  chassis_id INTEGER NOT NULL,
  premium_sound_id INTEGER,
  color VARCHAR(30) NOT NULL,
  option_set_price INTEGER NOT NUll,
  FOREIGN KEY (model_id) REFERENCES Models(model_id),
  FOREIGN KEY (engine_id) REFERENCES Car_Parts(part_id),
  FOREIGN KEY (premium_sound_id) REFERENCES Car_Parts(part_id),
  FOREIGN KEY (transmission_id) REFERENCES Car_Parts(part_id),
  FOREIGN KEY (chassis_id) REFERENCES Car_Parts(part_id)
);

Create Table Car_Parts(
  part_id INTEGER PRIMARY KEY AUTOINCREMENT,
  part_name VARCHAR(100) NOT NULL,
  manufacture_plant_id INTEGER NOT NULL,
  manufacture_start_date DATE NOT NUll,
  manufacture_end_date DATE,
  part_recall INTEGER DEFAULT 0 CHECK (part_recall = 0 or part_recall = 1),
  FOREIGN KEY (manufacture_plant_id) REFERENCES Manufacture_Plant(manufacture_plant_id)
);

Create Table Brands(
  brand_id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand_name VARCHAR(50) NOT NUll
);

Create Table Models(
  model_id INTEGER PRIMARY KEY AUTOINCREMENT,
  model_name VARCHAR(50) NOT NULL,
  model_base_price INTEGER NOT NULL,
  brand_id INTEGER NOT NULL,
  FOREIGN KEY (brand_id) REFERENCES Brands(brand_id)
);

Create Table Customer_Ownership(
  customer_id INTEGER NOT NULL,
  vin INTEGER NOT NULL,
  purchase_date DATE NOT NULL,
  purchase_price INTEGER NOT NULL,
  warantee_expire_date DATE,
  dealer_id INTEGER NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES Customers(customer_id),
  FOREIGN KEY (vin) REFERENCES Car_Vins(vin),
  FOREIGN KEY (dealer_id) REFERENCES Dealers(dealer_id)
  PRIMARY KEY (customer_id, vin)
);

Create Table Manufacture_Plant(
  manufacture_plant_id INTEGER PRIMARY KEY AUTOINCREMENT,
  plant_name VARCHAR(50) NOT NULL,
  plant_type VARCHAR (7) CHECK (plant_type="Assembly" or plant_type="Parts"),
  plant_location VARCHAR(100),
  company_owned INTEGER CHECK(company_owned=0 or company_owned=1)
);

Create Table Dealers (
  dealer_id INTEGER PRIMARY KEY AUTOINCREMENT,
  dealer_name VARCHAR(50) NOT NULL,
  dealer_address VARCHAR(100)
);

Create Table Dealer_Brand(
  dealer_id INTEGER NOT NULL,
  brand_id INTEGER NOT NULL,
  FOREIGN KEY (dealer_id) REFERENCES Dealers(dealer_id),
  FOREIGN KEY (brand_id) REFERENCES Brands(brand_id),
  PRIMARY KEY (dealer_id, brand_id)
);