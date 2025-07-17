<template>
  <div class="w-full h-full overflow-auto bg-white border border-gray-200 rounded-md">
    <div v-if="!data" class="p-4 text-gray-500 text-center">
      No data to display
    </div>
    <div v-else class="p-4">
      <JsonViewer
        :value="data"
        :expand-depth="2"
        copyable
        sort
        boxed
        theme="json-viewer-light"
        preview-mode
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
// @ts-ignore: No type definitions available for vue-json-viewer
import JsonViewer from 'vue-json-viewer'
import 'vue-json-viewer/style.css'

interface Props {
  data: any
  title?: string
}

const props = defineProps<Props>()

// Ensure data is properly formatted for the JSON viewer
const data = computed(() => {
  if (!props.data) return null
  
  // If it's already an object, return as-is
  if (typeof props.data === 'object') {
    return props.data
  }
  
  // If it's a string, try to parse as JSON
  if (typeof props.data === 'string') {
    try {
      return JSON.parse(props.data)
    } catch {
      return { value: props.data }
    }
  }
  
  // For other types, wrap in an object
  return { value: props.data }
})
</script>

<style>
/* Custom styles for the JSON viewer */
.json-viewer-light {
  background-color: #ffffff !important;
  border: none !important;
}

.json-viewer .jv-item {
  margin: 2px 0;
}

.json-viewer .jv-key {
  color: #881391 !important;
  font-weight: 600;
}

.json-viewer .jv-string {
  color: #c41a16 !important;
}

.json-viewer .jv-number {
  color: #1c00cf !important;
}

.json-viewer .jv-boolean {
  color: #0d73cc !important;
}

.json-viewer .jv-null {
  color: #8e8e93 !important;
}

.json-viewer .jv-item.jv-array,
.json-viewer .jv-item.jv-object {
  border-left: 1px dotted #d1d5da;
  margin-left: 8px;
  padding-left: 12px;
}

.json-viewer .jv-toggle {
  background-color: #f6f8fa;
  border: 1px solid #d1d5da;
  border-radius: 3px;
  color: #586069;
  cursor: pointer;
  margin-right: 8px;
  padding: 2px 4px;
  font-size: 12px;
  line-height: 1;
  user-select: none;
}

.json-viewer .jv-toggle:hover {
  background-color: #e1e4e8;
  border-color: #c6cbd1;
}

.json-viewer .jv-node .jv-node {
  margin-left: 0;
}

/* Copy button styling */
.json-viewer .jv-copy {
  background-color: #f6f8fa;
  border: 1px solid #d1d5da;
  border-radius: 3px;
  color: #586069;
  cursor: pointer;
  font-size: 12px;
  margin-left: 8px;
  padding: 2px 6px;
}

.json-viewer .jv-copy:hover {
  background-color: #e1e4e8;
  border-color: #c6cbd1;
}

/* Scrollbar styling */
.json-viewer::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.json-viewer::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.json-viewer::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 4px;
}

.json-viewer::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}
</style> 