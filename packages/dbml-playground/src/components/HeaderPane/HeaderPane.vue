<template>
  <pane>
    <img :src='DbmlLogoUrl' width=60 height=60/>
    <slot/>
  </pane>
</template>

<script setup lang="ts">
  import { Pane } from 'splitpanes';
  import DbmlLogoUrl from '../../assets/images/dbml-logo.png';
</script>

