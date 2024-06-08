<template>
  <pane class='border-b-[1px] border-b-gray-300 bg-white h-16 p-4 flex justify-between' role='navigation'>
    <div class='flex gap-2'> 
      <div role='banner' class='flex flex-row items-center gap-2'>
        <img :src='DbmlLogoUrl' width=24 />
        <p class='font-bold'>dbx / DBML Playground</p>
      </div>
    </div>
  </pane>
</template>

<script setup lang="ts">
  import { Pane } from 'splitpanes';
  import DbmlLogoUrl from '../../assets/images/dbml-logo.png';
</script>

