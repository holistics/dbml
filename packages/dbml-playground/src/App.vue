<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { Splitpanes } from 'splitpanes';
import HeaderPane from './components/HeaderPane/HeaderPane.vue'

</script>

<template>
  <splitpanes horizontal>
    <HeaderPane>
      <RouterLink to="/">DBML Playground</RouterLink> 
    </HeaderPane>
    <RouterView />
  </splitpanes>
</template>
