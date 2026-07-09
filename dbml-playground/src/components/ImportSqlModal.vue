<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40"
      @click.self="$emit('update:modelValue', false)"
    >
      <div class="bg-white rounded-lg shadow-xl w-[520px] max-h-[80vh] flex flex-col overflow-hidden">
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 class="text-sm font-semibold text-gray-800">
            Import SQL
          </h2>
          <button
            class="text-gray-400 hover:text-gray-600 cursor-pointer p-1 rounded transition-colors"
            @click="$emit('update:modelValue', false)"
          >
            <PhX class="w-4 h-4" />
          </button>
        </div>

        <!-- Body -->
        <div class="flex flex-col gap-3 p-4 flex-1 overflow-auto">
          <!-- Format selector -->
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">Format</label>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="fmt in FORMATS"
                :key="fmt.value"
                class="px-2.5 py-1 rounded text-xs border transition-colors cursor-pointer"
                :class="selectedFormat === fmt.value
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600'"
                @click="selectedFormat = fmt.value"
              >
                {{ fmt.label }}
              </button>
            </div>
          </div>

          <!-- SQL input -->
          <div class="flex flex-col flex-1">
            <label class="block text-xs font-medium text-gray-600 mb-1">SQL</label>
            <textarea
              v-model="sqlContent"
              class="flex-1 min-h-[240px] w-full font-mono text-xs border border-gray-200 rounded p-2 resize-none outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 text-gray-800"
              placeholder="Paste SQL DDL here..."
            />
          </div>

          <!-- Error -->
          <p
            v-if="error"
            class="text-xs text-red-600 bg-red-50 rounded px-2 py-1.5"
          >
            {{ error }}
          </p>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200">
          <button
            class="text-xs px-3 py-1.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors"
            @click="$emit('update:modelValue', false)"
          >
            Cancel
          </button>
          <button
            class="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!sqlContent.trim()"
            @click="doImport"
          >
            Import
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { PhX } from '@phosphor-icons/vue';
import { importer } from '@dbml/core';

const FORMATS = [
  { value: 'postgres', label: 'PostgreSQL' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'mssql', label: 'SQL Server' },
  { value: 'snowflake', label: 'Snowflake' },
  { value: 'oracle', label: 'Oracle' },
] as const;

type ImportFormat = typeof FORMATS[number]['value'];

defineProps<{ modelValue: boolean }>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'import': [dbml: string];
}>();

const selectedFormat = ref<ImportFormat>('postgres');
const sqlContent = ref('');
const error = ref('');

function doImport () {
  error.value = '';
  try {
    const dbml = importer.import(sqlContent.value, selectedFormat.value);
    emit('import', dbml);
    emit('update:modelValue', false);
    sqlContent.value = '';
  } catch (e: any) {
    const diags = e?.diags;
    if (Array.isArray(diags) && diags.length > 0) {
      error.value = diags[0].message ?? 'Import failed.';
    } else {
      error.value = 'Import failed. Check that your SQL matches the selected format.';
    }
  }
}
</script>
