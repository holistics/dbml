CREATE TABLE department (
    departmentid NUMBER NOT NULL,
    name VARCHAR2(255) NOT NULL,
    groupname VARCHAR2(255) NOT NULL,
    modifieddate TIMESTAMP DEFAULT SYSDATE NOT NULL
);

COMMENT ON TABLE department IS 'Lookup table containing the departments within the Adventure Works Cycles company.';

COMMENT ON COLUMN department.departmentid IS 'Primary key for Department records.';

COMMENT ON COLUMN department.name IS 'Name of the department.';

COMMENT ON COLUMN department.groupname IS 'Name of the group to which the department belongs.';

CREATE VIEW d AS
 SELECT department.departmentid AS id,
    department.departmentid,
    department.name,
    department.groupname,
    department.modifieddate
   FROM department;


CREATE TABLE employee (
    businessentityid NUMBER(10) NOT NULL,
    nationalidnumber VARCHAR2(15) NOT NULL,
    loginid VARCHAR2(256) NOT NULL,
    jobtitle VARCHAR2(50) NOT NULL,
    birthdate DATE NOT NULL,
    maritalstatus CHAR(1) NOT NULL,
    gender CHAR(1) NOT NULL,
    hiredate DATE NOT NULL,
    salariedflag NUMBER(1,0) DEFAULT 1 NOT NULL,
    vacationhours NUMBER(5,0) DEFAULT 0 NOT NULL,
    sickleavehours NUMBER(5,0) DEFAULT 0 NOT NULL,
    currentflag NUMBER(1,0) DEFAULT 1 NOT NULL,
    rowguid RAW(16) DEFAULT SYS_GUID() NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    organizationnode VARCHAR2(255) DEFAULT '/' NOT NULL,
    --CONSTRAINT CK_Employee_BirthDate CHECK (birthdate BETWEEN TO_DATE('1930-01-01', 'YYYY-MM-DD') AND SYSDATE - INTERVAL '18' YEAR),
    CONSTRAINT CK_Employee_Gender CHECK (gender IN ('M', 'F')),
    --CONSTRAINT CK_Employee_HireDate CHECK (hiredate BETWEEN TO_DATE('1996-07-01', 'YYYY-MM-DD') AND SYSDATE + INTERVAL '1' DAY),
    CONSTRAINT CK_Employee_MaritalStatus CHECK (maritalstatus IN ('M', 'S')),
    CONSTRAINT CK_Employee_SickLeaveHours CHECK (sickleavehours BETWEEN 0 AND 120),
    CONSTRAINT CK_Employee_VacationHours CHECK (vacationhours BETWEEN -40 AND 240)
);

COMMENT ON TABLE employee IS 'Employee information such as salary, department, and title.';

COMMENT ON COLUMN employee.businessentityid IS 'Primary key for Employee records.  Foreign key to BusinessEntity.BusinessEntityID.';

COMMENT ON COLUMN employee.nationalidnumber IS 'Unique national identification number such as a social security number.';

COMMENT ON COLUMN employee.loginid IS 'Network login.';

COMMENT ON COLUMN employee.jobtitle IS 'Work title such as Buyer or Sales Representative.';

COMMENT ON COLUMN employee.birthdate IS 'Date of birth.';

COMMENT ON COLUMN employee.maritalstatus IS 'M = Married, S = Single';

COMMENT ON COLUMN employee.gender IS 'M = Male, F = Female';

COMMENT ON COLUMN employee.hiredate IS 'Employee hired on this date.';

COMMENT ON COLUMN employee.salariedflag IS 'Job classification. 0 = Hourly, not exempt from collective bargaining. 1 = Salaried, exempt from collective bargaining.';

COMMENT ON COLUMN employee.vacationhours IS 'Number of available vacation hours.';

COMMENT ON COLUMN employee.sickleavehours IS 'Number of available sick leave hours.';

COMMENT ON COLUMN employee.currentflag IS '0 = Inactive, 1 = Active';

COMMENT ON COLUMN employee.organizationnode IS 'Where the employee is located in corporate hierarchy.';

CREATE VIEW e AS
 SELECT employee.businessentityid AS id,
    employee.businessentityid,
    employee.nationalidnumber,
    employee.loginid,
    employee.jobtitle,
    employee.birthdate,
    employee.maritalstatus,
    employee.gender,
    employee.hiredate,
    employee.salariedflag,
    employee.vacationhours,
    employee.sickleavehours,
    employee.currentflag,
    employee.rowguid,
    employee.modifieddate,
    employee.organizationnode
   FROM employee;

CREATE TABLE employeedepartmenthistory (
    businessentityid NUMBER NOT NULL,
    departmentid NUMBER(5) NOT NULL,
    shiftid NUMBER(5) NOT NULL,
    startdate DATE NOT NULL,
    enddate DATE,
    modifieddate TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT CK_EmployeeDepartmentHistory_EndDate CHECK (enddate >= startdate OR enddate IS NULL)
);

COMMENT ON TABLE employeedepartmenthistory IS 'Employee department transfers.';

COMMENT ON COLUMN employeedepartmenthistory.businessentityid IS 'Employee identification number. Foreign key to Employee.BusinessEntityID.';

COMMENT ON COLUMN employeedepartmenthistory.departmentid IS 'Department in which the employee worked including currently. Foreign key to Department.DepartmentID.';

COMMENT ON COLUMN employeedepartmenthistory.shiftid IS 'Identifies which 8-hour shift the employee works. Foreign key to Shift.Shift.ID.';

COMMENT ON COLUMN employeedepartmenthistory.startdate IS 'Date the employee started work in the department.';

COMMENT ON COLUMN employeedepartmenthistory.enddate IS 'Date the employee left the department. NULL = Current department.';

CREATE VIEW edh AS
 SELECT employeedepartmenthistory.businessentityid AS id,
    employeedepartmenthistory.businessentityid,
    employeedepartmenthistory.departmentid,
    employeedepartmenthistory.shiftid,
    employeedepartmenthistory.startdate,
    employeedepartmenthistory.enddate,
    employeedepartmenthistory.modifieddate
   FROM employeedepartmenthistory;

CREATE TABLE employeepayhistory (
    businessentityid NUMBER NOT NULL,
    ratechangedate TIMESTAMP NOT NULL,
    rate NUMBER(8, 2) NOT NULL,
    payfrequency NUMBER(5) NOT NULL,
    modifieddate TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT CK_EmployeePayHistory_PayFrequency CHECK (payfrequency IN (1, 2)),
    CONSTRAINT CK_EmployeePayHistory_Rate CHECK (rate >= 6.50 AND rate <= 200.00)
);

COMMENT ON TABLE employeepayhistory IS 'Employee pay history.';

COMMENT ON COLUMN employeepayhistory.businessentityid IS 'Employee identification number. Foreign key to Employee.BusinessEntityID.';

COMMENT ON COLUMN employeepayhistory.ratechangedate IS 'Date the change in pay is effective';

COMMENT ON COLUMN employeepayhistory.rate IS 'Salary hourly rate.';

COMMENT ON COLUMN employeepayhistory.payfrequency IS '1 = Salary received monthly, 2 = Salary received biweekly';

CREATE VIEW eph AS
 SELECT employeepayhistory.businessentityid AS id,
    employeepayhistory.businessentityid,
    employeepayhistory.ratechangedate,
    employeepayhistory.rate,
    employeepayhistory.payfrequency,
    employeepayhistory.modifieddate
   FROM employeepayhistory;

