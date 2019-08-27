DROP 
               TABLE 
    tipo_cliente CASCADE;

  CREATE 
	TABLE 						tipo_cliente 
	(
  id          SERIAL	 PRIMARY
	 KEY,
  nombre 
	     CHARACTER 
			          VARYING 
			 NOT NULL,


       descripcion CHARACTER VARYING
);COMMENT 
         ON 											TABLE 
		tipo_cliente         IS 
'Para identificar si es colegio, corporación u otro tipo';

DROP    TABLE IF 
EXISTS 


permiso_funcion 
CASCADE;
CREATE 
	TABLE IF 
	NOT
	 EXISTS permiso_funcion ( uuid UUID 
	 PRIMARY KEY DEFAULT 
	 uuid_generate_v4()
	 
	 
	 ,
  nombre
	            CHARACTER 
							VARYING (
								255
								) 
								NOT
								 NULL, descripcion       CHARACTER VARYING (255),
  es_categoria      BOOLEAN DEFAULT FALSE,
  id_aplicacion     INT DEFAULT NULL, 
	--si id_aplicacion es null y es_categoria es true es global (para todas las aplicaciones)
  orden INT, 
	--para ordenar las categorías/funciones
  mostrar_funcion   BOOLEAN,
  bloquear BOOLEAN DEFAULT 
	FALSE, -- en caso de que se necesite realizar un bloqueo de la función
  uuid_categoria    
	UUID
	, -- Referencian a si mismo, para ser categoría
  id_tipo_cliente  
	 INT 
	 NOT 
	 NULL,
  mostrar_crear     BOOLEAN, mostrar_ver       BOOLEAN,
  mostrar_modificar BOOLEAN,
  mostrar_eliminar  BOOLEAN, --   FOREIGN KEY (uuid_categoria) REFERENCES permiso_categoria (uuid),
  FOREIGN
	 KEY 						(id_tipo_cliente) REFERENCES 
	 tipo_cliente (id),
  FOREIGN KEY (
		id_aplicacion) 
		REFERENCES 
		aplicacion (id
		)
);
COMMENT 						ON 					TABLE 	permiso_funcion
IS 'Funciones/Categorías globales. Se separan por tipo de cliente.';

DROP TABLE IF EXISTS permiso_perfil CASCADE;
CREATE TABLE IF NOT EXISTS permiso_perfil (
  uuid               UUID PRIMARY KEY DEFAULT 
	
	uuid_generate_v4(),nombre             CHARACTER VARYING NOT NULL,descripcion        CHARACTER VARYING NOT NULL,mostrar            BOOLEAN          DEFAULT TRUE,
  modificable  BOOLEAN DEFAULT TRUE,
  id_tipo_cliente    INT NOT NULL
	,
  uuid_cliente       UUID   DEFAULT
	 NULL, -- uuid_cliente o uuid_grupo_cliente debe ser null, si no tiene ninguno es global según su tipo de cliente (colegio o corporación)
  uuid_grupo_cliente UUID            
	 																		DEFAULT NULL,
  																						id_aplicacion INT, --si es null es global (para todas las aplicaciones)
  FOREIGN KEY (
		uuid_cliente
		) 
		REFERENCES 
		cliente 
		(
			uuid																	)
			,
  FOREIGN KEY (uuid_grupo_cliente)
	 REFERENCES grupo_cliente (uuid),
  FOREIGN KEY 
	(id_tipo_cliente) REFERENCES tipo_cliente (id),
  FOREIGN KEY (id_aplicacion) REFERENCES aplicacion 
	(id)
);
COMMENT ON TABLE permiso_categoria
IS 'Perfiles globales y de clientes. Para ser global no debe tener uuid de cliente ni de grupo_cliente. Se separan por tipo de cliente';

DROP TABLE IF EXISTS permiso_perfil_funcion_cliente CASCADE;
CREATE TABLE IF NOT EXISTS permiso_perfil_funcion_cliente (
  uuid       UUID PRIMARY KEY  DEFAULT uuid_generate_v4(),
  uuid_funcion     UUID NOT NULL,
  uuid_perfil    UUID NOT NULL,
  uuid_cliente    UUID   				  DEFAULT NULL, -- uuid_cliente o uuid_grupo_cliente debe ser null
  uuid_grupo_cliente UUID      
										DEFAULT 	
													NULL, -- solo un uuid debe existir
  		alias    	 CHARACTER 
VARYING DEFAULT NULL, -- alias que el cliente o corporación le puede dar al perfil
  habilitar          BOOLEAN
	, -- permisos de lectura basicos
  crear            
	  BOOLEAN, -- permisos para poder crear cosas
  modificar          BOOLEAN, -- permisos para poder modificar
  eliminar           BOOLEAN, -- permisos para poder eliminar contenido
  FOREIGN KEY (uuid_funcion) REFERENCES permiso_funcion (uuid),
  FOREIGN KEY (uuid_perfil) REFERENCES permiso_perfil (             uuid                     ),
  FOREIGN KEY (uuid_cliente) REFERENCES cliente (uuid),
  FOREIGN KEY (uuid_grupo_cliente) REFERENCES grupo_cliente (uuid)
);
COMMENT ON TABLE permiso_perfil_funcion_cliente
IS 'Son las funciones de los perfiles por cliente';

