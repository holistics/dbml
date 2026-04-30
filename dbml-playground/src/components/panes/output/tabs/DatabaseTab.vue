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
          <div
            v-for="(table, ti) in database.tables"
            :key="ti"
          >
            <div
              class="flex items-center gap-2 py-1 cursor-pointer hover:bg-blue-50 border-b border-gray-50"
              :style="{ paddingLeft: '20px', paddingRight: '12px' }"
              @click="toggleTable(ti)"
            >
              <PhCaretRight
                class="w-3 h-3 text-gray-400 transition-transform duration-100 flex-shrink-0"
                :class="expandedTables.has(ti) ? 'rotate-90' : ''"
              />
              <VTooltip
                placement="right"
                :distance="6"
              >
                <PhTable class="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                <template #popper>
                  <span class="text-xs">Table</span>
                </template>
              </VTooltip>
              <span class="text-blue-500 hover:underline">{{ table.name }}</span>
              <span
                v-if="table.schemaName && table.schemaName !== 'public'"
                class="text-gray-400"
              >.{{ table.schemaName }}</span>
              <span class="text-gray-400 ml-auto text-xs">{{ table.fields.length }} cols</span>
            </div>
            <div v-if="expandedTables.has(ti)">
              <!-- Columns -->
              <div
                v-for="(col, ci) in table.fields"
                :key="ci"
                class="flex items-center gap-1.5 py-1 border-b border-gray-50 hover:bg-blue-50"
                :style="{ paddingLeft: '40px', paddingRight: '12px' }"
              >
                <VTooltip
                  placement="right"
                  :distance="6"
                >
                  <PhListBullets class="w-3 h-3 text-gray-500 flex-shrink-0" />
                  <template #popper>
                    <span class="text-xs">Column</span>
                  </template>
                </VTooltip>
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
                <span class="text-green-700 ml-auto">{{ col.type.type_name }}</span>
              </div>
              <!-- Indexes -->
              <template v-if="table.indexes.length">
                <div
                  class="flex items-center gap-1.5 px-3 py-[3px] border-b border-gray-100 bg-gray-50/60 select-none"
                  :style="{ paddingLeft: '40px' }"
                >
                  <PhArrowsDownUp class="w-3 h-3 text-indigo-400 flex-shrink-0" />
                  <span class="text-[11px] text-gray-400 font-medium">indexes</span>
                </div>
                <div
                  v-for="(idx, ii) in table.indexes"
                  :key="ii"
                >
                  <div
                    class="flex items-center gap-2 py-[3px] cursor-pointer border-b border-gray-50 hover:bg-indigo-50"
                    :style="{ paddingLeft: '48px', paddingRight: '12px' }"
                    @click="toggleIndex(`${ti}-${ii}`)"
                  >
                    <PhCaretRight
                      class="w-3 h-3 text-gray-400 transition-transform duration-100 flex-shrink-0"
                      :class="expandedIndexes.has(`${ti}-${ii}`) ? 'rotate-90' : ''"
                    />
                    <VTooltip
                      placement="right"
                      :distance="6"
                    >
                      <PhArrowsDownUp class="w-3 h-3 text-indigo-400 flex-shrink-0" />
                      <template #popper>
                        <span class="text-xs">Index</span>
                      </template>
                    </VTooltip>
                    <span class="text-indigo-600 truncate">{{ idx.name || indexLabel(idx) }}</span>
                    <span class="flex gap-1 ml-auto flex-shrink-0">
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
                    </span>
                  </div>
                  <div v-if="expandedIndexes.has(`${ti}-${ii}`)">
                    <div
                      v-for="(col, ci) in idx.columns"
                      :key="ci"
                      class="flex items-center gap-2 py-[3px] border-b border-gray-50 hover:bg-indigo-50"
                      :style="{ paddingLeft: '64px', paddingRight: '12px' }"
                    >
                      <VTooltip
                        v-if="col.type === 'expression'"
                        placement="right"
                        :distance="6"
                      >
                        <PhLightning class="w-3 h-3 text-orange-400 flex-shrink-0" />
                        <template #popper>
                          <span class="text-xs">Expression</span>
                        </template>
                      </VTooltip>
                      <VTooltip
                        v-else
                        placement="right"
                        :distance="6"
                      >
                        <PhListBullets class="w-3 h-3 text-indigo-400 flex-shrink-0" />
                        <template #popper>
                          <span class="text-xs">Column ref</span>
                        </template>
                      </VTooltip>
                      <span :class="col.type === 'expression' ? 'text-orange-600 italic' : 'text-indigo-600'">{{ col.value }}</span>
                      <DbBadge
                        v-if="col.type === 'expression'"
                        label="expr"
                        color="orange"
                      />
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </DbSection>

        <!-- Refs -->
        <DbSection
          label="Refs"
          :count="database.refs.length"
          :icon="PhArrowsLeftRight"
          icon-color="text-purple-500"
        >
          <div
            v-for="(ref_, ri) in database.refs"
            :key="ri"
            class="flex items-center gap-2 py-1 border-b border-gray-50 hover:bg-blue-50"
            :style="{ paddingLeft: '20px', paddingRight: '12px' }"
          >
            <VTooltip
              placement="right"
              :distance="6"
            >
              <PhArrowsLeftRight class="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
              <template #popper>
                <span class="text-xs">Ref</span>
              </template>
            </VTooltip>
            <span class="text-blue-500">{{ endpointLabel(ref_.endpoints[0]) }}</span>
            <span class="text-gray-400">{{ ref_.endpoints[0].relation }}—{{ ref_.endpoints[1].relation }}</span>
            <span class="text-blue-500">{{ endpointLabel(ref_.endpoints[1]) }}</span>
          </div>
        </DbSection>

        <!-- Enums -->
        <DbSection
          label="Enums"
          :count="database.enums.length"
          :icon="PhTextAa"
          icon-color="text-green-600"
        >
          <div
            v-for="(en, ei) in database.enums"
            :key="ei"
          >
            <div
              class="flex items-center gap-2 py-1 cursor-pointer border-b border-gray-50 hover:bg-blue-50"
              :style="{ paddingLeft: '20px', paddingRight: '12px' }"
              @click="toggleEnum(ei)"
            >
              <PhCaretRight
                class="w-3 h-3 text-gray-400 transition-transform duration-100 flex-shrink-0"
                :class="expandedEnums.has(ei) ? 'rotate-90' : ''"
              />
              <VTooltip
                placement="right"
                :distance="6"
              >
                <PhTextAa class="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                <template #popper>
                  <span class="text-xs">Enum</span>
                </template>
              </VTooltip>
              <span class="text-green-700 hover:underline">{{ en.name }}</span>
              <span class="text-gray-400 text-xs ml-auto">{{ en.values.length }} values</span>
            </div>
            <div v-if="expandedEnums.has(ei)">
              <div
                v-for="(val, vi) in en.values"
                :key="vi"
                class="flex items-center gap-2 py-[3px] border-b border-gray-50 hover:bg-blue-50"
                :style="{ paddingLeft: '40px', paddingRight: '12px' }"
              >
                <VTooltip
                  placement="right"
                  :distance="6"
                >
                  <PhNumberSquareOne class="w-3 h-3 text-green-500 flex-shrink-0" />
                  <template #popper>
                    <span class="text-xs">Enum field</span>
                  </template>
                </VTooltip>
                <span class="text-green-700">{{ val.name }}</span>
              </div>
            </div>
          </div>
        </DbSection>

        <!-- TableGroups -->
        <DbSection
          label="TableGroups"
          :count="database.tableGroups.length"
          :icon="PhFolder"
          icon-color="text-yellow-600"
        >
          <div
            v-for="(tg, tgi) in database.tableGroups"
            :key="tgi"
            class="flex items-center gap-2 py-1 border-b border-gray-50 hover:bg-blue-50"
            :style="{ paddingLeft: '20px', paddingRight: '12px' }"
          >
            <VTooltip
              placement="right"
              :distance="6"
            >
              <PhFolder class="w-3.5 h-3.5 text-yellow-600 flex-shrink-0" />
              <template #popper>
                <span class="text-xs">TableGroup</span>
              </template>
            </VTooltip>
            <span class="text-yellow-700">{{ tg.name }}</span>
            <span class="text-gray-400 text-xs ml-auto">{{ tg.tables.length }} tables</span>
          </div>
        </DbSection>

        <!-- TablePartials -->
        <DbSection
          label="TablePartials"
          :count="database.tablePartials?.length ?? 0"
          :icon="PhPuzzlePiece"
          icon-color="text-teal-500"
        >
          <div
            v-for="(tp, tpi) in database.tablePartials"
            :key="tpi"
          >
            <div
              class="flex items-center gap-2 py-1 cursor-pointer border-b border-gray-50 hover:bg-blue-50"
              :style="{ paddingLeft: '20px', paddingRight: '12px' }"
              @click="toggleTablePartial(tpi)"
            >
              <PhCaretRight
                class="w-3 h-3 text-gray-400 transition-transform duration-100 flex-shrink-0"
                :class="expandedTablePartials.has(tpi) ? 'rotate-90' : ''"
              />
              <VTooltip
                placement="right"
                :distance="6"
              >
                <PhPuzzlePiece class="w-3.5 h-3.5 text-teal-500 flex-shrink-0" />
                <template #popper>
                  <span class="text-xs">TablePartial</span>
                </template>
              </VTooltip>
              <span class="text-teal-700 hover:underline">{{ tp.name }}</span>
              <span class="text-gray-400 ml-auto text-xs">{{ tp.fields.length }} cols</span>
            </div>
            <div v-if="expandedTablePartials.has(tpi)">
              <div
                v-for="(col, ci) in tp.fields"
                :key="ci"
                class="flex items-center gap-1.5 py-1 border-b border-gray-50 hover:bg-blue-50"
                :style="{ paddingLeft: '40px', paddingRight: '12px' }"
              >
                <VTooltip
                  placement="right"
                  :distance="6"
                >
                  <PhListBullets class="w-3 h-3 text-gray-500 flex-shrink-0" />
                  <template #popper>
                    <span class="text-xs">Column</span>
                  </template>
                </VTooltip>
                <span class="text-gray-700">{{ col.name }}</span>
                <span class="text-green-700 ml-auto">{{ col.type.type_name }}</span>
              </div>
            </div>
          </div>
        </DbSection>

        <!-- Records -->
        <DbSection
          label="Records"
          :count="database.records.length"
          :icon="PhRows"
          icon-color="text-gray-500"
        >
          <div
            v-for="(rec, ri) in database.records"
            :key="ri"
            class="flex items-center gap-2 py-1 border-b border-gray-50 hover:bg-blue-50"
            :style="{ paddingLeft: '20px', paddingRight: '12px' }"
          >
            <VTooltip
              placement="right"
              :distance="6"
            >
              <PhRows class="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
              <template #popper>
                <span class="text-xs">Record</span>
              </template>
            </VTooltip>
            <span class="text-blue-500">{{ rec.tableName }}</span>
            <span class="text-gray-400 text-xs ml-auto">{{ rec.values.length }} rows</span>
          </div>
        </DbSection>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import {
  ref, computed,
} from 'vue';
import {
  PhCaretRight,
  PhTable,
  PhListBullets,
  PhArrowsLeftRight,
  PhArrowsDownUp,
  PhTextAa,
  PhNumberSquareOne,
  PhFolder,
  PhRows,
  PhKey,
  PhLink,
  PhLightning,
  PhPuzzlePiece,
} from '@phosphor-icons/vue';
import TabSettingsButton from './common/TabSettingsButton.vue';
import type {
  Database,
} from '@dbml/parse';

