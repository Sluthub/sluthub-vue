<template>
  <VBtn
    v-bind="$attrs"
    icon
    @click.passive="previous"
    @dblclick.passive="forcePrevious">
    <JIcon
      v-bind="$attrs"
      class="i-mdi:skip-previous" />
  </VBtn>
</template>

<script setup lang="ts">
import { playbackManager } from '#/store/playback-manager.ts';
const previous = () => playbackManager.setPreviousItem();
const forcePrevious = () => playbackManager.setPreviousItem(true);
</script>
