<template>
  <div
    class="h-full flex flex-col text-[13px]"
    style="font-family: 'SF Mono', Monaco, Consolas, monospace;"
  >
    <div
      v-if="!database"
      class="flex-1 flex items-center justify-center text-gray-400"
    >
      Fix errors to see output
    </div>
    <template v-else>
      <div class="flex-shrink-0 px-3 py-1 border-b border-gray-200 text-xs text-gray-400 flex items-center justify-between">
        <span>{{ totalCount }} elements</span>
        <TabSettingsButton
          :show-decoration="showDecoration"
          @toggle-decoration="emit('toggle-decoration')"
        />
      </div>
      <div class="flex-1 overflow-auto">
        <!-- Tables -->
        <DbSection
          label="Tables"
          :count="database.tables.length"
          :icon="PhTable"
          icon-color="text-blue-500"
        >
          <DbRow
            v-for="(table, ti) in database.tables"
            :key="ti"
            :icon="PhTable"
            icon-color="text-blue-500"
            tooltip="Table"
          >
            <span class="text-blue-500 hover:underline">{{ table.name }}</span>
            <span
              v-if="table.schemaName && table.schemaName !== 'public'"
              class="text-gray-400"
            >.{{ table.schemaName }}</span>
            <template #trailing>
              <span class="text-gray-400 text-xs">{{ table.fields.length }} cols</span>
            </template>
            <template #children>
              <!-- Columns -->
              <DbRow
                v-for="(col, ci) in table.fields"
                :key="ci"
                :icon="PhListBullets"
                tooltip="Column"
              >
                <span class="text-gray-700">{{ col.name }}</span>
                <PhKey
                  v-if="col.pk"
                  class="w-3 h-3 text-blue-400 flex-shrink-0"
                />
                <span
                  v-if="col.not_null"
                  class="text-[10px] px-1 bg-gray-100 text-gray-500 rounded font-medium leading-[14px]"
                >NN</span>
                <span
                  v-if="col.unique"
                  class="text-[10px] px-1 bg-purple-100 text-purple-600 rounded font-medium leading-[14px]"
                >U</span>
                <span
                  v-if="col.increment"
                  class="text-[10px] px-1 bg-gray-100 text-gray-500 rounded font-medium leading-[14px]"
                >AI</span>
                <VDropdown
                  v-if="colRefs(table, col).length"
                  placement="bottom-start"
                  :distance="4"
                  :arrow-padding="0"
                  no-auto-focus
                  @click.stop
                >
                  <PhLink class="w-3 h-3 text-blue-400 flex-shrink-0 cursor-pointer hover:text-blue-600" />
                  <template #popper>
                    <div
                      class="py-1 min-w-[180px] max-w-[320px]"
                      style="font-family: 'SF Mono', Monaco, Consolas, monospace;"
                    >
                      <div
                        v-for="(entry, ri) in colRefs(table, col)"
                        :key="ri"
                        class="flex items-center gap-2 px-3 py-1 text-xs"
                      >
                        <span class="text-blue-500 font-mono font-bold flex-shrink-0">{{ entry.arrow }}</span>
                        <span class="text-blue-600">{{ entry.otherLabel }}</span>
                      </div>
                    </div>
                  </template>
                </VDropdown>
                <template #trailing>
                  <span class="text-green-700">{{ col.type.type_name }}</span>
                </template>
                <template #attached>
                  <DbMetadata :metadata="col.metadata" />
                </template>
              </DbRow>
              <!-- Indexes -->
              <DbRow
                v-if="table.indexes.length"
                :icon="PhArrowsDownUp"
                icon-color="text-indigo-400"
                heading
                dense
              >
                <span class="text-[11px] text-gray-400 font-medium">indexes</span>
                <template #attached>
                  <DbRow
                    v-for="(idx, ii) in table.indexes"
                    :key="ii"
                    :icon="PhArrowsDownUp"
                    icon-color="text-indigo-400"
                    tooltip="Index"
                    hover="indigo"
                    dense
                  >
                    <span class="text-indigo-600 truncate">{{ idx.name || indexLabel(idx) }}</span>
                    <template #trailing>
                      <DbBadge
                        v-if="idx.pk"
                        label="pk"
                        color="blue"
                      />
                      <DbBadge
                        v-if="idx.unique"
                        label="unique"
                        color="purple"
                      />
                      <DbBadge
                        v-if="idx.type"
                        :label="idx.type"
                        color="indigo"
                      />
                    </template>
                    <template #children>
                      <DbRow
                        v-for="(col, ci) in idx.columns"
                        :key="ci"
                        :icon="col.type === 'expression' ? PhLightning : PhListBullets"
                        :icon-color="col.type === 'expression' ? 'text-orange-400' : 'text-indigo-400'"
                        :tooltip="col.type === 'expression' ? 'Expression' : 'Column ref'"
                        hover="indigo"
                        dense
                      >
                        <span :class="col.type === 'expression' ? 'text-orange-600 italic' : 'text-indigo-600'">{{ col.value }}</span>
                        <DbBadge
                          v-if="col.type === 'expression'"
                          label="expr"
                          color="orange"
                        />
                      </DbRow>
                    </template>
                  </DbRow>
                </template>
              </DbRow>
              <!-- Table metadata -->
              <DbMetadata :metadata="table.metadata" />
            </template>
          </DbRow>
        </DbSection>

        <!-- Refs -->
        <DbSection
          label="Refs"
          :count="database.refs.length"
          :icon="PhArrowsLeftRight"
          icon-color="text-purple-500"
        >
          <DbRow
            v-for="(ref_, ri) in database.refs"
            :key="ri"
            :icon="PhArrowsLeftRight"
            icon-color="text-purple-500"
            tooltip="Ref"
          >
            <span
              v-if="ref_.name"
              class="text-purple-700"
            >{{ ref_.name }}:</span>
            <span class="text-blue-500">{{ endpointLabel(ref_.endpoints[0]) }}</span>
            <span class="text-gray-400">{{ ref_.endpoints[0].relation }}-{{ ref_.endpoints[1].relation }}</span>
            <span class="text-blue-500">{{ endpointLabel(ref_.endpoints[1]) }}</span>
            <template
              v-if="ref_.color"
              #trailing
            >
              <span class="text-gray-400 text-xs">{{ ref_.color }}</span>
            </template>
            <template #attached>
              <DbMetadata :metadata="ref_.metadata" />
            </template>
          </DbRow>
        </DbSection>

        <!-- Deps -->
        <DbSection
          label="Deps"
          :count="database.deps.length"
          :icon="PhArrowRight"
          icon-color="text-orange-500"
        >
          <DbRow
            v-for="(dep, di) in database.deps"
            :key="di"
          >
            <span
              v-if="dep.name"
              class="text-orange-700"
            >{{ dep.name }}</span>
            <template #trailing>
              <span class="text-gray-400 text-xs">{{ dep.edges.length }} edges</span>
            </template>
            <template #children>
              <DbRow
                v-for="(edge, ei) in dep.edges"
                :key="`${di}-${ei}`"
                :icon="PhArrowRight"
                icon-color="text-orange-500"
                tooltip="Dep"
              >
                <span class="text-blue-500">{{ depEndpointLabel(edge.upstream) }}</span>
                <span class="text-gray-400">→</span>
                <span class="text-blue-500">{{ depEndpointLabel(edge.downstream) }}</span>
                <!-- A Dep's metadata is shown once, under its last edge -->
              </DbRow>
              <DbMetadata :metadata="dep.metadata" />
            </template>
          </DbRow>
        </DbSection>

        <!-- Enums -->
        <DbSection
          label="Enums"
          :count="database.enums.length"
          :icon="PhTextAa"
          icon-color="text-green-600"
        >
          <DbRow
            v-for="(en, ei) in database.enums"
            :key="ei"
            :icon="PhTextAa"
            icon-color="text-green-600"
            tooltip="Enum"
          >
            <span class="text-green-700 hover:underline">{{ en.name }}</span>
            <template #trailing>
              <span class="text-gray-400 text-xs">{{ en.values.length }} values</span>
            </template>
            <template #children>
              <DbRow
                v-for="(val, vi) in en.values"
                :key="vi"
                :icon="PhNumberSquareOne"
                icon-color="text-green-500"
                tooltip="Enum field"
                dense
              >
                <span class="text-green-700">{{ val.name }}</span>
              </DbRow>
            </template>
          </DbRow>
        </DbSection>

        <!-- TableGroups -->
        <DbSection
          label="TableGroups"
          :count="database.tableGroups.length"
          :icon="PhFolder"
          icon-color="text-yellow-600"
        >
          <DbRow
            v-for="(tg, tgi) in database.tableGroups"
            :key="tgi"
            :icon="PhFolder"
            icon-color="text-yellow-600"
            tooltip="TableGroup"
          >
            <span class="text-yellow-700">{{ tg.name }}</span>
            <template #trailing>
              <span class="text-gray-400 text-xs">{{ tg.tables.length }} tables</span>
            </template>
            <template #attached>
              <DbMetadata :metadata="tg.metadata" />
            </template>
          </DbRow>
        </DbSection>

        <!-- TablePartials -->
        <DbSection
          label="TablePartials"
          :count="database.tablePartials?.length ?? 0"
          :icon="PhPuzzlePiece"
          icon-color="text-teal-500"
        >
          <DbRow
            v-for="(tp, tpi) in database.tablePartials"
            :key="tpi"
            :icon="PhPuzzlePiece"
            icon-color="text-teal-500"
            tooltip="TablePartial"
          >
            <span class="text-teal-700 hover:underline">{{ tp.name }}</span>
            <template #trailing>
              <span class="text-gray-400 text-xs">{{ tp.fields.length }} cols</span>
            </template>
            <template #children>
              <DbRow
                v-for="(col, ci) in tp.fields"
                :key="ci"
                :icon="PhListBullets"
                tooltip="Column"
              >
                <span class="text-gray-700">{{ col.name }}</span>
                <template #trailing>
                  <span class="text-green-700">{{ col.type.type_name }}</span>
                </template>
              </DbRow>
            </template>
          </DbRow>
        </DbSection>

        <!-- Records -->
        <DbSection
          label="Records"
          :count="database.records.length"
          :icon="PhRows"
          icon-color="text-gray-500"
        >
          <DbRow
            v-for="(rec, ri) in database.records"
            :key="ri"
            :icon="PhRows"
            tooltip="Record"
          >
            <span class="text-blue-500">{{ rec.tableName }}</span>
            <template #trailing>
              <span class="text-gray-400 text-xs">{{ rec.values.length }} rows</span>
            </template>
          </DbRow>
        </DbSection>

        <!-- Notes (Sticky Notes) -->
        <DbSection
          v-if="database.notes?.length"
          label="Notes"
          :count="database.notes.length"
          :icon="PhNote"
          icon-color="text-yellow-500"
        >
          <DbRow
            v-for="(note, ni) in database.notes"
            :key="ni"
            :icon="PhNote"
            icon-color="text-yellow-500"
            tooltip="Sticky Note"
          >
            <span class="text-blue-500">{{ note.name }}</span>
            <template #attached>
              <DbMetadata :metadata="note.metadata" />
            </template>
          </DbRow>
        </DbSection>

        <!-- DiagramViews -->
        <DbSection
          label="DiagramViews"
          :count="database.diagramViews?.length ?? 0"
          :icon="PhLayout"
          icon-color="text-pink-500"
        >
          <DbRow
            v-for="(dv, dvi) in database.diagramViews"
            :key="dvi"
            :icon="PhLayout"
            icon-color="text-pink-500"
            tooltip="DiagramView"
          >
            <span class="text-pink-600">{{ dv.name }}</span>
            <span
              v-if="dv.schemaName && dv.schemaName !== 'public'"
              class="text-gray-400"
            >.{{ dv.schemaName }}</span>
            <template #trailing>
              <span class="text-gray-400 text-xs">{{ diagramViewMemberCount(dv) }} members</span>
            </template>
            <template #children>
              <template
                v-for="(items, kind) in diagramViewMembers(dv)"
                :key="kind"
              >
                <DbRow
                  v-for="(item, ii) in items"
                  :key="`${kind}-${ii}`"
                  hover="pink"
                  dense
                >
                  <span class="text-pink-500">{{ item.name }}</span>
                  <template #trailing>
                    <span class="text-gray-400 text-xs">{{ kind }}</span>
                  </template>
                </DbRow>
              </template>
              <DbRow
                v-if="diagramViewMemberCount(dv) === 0"
                hover="pink"
                dense
              >
                <span class="text-gray-400 text-xs italic">show all (no filter)</span>
              </DbRow>
            </template>
          </DbRow>
        </DbSection>

        <!-- Externals -->
        <DbSection
          label="Externals"
          :count="externalsCount"
          :icon="PhArrowSquareOut"
          icon-color="text-orange-500"
        >
          <template
            v-for="(entries, category) in externalCategories"
            :key="category"
          >
            <DbRow
              v-for="(ext, ei) in entries"
              :key="`${category}-${ei}`"
              :icon="externalIcon(String(category))"
              :icon-color="externalIconColor(String(category))"
              :tooltip="String(category)"
            >
              <span class="text-orange-600">{{ ext.name }}</span>
              <span
                v-if="ext.schemaName"
                class="text-gray-400"
              >.{{ ext.schemaName }}</span>
              <DbBadge
                label="external"
                color="orange"
              />
            </DbRow>
          </template>
        </DbSection>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  PhTable,
  PhListBullets,
  PhArrowsLeftRight,
  PhArrowsDownUp,
  PhArrowRight,
  PhTextAa,
  PhNumberSquareOne,
  PhFolder,
  PhRows,
  PhKey,
  PhLink,
  PhLightning,
  PhPuzzlePiece,
  PhLayout,
  PhArrowSquareOut,
  PhNote,
} from '@phosphor-icons/vue';
import TabSettingsButton from './common/TabSettingsButton.vue';
import type { Database } from '@dbml/parse';

