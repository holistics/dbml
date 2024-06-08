<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { Splitpanes } from 'splitpanes';
import Header from './components/Header/Header.vue'
</script>

<template>
  <Header />
  <main class='w-full h-full'>
    <RouterView class='w-full h-full'/>
  </main>
</template>
