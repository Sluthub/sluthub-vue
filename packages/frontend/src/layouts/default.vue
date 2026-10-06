<template>
  <AppBar />
  <NavigationDrawer
    :order="display.mobile.value ? -1 : undefined"
    :drawer-items="drawerItems as DrawerItem[]" />
  <JMain>
    <div class="pa-s">
      <slot />
    </div>
  </JMain>
  <AudioControls />
  <MiniVideoPlayer
    v-if="
      playbackManager.isVideo.value
    " />
</template>

<script setup lang="ts">
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client';
import { getUserViewsApi } from '@jellyfin/sdk/lib/utils/api/user-views-api';
import { computed, provide, ref, watch } from 'vue';
import { useDisplay } from 'vuetify';
import type { DrawerItem } from '#/components/Layout/Navigation/NavigationDrawer.vue';
import { playbackManager } from '#/store/playback-manager.ts';
import { getLibraryIcon } from '#/utils/items.ts';
import { useBaseItem } from '#/composables/apis.ts';

const display = useDisplay();
const navDrawer = ref(!display.mobile.value);

// The sidebar needs library names only. Home's rich resume/latest/next-up requests belong to Home.
const { data: views } = await useBaseItem(getUserViewsApi, 'getUserViews')();

const drawerItems = computed<DrawerItem[]>(() => {
  return views.value.map((view: BaseItemDto) => {
    return {
      icon: getLibraryIcon(view.CollectionType),
      title: view.Name ?? '',
      to: `/library/${view.Id}`
    };
  });
});

watch(display.mobile, () => {
  navDrawer.value = !display.mobile.value;
});

provide('NavigationDrawer', navDrawer);
</script>
