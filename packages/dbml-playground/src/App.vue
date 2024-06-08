<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { Splitpanes } from 'splitpanes';
import HeaderPane from './components/HeaderPane/HeaderPane.vue'

</script>

<template>
  <splitpanes horizontal>
    <HeaderPane />
    <RouterView />
  </splitpanes>
</template>