type RefEndpoint = Database['refs'][number]['endpoints'][number];
type DepEndpoint = NonNullable<Database['deps']>[number]['edges'][number]['upstream'];
type IndexEntry = Database['tables'][number]['indexes'][number];

import DbSection from './common/DbSection.vue';
import DbRow from './common/DbRow.vue';
import DbBadge from './common/DbBadge.vue';
import DbMetadata from './common/DbMetadata.vue';

const {
  database,
  showDecoration = false,
} = defineProps<{
  database: Database | undefined;
  showDecoration?: boolean;
}>();
const emit = defineEmits<{ 'toggle-decoration': [] }>();

const externalCategories = computed(() => {
  const ext = database?.externals;
  if (!ext) return {};
  const cats: Record<string, typeof ext.tables> = {};
  if (ext.tables.length) cats.table = ext.tables;
  if (ext.enums.length) cats.enum = ext.enums;
  if (ext.tableGroups.length) cats.tableGroup = ext.tableGroups;
  if (ext.tablePartials.length) cats.tablePartial = ext.tablePartials;
  if (ext.notes.length) cats.note = ext.notes;
  return cats;
});

const externalsCount = computed(() => {
  const ext = database?.externals;
  if (!ext) return 0;
  return ext.tables.length + ext.enums.length + ext.tableGroups.length
    + ext.tablePartials.length + ext.notes.length;
});

