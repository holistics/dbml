import Database from '../../../src/model_structure/database';
import jsonDb from './dep.json';
import { test, expect, describe, beforeAll } from 'vitest';

describe('@dbml/core - Dep model', () => {
  let database: Database;
  beforeAll(() => {
    database = new Database(jsonDb as any);
  });

  describe('schema.deps', () => {
    test('public schema has 3 deps', () => {
      const pub = database.schemas.find((s) => s.name === 'public')!;
      expect(pub.deps).toHaveLength(3);
    });
  });

  describe('Dep #1 — bare-table endpoints', () => {
    test('1 edge with empty fieldNames on both endpoints', () => {
      const dep = database.schemas[0].deps[0];
      expect(dep.edges).toHaveLength(1);
      expect(dep.edges[0].upstream.tableName).toBe('raw_orders');
      expect(dep.edges[0].upstream.fieldNames).toEqual([]);
      expect(dep.edges[0].downstream.tableName).toBe('stg_orders');
      expect(dep.edges[0].downstream.fieldNames).toEqual([]);
    });

    test('no note, no custom', () => {
      const dep = database.schemas[0].deps[0];
      expect(dep.note).toBeNull();
      expect(dep.custom).toBeNull();
    });
  });

  describe('Dep #2 — multi-edge with note + custom', () => {
    test('2 edges; first is bare-bare, second is column-level', () => {
      const dep = database.schemas[0].deps[1];
      expect(dep.edges).toHaveLength(2);
      expect(dep.edges[0].upstream.fieldNames).toEqual([]);
      expect(dep.edges[0].downstream.fieldNames).toEqual([]);
      expect(dep.edges[1].upstream.fieldNames).toEqual(['id']);
      expect(dep.edges[1].downstream.fieldNames).toEqual(['amount']);
    });

    test('note + custom carried correctly', () => {
      const dep = database.schemas[0].deps[1];
      expect(dep.note).toBe('Aggregate staging into facts');
      expect(dep.custom).toEqual({ materialized: 'table', owner: 'data-team' });
    });
  });

  describe('Dep #3 — schema-qualified, cross-schema', () => {
    test('upstream is analytics.events.ts, downstream is public.fct_orders.id', () => {
      const dep = database.schemas[0].deps[2];
      expect(dep.edges).toHaveLength(1);
      const edge = dep.edges[0];
      expect(edge.upstream.schemaName).toBe('analytics');
      expect(edge.upstream.tableName).toBe('events');
      expect(edge.upstream.fieldNames).toEqual(['ts']);
      expect(edge.downstream.schemaName).toBe('public');
      expect(edge.downstream.tableName).toBe('fct_orders');
      expect(edge.downstream.fieldNames).toEqual(['id']);
    });
  });

  describe('DepEdge — table + field resolution', () => {
    test('bare-table edge resolves upstreamTable / downstreamTable, empty fields arrays', () => {
      const edge = database.schemas[0].deps[0].edges[0];
      expect(edge.upstreamTable?.name).toBe('raw_orders');
      expect(edge.downstreamTable?.name).toBe('stg_orders');
      expect(edge.upstreamFields).toEqual([]);
      expect(edge.downstreamFields).toEqual([]);
    });

    test('column-level edge resolves to actual Field instances', () => {
      const edge = database.schemas[0].deps[1].edges[1];
      expect(edge.upstreamFields).toHaveLength(1);
      expect(edge.upstreamFields[0].name).toBe('id');
      expect(edge.downstreamFields).toHaveLength(1);
      expect(edge.downstreamFields[0].name).toBe('amount');
    });

    test('schema-qualified edge resolves table from non-public schema', () => {
      const edge = database.schemas[0].deps[2].edges[0];
      const analyticsSchema = database.schemas.find((s) => s.name === 'analytics');
      const eventsTable = analyticsSchema?.tables.find((t) => t.name === 'events');
      expect(edge.upstreamTable).toBe(eventsTable);
      expect(edge.upstreamFields[0].name).toBe('ts');
    });
  });

  describe('normalize', () => {
    test('model.deps populated with all 3 Dep records', () => {
      const model = database.normalize();
      const deps = Object.values(model.deps);
      expect(deps).toHaveLength(3);
    });

    test('each Dep record has a numeric id and edgeIds pointing to existing depEdges', () => {
      const model = database.normalize();
      const deps = Object.values(model.deps);
      deps.forEach((dep: any) => {
        expect(typeof dep.id).toBe('number');
        expect(dep.edgeIds).toBeDefined();
        expect(dep.edgeIds.length).toBeGreaterThan(0);
        dep.edgeIds.forEach((eid: number) => {
          expect(typeof eid).toBe('number');
          expect(model.depEdges[eid]).toBeDefined();
        });
      });
    });

    test('depEdge carries full upstream + downstream data (tableName, schemaName, fieldNames)', () => {
      const model = database.normalize();
      const dep3 = Object.values(model.deps).find((d: any) => d.edgeIds.length === 1 && model.depEdges[d.edgeIds[0]].upstream.schemaName === 'analytics') as any;
      expect(dep3).toBeDefined();
      const edge = model.depEdges[dep3.edgeIds[0]];
      expect(edge.upstream.schemaName).toBe('analytics');
      expect(edge.upstream.tableName).toBe('events');
      expect(edge.upstream.fieldNames).toEqual(['ts']);
      expect(edge.downstream.schemaName).toBe('public');
      expect(edge.downstream.tableName).toBe('fct_orders');
      expect(edge.downstream.fieldNames).toEqual(['id']);
    });

    test('normalize preserves note + custom on the dep record', () => {
      const model = database.normalize();
      const depWithCustom = Object.values(model.deps).find((d: any) => d.custom) as any;
      expect(depWithCustom).toBeDefined();
      expect(depWithCustom.note).toBe('Aggregate staging into facts');
      expect(depWithCustom.custom).toEqual({ materialized: 'table', owner: 'data-team' });
    });

    test('depEdge.depId points back to its parent dep', () => {
      const model = database.normalize();
      Object.values(model.deps).forEach((dep: any) => {
        dep.edgeIds.forEach((eid: number) => {
          expect(model.depEdges[eid].depId).toBe(dep.id);
        });
      });
    });
  });
});
