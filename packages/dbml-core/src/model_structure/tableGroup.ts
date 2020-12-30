import { NormalizedDatabase } from './database';
import DbState from './dbState';
import Element, { Token } from './element';
import Schema from './schema';
import Table from './table';
import { shouldPrintSchema } from './utils';

class TableGroup extends Element {
    name: String
    tables: Table[]
    schema: Schema
    dbState: DbState
    id: number

    constructor({ name, token, tables = [], schema }) {
        super(token);
        this.name = name;
        this.tables = [];
        this.schema = schema;
        this.dbState = this.schema.dbState;
        this.generateId();

        this.processTables(tables);
    }

    generateId() {
        this.id = this.dbState.generateId('tableGroupId');
    }

    processTables(rawTables) {
        rawTables.forEach((rawTable) => {
            const table = this.schema.database.findTable(rawTable);
            if (!table) {
                this.error(`Table ${rawTable.schemaName ? `"${rawTable.schemaName}".` : ''}${rawTable.name} don't exist`);
            }
            this.pushTable(table);
        });
    }

    pushTable(table) {
        this.checkTable(table);
        this.tables.push(table);
        table.group = this;
    }

    checkTable(table) {
        if (this.tables.some(t => t.id === table.id)) {
            this.error(`Table ${shouldPrintSchema(table.schema) ? `"${table.schema.name}".` : ''}.${table.name} is already in the group`);
        }

        if (table.group) {
            this.error(`Table ${shouldPrintSchema(table.schema)
                ? `"${table.schema.name}".` : ''}.${table.name} is already in group ${shouldPrintSchema(table.group.schema)
                    ? `"${table.group.schema.name}".` : ''}${table.group.name}`);
        }
    }

    export() {
        return {
            ...this.shallowExport(),
            ...this.exportChild(),
        };
    }

    exportChild() {
        return {
            tables: this.tables.map(t => ({ tableName: t.name, schemaName: t.schema.name })),
        };
    }

    exportChildIds() {
        return {
            tableIds: this.tables.map(t => t.id),
        };
    }

    exportParentIds() {
        return {
            schemaId: this.schema.id,
        };
    }

    shallowExport() {
        return {
            name: this.name,
        };
    }

    normalize(model: NormalizedDatabase) {
        model.tableGroups = {
            ...model.tableGroups,
            [this.id]: {
                id: this.id,
                ...this.shallowExport(),
                ...this.exportChildIds(),
                ...this.exportParentIds(),
            },
        };
    }
}

export interface NormalizedTableGroup {
    [_id: number]: {
        id: number
        name: String
        tableIds: number[]
        schemaId: number
    }
}

export default TableGroup;