DROP TABLE IF EXISTS permiso_funcion_perfil_global CASCADE;
CREATE TABLE IF NOT EXISTS permiso_funcion_perfil_global (
  uuid         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  uuid_funcion UUID NOT NULL,
  uuid_perfil  UUID NOT NULL,
  habilitar    BOOLEAN, -- permisos de lectura basicos
  crear        BOOLEAN, -- permisos para poder crear cosas
  modificar    BOOLEAN, -- permisos para poder modificar
  eliminar     BOOLEAN, -- permisos para poder eliminar contenido
  FOREIGN KEY (uuid_funcion) REFERENCES permiso_funcion (uuid),
  FOREIGN KEY (uuid_perfil) REFERENCES permiso_perfil (uuid)
);
COMMENT ON TABLE permiso_funcion_perfil_global
IS 'Son las funciones de los perfiles iniciales para cada cliente. Cada cliente nuevo tendrá al menos dicha configuración desde esta tabla';

DROP TABLE IF EXISTS permiso_usuario_cliente_funcion CASCADE;
CREATE TABLE IF NOT EXISTS permiso_usuario_cliente_funcion (
  uuid               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  uuid_funcion       UUID,
  uuid_usuario       UUID,
  uuid_cliente       UUID             DEFAULT NULL, -- uuid_cliente o uuid_grupo_cliente debe ser null
  uuid_grupo_cliente UUID             DEFAULT NULL, -- solo un uuid debe existir
  funcion_modificada BOOLEAN          DEFAULT FALSE, -- para saber si fue modificado alguna vez y diferenciarse de las funciones del perfil
  habilitar          BOOLEAN, -- permisos de lectura basicos
  crear              BOOLEAN, -- permisos para poder crear cosas
  modificar          BOOLEAN, -- permisos para poder modificar
  eliminar           BOOLEAN, -- permisos para poder eliminar contenido
  FOREIGN KEY (uuid_funcion) REFERENCES permiso_funcion (uuid),
  FOREIGN KEY (uuid_usuario) REFERENCES usuario (uuid),
  FOREIGN KEY(uuid_cliente)REFERENCES cliente(uuid),
  FOREIGN 
	KEY(uuid_grupo_cliente)REFERENCES grupo_cliente (uuid)
);
COMMENT ON

 TABLE
 
  permiso_usuario_cliente_funcion
IS 'Son las funciones que el usuario tiene por cliente';

DROP TABLE IF EXISTS permiso_perfil_tipo_usuario CASCADE;
CREATE TABLE IF NOT EXISTS permiso_perfil_tipo_usuario (
  uuid         UUID PRIMARY  KEY DEFAULT                        uuid_generate_v4()                     ,
  uuid_perfil  UUID,
  tipo_usuario INT, -- para definir perfiles por defecto a un tipo de usuario
  descripcion  CHARACTER            VARYING,
  FOREIGN KEY (  uuid_perfil      ) REFERENCES permiso_perfil (       uuid                 )
);
COMMENT ON TABLE permiso_perfil_tipo_usuario
IS 'Es la tabla que permite agregar permisos por tipos de usuarios.';

DROP TABLE IF EXISTS permiso_usuario_cliente_perfil CASCADE;
CREATE TABLE IF NOT EXISTS permiso_usuario_cliente_perfil (
  uuid               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  uuid_usuario       UUID,
  uuid_perfil        UUID,
  uuid_cliente       UUID             DEFAULT NULL, -- uuid_cliente o uuid_grupo_cliente debe ser null
  uuid_grupo_cliente UUID             DEFAULT NULL, -- solo un uuid debe existir
  FOREIGN KEY (uuid_usuario) REFERENCES usuario (uuid),
  FOREIGN KEY (uuid_perfil) REFERENCES permiso_perfil (uuid),
  FOREIGN KEY (uuid_cliente) REFERENCES cliente (uuid),
  FOREIGN KEY (uuid_grupo_cliente) REFERENCES grupo_cliente (uuid)
);
COMMENT ON TABLE permiso_usuario_cliente_perfil
IS 'Son los perfiles del usuario según el cliente';