<template>
  <div>
    <VAppBar
      flat
      density="compact"
      :class="useResponsiveClasses('second-toolbar')">
      <span class="text-h6 hidden-sm-and-down">
        {{ genre.Name }}
      </span>
      <VSpacer />
      <PlayButton
        :item="genre" />
      <VBtn
        class="mr-2 play-button"
        min-width="8em"
        variant="outlined"
        :to="`./${genre.Id}/shuffle`">
        {{ $t('shuffleAll') }}
      </VBtn>
    </VAppBar>
    <VContainer class="after-second-toolbar">
      <ItemGrid
        v-if="genres.length"
        :items="genres" />
      <VRow
        justify="center">
        <VCol
          cols="12"
          :class="
            useResponsiveClasses('card-grid-container empty-card-container')
          ">
          <SkeletonCard
            v-for="n in 24"
            :key="n"

            text
            boilerplate />
        </VCol>
        <div class="text-center empty-message">
          <h1 class="text-h5">
            {{ $t('libraryEmpty') }}
          </h1>
        </div>
      </VRow>
    </VContainer>
  </div>
</template>

<script setup lang="ts">
import {
  SortOrder,
  type BaseItemKind
} from '@jellyfin/sdk/lib/generated-client';
import { getItemsApi } from '@jellyfin/sdk/lib/utils/api/items-api';
import { getUserLibraryApi } from '@jellyfin/sdk/lib/utils/api/user-library-api';
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { isStr } from '@jellyfin-vue/shared/validation';
import { useResponsiveClasses } from '#/composables/use-responsive-classes';
import { useBaseItem } from '#/composables/apis';
import { useItemPageTitle } from '#/composables/page-title';

const route = useRoute('/genre/[itemId]');

const { itemId } = (route.params).itemId.replaceAll('-', '');

const includeItemTypes = computed<BaseItemKind[]>(() => {
  const typesQuery = (route.query.type ?? []) as BaseItemKind[];

  return isStr(typesQuery)
    ? [typesQuery] as BaseItemKind[]
    : typesQuery;
});

const [{ data: genre }, { data: genres }] = await Promise.all([
  useBaseItem(getUserLibraryApi, 'getItem')(() => ({
    itemId
  })),
  useBaseItem(getItemsApi, 'getItems')(() => ({
    genreIds: [itemId],
    includeItemTypes: includeItemTypes.value,
    recursive: true,
    sortBy: ['SortName'],
    sortOrder: [SortOrder.Ascending]
  }))
]);

useItemPageTitle(genre);
</script>

<style scoped>
.second-toolbar {
  top: 56px;
}

.second-toolbar.md-and-up {
  top: 64px;
}

.second-toolbar.lg-and-up {
  left: 256px !important;
}

.after-second-toolbar {
  padding-top: 60px;
}

.genre-toolbar {
  width: 100%;
}

.scroller {
  max-height: 100%;
}

.card-grid-container {
  display: grid;
}

.card-grid-container.sm-and-down {
  grid-template-columns: repeat(3, minmax(calc(100% / 3), 1fr));
}

.card-grid-container.sm-and-up {
  grid-template-columns: repeat(4, minmax(calc(100% / 4), 1fr));
}

.card-grid-container.lg-and-up {
  grid-template-columns: repeat(6, minmax(calc(100% / 6), 1fr));
}

.card-grid-container.xl {
  grid-template-columns: repeat(8, minmax(calc(100% / 8), 1fr));
}
</style>
