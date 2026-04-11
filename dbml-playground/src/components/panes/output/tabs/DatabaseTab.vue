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
      <div class="flex-shrink-0 px-3 py-1 border-b border-gray-200 text-xs text-gray-400">
        {{ database.tables.length }} tables · {{ database.refs.length }} refs · {{ database.enums.length }} enums
      </div>
      <div class="flex-1 overflow-auto">
        <!-- Tables -->
        <DbSection
          label="Tables"
          :count="database.tables.length"
        >
          <div
            v-for="(table, ti) in database.tables"
            :key="ti"
          >
            <div
              class="flex items-center gap-2 px-3 py-[3px] cursor-pointer hover:bg-blue-50 border-b border-gray-50"
              :style="{ paddingLeft: '20px' }"
              @click="toggleTable(ti)"
            >
              <ChevronRightIcon
                class="w-3 h-3 text-gray-400 transition-transform duration-100 flex-shrink-0"
                :class="expandedTables.has(ti) ? 'rotate-90' : ''"
              />
              <span class="text-blue-500 hover:underline">{{ table.name }}</span>
              <span
                v-if="table.schemaName && table.schemaName !== 'public'"
                class="text-gray-400"
              >.{{ table.schemaName }}</span>
              <span class="text-gray-400 ml-auto">[ {{ table.fields.length }} ]</span>
            </div>
            <div v-if="expandedTables.has(ti)">
              <div
                v-for="(col, ci) in table.fields"
                :key="ci"
                class="flex items-center gap-2 px-3 py-[2px] border-b border-gray-50 hover:bg-blue-50"
                :style="{ paddingLeft: '40px' }"
              >
                <span class="text-gray-700 min-w-[100px]">{{ col.name }}</span>
                <span class="text-green-700">{{ col.type.type_name }}</span>
                <span class="ml-auto flex gap-1">
                  <DbBadge
                    v-if="col.pk"
                    label="pk"
                    color="blue"
                  />
                  <DbBadge
                    v-if="col.not_null"
                    label="not null"
                    color="gray"
                  />
                  <DbBadge
                    v-if="col.unique"
                    label="unique"
                    color="purple"
                  />
                  <DbBadge
                    v-if="col.increment"
                    label="incr"
                    color="gray"
                  />
                </span>
              </div>
              <div
                v-if="table.indexes.length"
                class="flex items-center gap-2 px-3 py-[2px] border-b border-gray-50 text-gray-400"
                :style="{ paddingLeft: '40px' }"
              >
                indexes: <span
                  v-for="(idx, ii) in table.indexes"
                  :key="ii"
                  class="text-gray-500"
                >{{ idx.name || idx.columns.map(c => c.value).join(', ') }}</span>
              </div>
            </div>
          </div>
        </DbSection>

        <!-- Refs -->
        <DbSection
          label="Refs"
          :count="database.refs.length"
        >
          <div
            v-for="(ref_, ri) in database.refs"
            :key="ri"
            class="flex items-center gap-2 px-3 py-[3px] border-b border-gray-50 hover:bg-blue-50"
            :style="{ paddingLeft: '20px' }"
          >
            <span class="text-blue-500">{{ endpointLabel(ref_.endpoints[0]) }}</span>
            <span class="text-gray-400">{{ ref_.endpoints[0].relation }}—{{ ref_.endpoints[1].relation }}</span>
            <span class="text-blue-500">{{ endpointLabel(ref_.endpoints[1]) }}</span>
          </div>
        </DbSection>

        <!-- Enums -->
        <DbSection
          label="Enums"
          :count="database.enums.length"
        >
          <div
            v-for="(en, ei) in database.enums"
            :key="ei"
          >
            <div
              class="flex items-center gap-2 px-3 py-[3px] cursor-pointer border-b border-gray-50 hover:bg-blue-50"
              :style="{ paddingLeft: '20px' }"
              @click="toggleEnum(ei)"
            >
              <ChevronRightIcon
                class="w-3 h-3 text-gray-400 transition-transform duration-100 flex-shrink-0"
                :class="expandedEnums.has(ei) ? 'rotate-90' : ''"
              />
              <span class="text-blue-500 hover:underline">{{ en.name }}</span>
              <span class="text-gray-400 ml-auto">[ {{ en.values.length }} ]</span>
            </div>
            <div v-if="expandedEnums.has(ei)">
              <div
                v-for="(val, vi) in en.values"
                :key="vi"
                class="flex items-center px-3 py-[2px] border-b border-gray-50 hover:bg-blue-50"
                :style="{ paddingLeft: '40px' }"
              >
                <span class="text-green-700">{{ val.name }}</span>
              </div>
            </div>
          </div>
        </DbSection>

        <!-- TableGroups -->
        <DbSection
          v-if="database.tableGroups.length"
          label="TableGroups"
          :count="database.tableGroups.length"
        >
          <div
            v-for="(tg, tgi) in database.tableGroups"
            :key="tgi"
            class="flex items-center gap-2 px-3 py-[3px] border-b border-gray-50 hover:bg-blue-50"
            :style="{ paddingLeft: '20px' }"
          >
            <span class="text-blue-500">{{ tg.name }}</span>
            <span class="text-gray-400">[ {{ tg.tables.length }} tables ]</span>
          </div>
        </DbSection>

        <!-- Records -->
        <DbSection
          v-if="database.records.length"
          label="Records"
          :count="database.records.length"
        >
          <div
            v-for="(rec, ri) in database.records"
            :key="ri"
            class="flex items-center gap-2 px-3 py-[3px] border-b border-gray-50 hover:bg-blue-50"
            :style="{ paddingLeft: '20px' }"
          >
            <span class="text-blue-500">{{ rec.tableName }}</span>
            <span class="text-gray-400 ml-auto">[ {{ rec.values.length }} rows ]</span>
          </div>
        </DbSection>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ChevronRightIcon } from '@heroicons/vue/24/outline';
import type { Database } from '@dbml/parse';

type RefEndpoint = Database['refs'][number]['endpoints'][number];
import DbSection from './DbSection.vue';
import DbBadge from './DbBadge.vue';

interface Props {
  database: Database | null;
}

const props = defineProps<Props>();

const expandedTables = ref(new Set<number>());
const expandedEnums = ref(new Set<number>());

function toggleTable (i: number) {
  if (expandedTables.value.has(i)) expandedTables.value.delete(i);
  else expandedTables.value.add(i);
}

function toggleEnum (i: number) {
  if (expandedEnums.value.has(i)) expandedEnums.value.delete(i);
  else expandedEnums.value.add(i);
}

function endpointLabel (ep: RefEndpoint): string {
  const fields = ep.fieldNames.length === 1 ? ep.fieldNames[0] : `(${ep.fieldNames.join(', ')})`;
  return ep.schemaName ? `${ep.schemaName}.${ep.tableName}.${fields}` : `${ep.tableName}.${fields}`;
}
</script>
