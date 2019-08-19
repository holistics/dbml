<template>
    <div class="main">
        <ParentPage :sidebar-items="sidebarItems"/>
    </div>
</template>
<script>
import ParentPage from '@parent-theme/components/Page.vue'
export default {
  props: ['sidebarItems'],
  components: {ParentPage},
  name: 'Page'
}
</script>
<style lang="css">
  .nav-links .nav-item {
    margin-left: 2.5rem;
  }
</style>
