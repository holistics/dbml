ALTER APPLICATION ROLE weekly_receipts   
    WITH NAME = receipts_ledger;  
GO

ALTER ASYMMETRIC KEY PacificSales09   
    WITH PRIVATE KEY (  
    DECRYPTION BY PASSWORD = '<oldPassword>',  
    ENCRYPTION BY PASSWORD = '<enterStrongPasswordHere>');  
GO

ALTER AUTHORIZATION ON OBJECT::Parts.Sprockets TO MichikoOsada;
GO