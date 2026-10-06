<template>
  <VBtn
    v-bind="$attrs"
    icon
    :color="playbackManager.isShuffling.value ? 'primary' : undefined"
    @click="shuffle">
    <JIcon
      v-bind="$attrs"
      class="i-mdi:shuffle" />
  </VBtn>
</template>

<script setup lang="ts">
import { playbackManager } from '#/store/playback-manager.ts';
const shuffle = () => playbackManager.toggleShuffle();
</script>
