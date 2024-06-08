<template>
  <nav class='border-b-[1px] border-b-white bg-black h-16 p-4 flex justify-between'>
    <div role='banner' class='flex flex-row items-center gap-2'>
      <img :src='DbmlLogoUrl' width=24 />
      <p class='font-bold text-white'>dbx / DBML Playground</p>
    </div>
  </nav>
</template>

<script setup lang="ts">
  import { Pane } from 'splitpanes';
  import DbmlLogoUrl from '../../assets/images/dbml-logo.png';
</script>