CREATE TABLE jobcandidate (
    jobcandidateid NUMBER NOT NULL,
    businessentityid NUMBER,
    resume XMLType,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE jobcandidate IS 'RÃ©sumÃ©s submitted to Human Resources by job applicants.';

COMMENT ON COLUMN jobcandidate.jobcandidateid IS 'Primary key for JobCandidate records.';

COMMENT ON COLUMN jobcandidate.businessentityid IS 'Employee identification number if applicant was hired. Foreign key to Employee.BusinessEntityID.';

COMMENT ON COLUMN jobcandidate.resume IS 'RÃ©sumÃ© in XML format.';

CREATE VIEW jc AS
 SELECT jobcandidate.jobcandidateid AS id,
    jobcandidate.jobcandidateid,
    jobcandidate.businessentityid,
    jobcandidate.resume,
    jobcandidate.modifieddate
   FROM jobcandidate;

CREATE TABLE shift (
    shiftid NUMBER NOT NULL,
    name VARCHAR2(255) NOT NULL,
    starttime TIMESTAMP,
    endtime TIMESTAMP,
    modifieddate TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL
);

COMMENT ON TABLE shift IS 'Work shift lookup table.';

COMMENT ON COLUMN shift.shiftid IS 'Primary key for Shift records.';

COMMENT ON COLUMN shift.name IS 'Shift description.';

COMMENT ON COLUMN shift.starttime IS 'Shift start time.';

COMMENT ON COLUMN shift.endtime IS 'Shift end time.';

CREATE VIEW s AS
 SELECT shift.shiftid AS id,
    shift.shiftid,
    shift.name,
    shift.starttime,
    shift.endtime,
    shift.modifieddate
   FROM shift;

CREATE TABLE address (
    addressid NUMBER(10) NOT NULL,
    addressline1 VARCHAR2(60) NOT NULL,
    addressline2 VARCHAR2(60),
    city VARCHAR2(30) NOT NULL,
    stateprovinceid NUMBER NOT NULL,
    postalcode VARCHAR2(15) NOT NULL,
    spatiallocation VARCHAR2(44),
    rowguid RAW(16) DEFAULT SYS_GUID() NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE address IS 'Street address information for customers, employees, and vendors.';

COMMENT ON COLUMN address.addressid IS 'Primary key for Address records.';

COMMENT ON COLUMN address.addressline1 IS 'First street address line.';

COMMENT ON COLUMN address.addressline2 IS 'Second street address line.';

COMMENT ON COLUMN address.city IS 'Name of the city.';

COMMENT ON COLUMN address.stateprovinceid IS 'Unique identification number for the state or province. Foreign key to StateProvince table.';

COMMENT ON COLUMN address.postalcode IS 'Postal code for the street address.';

COMMENT ON COLUMN address.spatiallocation IS 'Latitude and longitude of this address.';

CREATE TABLE businessentityaddress (
    businessentityid NUMBER NOT NULL,
    addressid NUMBER NOT NULL,
    addresstypeid NUMBER NOT NULL,
    rowguid RAW(16) DEFAULT SYS_GUID() NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE businessentityaddress IS 'Cross-reference table mapping customers, vendors, and employees to their addresses.';

COMMENT ON COLUMN businessentityaddress.businessentityid IS 'Primary key. Foreign key to BusinessEntity.BusinessEntityID.';

COMMENT ON COLUMN businessentityaddress.addressid IS 'Primary key. Foreign key to Address.AddressID.';

COMMENT ON COLUMN businessentityaddress.addresstypeid IS 'Primary key. Foreign key to AddressType.AddressTypeID.';

CREATE TABLE countryregion (
    countryregioncode VARCHAR2(3) NOT NULL,
    name VARCHAR2(255) NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE countryregion IS 'Lookup table containing the ISO standard codes for countries and regions.';

COMMENT ON COLUMN countryregion.countryregioncode IS 'ISO standard code for countries and regions.';

COMMENT ON COLUMN countryregion.name IS 'Country or region name.';

CREATE TABLE emailaddress (
    businessentityid NUMBER NOT NULL,
    emailaddressid NUMBER NOT NULL,
    emailaddress VARCHAR2(50),
    rowguid RAW(16) DEFAULT SYS_GUID() NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE emailaddress IS 'Where to send a person email.';

COMMENT ON COLUMN emailaddress.businessentityid IS 'Primary key. Person associated with this email address.  Foreign key to Person.BusinessEntityID';

COMMENT ON COLUMN emailaddress.emailaddressid IS 'Primary key. ID of this email address.';

COMMENT ON COLUMN emailaddress.emailaddress IS 'E-mail address for the person.';

CREATE TABLE person (
    businessentityid NUMBER NOT NULL,
    persontype CHAR(2) NOT NULL,
    namestyle NUMBER(1) DEFAULT 0 NOT NULL,
    title VARCHAR2(8),
    firstname VARCHAR2(255) NOT NULL,
    middlename VARCHAR2(255),
    lastname VARCHAR2(255) NOT NULL,
    suffix VARCHAR2(10),
    emailpromotion NUMBER(1) DEFAULT 0 NOT NULL,
    additionalcontactinfo XMLType,
    demographics XMLType,
    rowguid RAW(16) DEFAULT SYS_GUID() NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT CK_Person_EmailPromotion CHECK (emailpromotion BETWEEN 0 AND 2),
    CONSTRAINT CK_Person_PersonType CHECK (persontype IS NULL OR UPPER(persontype) IN ('SC', 'VC', 'IN', 'EM', 'SP', 'GC'))
);

COMMENT ON TABLE person IS 'Human beings involved with AdventureWorks: employees, customer contacts, and vendor contacts.';

COMMENT ON COLUMN person.businessentityid IS 'Primary key for Person records.';

COMMENT ON COLUMN person.persontype IS 'Primary type of person: SC = Store Contact, IN = Individual (retail) customer, SP = Sales person, EM = Employee (non-sales), VC = Vendor contact, GC = General contact';

COMMENT ON COLUMN person.namestyle IS '0 = The data in FirstName and LastName are stored in western style (first name, last name) order.  1 = Eastern style (last name, first name) order.';

COMMENT ON COLUMN person.title IS 'A courtesy title. For example, Mr. or Ms.';

COMMENT ON COLUMN person.firstname IS 'First name of the person.';

COMMENT ON COLUMN person.middlename IS 'Middle name or middle initial of the person.';

COMMENT ON COLUMN person.lastname IS 'Last name of the person.';

COMMENT ON COLUMN person.suffix IS 'Surname suffix. For example, Sr. or Jr.';

COMMENT ON COLUMN person.emailpromotion IS '0 = Contact does not wish to receive e-mail promotions, 1 = Contact does wish to receive e-mail promotions from AdventureWorks, 2 = Contact does wish to receive e-mail promotions from AdventureWorks and selected partners.';

COMMENT ON COLUMN person.additionalcontactinfo IS 'Additional contact information about the person stored in xml format.';

COMMENT ON COLUMN person.demographics IS 'Personal information such as hobbies, and income collected from online shoppers. Used for sales analysis.';

CREATE TABLE personphone (
    businessentityid NUMBER NOT NULL,
    phonenumber VARCHAR2(25) NOT NULL,
    phonenumbertypeid NUMBER NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE personphone IS 'Telephone number and type of a person.';

COMMENT ON COLUMN personphone.businessentityid IS 'Business entity identification number. Foreign key to Person.BusinessEntityID.';

COMMENT ON COLUMN personphone.phonenumber IS 'Telephone number identification number.';

COMMENT ON COLUMN personphone.phonenumbertypeid IS 'Kind of phone number. Foreign key to PhoneNumberType.PhoneNumberTypeID.';

CREATE TABLE phonenumbertype (
    phonenumbertypeid NUMBER NOT NULL,
    name VARCHAR2(255) NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE phonenumbertype IS 'Type of phone number of a person.';

COMMENT ON COLUMN phonenumbertype.phonenumbertypeid IS 'Primary key for telephone number type records.';

COMMENT ON COLUMN phonenumbertype.name IS 'Name of the telephone number type';

CREATE TABLE stateprovince (
    stateprovinceid NUMBER NOT NULL,
    stateprovincecode CHAR(3) NOT NULL,
    countryregioncode VARCHAR2(3) NOT NULL,
    isonlystateprovinceflag NUMBER(1) DEFAULT 1 NOT NULL, -- Use NUMBER(1) for boolean emulation
    name VARCHAR2(255) NOT NULL,
    territoryid NUMBER NOT NULL,
    rowguid RAW(16) DEFAULT SYS_GUID() NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE stateprovince IS 'State and province lookup table.';

COMMENT ON COLUMN stateprovince.stateprovinceid IS 'Primary key for StateProvince records.';

COMMENT ON COLUMN stateprovince.stateprovincecode IS 'ISO standard state or province code.';

COMMENT ON COLUMN stateprovince.countryregioncode IS 'ISO standard country or region code. Foreign key to CountryRegion.CountryRegionCode.';

COMMENT ON COLUMN stateprovince.isonlystateprovinceflag IS '0 = StateProvinceCode exists. 1 = StateProvinceCode unavailable, using CountryRegionCode.';

COMMENT ON COLUMN stateprovince.name IS 'State or province description.';

COMMENT ON COLUMN stateprovince.territoryid IS 'ID of the territory in which the state or province is located. Foreign key to SalesTerritory.SalesTerritoryID.';

CREATE VIEW vemployee AS
SELECT e.businessentityid,
    p.title,
    p.firstname,
    p.middlename,
    p.lastname,
    p.suffix,
    e.jobtitle,
    pp.phonenumber,
    pnt.name AS phonenumbertype,
    ea.emailaddress,
    p.emailpromotion,
    a.addressline1,
    a.addressline2,
    a.city,
    sp.name AS stateprovincename,
    a.postalcode,
    cr.name AS countryregionname,
    p.additionalcontactinfo
FROM ((((((((employee e
JOIN person p ON (p.businessentityid = e.businessentityid))
JOIN businessentityaddress bea ON (bea.businessentityid = e.businessentityid))
JOIN address a ON (a.addressid = bea.addressid))
JOIN stateprovince sp ON (sp.stateprovinceid = a.stateprovinceid))
JOIN countryregion cr ON (cr.countryregioncode = sp.countryregioncode))
LEFT JOIN personphone pp ON (pp.businessentityid = p.businessentityid))
LEFT JOIN phonenumbertype pnt ON (pp.phonenumbertypeid = pnt.phonenumbertypeid))
LEFT JOIN emailaddress ea ON (p.businessentityid = ea.businessentityid));

CREATE VIEW vemployeedepartment AS
 SELECT e.businessentityid,
    p.title,
    p.firstname,
    p.middlename,
    p.lastname,
    p.suffix,
    e.jobtitle,
    d.name AS department,
    d.groupname,
    edh.startdate
   FROM (((employee e
     JOIN person p ON ((p.businessentityid = e.businessentityid)))
     JOIN employeedepartmenthistory edh ON ((e.businessentityid = edh.businessentityid)))
     JOIN department d ON ((edh.departmentid = d.departmentid)))
  WHERE (edh.enddate IS NULL);

CREATE VIEW vemployeedepartmenthistory AS
 SELECT e.businessentityid,
    p.title,
    p.firstname,
    p.middlename,
    p.lastname,
    p.suffix,
    s.name AS shift,
    d.name AS department,
    d.groupname,
    edh.startdate,
    edh.enddate
   FROM ((((employee e
     JOIN person p ON ((p.businessentityid = e.businessentityid)))
     JOIN employeedepartmenthistory edh ON ((e.businessentityid = edh.businessentityid)))
     JOIN department d ON ((edh.departmentid = d.departmentid)))
     JOIN shift s ON ((s.shiftid = edh.shiftid)));

CREATE VIEW a AS
 SELECT address.addressid AS id,
    address.addressid,
    address.addressline1,
    address.addressline2,
    address.city,
    address.stateprovinceid,
    address.postalcode,
    address.spatiallocation,
    address.rowguid,
    address.modifieddate
   FROM address;

CREATE TABLE addresstype (
    addresstypeid NUMBER NOT NULL,
    name VARCHAR2(255) NOT NULL,
    rowguid RAW(16) DEFAULT SYS_GUID() NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE addresstype IS 'Types of addresses stored in the Address table.';

COMMENT ON COLUMN addresstype.addresstypeid IS 'Primary key for AddressType records.';

COMMENT ON COLUMN addresstype.name IS 'Address type description. For example, Billing, Home, or Shipping.';

CREATE VIEW at AS
 SELECT addresstype.addresstypeid AS id,
    addresstype.addresstypeid,
    addresstype.name,
    addresstype.rowguid,
    addresstype.modifieddate
   FROM addresstype;

CREATE TABLE businessentity (
    businessentityid NUMBER NOT NULL,
    rowguid RAW(16) DEFAULT SYS_GUID() NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE businessentity IS 'Source of the ID that connects vendors, customers, and employees with address and contact information.';

COMMENT ON COLUMN businessentity.businessentityid IS 'Primary key for all customers, vendors, and employees.';

CREATE VIEW be AS
 SELECT businessentity.businessentityid AS id,
    businessentity.businessentityid,
    businessentity.rowguid,
    businessentity.modifieddate
   FROM businessentity;

CREATE VIEW bea AS
 SELECT businessentityaddress.businessentityid AS id,
    businessentityaddress.businessentityid,
    businessentityaddress.addressid,
    businessentityaddress.addresstypeid,
    businessentityaddress.rowguid,
    businessentityaddress.modifieddate
   FROM businessentityaddress;

CREATE TABLE businessentitycontact (
    businessentityid NUMBER NOT NULL,
    personid NUMBER NOT NULL,
    contacttypeid NUMBER NOT NULL,
    rowguid RAW(16) DEFAULT SYS_GUID() NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE businessentitycontact IS 'Cross-reference table mapping stores, vendors, and employees to people';

COMMENT ON COLUMN businessentitycontact.businessentityid IS 'Primary key. Foreign key to BusinessEntity.BusinessEntityID.';

COMMENT ON COLUMN businessentitycontact.personid IS 'Primary key. Foreign key to Person.BusinessEntityID.';

COMMENT ON COLUMN businessentitycontact.contacttypeid IS 'Primary key.  Foreign key to ContactType.ContactTypeID.';

CREATE VIEW bec AS
 SELECT businessentitycontact.businessentityid AS id,
    businessentitycontact.businessentityid,
    businessentitycontact.personid,
    businessentitycontact.contacttypeid,
    businessentitycontact.rowguid,
    businessentitycontact.modifieddate
   FROM businessentitycontact;

CREATE VIEW cr AS
 SELECT countryregion.countryregioncode,
    countryregion.name,
    countryregion.modifieddate
   FROM countryregion;

CREATE TABLE contacttype (
    contacttypeid NUMBER NOT NULL,
    name VARCHAR2(255) NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE contacttype IS 'Lookup table containing the types of business entity contacts.';

COMMENT ON COLUMN contacttype.contacttypeid IS 'Primary key for ContactType records.';

COMMENT ON COLUMN contacttype.name IS 'Contact type description.';

CREATE VIEW ct AS
 SELECT contacttype.contacttypeid AS id,
    contacttype.contacttypeid,
    contacttype.name,
    contacttype.modifieddate
   FROM contacttype;

CREATE VIEW e2 AS
 SELECT emailaddress.emailaddressid AS id,
    emailaddress.businessentityid,
    emailaddress.emailaddressid,
    emailaddress.emailaddress,
    emailaddress.rowguid,
    emailaddress.modifieddate
   FROM emailaddress;

CREATE VIEW p AS
 SELECT person.businessentityid AS id,
    person.businessentityid,
    person.persontype,
    person.namestyle,
    person.title,
    person.firstname,
    person.middlename,
    person.lastname,
    person.suffix,
    person.emailpromotion,
    person.additionalcontactinfo,
    person.demographics,
    person.rowguid,
    person.modifieddate
   FROM person;

CREATE TABLE password (
    businessentityid NUMBER NOT NULL,
    passwordhash VARCHAR2(128) NOT NULL,
    passwordsalt VARCHAR2(10) NOT NULL,
    rowguid RAW(16) DEFAULT SYS_GUID() NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE password IS 'One way hashed authentication information';

COMMENT ON COLUMN password.passwordhash IS 'Password for the e-mail account.';

COMMENT ON COLUMN password.passwordsalt IS 'Random value concatenated with the password string before the password is hashed.';

CREATE VIEW pa AS
 SELECT password.businessentityid AS id,
    password.businessentityid,
    password.passwordhash,
    password.passwordsalt,
    password.rowguid,
    password.modifieddate
   FROM password;

CREATE VIEW pnt AS
 SELECT phonenumbertype.phonenumbertypeid AS id,
    phonenumbertype.phonenumbertypeid,
    phonenumbertype.name,
    phonenumbertype.modifieddate
   FROM phonenumbertype;

CREATE VIEW pp AS
 SELECT personphone.businessentityid AS id,
    personphone.businessentityid,
    personphone.phonenumber,
    personphone.phonenumbertypeid,
    personphone.modifieddate
   FROM personphone;

CREATE VIEW sp AS
 SELECT stateprovince.stateprovinceid AS id,
    stateprovince.stateprovinceid,
    stateprovince.stateprovincecode,
    stateprovince.countryregioncode,
    stateprovince.isonlystateprovinceflag,
    stateprovince.name,
    stateprovince.territoryid,
    stateprovince.rowguid,
    stateprovince.modifieddate
   FROM stateprovince;

CREATE TABLE billofmaterials (
    billofmaterialsid NUMBER NOT NULL,
    productassemblyid NUMBER,
    componentid NUMBER NOT NULL,
    startdate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    enddate TIMESTAMP,
    unitmeasurecode CHAR(3) NOT NULL,
    bomlevel NUMBER(5,0) NOT NULL,
    perassemblyqty NUMBER(8,2) DEFAULT 1.00 NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT CK_BillOfMaterials_BOMLevel CHECK (
        ((productassemblyid IS NULL) AND (bomlevel = 0) AND (perassemblyqty = 1.00)) OR
        ((productassemblyid IS NOT NULL) AND (bomlevel >= 1))
    ),
    CONSTRAINT CK_BillOfMaterials_EndDate CHECK ((enddate > startdate) OR (enddate IS NULL)),
    CONSTRAINT CK_BillOfMaterials_PerAssemblyQty CHECK (perassemblyqty >= 1.00),
    CONSTRAINT CK_BillOfMaterials_ProductAssemblyID CHECK (productassemblyid <> componentid)
);

COMMENT ON TABLE billofmaterials IS 'Items required to make bicycles and bicycle subassemblies. It identifies the heirarchical relationship between a parent product and its components.';

COMMENT ON COLUMN billofmaterials.billofmaterialsid IS 'Primary key for BillOfMaterials records.';

COMMENT ON COLUMN billofmaterials.productassemblyid IS 'Parent product identification number. Foreign key to Product.ProductID.';

COMMENT ON COLUMN billofmaterials.componentid IS 'Component identification number. Foreign key to Product.ProductID.';

COMMENT ON COLUMN billofmaterials.startdate IS 'Date the component started being used in the assembly item.';

COMMENT ON COLUMN billofmaterials.enddate IS 'Date the component stopped being used in the assembly item.';

COMMENT ON COLUMN billofmaterials.unitmeasurecode IS 'Standard code identifying the unit of measure for the quantity.';

COMMENT ON COLUMN billofmaterials.bomlevel IS 'Indicates the depth the component is from its parent (AssemblyID).';

COMMENT ON COLUMN billofmaterials.perassemblyqty IS 'Quantity of the component needed to create the assembly.';

CREATE VIEW bom AS
 SELECT billofmaterials.billofmaterialsid AS id,
    billofmaterials.billofmaterialsid,
    billofmaterials.productassemblyid,
    billofmaterials.componentid,
    billofmaterials.startdate,
    billofmaterials.enddate,
    billofmaterials.unitmeasurecode,
    billofmaterials.bomlevel,
    billofmaterials.perassemblyqty,
    billofmaterials.modifieddate
   FROM billofmaterials;

CREATE TABLE culture (
    cultureid VARCHAR2(6) NOT NULL,
    name VARCHAR2(255) NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE culture IS 'Lookup table containing the languages in which some AdventureWorks data is stored.';

COMMENT ON COLUMN culture.cultureid IS 'Primary key for Culture records.';

COMMENT ON COLUMN culture.name IS 'Culture description.';

CREATE VIEW c AS
 SELECT culture.cultureid AS id,
    culture.cultureid,
    culture.name,
    culture.modifieddate
   FROM culture;

CREATE TABLE document (
    title VARCHAR2(50) NOT NULL,
    owner NUMBER NOT NULL,
    folderflag NUMBER(1) DEFAULT 0 NOT NULL,
    filename VARCHAR2(400) NOT NULL,
    fileextension VARCHAR2(8),
    revision CHAR(5) NOT NULL,
    changenumber NUMBER DEFAULT 0 NOT NULL,
    status NUMBER(5,0) NOT NULL,
    documentsummary CLOB,
    document BLOB,
    rowguid RAW(16) DEFAULT SYS_GUID() NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    documentnode VARCHAR2(255) DEFAULT '/' NOT NULL,
    CONSTRAINT CK_Document_Status CHECK (status BETWEEN 1 AND 3)
);

COMMENT ON TABLE document IS 'Product maintenance documents.';

COMMENT ON COLUMN document.title IS 'Title of the document.';

COMMENT ON COLUMN document.owner IS 'Employee who controls the document.  Foreign key to Employee.BusinessEntityID';

COMMENT ON COLUMN document.folderflag IS '0 = This is a folder, 1 = This is a document.';

COMMENT ON COLUMN document.filename IS 'File name of the document';

COMMENT ON COLUMN document.fileextension IS 'File extension indicating the document type. For example, .doc or .txt.';

COMMENT ON COLUMN document.revision IS 'Revision number of the document.';

COMMENT ON COLUMN document.changenumber IS 'Engineering change approval number.';

COMMENT ON COLUMN document.status IS '1 = Pending approval, 2 = Approved, 3 = Obsolete';

COMMENT ON COLUMN document.documentsummary IS 'Document abstract.';

COMMENT ON COLUMN document.document IS 'Complete document.';

COMMENT ON COLUMN document.rowguid IS 'ROWGUIDCOL number uniquely identifying the record. Required for FileStream.';

COMMENT ON COLUMN document.documentnode IS 'Primary key for Document records.';

CREATE VIEW d2 AS
 SELECT document.title,
    document.owner,
    document.folderflag,
    document.filename,
    document.fileextension,
    document.revision,
    document.changenumber,
    document.status,
    document.documentsummary,
    document.document,
    document.rowguid,
    document.modifieddate,
    document.documentnode
   FROM document;

CREATE TABLE illustration (
    illustrationid NUMBER NOT NULL,
    diagram XMLType,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE illustration IS 'Bicycle assembly diagrams.';

COMMENT ON COLUMN illustration.illustrationid IS 'Primary key for Illustration records.';

COMMENT ON COLUMN illustration.diagram IS 'Illustrations used in manufacturing instructions. Stored as XML.';

CREATE VIEW i AS
 SELECT illustration.illustrationid AS id,
    illustration.illustrationid,
    illustration.diagram,
    illustration.modifieddate
   FROM illustration;

CREATE TABLE location (
    locationid NUMBER NOT NULL,
    name VARCHAR2(255) NOT NULL,
    costrate NUMBER(10, 2) DEFAULT 0.00 NOT NULL,
    availability NUMBER(8, 2) DEFAULT 0.00 NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT CK_Location_Availability CHECK (availability >= 0.00),
    CONSTRAINT CK_Location_CostRate CHECK (costrate >= 0.00)
);

COMMENT ON TABLE location IS 'Product inventory and manufacturing locations.';

COMMENT ON COLUMN location.locationid IS 'Primary key for Location records.';

COMMENT ON COLUMN location.name IS 'Location description.';

COMMENT ON COLUMN location.costrate IS 'Standard hourly cost of the manufacturing location.';

COMMENT ON COLUMN location.availability IS 'Work capacity (in hours) of the manufacturing location.';

CREATE VIEW l AS
 SELECT location.locationid AS id,
    location.locationid,
    location.name,
    location.costrate,
    location.availability,
    location.modifieddate
   FROM location;

CREATE TABLE product (
    productid NUMBER NOT NULL,
    name VARCHAR2(255) NOT NULL,
    productnumber VARCHAR2(25) NOT NULL,
    makeflag NUMBER(1) DEFAULT 1 NOT NULL,
    finishedgoodsflag NUMBER(1) DEFAULT 1 NOT NULL,
    color VARCHAR2(15),
    safetystocklevel NUMBER(5, 0) NOT NULL,
    reorderpoint NUMBER(5, 0) NOT NULL,
    standardcost NUMBER NOT NULL,
    listprice NUMBER NOT NULL,
    "size" VARCHAR2(5),
    sizeunitmeasurecode CHAR(3),
    weightunitmeasurecode CHAR(3),
    weight NUMBER(8, 2),
    daystomanufacture NUMBER NOT NULL,
    productline CHAR(2),
    class CHAR(2),
    style CHAR(2),
    productsubcategoryid NUMBER,
    productmodelid NUMBER,
    sellstartdate TIMESTAMP NOT NULL,
    sellenddate TIMESTAMP,
    discontinueddate TIMESTAMP,
    rowguid RAW(16) DEFAULT SYS_GUID() NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT CK_Product_Class CHECK (class IN ('L', 'M', 'H') OR class IS NULL),
    CONSTRAINT CK_Product_DaysToManufacture CHECK (daystomanufacture >= 0),
    CONSTRAINT CK_Product_ListPrice CHECK (listprice >= 0.00),
    CONSTRAINT CK_Product_ProductLine CHECK (productline IN ('S', 'T', 'M', 'R') OR productline IS NULL),
    CONSTRAINT CK_Product_ReorderPoint CHECK (reorderpoint > 0),
    CONSTRAINT CK_Product_SafetyStockLevel CHECK (safetystocklevel > 0),
    CONSTRAINT CK_Product_SellEndDate CHECK (sellenddate >= sellstartdate OR sellenddate IS NULL),
    CONSTRAINT CK_Product_StandardCost CHECK (standardcost >= 0.00),
    CONSTRAINT CK_Product_Style CHECK (style IN ('W', 'M', 'U') OR style IS NULL),
    CONSTRAINT CK_Product_Weight CHECK (weight > 0.00)
);

COMMENT ON TABLE product IS 'Products sold or used in the manfacturing of sold products.';

COMMENT ON COLUMN product.productid IS 'Primary key for Product records.';

COMMENT ON COLUMN product.name IS 'Name of the product.';

COMMENT ON COLUMN product.productnumber IS 'Unique product identification number.';

COMMENT ON COLUMN product.makeflag IS '0 = Product is purchased, 1 = Product is manufactured in-house.';

COMMENT ON COLUMN product.finishedgoodsflag IS '0 = Product is not a salable item. 1 = Product is salable.';

COMMENT ON COLUMN product.color IS 'Product color.';

COMMENT ON COLUMN product.safetystocklevel IS 'Minimum inventory quantity.';

COMMENT ON COLUMN product.reorderpoint IS 'Inventory level that triggers a purchase order or work order.';

COMMENT ON COLUMN product.standardcost IS 'Standard cost of the product.';

COMMENT ON COLUMN product.listprice IS 'Selling price.';

COMMENT ON COLUMN product."size" IS 'Product size.';

COMMENT ON COLUMN product.sizeunitmeasurecode IS 'Unit of measure for Size column.';

COMMENT ON COLUMN product.weightunitmeasurecode IS 'Unit of measure for Weight column.';

COMMENT ON COLUMN product.weight IS 'Product weight.';

COMMENT ON COLUMN product.daystomanufacture IS 'Number of days required to manufacture the product.';

COMMENT ON COLUMN product.productline IS 'R = Road, M = Mountain, T = Touring, S = Standard';

COMMENT ON COLUMN product.class IS 'H = High, M = Medium, L = Low';

COMMENT ON COLUMN product.style IS 'W = Womens, M = Mens, U = Universal';

COMMENT ON COLUMN product.productsubcategoryid IS 'Product is a member of this product subcategory. Foreign key to ProductSubCategory.ProductSubCategoryID.';

COMMENT ON COLUMN product.productmodelid IS 'Product is a member of this product model. Foreign key to ProductModel.ProductModelID.';

COMMENT ON COLUMN product.sellstartdate IS 'Date the product was available for sale.';

COMMENT ON COLUMN product.sellenddate IS 'Date the product was no longer available for sale.';

COMMENT ON COLUMN product.discontinueddate IS 'Date the product was discontinued.';

CREATE VIEW p2 AS
 SELECT product.productid AS id,
    product.productid,
    product.name,
    product.productnumber,
    product.makeflag,
    product.finishedgoodsflag,
    product.color,
    product.safetystocklevel,
    product.reorderpoint,
    product.standardcost,
    product.listprice,
    product."size",
    product.sizeunitmeasurecode,
    product.weightunitmeasurecode,
    product.weight,
    product.daystomanufacture,
    product.productline,
    product.class,
    product.style,
    product.productsubcategoryid,
    product.productmodelid,
    product.sellstartdate,
    product.sellenddate,
    product.discontinueddate,
    product.rowguid,
    product.modifieddate
   FROM production.product;

CREATE TABLE productcategory (
    productcategoryid NUMBER NOT NULL,
    name VARCHAR2(255) NOT NULL,
    rowguid RAW(16) DEFAULT SYS_GUID() NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE productcategory IS 'High-level product categorization.';

COMMENT ON COLUMN productcategory.productcategoryid IS 'Primary key for ProductCategory records.';

COMMENT ON COLUMN productcategory.name IS 'Category description.';

CREATE VIEW pc AS
 SELECT productcategory.productcategoryid AS id,
    productcategory.productcategoryid,
    productcategory.name,
    productcategory.rowguid,
    productcategory.modifieddate
   FROM productcategory;

CREATE TABLE productcosthistory (
    productid NUMBER NOT NULL,
    startdate TIMESTAMP NOT NULL,
    enddate TIMESTAMP,
    standardcost NUMBER NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT CK_ProductCostHistory_EndDate CHECK (enddate >= startdate OR enddate IS NULL),
    CONSTRAINT CK_ProductCostHistory_StandardCost CHECK (standardcost >= 0.00)
);

COMMENT ON TABLE productcosthistory IS 'Changes in the cost of a product over time.';

COMMENT ON COLUMN productcosthistory.productid IS 'Product identification number. Foreign key to Product.ProductID';

COMMENT ON COLUMN productcosthistory.startdate IS 'Product cost start date.';

COMMENT ON COLUMN productcosthistory.enddate IS 'Product cost end date.';

COMMENT ON COLUMN productcosthistory.standardcost IS 'Standard cost of the product.';

CREATE VIEW pch AS
 SELECT productcosthistory.productid AS id,
    productcosthistory.productid,
    productcosthistory.startdate,
    productcosthistory.enddate,
    productcosthistory.standardcost,
    productcosthistory.modifieddate
   FROM productcosthistory;

CREATE TABLE productdescription (
    productdescriptionid NUMBER NOT NULL,
    description VARCHAR2(400) NOT NULL,
    rowguid RAW(16) DEFAULT SYS_GUID() NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE productdescription IS 'Product descriptions in several languages.';

COMMENT ON COLUMN productdescription.productdescriptionid IS 'Primary key for ProductDescription records.';

COMMENT ON COLUMN productdescription.description IS 'Description of the product.';

CREATE VIEW pd AS
 SELECT productdescription.productdescriptionid AS id,
    productdescription.productdescriptionid,
    productdescription.description,
    productdescription.rowguid,
    productdescription.modifieddate
   FROM productdescription;

CREATE TABLE productdocument (
    productid NUMBER NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    documentnode VARCHAR2(255) DEFAULT '/' NOT NULL
);

COMMENT ON TABLE productdocument IS 'Cross-reference table mapping products to related product documents.';

COMMENT ON COLUMN productdocument.productid IS 'Product identification number. Foreign key to Product.ProductID.';

COMMENT ON COLUMN productdocument.documentnode IS 'Document identification number. Foreign key to Document.DocumentNode.';

CREATE VIEW pdoc AS
 SELECT productdocument.productid AS id,
    productdocument.productid,
    productdocument.modifieddate,
    productdocument.documentnode
   FROM productdocument;

CREATE TABLE productinventory (
    productid NUMBER NOT NULL,
    locationid NUMBER NOT NULL,
    shelf VARCHAR2(10) NOT NULL,
    bin NUMBER NOT NULL,
    quantity NUMBER DEFAULT 0 NOT NULL,
    rowguid RAW(16) DEFAULT SYS_GUID() NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT CK_ProductInventory_Bin CHECK (bin >= 0 AND bin <= 100)
);

COMMENT ON TABLE productinventory IS 'Product inventory information.';

COMMENT ON COLUMN productinventory.productid IS 'Product identification number. Foreign key to Product.ProductID.';

COMMENT ON COLUMN productinventory.locationid IS 'Inventory location identification number. Foreign key to Location.LocationID.';

COMMENT ON COLUMN productinventory.shelf IS 'Storage compartment within an inventory location.';

COMMENT ON COLUMN productinventory.bin IS 'Storage container on a shelf in an inventory location.';

COMMENT ON COLUMN productinventory.quantity IS 'Quantity of products in the inventory location.';

CREATE VIEW pi AS
 SELECT productinventory.productid AS id,
    productinventory.productid,
    productinventory.locationid,
    productinventory.shelf,
    productinventory.bin,
    productinventory.quantity,
    productinventory.rowguid,
    productinventory.modifieddate
   FROM productinventory;

CREATE TABLE productlistpricehistory (
    productid NUMBER NOT NULL,
    startdate TIMESTAMP NOT NULL,
    enddate TIMESTAMP,
    listprice NUMBER NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT CK_ProductListPriceHistory_EndDate CHECK (enddate >= startdate OR enddate IS NULL),
    CONSTRAINT CK_ProductListPriceHistory_ListPrice CHECK (listprice > 0.00)
);

COMMENT ON TABLE productlistpricehistory IS 'Changes in the list price of a product over time.';

COMMENT ON COLUMN productlistpricehistory.productid IS 'Product identification number. Foreign key to Product.ProductID';

COMMENT ON COLUMN productlistpricehistory.startdate IS 'List price start date.';

COMMENT ON COLUMN productlistpricehistory.enddate IS 'List price end date';

COMMENT ON COLUMN productlistpricehistory.listprice IS 'Product list price.';

CREATE VIEW plph AS
 SELECT productlistpricehistory.productid AS id,
    productlistpricehistory.productid,
    productlistpricehistory.startdate,
    productlistpricehistory.enddate,
    productlistpricehistory.listprice,
    productlistpricehistory.modifieddate
   FROM productlistpricehistory;

CREATE TABLE productmodel (
    productmodelid NUMBER NOT NULL,
    name VARCHAR2(255) NOT NULL,
    catalogdescription XMLTYPE,
    instructions XMLTYPE,
    rowguid RAW(16) DEFAULT SYS_GUID() NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE productmodel IS 'Product model classification.';

COMMENT ON COLUMN productmodel.productmodelid IS 'Primary key for ProductModel records.';

COMMENT ON COLUMN productmodel.name IS 'Product model description.';

COMMENT ON COLUMN productmodel.catalogdescription IS 'Detailed product catalog information in xml format.';

COMMENT ON COLUMN productmodel.instructions IS 'Manufacturing instructions in xml format.';

CREATE VIEW pm AS
 SELECT productmodel.productmodelid AS id,
    productmodel.productmodelid,
    productmodel.name,
    productmodel.catalogdescription,
    productmodel.instructions,
    productmodel.rowguid,
    productmodel.modifieddate
   FROM productmodel;

CREATE TABLE productmodelillustration (
    productmodelid NUMBER NOT NULL,
    illustrationid NUMBER NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE productmodelillustration IS 'Cross-reference table mapping product models and illustrations.';

COMMENT ON COLUMN productmodelillustration.productmodelid IS 'Primary key. Foreign key to ProductModel.ProductModelID.';

COMMENT ON COLUMN productmodelillustration.illustrationid IS 'Primary key. Foreign key to Illustration.IllustrationID.';

CREATE VIEW pmi AS
 SELECT productmodelillustration.productmodelid,
    productmodelillustration.illustrationid,
    productmodelillustration.modifieddate
   FROM productmodelillustration;

CREATE TABLE productmodelproductdescriptionculture (
    productmodelid NUMBER NOT NULL,
    productdescriptionid NUMBER NOT NULL,
    cultureid VARCHAR2(6) NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE productmodelproductdescriptionculture IS 'Cross-reference table mapping product descriptions and the language the description is written in.';

COMMENT ON COLUMN productmodelproductdescriptionculture.productmodelid IS 'Primary key. Foreign key to ProductModel.ProductModelID.';

COMMENT ON COLUMN productmodelproductdescriptionculture.productdescriptionid IS 'Primary key. Foreign key to ProductDescription.ProductDescriptionID.';

COMMENT ON COLUMN productmodelproductdescriptionculture.cultureid IS 'Culture identification number. Foreign key to Culture.CultureID.';

CREATE VIEW pmpdc AS
 SELECT productmodelproductdescriptionculture.productmodelid,
    productmodelproductdescriptionculture.productdescriptionid,
    productmodelproductdescriptionculture.cultureid,
    productmodelproductdescriptionculture.modifieddate
   FROM productmodelproductdescriptionculture;

CREATE TABLE productphoto (
    productphotoid NUMBER NOT NULL,
    thumbnailphoto BLOB,
    thumbnailphotofilename VARCHAR2(50),
    largephoto BLOB,
    largephotofilename VARCHAR2(50),
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE productphoto IS 'Product images.';

COMMENT ON COLUMN productphoto.productphotoid IS 'Primary key for ProductPhoto records.';

COMMENT ON COLUMN productphoto.thumbnailphoto IS 'Small image of the product.';

COMMENT ON COLUMN productphoto.thumbnailphotofilename IS 'Small image file name.';

COMMENT ON COLUMN productphoto.largephoto IS 'Large image of the product.';

COMMENT ON COLUMN productphoto.largephotofilename IS 'Large image file name.';

CREATE VIEW pp2 AS
 SELECT productphoto.productphotoid AS id,
    productphoto.productphotoid,
    productphoto.thumbnailphoto,
    productphoto.thumbnailphotofilename,
    productphoto.largephoto,
    productphoto.largephotofilename,
    productphoto.modifieddate
   FROM productphoto;

CREATE TABLE productproductphoto (
    productid NUMBER NOT NULL,
    productphotoid NUMBER NOT NULL,
    "primary" NUMBER(1) DEFAULT 0 NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE productproductphoto IS 'Cross-reference table mapping products and product photos.';

COMMENT ON COLUMN productproductphoto.productid IS 'Product identification number. Foreign key to Product.ProductID.';

COMMENT ON COLUMN productproductphoto.productphotoid IS 'Product photo identification number. Foreign key to ProductPhoto.ProductPhotoID.';

COMMENT ON COLUMN productproductphoto."primary" IS '0 = Photo is not the principal image. 1 = Photo is the principal image.';

CREATE VIEW ppp AS
 SELECT productproductphoto.productid,
    productproductphoto.productphotoid,
    productproductphoto."primary",
    productproductphoto.modifieddate
   FROM productproductphoto;

CREATE TABLE productreview (
    productreviewid NUMBER NOT NULL,
    productid NUMBER NOT NULL,
    reviewername VARCHAR2(255) NOT NULL,
    reviewdate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    emailaddress VARCHAR2(50) NOT NULL,
    rating NUMBER NOT NULL,
    comments VARCHAR2(3850),
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT CK_ProductReview_Rating CHECK (rating >= 1 AND rating <= 5)
);

COMMENT ON TABLE productreview IS 'Customer reviews of products they have purchased.';

COMMENT ON COLUMN productreview.productreviewid IS 'Primary key for ProductReview records.';

COMMENT ON COLUMN productreview.productid IS 'Product identification number. Foreign key to Product.ProductID.';

COMMENT ON COLUMN productreview.reviewername IS 'Name of the reviewer.';

COMMENT ON COLUMN productreview.reviewdate IS 'Date review was submitted.';

COMMENT ON COLUMN productreview.emailaddress IS 'Reviewer''s e-mail address.';

COMMENT ON COLUMN productreview.rating IS 'Product rating given by the reviewer. Scale is 1 to 5 with 5 as the highest rating.';

COMMENT ON COLUMN productreview.comments IS 'Reviewer''s comments';

CREATE VIEW pr AS
 SELECT productreview.productreviewid AS id,
    productreview.productreviewid,
    productreview.productid,
    productreview.reviewername,
    productreview.reviewdate,
    productreview.emailaddress,
    productreview.rating,
    productreview.comments,
    productreview.modifieddate
   FROM productreview;

CREATE TABLE productsubcategory (
    productsubcategoryid NUMBER NOT NULL,
    productcategoryid NUMBER NOT NULL,
    name VARCHAR2(255) NOT NULL,
    rowguid RAW(16) DEFAULT SYS_GUID() NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE productsubcategory IS 'Product subcategories. See ProductCategory table.';

COMMENT ON COLUMN productsubcategory.productsubcategoryid IS 'Primary key for ProductSubcategory records.';

COMMENT ON COLUMN productsubcategory.productcategoryid IS 'Product category identification number. Foreign key to ProductCategory.ProductCategoryID.';

COMMENT ON COLUMN productsubcategory.name IS 'Subcategory description.';

CREATE VIEW psc AS
 SELECT productsubcategory.productsubcategoryid AS id,
    productsubcategory.productsubcategoryid,
    productsubcategory.productcategoryid,
    productsubcategory.name,
    productsubcategory.rowguid,
    productsubcategory.modifieddate
   FROM productsubcategory;

CREATE TABLE scrapreason (
    scrapreasonid NUMBER NOT NULL,
    name VARCHAR2(255) NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE scrapreason IS 'Manufacturing failure reasons lookup table.';

COMMENT ON COLUMN scrapreason.scrapreasonid IS 'Primary key for ScrapReason records.';

COMMENT ON COLUMN scrapreason.name IS 'Failure description.';

CREATE VIEW sr AS
 SELECT scrapreason.scrapreasonid AS id,
    scrapreason.scrapreasonid,
    scrapreason.name,
    scrapreason.modifieddate
   FROM scrapreason;

CREATE TABLE transactionhistory (
    transactionid NUMBER NOT NULL,
    productid NUMBER NOT NULL,
    referenceorderid NUMBER NOT NULL,
    referenceorderlineid NUMBER DEFAULT 0 NOT NULL,
    transactiondate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    transactiontype CHAR(1) NOT NULL,
    quantity NUMBER NOT NULL,
    actualcost NUMBER NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT CK_TransactionHistory_TransactionType CHECK (UPPER(transactiontype) IN ('W', 'S', 'P'))
);

COMMENT ON TABLE transactionhistory IS 'Record of each purchase order, sales order, or work order transaction year to date.';

COMMENT ON COLUMN transactionhistory.transactionid IS 'Primary key for TransactionHistory records.';

COMMENT ON COLUMN transactionhistory.productid IS 'Product identification number. Foreign key to Product.ProductID.';

COMMENT ON COLUMN transactionhistory.referenceorderid IS 'Purchase order, sales order, or work order identification number.';

COMMENT ON COLUMN transactionhistory.referenceorderlineid IS 'Line number associated with the purchase order, sales order, or work order.';

COMMENT ON COLUMN transactionhistory.transactiondate IS 'Date and time of the transaction.';

COMMENT ON COLUMN transactionhistory.transactiontype IS 'W = WorkOrder, S = SalesOrder, P = PurchaseOrder';

COMMENT ON COLUMN transactionhistory.quantity IS 'Product quantity.';

COMMENT ON COLUMN transactionhistory.actualcost IS 'Product cost.';

CREATE VIEW th AS
 SELECT transactionhistory.transactionid AS id,
    transactionhistory.transactionid,
    transactionhistory.productid,
    transactionhistory.referenceorderid,
    transactionhistory.referenceorderlineid,
    transactionhistory.transactiondate,
    transactionhistory.transactiontype,
    transactionhistory.quantity,
    transactionhistory.actualcost,
    transactionhistory.modifieddate
   FROM transactionhistory;

CREATE TABLE transactionhistoryarchive (
    transactionid NUMBER NOT NULL,
    productid NUMBER NOT NULL,
    referenceorderid NUMBER NOT NULL,
    referenceorderlineid NUMBER DEFAULT 0 NOT NULL,
    transactiondate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    transactiontype CHAR(1) NOT NULL,
    quantity NUMBER NOT NULL,
    actualcost NUMBER NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT CK_TransactionHistoryArchive_TransactionType CHECK (UPPER(transactiontype) IN ('W', 'S', 'P'))
);

COMMENT ON TABLE transactionhistoryarchive IS 'Transactions for previous years.';

COMMENT ON COLUMN transactionhistoryarchive.transactionid IS 'Primary key for TransactionHistoryArchive records.';

COMMENT ON COLUMN transactionhistoryarchive.productid IS 'Product identification number. Foreign key to Product.ProductID.';

COMMENT ON COLUMN transactionhistoryarchive.referenceorderid IS 'Purchase order, sales order, or work order identification number.';

COMMENT ON COLUMN transactionhistoryarchive.referenceorderlineid IS 'Line number associated with the purchase order, sales order, or work order.';

COMMENT ON COLUMN transactionhistoryarchive.transactiondate IS 'Date and time of the transaction.';

COMMENT ON COLUMN transactionhistoryarchive.transactiontype IS 'W = Work Order, S = Sales Order, P = Purchase Order';

COMMENT ON COLUMN transactionhistoryarchive.quantity IS 'Product quantity.';

COMMENT ON COLUMN transactionhistoryarchive.actualcost IS 'Product cost.';

CREATE VIEW tha AS
 SELECT transactionhistoryarchive.transactionid AS id,
    transactionhistoryarchive.transactionid,
    transactionhistoryarchive.productid,
    transactionhistoryarchive.referenceorderid,
    transactionhistoryarchive.referenceorderlineid,
    transactionhistoryarchive.transactiondate,
    transactionhistoryarchive.transactiontype,
    transactionhistoryarchive.quantity,
    transactionhistoryarchive.actualcost,
    transactionhistoryarchive.modifieddate
   FROM transactionhistoryarchive;

CREATE TABLE unitmeasure (
    unitmeasurecode CHAR(3) NOT NULL,
    name VARCHAR2(255) NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE unitmeasure IS 'Unit of measure lookup table.';

COMMENT ON COLUMN unitmeasure.unitmeasurecode IS 'Primary key.';

COMMENT ON COLUMN unitmeasure.name IS 'Unit of measure description.';

CREATE VIEW um AS
 SELECT unitmeasure.unitmeasurecode AS id,
    unitmeasure.unitmeasurecode,
    unitmeasure.name,
    unitmeasure.modifieddate
   FROM unitmeasure;

CREATE TABLE workorder (
    workorderid NUMBER NOT NULL,
    productid NUMBER NOT NULL,
    orderqty NUMBER NOT NULL,
    scrappedqty NUMBER(5, 0) NOT NULL,
    startdate TIMESTAMP NOT NULL,
    enddate TIMESTAMP,
    duedate TIMESTAMP NOT NULL,
    scrapreasonid NUMBER,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT CK_WorkOrder_EndDate CHECK ((enddate >= startdate) OR (enddate IS NULL)),
    CONSTRAINT CK_WorkOrder_OrderQty CHECK (orderqty > 0),
    CONSTRAINT CK_WorkOrder_ScrappedQty CHECK (scrappedqty >= 0)
);

COMMENT ON TABLE workorder IS 'Manufacturing work orders.';

COMMENT ON COLUMN workorder.workorderid IS 'Primary key for WorkOrder records.';

COMMENT ON COLUMN workorder.productid IS 'Product identification number. Foreign key to Product.ProductID.';

COMMENT ON COLUMN workorder.orderqty IS 'Product quantity to build.';

COMMENT ON COLUMN workorder.scrappedqty IS 'Quantity that failed inspection.';

COMMENT ON COLUMN workorder.startdate IS 'Work order start date.';

COMMENT ON COLUMN workorder.enddate IS 'Work order end date.';

COMMENT ON COLUMN workorder.duedate IS 'Work order due date.';

COMMENT ON COLUMN workorder.scrapreasonid IS 'Reason for inspection failure.';

CREATE VIEW w AS
 SELECT workorder.workorderid AS id,
    workorder.workorderid,
    workorder.productid,
    workorder.orderqty,
    workorder.scrappedqty,
    workorder.startdate,
    workorder.enddate,
    workorder.duedate,
    workorder.scrapreasonid,
    workorder.modifieddate
   FROM workorder;

CREATE TABLE workorderrouting (
    workorderid NUMBER NOT NULL,
    productid NUMBER NOT NULL,
    operationsequence NUMBER(5, 0) NOT NULL,
    locationid NUMBER NOT NULL,
    scheduledstartdate TIMESTAMP NOT NULL,
    scheduledenddate TIMESTAMP NOT NULL,
    actualstartdate TIMESTAMP,
    actualenddate TIMESTAMP,
    actualresourcehrs NUMBER(9, 4),
    plannedcost NUMBER NOT NULL,
    actualcost NUMBER,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT CK_WorkOrderRouting_ActualCost CHECK ((actualcost > 0.00)),
    CONSTRAINT CK_WorkOrderRouting_ActualEndDate CHECK (((actualenddate >= actualstartdate) OR (actualenddate IS NULL) OR (actualstartdate IS NULL))),
    CONSTRAINT CK_WorkOrderRouting_ActualResourceHrs CHECK ((actualresourcehrs >= 0.0000)),
    CONSTRAINT CK_WorkOrderRouting_PlannedCost CHECK ((plannedcost > 0.00)),
    CONSTRAINT CK_WorkOrderRouting_ScheduledEndDate CHECK ((scheduledenddate >= scheduledstartdate))
);

COMMENT ON TABLE workorderrouting IS 'Work order details.';

COMMENT ON COLUMN workorderrouting.workorderid IS 'Primary key. Foreign key to WorkOrder.WorkOrderID.';

COMMENT ON COLUMN workorderrouting.productid IS 'Primary key. Foreign key to Product.ProductID.';

COMMENT ON COLUMN workorderrouting.operationsequence IS 'Primary key. Indicates the manufacturing process sequence.';

COMMENT ON COLUMN workorderrouting.locationid IS 'Manufacturing location where the part is processed. Foreign key to Location.LocationID.';

COMMENT ON COLUMN workorderrouting.scheduledstartdate IS 'Planned manufacturing start date.';

COMMENT ON COLUMN workorderrouting.scheduledenddate IS 'Planned manufacturing end date.';

COMMENT ON COLUMN workorderrouting.actualstartdate IS 'Actual start date.';

COMMENT ON COLUMN workorderrouting.actualenddate IS 'Actual end date.';

COMMENT ON COLUMN workorderrouting.actualresourcehrs IS 'Number of manufacturing hours used.';

COMMENT ON COLUMN workorderrouting.plannedcost IS 'Estimated manufacturing cost.';

COMMENT ON COLUMN workorderrouting.actualcost IS 'Actual manufacturing cost.';

CREATE VIEW wr AS
 SELECT workorderrouting.workorderid AS id,
    workorderrouting.workorderid,
    workorderrouting.productid,
    workorderrouting.operationsequence,
    workorderrouting.locationid,
    workorderrouting.scheduledstartdate,
    workorderrouting.scheduledenddate,
    workorderrouting.actualstartdate,
    workorderrouting.actualenddate,
    workorderrouting.actualresourcehrs,
    workorderrouting.plannedcost,
    workorderrouting.actualcost,
    workorderrouting.modifieddate
   FROM workorderrouting;

CREATE TABLE purchaseorderdetail (
    purchaseorderid NUMBER NOT NULL,
    purchaseorderdetailid NUMBER NOT NULL,
    duedate TIMESTAMP NOT NULL,
    orderqty NUMBER(5, 0) NOT NULL,
    productid NUMBER NOT NULL,
    unitprice NUMBER NOT NULL,
    receivedqty NUMBER(8, 2) NOT NULL,
    rejectedqty NUMBER(8, 2) NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT CK_PurchaseOrderDetail_OrderQty CHECK (orderqty > 0),
    CONSTRAINT CK_PurchaseOrderDetail_ReceivedQty CHECK (receivedqty >= 0.00),
    CONSTRAINT CK_PurchaseOrderDetail_RejectedQty CHECK (rejectedqty >= 0.00),
    CONSTRAINT CK_PurchaseOrderDetail_UnitPrice CHECK (unitprice >= 0.00)
);

COMMENT ON TABLE purchaseorderdetail IS 'Individual products associated with a specific purchase order. See PurchaseOrderHeader.';

COMMENT ON COLUMN purchaseorderdetail.purchaseorderid IS 'Primary key. Foreign key to PurchaseOrderHeader.PurchaseOrderID.';

COMMENT ON COLUMN purchaseorderdetail.purchaseorderdetailid IS 'Primary key. One line number per purchased product.';

COMMENT ON COLUMN purchaseorderdetail.duedate IS 'Date the product is expected to be received.';

COMMENT ON COLUMN purchaseorderdetail.orderqty IS 'Quantity ordered.';

COMMENT ON COLUMN purchaseorderdetail.productid IS 'Product identification number. Foreign key to Product.ProductID.';

COMMENT ON COLUMN purchaseorderdetail.unitprice IS 'Vendor''s selling price of a single product.';

COMMENT ON COLUMN purchaseorderdetail.receivedqty IS 'Quantity actually received from the vendor.';

COMMENT ON COLUMN purchaseorderdetail.rejectedqty IS 'Quantity rejected during inspection.';

CREATE VIEW pod AS
 SELECT purchaseorderdetail.purchaseorderdetailid AS id,
    purchaseorderdetail.purchaseorderid,
    purchaseorderdetail.purchaseorderdetailid,
    purchaseorderdetail.duedate,
    purchaseorderdetail.orderqty,
    purchaseorderdetail.productid,
    purchaseorderdetail.unitprice,
    purchaseorderdetail.receivedqty,
    purchaseorderdetail.rejectedqty,
    purchaseorderdetail.modifieddate
   FROM purchaseorderdetail;

CREATE TABLE purchaseorderheader (
    purchaseorderid NUMBER NOT NULL,
    revisionnumber NUMBER(5, 0) DEFAULT 0 NOT NULL,
    status NUMBER(5, 0) DEFAULT 1 NOT NULL,
    employeeid NUMBER NOT NULL,
    vendorid NUMBER NOT NULL,
    shipmethodid NUMBER NOT NULL,
    orderdate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    shipdate TIMESTAMP,
    subtotal NUMBER(10, 2) DEFAULT 0.00 NOT NULL,
    taxamt NUMBER(10, 2) DEFAULT 0.00 NOT NULL,
    freight NUMBER(10, 2) DEFAULT 0.00 NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT CK_PurchaseOrderHeader_Freight CHECK (freight >= 0.00),
    CONSTRAINT CK_PurchaseOrderHeader_ShipDate CHECK (shipdate >= orderdate OR shipdate IS NULL),
    CONSTRAINT CK_PurchaseOrderHeader_Status CHECK (status BETWEEN 1 AND 4),
    CONSTRAINT CK_PurchaseOrderHeader_SubTotal CHECK (subtotal >= 0.00),
    CONSTRAINT CK_PurchaseOrderHeader_TaxAmt CHECK (taxamt >= 0.00)
);

COMMENT ON TABLE purchaseorderheader IS 'General purchase order information. See PurchaseOrderDetail.';

COMMENT ON COLUMN purchaseorderheader.purchaseorderid IS 'Primary key.';

COMMENT ON COLUMN purchaseorderheader.revisionnumber IS 'Incremental number to track changes to the purchase order over time.';

COMMENT ON COLUMN purchaseorderheader.status IS 'Order current status. 1 = Pending; 2 = Approved; 3 = Rejected; 4 = Complete';

COMMENT ON COLUMN purchaseorderheader.employeeid IS 'Employee who created the purchase order. Foreign key to Employee.BusinessEntityID.';

COMMENT ON COLUMN purchaseorderheader.vendorid IS 'Vendor with whom the purchase order is placed. Foreign key to Vendor.BusinessEntityID.';

COMMENT ON COLUMN purchaseorderheader.shipmethodid IS 'Shipping method. Foreign key to ShipMethod.ShipMethodID.';

COMMENT ON COLUMN purchaseorderheader.orderdate IS 'Purchase order creation date.';

COMMENT ON COLUMN purchaseorderheader.shipdate IS 'Estimated shipment date from the vendor.';

COMMENT ON COLUMN purchaseorderheader.subtotal IS 'Purchase order subtotal. Computed as SUM(PurchaseOrderDetail.LineTotal)for the appropriate PurchaseOrderID.';

COMMENT ON COLUMN purchaseorderheader.taxamt IS 'Tax amount.';

COMMENT ON COLUMN purchaseorderheader.freight IS 'Shipping cost.';

CREATE VIEW poh AS
 SELECT purchaseorderheader.purchaseorderid AS id,
    purchaseorderheader.purchaseorderid,
    purchaseorderheader.revisionnumber,
    purchaseorderheader.status,
    purchaseorderheader.employeeid,
    purchaseorderheader.vendorid,
    purchaseorderheader.shipmethodid,
    purchaseorderheader.orderdate,
    purchaseorderheader.shipdate,
    purchaseorderheader.subtotal,
    purchaseorderheader.taxamt,
    purchaseorderheader.freight,
    purchaseorderheader.modifieddate
   FROM purchaseorderheader;

CREATE TABLE productvendor (
    productid NUMBER NOT NULL,
    businessentityid NUMBER NOT NULL,
    averageleadtime NUMBER NOT NULL,
    standardprice NUMBER NOT NULL,
    lastreceiptcost NUMBER,
    lastreceiptdate TIMESTAMP,
    minorderqty NUMBER NOT NULL,
    maxorderqty NUMBER NOT NULL,
    onorderqty NUMBER,
    unitmeasurecode CHAR(3) NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT CK_ProductVendor_AverageLeadTime CHECK (averageleadtime >= 1),
    CONSTRAINT CK_ProductVendor_LastReceiptCost CHECK (lastreceiptcost > 0.00),
    CONSTRAINT CK_ProductVendor_MaxOrderQty CHECK (maxorderqty >= 1),
    CONSTRAINT CK_ProductVendor_MinOrderQty CHECK (minorderqty >= 1),
    CONSTRAINT CK_ProductVendor_OnOrderQty CHECK (onorderqty >= 0),
    CONSTRAINT CK_ProductVendor_StandardPrice CHECK (standardprice > 0.00)
);

COMMENT ON TABLE productvendor IS 'Cross-reference table mapping vendors with the products they supply.';

COMMENT ON COLUMN productvendor.productid IS 'Primary key. Foreign key to Product.ProductID.';

COMMENT ON COLUMN productvendor.businessentityid IS 'Primary key. Foreign key to Vendor.BusinessEntityID.';

COMMENT ON COLUMN productvendor.averageleadtime IS 'The average span of time (in days) between placing an order with the vendor and receiving the purchased product.';

COMMENT ON COLUMN productvendor.standardprice IS 'The vendor''s usual selling price.';

COMMENT ON COLUMN productvendor.lastreceiptcost IS 'The selling price when last purchased.';

COMMENT ON COLUMN productvendor.lastreceiptdate IS 'Date the product was last received by the vendor.';

COMMENT ON COLUMN productvendor.minorderqty IS 'The maximum quantity that should be ordered.';

COMMENT ON COLUMN productvendor.maxorderqty IS 'The minimum quantity that should be ordered.';

COMMENT ON COLUMN productvendor.onorderqty IS 'The quantity currently on order.';

COMMENT ON COLUMN productvendor.unitmeasurecode IS 'The product''s unit of measure.';

CREATE VIEW pv AS
 SELECT productvendor.productid AS id,
    productvendor.productid,
    productvendor.businessentityid,
    productvendor.averageleadtime,
    productvendor.standardprice,
    productvendor.lastreceiptcost,
    productvendor.lastreceiptdate,
    productvendor.minorderqty,
    productvendor.maxorderqty,
    productvendor.onorderqty,
    productvendor.unitmeasurecode,
    productvendor.modifieddate
   FROM productvendor;

CREATE TABLE shipmethod (
    shipmethodid NUMBER NOT NULL,
    name VARCHAR2(255) NOT NULL,
    shipbase NUMBER DEFAULT 0.00 NOT NULL,
    shiprate NUMBER DEFAULT 0.00 NOT NULL,
    rowguid RAW(16) DEFAULT SYS_GUID() NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT CK_ShipMethod_ShipBase CHECK (shipbase > 0.00),
    CONSTRAINT CK_ShipMethod_ShipRate CHECK (shiprate > 0.00)
);

COMMENT ON TABLE shipmethod IS 'Shipping company lookup table.';

COMMENT ON COLUMN shipmethod.shipmethodid IS 'Primary key for ShipMethod records.';

COMMENT ON COLUMN shipmethod.name IS 'Shipping company name.';

COMMENT ON COLUMN shipmethod.shipbase IS 'Minimum shipping charge.';

COMMENT ON COLUMN shipmethod.shiprate IS 'Shipping charge per pound.';

CREATE VIEW sm AS
 SELECT shipmethod.shipmethodid AS id,
    shipmethod.shipmethodid,
    shipmethod.name,
    shipmethod.shipbase,
    shipmethod.shiprate,
    shipmethod.rowguid,
    shipmethod.modifieddate
   FROM shipmethod;

CREATE TABLE vendor (
    businessentityid NUMBER NOT NULL,
    accountnumber VARCHAR2(255) NOT NULL,
    name VARCHAR2(255) NOT NULL,
    creditrating NUMBER(3,0) NOT NULL,
    preferredvendorstatus CHAR(1) DEFAULT 'Y' NOT NULL,
    activeflag CHAR(1) DEFAULT 'Y' NOT NULL,
    purchasingwebserviceurl VARCHAR2(1024),
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT CK_Vendor_CreditRating CHECK (creditrating >= 1 AND creditrating <= 5)
);

COMMENT ON TABLE vendor IS 'Companies from whom Adventure Works Cycles purchases parts or other goods.';

COMMENT ON COLUMN vendor.businessentityid IS 'Primary key for Vendor records.  Foreign key to BusinessEntity.BusinessEntityID';

COMMENT ON COLUMN vendor.accountnumber IS 'Vendor account (identification) number.';

COMMENT ON COLUMN vendor.name IS 'Company name.';

COMMENT ON COLUMN vendor.creditrating IS '1 = Superior, 2 = Excellent, 3 = Above average, 4 = Average, 5 = Below average';

COMMENT ON COLUMN vendor.preferredvendorstatus IS '0 = Do not use if another vendor is available. 1 = Preferred over other vendors supplying the same product.';

COMMENT ON COLUMN vendor.activeflag IS '0 = Vendor no longer used. 1 = Vendor is actively used.';

COMMENT ON COLUMN vendor.purchasingwebserviceurl IS 'Vendor URL.';

CREATE VIEW v AS
 SELECT vendor.businessentityid AS id,
    vendor.businessentityid,
    vendor.accountnumber,
    vendor.name,
    vendor.creditrating,
    vendor.preferredvendorstatus,
    vendor.activeflag,
    vendor.purchasingwebserviceurl,
    vendor.modifieddate
   FROM vendor;

CREATE VIEW vvendorwithaddresses AS
SELECT
    v.businessentityid,
    v.name,
    at.name AS addresstype,
    a.addressline1,
    a.addressline2,
    a.city,
    sp.name AS stateprovincename,
    a.postalcode,
    cr.name AS countryregionname
FROM
    vendor v
JOIN
    businessentityaddress bea ON bea.businessentityid = v.businessentityid
JOIN
    address a ON a.addressid = bea.addressid
JOIN
    stateprovince sp ON sp.stateprovinceid = a.stateprovinceid
JOIN
    countryregion cr ON cr.countryregioncode = sp.countryregioncode
JOIN
    addresstype at ON at.addresstypeid = bea.addresstypeid;

CREATE VIEW vvendorwithcontacts AS
 SELECT v.businessentityid,
    v.name,
    ct.name AS contacttype,
    p.title,
    p.firstname,
    p.middlename,
    p.lastname,
    p.suffix,
    pp.phonenumber,
    pnt.name AS phonenumbertype,
    ea.emailaddress,
    p.emailpromotion
   FROM ((((((vendor v
     JOIN businessentitycontact bec ON ((bec.businessentityid = v.businessentityid)))
     JOIN contacttype ct ON ((ct.contacttypeid = bec.contacttypeid)))
     JOIN person p ON ((p.businessentityid = bec.personid)))
     LEFT JOIN emailaddress ea ON ((ea.businessentityid = p.businessentityid)))
     LEFT JOIN personphone pp ON ((pp.businessentityid = p.businessentityid)))
     LEFT JOIN phonenumbertype pnt ON ((pnt.phonenumbertypeid = pp.phonenumbertypeid)));

CREATE TABLE customer (
    customerid NUMBER NOT NULL,
    personid NUMBER,
    storeid NUMBER,
    territoryid NUMBER,
    rowguid RAW(16) DEFAULT SYS_GUID() NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE customer IS 'Current customer information. Also see the Person and Store tables.';

COMMENT ON COLUMN customer.customerid IS 'Primary key.';

COMMENT ON COLUMN customer.personid IS 'Foreign key to Person.BusinessEntityID';

COMMENT ON COLUMN customer.storeid IS 'Foreign key to Store.BusinessEntityID';

COMMENT ON COLUMN customer.territoryid IS 'ID of the territory in which the customer is located. Foreign key to SalesTerritory.SalesTerritoryID.';

CREATE VIEW c2 AS
 SELECT customer.customerid AS id,
    customer.customerid,
    customer.personid,
    customer.storeid,
    customer.territoryid,
    customer.rowguid,
    customer.modifieddate
   FROM customer;

CREATE TABLE creditcard (
    creditcardid NUMBER NOT NULL,
    cardtype VARCHAR2(50) NOT NULL,
    cardnumber VARCHAR2(25) NOT NULL,
    expmonth NUMBER(2) NOT NULL,
    expyear NUMBER(4) NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE creditcard IS 'Customer credit card information.';

COMMENT ON COLUMN creditcard.creditcardid IS 'Primary key for CreditCard records.';

COMMENT ON COLUMN creditcard.cardtype IS 'Credit card name.';

COMMENT ON COLUMN creditcard.cardnumber IS 'Credit card number.';

COMMENT ON COLUMN creditcard.expmonth IS 'Credit card expiration month.';

COMMENT ON COLUMN creditcard.expyear IS 'Credit card expiration year.';

CREATE VIEW cc AS
 SELECT creditcard.creditcardid AS id,
    creditcard.creditcardid,
    creditcard.cardtype,
    creditcard.cardnumber,
    creditcard.expmonth,
    creditcard.expyear,
    creditcard.modifieddate
   FROM creditcard;

CREATE TABLE currencyrate (
    currencyrateid NUMBER NOT NULL,
    currencyratedate TIMESTAMP NOT NULL,
    fromcurrencycode CHAR(3) NOT NULL,
    tocurrencycode CHAR(3) NOT NULL,
    averagerate NUMBER NOT NULL,
    endofdayrate NUMBER NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE currencyrate IS 'Currency exchange rates.';

COMMENT ON COLUMN currencyrate.currencyrateid IS 'Primary key for CurrencyRate records.';

COMMENT ON COLUMN currencyrate.currencyratedate IS 'Date and time the exchange rate was obtained.';

COMMENT ON COLUMN currencyrate.fromcurrencycode IS 'Exchange rate was converted from this currency code.';

COMMENT ON COLUMN currencyrate.tocurrencycode IS 'Exchange rate was converted to this currency code.';

COMMENT ON COLUMN currencyrate.averagerate IS 'Average exchange rate for the day.';

COMMENT ON COLUMN currencyrate.endofdayrate IS 'Final exchange rate for the day.';

CREATE VIEW cr2 AS
 SELECT currencyrate.currencyrateid,
    currencyrate.currencyratedate,
    currencyrate.fromcurrencycode,
    currencyrate.tocurrencycode,
    currencyrate.averagerate,
    currencyrate.endofdayrate,
    currencyrate.modifieddate
   FROM currencyrate;

CREATE TABLE countryregioncurrency (
    countryregioncode VARCHAR2(3) NOT NULL,
    currencycode CHAR(3) NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE countryregioncurrency IS 'Cross-reference table mapping ISO currency codes to a country or region.';

COMMENT ON COLUMN countryregioncurrency.countryregioncode IS 'ISO code for countries and regions. Foreign key to CountryRegion.CountryRegionCode.';

COMMENT ON COLUMN countryregioncurrency.currencycode IS 'ISO standard currency code. Foreign key to Currency.CurrencyCode.';

CREATE VIEW crc AS
 SELECT countryregioncurrency.countryregioncode,
    countryregioncurrency.currencycode,
    countryregioncurrency.modifieddate
   FROM countryregioncurrency;

CREATE TABLE currency (
    currencycode CHAR(3) NOT NULL,
    name VARCHAR2(255) NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE currency IS 'Lookup table containing standard ISO currencies.';

COMMENT ON COLUMN currency.currencycode IS 'The ISO code for the Currency.';

COMMENT ON COLUMN currency.name IS 'Currency name.';

CREATE VIEW cu AS
 SELECT currency.currencycode AS id,
    currency.currencycode,
    currency.name,
    currency.modifieddate
   FROM currency;

CREATE TABLE personcreditcard (
    businessentityid NUMBER NOT NULL,
    creditcardid NUMBER NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE personcreditcard IS 'Cross-reference table mapping people to their credit card information in the CreditCard table.';

COMMENT ON COLUMN personcreditcard.businessentityid IS 'Business entity identification number. Foreign key to Person.BusinessEntityID.';

COMMENT ON COLUMN personcreditcard.creditcardid IS 'Credit card identification number. Foreign key to CreditCard.CreditCardID.';

CREATE VIEW pcc AS
 SELECT personcreditcard.businessentityid AS id,
    personcreditcard.businessentityid,
    personcreditcard.creditcardid,
    personcreditcard.modifieddate
   FROM personcreditcard;

CREATE TABLE store (
    businessentityid NUMBER NOT NULL,
    name VARCHAR2(255) NOT NULL,
    salespersonid NUMBER,
    demographics XMLType,
    rowguid RAW(16) DEFAULT SYS_GUID() NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE store IS 'Customers (resellers) of Adventure Works products.';

COMMENT ON COLUMN store.businessentityid IS 'Primary key. Foreign key to Customer.BusinessEntityID.';

COMMENT ON COLUMN store.name IS 'Name of the store.';

COMMENT ON COLUMN store.salespersonid IS 'ID of the sales person assigned to the customer. Foreign key to SalesPerson.BusinessEntityID.';

COMMENT ON COLUMN store.demographics IS 'Demographic informationg about the store such as the number of employees, annual sales and store type.';

CREATE VIEW s2 AS
 SELECT store.businessentityid AS id,
    store.businessentityid,
    store.name,
    store.salespersonid,
    store.demographics,
    store.rowguid,
    store.modifieddate
   FROM store;

CREATE TABLE shoppingcartitem (
    shoppingcartitemid NUMBER NOT NULL,
    shoppingcartid VARCHAR2(50) NOT NULL,
    quantity NUMBER DEFAULT 1 NOT NULL,
    productid NUMBER NOT NULL,
    datecreated TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT CK_ShoppingCartItem_Quantity CHECK (quantity >= 1)
);

COMMENT ON TABLE shoppingcartitem IS 'Contains online customer orders until the order is submitted or cancelled.';

COMMENT ON COLUMN shoppingcartitem.shoppingcartitemid IS 'Primary key for ShoppingCartItem records.';

COMMENT ON COLUMN shoppingcartitem.shoppingcartid IS 'Shopping cart identification number.';

COMMENT ON COLUMN shoppingcartitem.quantity IS 'Product quantity ordered.';

COMMENT ON COLUMN shoppingcartitem.productid IS 'Product ordered. Foreign key to Product.ProductID.';

COMMENT ON COLUMN shoppingcartitem.datecreated IS 'Date the time the record was created.';

CREATE VIEW sci AS
 SELECT shoppingcartitem.shoppingcartitemid AS id,
    shoppingcartitem.shoppingcartitemid,
    shoppingcartitem.shoppingcartid,
    shoppingcartitem.quantity,
    shoppingcartitem.productid,
    shoppingcartitem.datecreated,
    shoppingcartitem.modifieddate
   FROM shoppingcartitem;

CREATE TABLE specialoffer (
    specialofferid NUMBER NOT NULL,
    description VARCHAR2(255) NOT NULL,
    discountpct NUMBER(5,2) DEFAULT 0.00 NOT NULL,
    type VARCHAR2(50) NOT NULL,
    category VARCHAR2(50) NOT NULL,
    startdate TIMESTAMP NOT NULL,
    enddate TIMESTAMP NOT NULL,
    minqty NUMBER DEFAULT 0 NOT NULL,
    maxqty NUMBER,
    rowguid RAW(16) DEFAULT SYS_GUID() NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT CK_SpecialOffer_DiscountPct CHECK (discountpct >= 0.00),
    CONSTRAINT CK_SpecialOffer_EndDate CHECK (enddate >= startdate),
    CONSTRAINT CK_SpecialOffer_MaxQty CHECK (maxqty >= 0),
    CONSTRAINT CK_SpecialOffer_MinQty CHECK (minqty >= 0)
);

COMMENT ON TABLE specialoffer IS 'Sale discounts lookup table.';

COMMENT ON COLUMN specialoffer.specialofferid IS 'Primary key for SpecialOffer records.';

COMMENT ON COLUMN specialoffer.description IS 'Discount description.';

COMMENT ON COLUMN specialoffer.discountpct IS 'Discount precentage.';

COMMENT ON COLUMN specialoffer.type IS 'Discount type category.';

COMMENT ON COLUMN specialoffer.category IS 'Group the discount applies to such as Reseller or Customer.';

COMMENT ON COLUMN specialoffer.startdate IS 'Discount start date.';

COMMENT ON COLUMN specialoffer.enddate IS 'Discount end date.';

COMMENT ON COLUMN specialoffer.minqty IS 'Minimum discount percent allowed.';

COMMENT ON COLUMN specialoffer.maxqty IS 'Maximum discount percent allowed.';

CREATE VIEW so AS
 SELECT specialoffer.specialofferid AS id,
    specialoffer.specialofferid,
    specialoffer.description,
    specialoffer.discountpct,
    specialoffer.type,
    specialoffer.category,
    specialoffer.startdate,
    specialoffer.enddate,
    specialoffer.minqty,
    specialoffer.maxqty,
    specialoffer.rowguid,
    specialoffer.modifieddate
   FROM specialoffer;

CREATE TABLE salesorderdetail (
    salesorderid NUMBER NOT NULL,
    salesorderdetailid NUMBER NOT NULL,
    carriertrackingnumber VARCHAR2(25),
    orderqty NUMBER(5) NOT NULL,
    productid NUMBER NOT NULL,
    specialofferid NUMBER NOT NULL,
    unitprice NUMBER NOT NULL,
    unitpricediscount NUMBER(5,2) DEFAULT 0.0 NOT NULL,
    rowguid RAW(16) DEFAULT SYS_GUID() NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT CK_SalesOrderDetail_OrderQty CHECK (orderqty > 0),
    CONSTRAINT CK_SalesOrderDetail_UnitPrice CHECK (unitprice >= 0.00),
    CONSTRAINT CK_SalesOrderDetail_UnitPriceDiscount CHECK (unitpricediscount >= 0.00)
);

COMMENT ON TABLE salesorderdetail IS 'Individual products associated with a specific sales order. See SalesOrderHeader.';

COMMENT ON COLUMN salesorderdetail.salesorderid IS 'Primary key. Foreign key to SalesOrderHeader.SalesOrderID.';

COMMENT ON COLUMN salesorderdetail.salesorderdetailid IS 'Primary key. One incremental unique number per product sold.';

COMMENT ON COLUMN salesorderdetail.carriertrackingnumber IS 'Shipment tracking number supplied by the shipper.';

COMMENT ON COLUMN salesorderdetail.orderqty IS 'Quantity ordered per product.';

COMMENT ON COLUMN salesorderdetail.productid IS 'Product sold to customer. Foreign key to Product.ProductID.';

COMMENT ON COLUMN salesorderdetail.specialofferid IS 'Promotional code. Foreign key to SpecialOffer.SpecialOfferID.';

COMMENT ON COLUMN salesorderdetail.unitprice IS 'Selling price of a single product.';

COMMENT ON COLUMN salesorderdetail.unitpricediscount IS 'Discount amount.';

CREATE VIEW sod AS
 SELECT salesorderdetail.salesorderdetailid AS id,
    salesorderdetail.salesorderid,
    salesorderdetail.salesorderdetailid,
    salesorderdetail.carriertrackingnumber,
    salesorderdetail.orderqty,
    salesorderdetail.productid,
    salesorderdetail.specialofferid,
    salesorderdetail.unitprice,
    salesorderdetail.unitpricediscount,
    salesorderdetail.rowguid,
    salesorderdetail.modifieddate
   FROM salesorderdetail;

CREATE TABLE salesorderheader (
    salesorderid NUMBER NOT NULL,
    revisionnumber NUMBER(5,0) DEFAULT 0 NOT NULL,
    orderdate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    duedate TIMESTAMP NOT NULL,
    shipdate TIMESTAMP,
    status NUMBER(5,0) DEFAULT 1 NOT NULL,
    onlineorderflag CHAR(1) DEFAULT 'Y' NOT NULL,
    purchaseordernumber VARCHAR2(25),
    accountnumber VARCHAR2(255),
    customerid NUMBER NOT NULL,
    salespersonid NUMBER,
    territoryid NUMBER,
    billtoaddressid NUMBER NOT NULL,
    shiptoaddressid NUMBER NOT NULL,
    shipmethodid NUMBER NOT NULL,
    creditcardid NUMBER,
    creditcardapprovalcode VARCHAR2(15),
    currencyrateid NUMBER,
    subtotal NUMBER(12,2) DEFAULT 0.00 NOT NULL,
    taxamt NUMBER(12,2) DEFAULT 0.00 NOT NULL,
    freight NUMBER(12,2) DEFAULT 0.00 NOT NULL,
    totaldue NUMBER(12,2),
    "comment" VARCHAR2(128),
    rowguid RAW(16) DEFAULT SYS_GUID() NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT CK_SalesOrderHeader_DueDate CHECK (duedate >= orderdate),
    CONSTRAINT CK_SalesOrderHeader_Freight CHECK (freight >= 0.00),
    CONSTRAINT CK_SalesOrderHeader_ShipDate CHECK (shipdate >= orderdate OR shipdate IS NULL),
    CONSTRAINT CK_SalesOrderHeader_Status CHECK (status >= 0 AND status <= 8),
    CONSTRAINT CK_SalesOrderHeader_SubTotal CHECK (subtotal >= 0.00),
    CONSTRAINT CK_SalesOrderHeader_TaxAmt CHECK (taxamt >= 0.00)
);

COMMENT ON TABLE salesorderheader IS 'General sales order information.';

COMMENT ON COLUMN salesorderheader.salesorderid IS 'Primary key.';

COMMENT ON COLUMN salesorderheader.revisionnumber IS 'Incremental number to track changes to the sales order over time.';

COMMENT ON COLUMN salesorderheader.orderdate IS 'Dates the sales order was created.';

COMMENT ON COLUMN salesorderheader.duedate IS 'Date the order is due to the customer.';

COMMENT ON COLUMN salesorderheader.shipdate IS 'Date the order was shipped to the customer.';

COMMENT ON COLUMN salesorderheader.status IS 'Order current status. 1 = In process; 2 = Approved; 3 = Backordered; 4 = Rejected; 5 = Shipped; 6 = Cancelled';

COMMENT ON COLUMN salesorderheader.onlineorderflag IS '0 = Order placed by sales person. 1 = Order placed online by customer.';

COMMENT ON COLUMN salesorderheader.purchaseordernumber IS 'Customer purchase order number reference.';

COMMENT ON COLUMN salesorderheader.accountnumber IS 'Financial accounting number reference.';

COMMENT ON COLUMN salesorderheader.customerid IS 'Customer identification number. Foreign key to Customer.BusinessEntityID.';

COMMENT ON COLUMN salesorderheader.salespersonid IS 'Sales person who created the sales order. Foreign key to SalesPerson.BusinessEntityID.';

COMMENT ON COLUMN salesorderheader.territoryid IS 'Territory in which the sale was made. Foreign key to SalesTerritory.SalesTerritoryID.';

COMMENT ON COLUMN salesorderheader.billtoaddressid IS 'Customer billing address. Foreign key to Address.AddressID.';

COMMENT ON COLUMN salesorderheader.shiptoaddressid IS 'Customer shipping address. Foreign key to Address.AddressID.';

COMMENT ON COLUMN salesorderheader.shipmethodid IS 'Shipping method. Foreign key to ShipMethod.ShipMethodID.';

COMMENT ON COLUMN salesorderheader.creditcardid IS 'Credit card identification number. Foreign key to CreditCard.CreditCardID.';

COMMENT ON COLUMN salesorderheader.creditcardapprovalcode IS 'Approval code provided by the credit card company.';

COMMENT ON COLUMN salesorderheader.currencyrateid IS 'Currency exchange rate used. Foreign key to CurrencyRate.CurrencyRateID.';

COMMENT ON COLUMN salesorderheader.subtotal IS 'Sales subtotal. Computed as SUM(SalesOrderDetail.LineTotal)for the appropriate SalesOrderID.';

COMMENT ON COLUMN salesorderheader.taxamt IS 'Tax amount.';

COMMENT ON COLUMN salesorderheader.freight IS 'Shipping cost.';

COMMENT ON COLUMN salesorderheader.totaldue IS 'Total due from customer. Computed as Subtotal + TaxAmt + Freight.';

COMMENT ON COLUMN salesorderheader."comment" IS 'Sales representative comments.';

CREATE VIEW soh AS
 SELECT salesorderheader.salesorderid AS id,
    salesorderheader.salesorderid,
    salesorderheader.revisionnumber,
    salesorderheader.orderdate,
    salesorderheader.duedate,
    salesorderheader.shipdate,
    salesorderheader.status,
    salesorderheader.onlineorderflag,
    salesorderheader.purchaseordernumber,
    salesorderheader.accountnumber,
    salesorderheader.customerid,
    salesorderheader.salespersonid,
    salesorderheader.territoryid,
    salesorderheader.billtoaddressid,
    salesorderheader.shiptoaddressid,
    salesorderheader.shipmethodid,
    salesorderheader.creditcardid,
    salesorderheader.creditcardapprovalcode,
    salesorderheader.currencyrateid,
    salesorderheader.subtotal,
    salesorderheader.taxamt,
    salesorderheader.freight,
    salesorderheader.totaldue,
    salesorderheader."comment",
    salesorderheader.rowguid,
    salesorderheader.modifieddate
   FROM salesorderheader;

CREATE TABLE salesorderheadersalesreason (
    salesorderid NUMBER NOT NULL,
    salesreasonid NUMBER NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE salesorderheadersalesreason IS 'Cross-reference table mapping sales orders to sales reason codes.';

COMMENT ON COLUMN salesorderheadersalesreason.salesorderid IS 'Primary key. Foreign key to SalesOrderHeader.SalesOrderID.';

COMMENT ON COLUMN salesorderheadersalesreason.salesreasonid IS 'Primary key. Foreign key to SalesReason.SalesReasonID.';

CREATE VIEW sohsr AS
 SELECT salesorderheadersalesreason.salesorderid,
    salesorderheadersalesreason.salesreasonid,
    salesorderheadersalesreason.modifieddate
   FROM salesorderheadersalesreason;

CREATE TABLE specialofferproduct (
    specialofferid NUMBER NOT NULL,
    productid NUMBER NOT NULL,
    rowguid RAW(16) DEFAULT SYS_GUID() NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE specialofferproduct IS 'Cross-reference table mapping products to special offer discounts.';

COMMENT ON COLUMN specialofferproduct.specialofferid IS 'Primary key for SpecialOfferProduct records.';

COMMENT ON COLUMN specialofferproduct.productid IS 'Product identification number. Foreign key to Product.ProductID.';

CREATE VIEW sop AS
 SELECT specialofferproduct.specialofferid AS id,
    specialofferproduct.specialofferid,
    specialofferproduct.productid,
    specialofferproduct.rowguid,
    specialofferproduct.modifieddate
   FROM specialofferproduct;

CREATE TABLE salesperson (
    businessentityid NUMBER NOT NULL,
    territoryid NUMBER,
    salesquota NUMBER,
    bonus NUMBER(12,2) DEFAULT 0.00 NOT NULL,
    commissionpct NUMBER(5,2) DEFAULT 0.00 NOT NULL,
    salesytd NUMBER(12,2) DEFAULT 0.00 NOT NULL,
    saleslastyear NUMBER(12,2) DEFAULT 0.00 NOT NULL,
    rowguid RAW(16) DEFAULT SYS_GUID() NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT CK_SalesPerson_Bonus CHECK (bonus >= 0.00),
    CONSTRAINT CK_SalesPerson_CommissionPct CHECK (commissionpct >= 0.00),
    CONSTRAINT CK_SalesPerson_SalesLastYear CHECK (saleslastyear >= 0.00),
    CONSTRAINT CK_SalesPerson_SalesQuota CHECK (salesquota > 0.00),
    CONSTRAINT CK_SalesPerson_SalesYTD CHECK (salesytd >= 0.00)
);

COMMENT ON TABLE salesperson IS 'Sales representative current information.';

COMMENT ON COLUMN salesperson.businessentityid IS 'Primary key for SalesPerson records. Foreign key to Employee.BusinessEntityID';

COMMENT ON COLUMN salesperson.territoryid IS 'Territory currently assigned to. Foreign key to SalesTerritory.SalesTerritoryID.';

COMMENT ON COLUMN salesperson.salesquota IS 'Projected yearly sales.';

COMMENT ON COLUMN salesperson.bonus IS 'Bonus due if quota is met.';

COMMENT ON COLUMN salesperson.commissionpct IS 'Commision percent received per sale.';

COMMENT ON COLUMN salesperson.salesytd IS 'Sales total year to date.';

COMMENT ON COLUMN salesperson.saleslastyear IS 'Sales total of previous year.';

CREATE VIEW sp2 AS
 SELECT salesperson.businessentityid AS id,
    salesperson.businessentityid,
    salesperson.territoryid,
    salesperson.salesquota,
    salesperson.bonus,
    salesperson.commissionpct,
    salesperson.salesytd,
    salesperson.saleslastyear,
    salesperson.rowguid,
    salesperson.modifieddate
   FROM salesperson;

CREATE TABLE salespersonquotahistory (
    businessentityid NUMBER NOT NULL,
    quotadate TIMESTAMP NOT NULL,
    salesquota NUMBER NOT NULL,
    rowguid RAW(16) DEFAULT SYS_GUID() NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT CK_SalesPersonQuotaHistory_SalesQuota CHECK (salesquota > 0.00)
);

COMMENT ON TABLE salespersonquotahistory IS 'Sales performance tracking.';

COMMENT ON COLUMN salespersonquotahistory.businessentityid IS 'Sales person identification number. Foreign key to SalesPerson.BusinessEntityID.';

COMMENT ON COLUMN salespersonquotahistory.quotadate IS 'Sales quota date.';

COMMENT ON COLUMN salespersonquotahistory.salesquota IS 'Sales quota amount.';

CREATE VIEW spqh AS
 SELECT salespersonquotahistory.businessentityid AS id,
    salespersonquotahistory.businessentityid,
    salespersonquotahistory.quotadate,
    salespersonquotahistory.salesquota,
    salespersonquotahistory.rowguid,
    salespersonquotahistory.modifieddate
   FROM salespersonquotahistory;

CREATE TABLE salesreason (
    salesreasonid NUMBER NOT NULL,
    name VARCHAR2(255) NOT NULL,
    reasontype VARCHAR2(255) NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE salesreason IS 'Lookup table of customer purchase reasons.';

COMMENT ON COLUMN salesreason.salesreasonid IS 'Primary key for SalesReason records.';

COMMENT ON COLUMN salesreason.name IS 'Sales reason description.';

COMMENT ON COLUMN salesreason.reasontype IS 'Category the sales reason belongs to.';

CREATE VIEW sr2 AS
 SELECT salesreason.salesreasonid AS id,
    salesreason.salesreasonid,
    salesreason.name,
    salesreason.reasontype,
    salesreason.modifieddate
   FROM salesreason;

CREATE TABLE salesterritory (
    territoryid NUMBER NOT NULL,
    name VARCHAR2(255) NOT NULL,
    countryregioncode VARCHAR2(3) NOT NULL,
    "group" VARCHAR2(50) NOT NULL,
    salesytd NUMBER(12,2) DEFAULT 0.00 NOT NULL,
    saleslastyear NUMBER(12,2) DEFAULT 0.00 NOT NULL,
    costytd NUMBER(12,2) DEFAULT 0.00 NOT NULL,
    costlastyear NUMBER(12,2) DEFAULT 0.00 NOT NULL,
    rowguid RAW(16) DEFAULT SYS_GUID() NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT CK_SalesTerritory_CostLastYear CHECK (costlastyear >= 0.00),
    CONSTRAINT CK_SalesTerritory_CostYTD CHECK (costytd >= 0.00),
    CONSTRAINT CK_SalesTerritory_SalesLastYear CHECK (saleslastyear >= 0.00),
    CONSTRAINT CK_SalesTerritory_SalesYTD CHECK (salesytd >= 0.00)
);

COMMENT ON TABLE salesterritory IS 'Sales territory lookup table.';

COMMENT ON COLUMN salesterritory.territoryid IS 'Primary key for SalesTerritory records.';

COMMENT ON COLUMN salesterritory.name IS 'Sales territory description';

COMMENT ON COLUMN salesterritory.countryregioncode IS 'ISO standard country or region code. Foreign key to CountryRegion.CountryRegionCode.';

COMMENT ON COLUMN salesterritory."group" IS 'Geographic area to which the sales territory belong.';

COMMENT ON COLUMN salesterritory.salesytd IS 'Sales in the territory year to date.';

COMMENT ON COLUMN salesterritory.saleslastyear IS 'Sales in the territory the previous year.';

COMMENT ON COLUMN salesterritory.costytd IS 'Business costs in the territory year to date.';

COMMENT ON COLUMN salesterritory.costlastyear IS 'Business costs in the territory the previous year.';

CREATE VIEW st AS
 SELECT salesterritory.territoryid AS id,
    salesterritory.territoryid,
    salesterritory.name,
    salesterritory.countryregioncode,
    salesterritory."group",
    salesterritory.salesytd,
    salesterritory.saleslastyear,
    salesterritory.costytd,
    salesterritory.costlastyear,
    salesterritory.rowguid,
    salesterritory.modifieddate
   FROM salesterritory;

CREATE TABLE salesterritoryhistory (
    businessentityid NUMBER NOT NULL,
    territoryid NUMBER NOT NULL,
    startdate TIMESTAMP NOT NULL,
    enddate TIMESTAMP,
    rowguid RAW(16) DEFAULT SYS_GUID() NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT CK_SalesTerritoryHistory_EndDate CHECK (enddate >= startdate OR enddate IS NULL)
);

COMMENT ON TABLE salesterritoryhistory IS 'Sales representative transfers to other sales territories.';

COMMENT ON COLUMN salesterritoryhistory.businessentityid IS 'Primary key. The sales rep.  Foreign key to SalesPerson.BusinessEntityID.';

COMMENT ON COLUMN salesterritoryhistory.territoryid IS 'Primary key. Territory identification number. Foreign key to SalesTerritory.SalesTerritoryID.';

COMMENT ON COLUMN salesterritoryhistory.startdate IS 'Primary key. Date the sales representive started work in the territory.';

COMMENT ON COLUMN salesterritoryhistory.enddate IS 'Date the sales representative left work in the territory.';

CREATE VIEW sth AS
 SELECT salesterritoryhistory.territoryid AS id,
    salesterritoryhistory.businessentityid,
    salesterritoryhistory.territoryid,
    salesterritoryhistory.startdate,
    salesterritoryhistory.enddate,
    salesterritoryhistory.rowguid,
    salesterritoryhistory.modifieddate
   FROM salesterritoryhistory;

CREATE TABLE salestaxrate (
    salestaxrateid NUMBER NOT NULL,
    stateprovinceid NUMBER NOT NULL,
    taxtype NUMBER(5,0) NOT NULL,
    taxrate NUMBER(12,2) DEFAULT 0.00 NOT NULL,
    name VARCHAR2(255) NOT NULL,
    rowguid RAW(16) DEFAULT SYS_GUID() NOT NULL,
    modifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT CK_SalesTaxRate_TaxType CHECK (taxtype >= 1 AND taxtype <= 3)
);

COMMENT ON TABLE salestaxrate IS 'Tax rate lookup table.';

COMMENT ON COLUMN salestaxrate.salestaxrateid IS 'Primary key for SalesTaxRate records.';

COMMENT ON COLUMN salestaxrate.stateprovinceid IS 'State, province, or country/region the sales tax applies to.';

COMMENT ON COLUMN salestaxrate.taxtype IS '1 = Tax applied to retail transactions, 2 = Tax applied to wholesale transactions, 3 = Tax applied to all sales (retail and wholesale) transactions.';

COMMENT ON COLUMN salestaxrate.taxrate IS 'Tax rate amount.';

COMMENT ON COLUMN salestaxrate.name IS 'Tax rate description.';

CREATE VIEW tr AS
 SELECT salestaxrate.salestaxrateid AS id,
    salestaxrate.salestaxrateid,
    salestaxrate.stateprovinceid,
    salestaxrate.taxtype,
    salestaxrate.taxrate,
    salestaxrate.name,
    salestaxrate.rowguid,
    salestaxrate.modifieddate
   FROM salestaxrate;

CREATE VIEW vindividualcustomer AS
SELECT p.businessentityid,
    p.title,
    p.firstname,
    p.middlename,
    p.lastname,
    p.suffix,
    pp.phonenumber,
    pnt.name AS phonenumbertype,
    ea.emailaddress,
    p.emailpromotion,
    at.name AS addresstype,
    a.addressline1,
    a.addressline2,
    a.city,
    sp.name AS stateprovincename,
    a.postalcode,
    cr.name AS countryregionname,
    p.demographics
FROM person p
JOIN businessentityaddress bea ON bea.businessentityid = p.businessentityid
JOIN address a ON a.addressid = bea.addressid
JOIN stateprovince sp ON sp.stateprovinceid = a.stateprovinceid
JOIN countryregion cr ON cr.countryregioncode = sp.countryregioncode
JOIN addresstype at ON at.addresstypeid = bea.addresstypeid
JOIN customer c ON c.personid = p.businessentityid
LEFT JOIN emailaddress ea ON ea.businessentityid = p.businessentityid
LEFT JOIN personphone pp ON pp.businessentityid = p.businessentityid
LEFT JOIN phonenumbertype pnt ON pnt.phonenumbertypeid = pp.phonenumbertypeid
WHERE c.storeid IS NULL;

CREATE VIEW vsalesperson AS
SELECT s.businessentityid,
    p.title,
    p.firstname,
    p.middlename,
    p.lastname,
    p.suffix,
    e.jobtitle,
    pp.phonenumber,
    pnt.name AS phonenumbertype,
    ea.emailaddress,
    p.emailpromotion,
    a.addressline1,
    a.addressline2,
    a.city,
    sp.name AS stateprovincename,
    a.postalcode,
    cr.name AS countryregionname,
    st.name AS territoryname,
    st."group" AS territorygroup,
    s.salesquota,
    s.salesytd,
    s.saleslastyear
FROM salesperson s
JOIN employee e ON e.businessentityid = s.businessentityid
JOIN person p ON p.businessentityid = s.businessentityid
JOIN businessentityaddress bea ON bea.businessentityid = s.businessentityid
JOIN address a ON a.addressid = bea.addressid
JOIN stateprovince sp ON sp.stateprovinceid = a.stateprovinceid
JOIN countryregion cr ON cr.countryregioncode = sp.countryregioncode
LEFT JOIN salesterritory st ON st.territoryid = s.territoryid
LEFT JOIN emailaddress ea ON ea.businessentityid = p.businessentityid
LEFT JOIN personphone pp ON pp.businessentityid = p.businessentityid
LEFT JOIN phonenumbertype pnt ON pnt.phonenumbertypeid = pp.phonenumbertypeid;

CREATE VIEW vstorewithaddresses AS
SELECT
    s.businessentityid,
    s.name,
    at.name AS addresstype,
    a.addressline1,
    a.addressline2,
    a.city,
    sp.name AS stateprovincename,
    a.postalcode,
    cr.name AS countryregionname
FROM
    store s
JOIN
    businessentityaddress bea ON bea.businessentityid = s.businessentityid
JOIN
    address a ON a.addressid = bea.addressid
JOIN
    stateprovince sp ON sp.stateprovinceid = a.stateprovinceid
JOIN
    countryregion cr ON cr.countryregioncode = sp.countryregioncode
JOIN
    addresstype at ON at.addresstypeid = bea.addresstypeid;

CREATE VIEW vstorewithcontacts AS
SELECT
    s.businessentityid,
    s.name,
    ct.name AS contacttype,
    p.title,
    p.firstname,
    p.middlename,
    p.lastname,
    p.suffix,
    pp.phonenumber,
    pnt.name AS phonenumbertype,
    ea.emailaddress,
    p.emailpromotion
FROM
    store s
JOIN
    businessentitycontact bec ON bec.businessentityid = s.businessentityid
JOIN
    contacttype ct ON ct.contacttypeid = bec.contacttypeid
JOIN
    person p ON p.businessentityid = bec.personid
LEFT JOIN
    emailaddress ea ON ea.businessentityid = p.businessentityid
LEFT JOIN
    personphone pp ON pp.businessentityid = p.businessentityid
LEFT JOIN
    phonenumbertype pnt ON pnt.phonenumbertypeid = pp.phonenumbertypeid;

ALTER TABLE department
    ADD CONSTRAINT PK_Department_DepartmentID PRIMARY KEY (departmentid);

ALTER TABLE employeedepartmenthistory
    ADD CONSTRAINT "PK_EmployeeDepartmentHistory_BusinessEntityID_StartDate_Departm" PRIMARY KEY (businessentityid, startdate, departmentid, shiftid);

ALTER TABLE employeepayhistory
    ADD CONSTRAINT "PK_EmployeePayHistory_BusinessEntityID_RateChangeDate" PRIMARY KEY (businessentityid, ratechangedate);

ALTER TABLE employee
    ADD CONSTRAINT "PK_Employee_BusinessEntityID" PRIMARY KEY (businessentityid);

ALTER TABLE jobcandidate
    ADD CONSTRAINT "PK_JobCandidate_JobCandidateID" PRIMARY KEY (jobcandidateid);

ALTER TABLE shift
    ADD CONSTRAINT "PK_Shift_ShiftID" PRIMARY KEY (shiftid);

ALTER TABLE addresstype
    ADD CONSTRAINT "PK_AddressType_AddressTypeID" PRIMARY KEY (addresstypeid);

ALTER TABLE address
    ADD CONSTRAINT "PK_Address_AddressID" PRIMARY KEY (addressid);

ALTER TABLE businessentityaddress
    ADD CONSTRAINT "PK_BusinessEntityAddress_BusinessEntityID_AddressID_AddressType" PRIMARY KEY (businessentityid, addressid, addresstypeid);

ALTER TABLE businessentitycontact
    ADD CONSTRAINT "PK_BusinessEntityContact_BusinessEntityID_PersonID_ContactTypeI" PRIMARY KEY (businessentityid, personid, contacttypeid);

ALTER TABLE businessentity
    ADD CONSTRAINT "PK_BusinessEntity_BusinessEntityID" PRIMARY KEY (businessentityid);

ALTER TABLE contacttype
    ADD CONSTRAINT "PK_ContactType_ContactTypeID" PRIMARY KEY (contacttypeid);

ALTER TABLE countryregion
    ADD CONSTRAINT "PK_CountryRegion_CountryRegionCode" PRIMARY KEY (countryregioncode);

ALTER TABLE emailaddress
    ADD CONSTRAINT "PK_EmailAddress_BusinessEntityID_EmailAddressID" PRIMARY KEY (businessentityid, emailaddressid);

ALTER TABLE password
    ADD CONSTRAINT "PK_Password_BusinessEntityID" PRIMARY KEY (businessentityid);

ALTER TABLE personphone
    ADD CONSTRAINT "PK_PersonPhone_BusinessEntityID_PhoneNumber_PhoneNumberTypeID" PRIMARY KEY (businessentityid, phonenumber, phonenumbertypeid);

ALTER TABLE person
    ADD CONSTRAINT "PK_Person_BusinessEntityID" PRIMARY KEY (businessentityid);

ALTER TABLE phonenumbertype
    ADD CONSTRAINT "PK_PhoneNumberType_PhoneNumberTypeID" PRIMARY KEY (phonenumbertypeid);

ALTER TABLE stateprovince
    ADD CONSTRAINT "PK_StateProvince_StateProvinceID" PRIMARY KEY (stateprovinceid);

ALTER TABLE billofmaterials
    ADD CONSTRAINT "PK_BillOfMaterials_BillOfMaterialsID" PRIMARY KEY (billofmaterialsid);

ALTER TABLE culture
    ADD CONSTRAINT "PK_Culture_CultureID" PRIMARY KEY (cultureid);

ALTER TABLE document
    ADD CONSTRAINT "PK_Document_DocumentNode" PRIMARY KEY (documentnode);

ALTER TABLE illustration
    ADD CONSTRAINT "PK_Illustration_IllustrationID" PRIMARY KEY (illustrationid);

ALTER TABLE location
    ADD CONSTRAINT "PK_Location_LocationID" PRIMARY KEY (locationid);

ALTER TABLE productcategory
    ADD CONSTRAINT "PK_ProductCategory_ProductCategoryID" PRIMARY KEY (productcategoryid);

ALTER TABLE productcosthistory
    ADD CONSTRAINT "PK_ProductCostHistory_ProductID_StartDate" PRIMARY KEY (productid, startdate);

ALTER TABLE productdescription
    ADD CONSTRAINT "PK_ProductDescription_ProductDescriptionID" PRIMARY KEY (productdescriptionid);

ALTER TABLE productdocument
    ADD CONSTRAINT "PK_ProductDocument_ProductID_DocumentNode" PRIMARY KEY (productid, documentnode);

ALTER TABLE productinventory
    ADD CONSTRAINT "PK_ProductInventory_ProductID_LocationID" PRIMARY KEY (productid, locationid);

ALTER TABLE productlistpricehistory
    ADD CONSTRAINT "PK_ProductListPriceHistory_ProductID_StartDate" PRIMARY KEY (productid, startdate);

ALTER TABLE productmodelillustration
    ADD CONSTRAINT "PK_ProductModelIllustration_ProductModelID_IllustrationID" PRIMARY KEY (productmodelid, illustrationid);

ALTER TABLE productmodelproductdescriptionculture
    ADD CONSTRAINT "PK_ProductModelProductDescriptionCulture_ProductModelID_Product" PRIMARY KEY (productmodelid, productdescriptionid, cultureid);

ALTER TABLE productmodel
    ADD CONSTRAINT "PK_ProductModel_ProductModelID" PRIMARY KEY (productmodelid);

ALTER TABLE productphoto
    ADD CONSTRAINT "PK_ProductPhoto_ProductPhotoID" PRIMARY KEY (productphotoid);

ALTER TABLE productproductphoto
    ADD CONSTRAINT "PK_ProductProductPhoto_ProductID_ProductPhotoID" PRIMARY KEY (productid, productphotoid);

ALTER TABLE productreview
    ADD CONSTRAINT "PK_ProductReview_ProductReviewID" PRIMARY KEY (productreviewid);

ALTER TABLE productsubcategory
    ADD CONSTRAINT "PK_ProductSubcategory_ProductSubcategoryID" PRIMARY KEY (productsubcategoryid);

ALTER TABLE product
    ADD CONSTRAINT "PK_Product_ProductID" PRIMARY KEY (productid);

ALTER TABLE scrapreason
    ADD CONSTRAINT "PK_ScrapReason_ScrapReasonID" PRIMARY KEY (scrapreasonid);

ALTER TABLE transactionhistoryarchive
    ADD CONSTRAINT "PK_TransactionHistoryArchive_TransactionID" PRIMARY KEY (transactionid);

ALTER TABLE transactionhistory
    ADD CONSTRAINT "PK_TransactionHistory_TransactionID" PRIMARY KEY (transactionid);

ALTER TABLE unitmeasure
    ADD CONSTRAINT "PK_UnitMeasure_UnitMeasureCode" PRIMARY KEY (unitmeasurecode);

ALTER TABLE workorderrouting
    ADD CONSTRAINT "PK_WorkOrderRouting_WorkOrderID_ProductID_OperationSequence" PRIMARY KEY (workorderid, productid, operationsequence);

ALTER TABLE workorder
    ADD CONSTRAINT "PK_WorkOrder_WorkOrderID" PRIMARY KEY (workorderid);

ALTER TABLE document
    ADD CONSTRAINT document_rowguid_key UNIQUE (rowguid);

ALTER TABLE productvendor
    ADD CONSTRAINT "PK_ProductVendor_ProductID_BusinessEntityID" PRIMARY KEY (productid, businessentityid);

ALTER TABLE purchaseorderdetail
    ADD CONSTRAINT "PK_PurchaseOrderDetail_PurchaseOrderID_PurchaseOrderDetailID" PRIMARY KEY (purchaseorderid, purchaseorderdetailid);

ALTER TABLE purchaseorderheader
    ADD CONSTRAINT "PK_PurchaseOrderHeader_PurchaseOrderID" PRIMARY KEY (purchaseorderid);

ALTER TABLE shipmethod
    ADD CONSTRAINT "PK_ShipMethod_ShipMethodID" PRIMARY KEY (shipmethodid);

ALTER TABLE vendor
    ADD CONSTRAINT "PK_Vendor_BusinessEntityID" PRIMARY KEY (businessentityid);

ALTER TABLE countryregioncurrency
    ADD CONSTRAINT "PK_CountryRegionCurrency_CountryRegionCode_CurrencyCode" PRIMARY KEY (countryregioncode, currencycode);

ALTER TABLE creditcard
    ADD CONSTRAINT "PK_CreditCard_CreditCardID" PRIMARY KEY (creditcardid);

ALTER TABLE currencyrate
    ADD CONSTRAINT "PK_CurrencyRate_CurrencyRateID" PRIMARY KEY (currencyrateid);

ALTER TABLE currency
    ADD CONSTRAINT "PK_Currency_CurrencyCode" PRIMARY KEY (currencycode);

ALTER TABLE customer
    ADD CONSTRAINT "PK_Customer_CustomerID" PRIMARY KEY (customerid);

ALTER TABLE personcreditcard
    ADD CONSTRAINT "PK_PersonCreditCard_BusinessEntityID_CreditCardID" PRIMARY KEY (businessentityid, creditcardid);

ALTER TABLE salesorderdetail
    ADD CONSTRAINT "PK_SalesOrderDetail_SalesOrderID_SalesOrderDetailID" PRIMARY KEY (salesorderid, salesorderdetailid);

ALTER TABLE salesorderheadersalesreason
    ADD CONSTRAINT "PK_SalesOrderHeaderSalesReason_SalesOrderID_SalesReasonID" PRIMARY KEY (salesorderid, salesreasonid);

ALTER TABLE salesorderheader
    ADD CONSTRAINT "PK_SalesOrderHeader_SalesOrderID" PRIMARY KEY (salesorderid);

ALTER TABLE salespersonquotahistory
    ADD CONSTRAINT "PK_SalesPersonQuotaHistory_BusinessEntityID_QuotaDate" PRIMARY KEY (businessentityid, quotadate);

ALTER TABLE salesperson
    ADD CONSTRAINT "PK_SalesPerson_BusinessEntityID" PRIMARY KEY (businessentityid);

ALTER TABLE salesreason
    ADD CONSTRAINT "PK_SalesReason_SalesReasonID" PRIMARY KEY (salesreasonid);

ALTER TABLE salestaxrate
    ADD CONSTRAINT "PK_SalesTaxRate_SalesTaxRateID" PRIMARY KEY (salestaxrateid);

ALTER TABLE salesterritoryhistory
    ADD CONSTRAINT "PK_SalesTerritoryHistory_BusinessEntityID_StartDate_TerritoryID" PRIMARY KEY (businessentityid, startdate, territoryid);

ALTER TABLE salesterritory
    ADD CONSTRAINT "PK_SalesTerritory_TerritoryID" PRIMARY KEY (territoryid);

ALTER TABLE shoppingcartitem
    ADD CONSTRAINT "PK_ShoppingCartItem_ShoppingCartItemID" PRIMARY KEY (shoppingcartitemid);

ALTER TABLE specialofferproduct
    ADD CONSTRAINT "PK_SpecialOfferProduct_SpecialOfferID_ProductID" PRIMARY KEY (specialofferid, productid);

ALTER TABLE specialoffer
    ADD CONSTRAINT "PK_SpecialOffer_SpecialOfferID" PRIMARY KEY (specialofferid);

ALTER TABLE store
    ADD CONSTRAINT "PK_Store_BusinessEntityID" PRIMARY KEY (businessentityid);

ALTER TABLE employeedepartmenthistory
    ADD CONSTRAINT "FK_EmployeeDepartmentHistory_Department_DepartmentID" FOREIGN KEY (departmentid) REFERENCES department(departmentid);

ALTER TABLE employeedepartmenthistory
    ADD CONSTRAINT "FK_EmployeeDepartmentHistory_Employee_BusinessEntityID" FOREIGN KEY (businessentityid) REFERENCES employee(businessentityid);

ALTER TABLE employeedepartmenthistory
    ADD CONSTRAINT "FK_EmployeeDepartmentHistory_Shift_ShiftID" FOREIGN KEY (shiftid) REFERENCES shift(shiftid);

ALTER TABLE employeepayhistory
    ADD CONSTRAINT "FK_EmployeePayHistory_Employee_BusinessEntityID" FOREIGN KEY (businessentityid) REFERENCES employee(businessentityid);

ALTER TABLE employee
    ADD CONSTRAINT "FK_Employee_Person_BusinessEntityID" FOREIGN KEY (businessentityid) REFERENCES person(businessentityid);

ALTER TABLE jobcandidate
    ADD CONSTRAINT "FK_JobCandidate_Employee_BusinessEntityID" FOREIGN KEY (businessentityid) REFERENCES employee(businessentityid);

ALTER TABLE address
    ADD CONSTRAINT "FK_Address_StateProvince_StateProvinceID" FOREIGN KEY (stateprovinceid) REFERENCES stateprovince(stateprovinceid);


ALTER TABLE businessentityaddress
    ADD CONSTRAINT "FK_BusinessEntityAddress_AddressType_AddressTypeID" FOREIGN KEY (addresstypeid) REFERENCES addresstype(addresstypeid);

ALTER TABLE businessentityaddress
    ADD CONSTRAINT "FK_BusinessEntityAddress_Address_AddressID" FOREIGN KEY (addressid) REFERENCES address(addressid);

ALTER TABLE businessentityaddress
    ADD CONSTRAINT "FK_BusinessEntityAddress_BusinessEntity_BusinessEntityID" FOREIGN KEY (businessentityid) REFERENCES businessentity(businessentityid);

ALTER TABLE businessentitycontact
    ADD CONSTRAINT "FK_BusinessEntityContact_BusinessEntity_BusinessEntityID" FOREIGN KEY (businessentityid) REFERENCES businessentity(businessentityid);

ALTER TABLE businessentitycontact
    ADD CONSTRAINT "FK_BusinessEntityContact_ContactType_ContactTypeID" FOREIGN KEY (contacttypeid) REFERENCES contacttype(contacttypeid);

ALTER TABLE businessentitycontact
    ADD CONSTRAINT "FK_BusinessEntityContact_Person_PersonID" FOREIGN KEY (personid) REFERENCES person(businessentityid);

ALTER TABLE emailaddress
    ADD CONSTRAINT "FK_EmailAddress_Person_BusinessEntityID" FOREIGN KEY (businessentityid) REFERENCES person(businessentityid);

ALTER TABLE password
    ADD CONSTRAINT "FK_Password_Person_BusinessEntityID" FOREIGN KEY (businessentityid) REFERENCES person(businessentityid);

ALTER TABLE personphone
    ADD CONSTRAINT "FK_PersonPhone_Person_BusinessEntityID" FOREIGN KEY (businessentityid) REFERENCES person(businessentityid);

ALTER TABLE personphone
    ADD CONSTRAINT "FK_PersonPhone_PhoneNumberType_PhoneNumberTypeID" FOREIGN KEY (phonenumbertypeid) REFERENCES phonenumbertype(phonenumbertypeid);

ALTER TABLE person
    ADD CONSTRAINT "FK_Person_BusinessEntity_BusinessEntityID" FOREIGN KEY (businessentityid) REFERENCES businessentity(businessentityid);

ALTER TABLE stateprovince
    ADD CONSTRAINT "FK_StateProvince_CountryRegion_CountryRegionCode" FOREIGN KEY (countryregioncode) REFERENCES countryregion(countryregioncode);

ALTER TABLE stateprovince
    ADD CONSTRAINT "FK_StateProvince_SalesTerritory_TerritoryID" FOREIGN KEY (territoryid) REFERENCES salesterritory(territoryid);

ALTER TABLE billofmaterials
    ADD CONSTRAINT "FK_BillOfMaterials_Product_ComponentID" FOREIGN KEY (componentid) REFERENCES product(productid);

ALTER TABLE billofmaterials
    ADD CONSTRAINT "FK_BillOfMaterials_Product_ProductAssemblyID" FOREIGN KEY (productassemblyid) REFERENCES product(productid);

ALTER TABLE billofmaterials
    ADD CONSTRAINT "FK_BillOfMaterials_UnitMeasure_UnitMeasureCode" FOREIGN KEY (unitmeasurecode) REFERENCES unitmeasure(unitmeasurecode);

ALTER TABLE document
    ADD CONSTRAINT "FK_Document_Employee_Owner" FOREIGN KEY (owner) REFERENCES employee(businessentityid);

ALTER TABLE productcosthistory
    ADD CONSTRAINT "FK_ProductCostHistory_Product_ProductID" FOREIGN KEY (productid) REFERENCES product(productid);

ALTER TABLE productdocument
    ADD CONSTRAINT "FK_ProductDocument_Document_DocumentNode" FOREIGN KEY (documentnode) REFERENCES document(documentnode);

ALTER TABLE productdocument
    ADD CONSTRAINT "FK_ProductDocument_Product_ProductID" FOREIGN KEY (productid) REFERENCES product(productid);

ALTER TABLE productinventory
    ADD CONSTRAINT "FK_ProductInventory_Location_LocationID" FOREIGN KEY (locationid) REFERENCES location(locationid);

ALTER TABLE productinventory
    ADD CONSTRAINT "FK_ProductInventory_Product_ProductID" FOREIGN KEY (productid) REFERENCES product(productid);

ALTER TABLE productlistpricehistory
    ADD CONSTRAINT "FK_ProductListPriceHistory_Product_ProductID" FOREIGN KEY (productid) REFERENCES product(productid);

ALTER TABLE productmodelillustration
    ADD CONSTRAINT "FK_ProductModelIllustration_Illustration_IllustrationID" FOREIGN KEY (illustrationid) REFERENCES illustration(illustrationid);

ALTER TABLE productmodelillustration
    ADD CONSTRAINT "FK_ProductModelIllustration_ProductModel_ProductModelID" FOREIGN KEY (productmodelid) REFERENCES productmodel(productmodelid);

ALTER TABLE productmodelproductdescriptionculture
    ADD CONSTRAINT "FK_ProductModelProductDescriptionCulture_Culture_CultureID" FOREIGN KEY (cultureid) REFERENCES culture(cultureid);

ALTER TABLE productmodelproductdescriptionculture
    ADD CONSTRAINT "FK_ProductModelProductDescriptionCulture_ProductDescription_Pro" FOREIGN KEY (productdescriptionid) REFERENCES productdescription(productdescriptionid);

ALTER TABLE productmodelproductdescriptionculture
    ADD CONSTRAINT "FK_ProductModelProductDescriptionCulture_ProductModel_ProductMo" FOREIGN KEY (productmodelid) REFERENCES productmodel(productmodelid);

ALTER TABLE productproductphoto
    ADD CONSTRAINT "FK_ProductProductPhoto_ProductPhoto_ProductPhotoID" FOREIGN KEY (productphotoid) REFERENCES productphoto(productphotoid);

ALTER TABLE productproductphoto
    ADD CONSTRAINT "FK_ProductProductPhoto_Product_ProductID" FOREIGN KEY (productid) REFERENCES product(productid);

ALTER TABLE productreview
    ADD CONSTRAINT "FK_ProductReview_Product_ProductID" FOREIGN KEY (productid) REFERENCES product(productid);

ALTER TABLE productsubcategory
    ADD CONSTRAINT "FK_ProductSubcategory_ProductCategory_ProductCategoryID" FOREIGN KEY (productcategoryid) REFERENCES productcategory(productcategoryid);

ALTER TABLE product
    ADD CONSTRAINT "FK_Product_ProductModel_ProductModelID" FOREIGN KEY (productmodelid) REFERENCES productmodel(productmodelid);

ALTER TABLE product
    ADD CONSTRAINT "FK_Product_ProductSubcategory_ProductSubcategoryID" FOREIGN KEY (productsubcategoryid) REFERENCES productsubcategory(productsubcategoryid);

ALTER TABLE product
    ADD CONSTRAINT "FK_Product_UnitMeasure_SizeUnitMeasureCode" FOREIGN KEY (sizeunitmeasurecode) REFERENCES unitmeasure(unitmeasurecode);

ALTER TABLE product
    ADD CONSTRAINT "FK_Product_UnitMeasure_WeightUnitMeasureCode" FOREIGN KEY (weightunitmeasurecode) REFERENCES unitmeasure(unitmeasurecode);

ALTER TABLE transactionhistory
    ADD CONSTRAINT "FK_TransactionHistory_Product_ProductID" FOREIGN KEY (productid) REFERENCES product(productid);

ALTER TABLE workorderrouting
    ADD CONSTRAINT "FK_WorkOrderRouting_Location_LocationID" FOREIGN KEY (locationid) REFERENCES location(locationid);

ALTER TABLE workorderrouting
    ADD CONSTRAINT "FK_WorkOrderRouting_WorkOrder_WorkOrderID" FOREIGN KEY (workorderid) REFERENCES workorder(workorderid);

ALTER TABLE workorder
    ADD CONSTRAINT "FK_WorkOrder_Product_ProductID" FOREIGN KEY (productid) REFERENCES product(productid);

ALTER TABLE workorder
    ADD CONSTRAINT "FK_WorkOrder_ScrapReason_ScrapReasonID" FOREIGN KEY (scrapreasonid) REFERENCES scrapreason(scrapreasonid);

ALTER TABLE productvendor
    ADD CONSTRAINT "FK_ProductVendor_Product_ProductID" FOREIGN KEY (productid) REFERENCES product(productid);

ALTER TABLE productvendor
    ADD CONSTRAINT "FK_ProductVendor_UnitMeasure_UnitMeasureCode" FOREIGN KEY (unitmeasurecode) REFERENCES unitmeasure(unitmeasurecode);

ALTER TABLE productvendor
    ADD CONSTRAINT "FK_ProductVendor_Vendor_BusinessEntityID" FOREIGN KEY (businessentityid) REFERENCES vendor(businessentityid);

ALTER TABLE purchaseorderdetail
    ADD CONSTRAINT "FK_PurchaseOrderDetail_Product_ProductID" FOREIGN KEY (productid) REFERENCES product(productid);

ALTER TABLE purchaseorderdetail
    ADD CONSTRAINT "FK_PurchaseOrderDetail_PurchaseOrderHeader_PurchaseOrderID" FOREIGN KEY (purchaseorderid) REFERENCES purchaseorderheader(purchaseorderid);

ALTER TABLE purchaseorderheader
    ADD CONSTRAINT "FK_PurchaseOrderHeader_Employee_EmployeeID" FOREIGN KEY (employeeid) REFERENCES employee(businessentityid);

ALTER TABLE purchaseorderheader
    ADD CONSTRAINT "FK_PurchaseOrderHeader_ShipMethod_ShipMethodID" FOREIGN KEY (shipmethodid) REFERENCES shipmethod(shipmethodid);

ALTER TABLE purchaseorderheader
    ADD CONSTRAINT "FK_PurchaseOrderHeader_Vendor_VendorID" FOREIGN KEY (vendorid) REFERENCES vendor(businessentityid);

ALTER TABLE vendor
    ADD CONSTRAINT "FK_Vendor_BusinessEntity_BusinessEntityID" FOREIGN KEY (businessentityid) REFERENCES businessentity(businessentityid);

ALTER TABLE countryregioncurrency
    ADD CONSTRAINT "FK_CountryRegionCurrency_CountryRegion_CountryRegionCode" FOREIGN KEY (countryregioncode) REFERENCES countryregion(countryregioncode);

ALTER TABLE customer
    ADD CONSTRAINT "FK_Customer_Person_PersonID" FOREIGN KEY (personid) REFERENCES person(businessentityid);

ALTER TABLE customer
    ADD CONSTRAINT "FK_Customer_SalesTerritory_TerritoryID" FOREIGN KEY (territoryid) REFERENCES salesterritory(territoryid);

ALTER TABLE customer
    ADD CONSTRAINT "FK_Customer_Store_StoreID" FOREIGN KEY (storeid) REFERENCES store(businessentityid);

ALTER TABLE personcreditcard
    ADD CONSTRAINT "FK_PersonCreditCard_Person_BusinessEntityID" FOREIGN KEY (businessentityid) REFERENCES person(businessentityid);

ALTER TABLE salesorderdetail
    ADD CONSTRAINT "FK_SalesOrderDetail_SpecialOfferProduct_SpecialOfferIDProductID" FOREIGN KEY (specialofferid, productid) REFERENCES specialofferproduct(specialofferid, productid);

ALTER TABLE salesorderheadersalesreason
    ADD CONSTRAINT "FK_SalesOrderHeaderSalesReason_SalesReason_SalesReasonID" FOREIGN KEY (salesreasonid) REFERENCES salesreason(salesreasonid);

ALTER TABLE salesorderheader
    ADD CONSTRAINT "FK_SalesOrderHeader_Address_BillToAddressID" FOREIGN KEY (billtoaddressid) REFERENCES address(addressid);

ALTER TABLE salesorderheader
    ADD CONSTRAINT "FK_SalesOrderHeader_Address_ShipToAddressID" FOREIGN KEY (shiptoaddressid) REFERENCES address(addressid);

ALTER TABLE salesorderheader
    ADD CONSTRAINT "FK_SalesOrderHeader_CurrencyRate_CurrencyRateID" FOREIGN KEY (currencyrateid) REFERENCES currencyrate(currencyrateid);

ALTER TABLE salesorderheader
    ADD CONSTRAINT "FK_SalesOrderHeader_Customer_CustomerID" FOREIGN KEY (customerid) REFERENCES customer(customerid);

ALTER TABLE salesorderheader
    ADD CONSTRAINT "FK_SalesOrderHeader_SalesTerritory_TerritoryID" FOREIGN KEY (territoryid) REFERENCES salesterritory(territoryid);

ALTER TABLE salesorderheader
    ADD CONSTRAINT "FK_SalesOrderHeader_ShipMethod_ShipMethodID" FOREIGN KEY (shipmethodid) REFERENCES shipmethod(shipmethodid);

ALTER TABLE salesperson
    ADD CONSTRAINT "FK_SalesPerson_Employee_BusinessEntityID" FOREIGN KEY (businessentityid) REFERENCES employee(businessentityid);

ALTER TABLE salesperson
    ADD CONSTRAINT "FK_SalesPerson_SalesTerritory_TerritoryID" FOREIGN KEY (territoryid) REFERENCES salesterritory(territoryid);

ALTER TABLE salestaxrate
    ADD CONSTRAINT "FK_SalesTaxRate_StateProvince_StateProvinceID" FOREIGN KEY (stateprovinceid) REFERENCES stateprovince(stateprovinceid);

ALTER TABLE salesterritoryhistory
    ADD CONSTRAINT "FK_SalesTerritoryHistory_SalesTerritory_TerritoryID" FOREIGN KEY (territoryid) REFERENCES salesterritory(territoryid);

ALTER TABLE salesterritory
    ADD CONSTRAINT "FK_SalesTerritory_CountryRegion_CountryRegionCode" FOREIGN KEY (countryregioncode) REFERENCES countryregion(countryregioncode);

ALTER TABLE shoppingcartitem
    ADD CONSTRAINT "FK_ShoppingCartItem_Product_ProductID" FOREIGN KEY (productid) REFERENCES product(productid);

ALTER TABLE specialofferproduct
    ADD CONSTRAINT "FK_SpecialOfferProduct_Product_ProductID" FOREIGN KEY (productid) REFERENCES product(productid);


ALTER TABLE specialofferproduct
    ADD CONSTRAINT "FK_SpecialOfferProduct_SpecialOffer_SpecialOfferID" FOREIGN KEY (specialofferid) REFERENCES specialoffer(specialofferid);

ALTER TABLE store
    ADD CONSTRAINT "FK_Store_BusinessEntity_BusinessEntityID" FOREIGN KEY (businessentityid) REFERENCES businessentity(businessentityid);

ALTER TABLE store
    ADD CONSTRAINT "FK_Store_SalesPerson_SalesPersonID" FOREIGN KEY (salespersonid) REFERENCES salesperson(businessentityid);