const totalCount = computed(() => {
  const db = database;
  if (!db) return 0;
  const indexCount = db.tables.reduce((n, t) => n + t.indexes.length, 0);
  return db.tables.length + indexCount + db.refs.length + (db.deps?.length ?? 0) + db.enums.length
    + db.tableGroups.length + (db.records?.length ?? 0) + (db.tablePartials?.length ?? 0)
    + (db.notes?.length ?? 0) + (db.diagramViews?.length ?? 0) + externalsCount.value;
});

type DiagramViewEntry = Database['diagramViews'][number];

function diagramViewMembers (dv: DiagramViewEntry): Record<string, Array<{ name: string }>> {
  const result: Record<string, Array<{ name: string }>> = {};
  const ve = dv.visibleEntities;
  if (ve.tables && ve.tables.length > 0) result.table = ve.tables.map((t) => ({ name: t.schemaName ? `${t.schemaName}.${t.name}` : t.name }));
  if (ve.stickyNotes && ve.stickyNotes.length > 0) result.note = ve.stickyNotes;
  if (ve.tableGroups && ve.tableGroups.length > 0) result.tableGroup = ve.tableGroups;
  if (ve.schemas && ve.schemas.length > 0) result.schema = ve.schemas;
  return result;
}

function diagramViewMemberCount (dv: DiagramViewEntry): number {
  const ve = dv.visibleEntities;
  return (ve.tables?.length ?? 0) + (ve.stickyNotes?.length ?? 0)
    + (ve.tableGroups?.length ?? 0) + (ve.schemas?.length ?? 0);
}