type RefEndpoint = Database['refs'][number]['endpoints'][number];
type IndexEntry = Database['tables'][number]['indexes'][number];

import DbSection from './common/DbSection.vue';
import DbBadge from './common/DbBadge.vue';

interface Props {
  database: Database | undefined;
  showDecoration?: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{ 'toggle-decoration': [] }>();

const totalCount = computed(() => {
  const db = props.database;
  if (!db) return 0;
  const indexCount = db.tables.reduce((n, t) => n + t.indexes.length, 0);
  return db.tables.length + indexCount + db.refs.length + db.enums.length
    + db.tableGroups.length + (db.records?.length ?? 0) + (db.tablePartials?.length ?? 0);
});

const expandedTables = ref(new Set<number>());
const expandedEnums = ref(new Set<number>());
const expandedIndexes = ref(new Set<string>());
const expandedTablePartials = ref(new Set<number>());

function toggleTable (i: number) {
  if (expandedTables.value.has(i)) expandedTables.value.delete(i);
  else expandedTables.value.add(i);
}

function toggleEnum (i: number) {
  if (expandedEnums.value.has(i)) expandedEnums.value.delete(i);
  else expandedEnums.value.add(i);
}

function toggleIndex (key: string) {
  if (expandedIndexes.value.has(key)) expandedIndexes.value.delete(key);
  else expandedIndexes.value.add(key);
}

function toggleTablePartial (i: number) {
  if (expandedTablePartials.value.has(i)) expandedTablePartials.value.delete(i);
  else expandedTablePartials.value.add(i);
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

function colRefs (table: TableEntry, col: FieldEntry): { arrow: string;
  otherLabel: string; }[] {
  const db = props.database;
  if (!db) return [];
  const result: { arrow: string;
    otherLabel: string; }[] = [];
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
</script>
