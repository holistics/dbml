// import _ from 'lodash';
import Schema, { NormalizedSchema, RawSchema } from './schema';
import Ref, { NormalizedRef } from './ref';
import Enum, { NormalizedEnum } from './enum';
import TableGroup, { NormalizedTableGroup } from './tableGroup';
import Table, { NormalizedTable } from './table';
import Element from './element';
import { DEFAULT_SCHEMA_NAME, TABLE, TABLE_GROUP, ENUM, REF } from './config';
import DbState from './dbState';
import { NormalizedEndpoint } from './endpoint';
import { NormalizedEnumValue } from './enumValue';
import { NormalizedField } from './field';
import { NormalizedIndexColumn } from './indexColumn';
import { NormalizedIndex } from './indexes';

export interface Project {
    note: String
    database_type: String
    name: String
}

export interface RawDatabase {
    schemas: Schema[],
    tables: Table[],
    enums: Enum[],
    refs: Ref[],
    tableGroups: TableGroup[],
    project: Project
}

class Database extends Element {
    dbState = new DbState();
    hasDefaultSchema = false;
    schemas: Schema[] = [];
    note: String
    databaseType: String
    name: String
    id: number


    constructor({ schemas = [], tables = [], enums = [], refs = [], tableGroups = [], project }: RawDatabase) {
        super(undefined);
        this.generateId();
        this.note = project.note;
        this.databaseType = project.database_type;
        this.name = project.name;

        // The process order is important. Do not change !
        this.processSchemas(schemas);
        this.processSchemaElements(tables, TABLE);
        this.processSchemaElements(refs, REF);
        this.processSchemaElements(enums, ENUM);
        this.processSchemaElements(tableGroups, TABLE_GROUP);
    }

    generateId() {
        this.id = this.dbState.generateId('dbId');
    }

    processSchemas(rawSchemas: RawSchema[]) {
        rawSchemas.forEach((schema) => {
            this.pushSchema(new Schema({ ...schema, database: this }));
        });
    }

    pushSchema(schema: Schema) {
        this.checkSchema(schema);
        this.schemas.push(schema);
    }

    checkSchema(schema: Schema) {
        if (this.schemas.some(s => s.name === schema.name)) {
            schema.error(`Schemas ${schema.name} existed`);
        }
    }

    processSchemaElements(elements: Schema[] | Table[] | Enum[] | TableGroup[] | Ref[], elementType) {
        let schema;

        elements.forEach((element) => {
            if (element.schemaName) {
                schema = this.findOrCreateSchema(element.schemaName);
                if (element.schemaName === DEFAULT_SCHEMA_NAME) {
                    this.hasDefaultSchema = true;
                }
            } else {
                schema = this.findOrCreateSchema(DEFAULT_SCHEMA_NAME);
            }

            switch (elementType) {
                case TABLE:
                    schema.pushTable(new Table({ ...element, schema }));
                    break;

                case ENUM:
                    schema.pushEnum(new Enum({ ...element, schema }));
                    break;

                case TABLE_GROUP:
                    schema.pushTableGroup(new TableGroup({ ...element, schema }));
                    break;

                case REF:
                    schema.pushRef(new Ref({ ...element, schema }));
                    break;

                default:
                    break;
            }
        });
    }

    findOrCreateSchema(schemaName: String) {
        let schema = this.schemas.find(s => s.name === schemaName || s.alias === schemaName);
        // create new schema if schema not found
        if (!schema) {
            schema = new Schema({
                name: schemaName,
                note: '',
                database: this,
            });

            this.pushSchema(schema);
        }

        return schema;
    }

    findTable(rawTable) {
        const schema = this.findOrCreateSchema(rawTable.schemaName || DEFAULT_SCHEMA_NAME);
        if (!schema) {
            this.error(`Schema ${rawTable.schemaName || DEFAULT_SCHEMA_NAME} don't exist`);
        }
        return schema.findTable(rawTable.name);
    }

    export() {
        return {
            ...this.exportChild(),
        };
    }

    shallowExport() {
        return {
            hasDefaultSchema: this.hasDefaultSchema,
            note: this.note,
            databaseType: this.databaseType,
            name: this.name,
        };
    }

    exportChild() {
        return {
            schemas: this.schemas.map(s => s.export()),
        };
    }

    exportChildIds() {
        return {
            schemaIds: this.schemas.map(s => s.id),
        };
    }

    normalize() {
        const normalizedModel: NormalizedDatabase = {
            database: {
                [this.id]: {
                    id: this.id,
                    ...this.shallowExport(),
                    ...this.exportChildIds(),
                },
            },
            schemas: {},
            refs: {},
            enums: {},
            tableGroups: {},
            tables: {},
            endpoints: {},
            enumValues: {},
            indexes: {},
            indexColumns: {},
            fields: {},
        };

        this.schemas.forEach((schema) => schema.normalize(normalizedModel));
        return normalizedModel;
    }
}

export interface NormalizedDatabase {
    database: {
        [_id: number]: {
            id: number,
            hasDefaultSchema: boolean,
            note: String,
            databaseType: String,
            name: String,
            schemaIds: number[]
        }
    }
    schemas: NormalizedSchema
    refs: NormalizedRef
    enums: NormalizedEnum
    tableGroups: NormalizedTableGroup
    tables: NormalizedTable
    endpoints: NormalizedEndpoint
    enumValues: NormalizedEnumValue
    indexes: NormalizedIndex
    indexColumns: NormalizedIndexColumn
    fields: NormalizedField
}

export default Database;