function externalIcon (category: string) {
  switch (category) {
    case 'table': return PhTable;
    case 'enum': return PhTextAa;
    case 'tableGroup': return PhFolder;
    case 'tablePartial': return PhPuzzlePiece;
    case 'note': return PhNote;
    default: return PhArrowSquareOut;
  }
}

function externalIconColor (category: string): string {
  switch (category) {
    case 'table': return 'text-blue-500';
    case 'enum': return 'text-green-600';
    case 'tableGroup': return 'text-yellow-600';
    case 'tablePartial': return 'text-teal-500';
    case 'note': return 'text-yellow-500';
    default: return 'text-orange-500';
  }
}

function indexLabel (idx: IndexEntry): string {
  return idx.columns.map((c) => c.type === 'expression' ? `\`${c.value}\`` : c.value).join(', ');
}

type TableEntry = Database['tables'][number];
type FieldEntry = TableEntry['fields'][number];

function relArrow (myRel: string, otherRel: string): string {
  if (myRel === '1' && otherRel === '*') return '>';
  if (myRel === '*' && otherRel === '1') return '<';
  if (myRel === '1' && otherRel === '1') return '-';
  return '<>';
}

function epLabel (ep: RefEndpoint): string {
  const cols = ep.fieldNames.length === 1 ? ep.fieldNames[0] : `(${ep.fieldNames.join(', ')})`;
  return ep.schemaName && ep.schemaName !== 'public'
    ? `${ep.schemaName}.${ep.tableName}.${cols}`
    : `${ep.tableName}.${cols}`;
}

