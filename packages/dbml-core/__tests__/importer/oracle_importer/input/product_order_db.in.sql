-- ProductOrderDb, A database for Physical Database Design
-- Oracle Version
--
-- Michal Kratky, Radim Baca
-- dbedu@cs.vsb.cz, 2023-2024

drop table OrderItem;
drop table "Order";
drop table Store;
drop table Product;
drop table Customer;
drop type idProductArrayType;

create table Customer (
  idCustomer int primary key,
  fName varchar(20) not null,
  lName varchar(30) not null,
  residence varchar(20) not null,
  gender char(1) not null,
  birthday date not null
);

create table Product (
  idProduct int primary key,
  name varchar(30) not null,
  unit_price int not null,
  producer varchar(30) not null,
  description varchar(2000) null
);

create table Store (
  idStore int primary key,
  name varchar(30) not null,
  residence varchar(20) not null
);

create table "Order" (
  idOrder int primary key,
  order_datetime date not null,
  idCustomer int references Customer(idCustomer) not null,
  order_status varchar2(10),
  idStore int references Store(idStore) not null
);

create table OrderItem (
  idOrder int references "Order"(idOrder) not null,
  idProduct int references Product(idProduct) not null,
  unit_price int not null,
  quantity int not null,
  primary key(idOrder, idProduct)
);