function colRefs (table: TableEntry, col: FieldEntry): {
  arrow: string;
  otherLabel: string;
}[] {
  const db = database;
  if (!db) return [];
  const result: {
    arrow: string;
    otherLabel: string;
  }[] = [];
  for (const ref of db.refs) {
    for (let i = 0; i < ref.endpoints.length; i++) {
      const ep = ref.endpoints[i];
      if (ep.tableName === table.name && ep.fieldNames.includes(col.name)) {
        const other = ref.endpoints[1 - i];
        result.push({
          arrow: relArrow(ep.relation, other.relation),
          otherLabel: epLabel(other),
        });
      }
    }
  }
  return result;
}

function endpointLabel (ep: RefEndpoint): string {
  const fields = ep.fieldNames.length === 1 ? ep.fieldNames[0] : `(${ep.fieldNames.join(', ')})`;
  return ep.schemaName ? `${ep.schemaName}.${ep.tableName}.${fields}` : `${ep.tableName}.${fields}`;
}

function depEndpointLabel (ep: DepEndpoint): string {
  const base = ep.schemaName ? `${ep.schemaName}.${ep.tableName}` : ep.tableName;
  if (ep.fieldNames.length === 0) return base;
  const fields = ep.fieldNames.length === 1 ? ep.fieldNames[0] : `(${ep.fieldNames.join(', ')})`;
  return `${base}.${fields}`;
}
</script>
