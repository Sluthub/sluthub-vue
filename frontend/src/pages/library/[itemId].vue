<template>
  <div>
    <VAppBar
      density="compact"
      flat>
      <span class="text-h6 hidden-sm-and-down">
        {{ library.Name }}
      </span>
      <VChip
        size="small"
        class="hidden-sm-and-down ma-2">
        <template v-if="loading && items.length === lazyLoadLimit && initialId === route.params.itemId">
          {{ t('lazyLoading', { value: items.length }) }}
        </template>
        <JProgressCircular
          v-else-if="loading"
          indeterminate
          class="uno-h-full" />
        <template v-else>
          {{ items.length ?? 0 }}
        </template>
      </VChip>
      <VDivider

        vertical
        inset
        class="hidden-sm-and-down mx-2" />
      <TypeButton
        v-if="hasViewTypes"
        v-model="viewType"
        :type="library.CollectionType" />
      <VDivider
        v-if="isSortable && hasViewTypes"
        inset
        vertical
        class="mx-2" />
      <SortButton
        v-if="isSortable"
        :ascending="sortAscending"
        @change="onChangeSort" />
      <FilterButton
        v-if="library && viewType && isSortable"
        :item="library"
        @change="onChangeFilter" />
      <VSpacer />
    </VAppBar>
    <VContainer>
      <ItemGrid
        :items="items">
        <h1
          v-if="!hasFilters"
          class="text-h5">
          {{ hasFilters ? t('libraryEmptyFilters') : t('libraryEmpty') }}
        </h1>
      </ItemGrid>
    </VContainer>
    <ScrollToTopButton />
  </div>
</template>

<script setup lang="ts">
import {
  BaseItemKind, SortOrder
} from '@jellyfin/sdk/lib/generated-client';
import { getArtistsApi } from '@jellyfin/sdk/lib/utils/api/artists-api';
import { getGenresApi } from '@jellyfin/sdk/lib/utils/api/genres-api';
import { getItemsApi } from '@jellyfin/sdk/lib/utils/api/items-api';
import { getMusicGenresApi } from '@jellyfin/sdk/lib/utils/api/music-genres-api';
import { getPersonsApi } from '@jellyfin/sdk/lib/utils/api/persons-api';
import { getStudiosApi } from '@jellyfin/sdk/lib/utils/api/studios-api';
import { computed, onBeforeMount, ref, shallowRef } from 'vue';
import { useTranslation } from 'i18next-vue';
import { useRoute } from 'vue-router';
import { useBaseItem } from '#/composables/apis';
import type { Filters } from '#/components/Buttons/FilterButton.vue';
import { useItemPageTitle } from '#/composables/page-title';

const { t } = useTranslation();
const route = useRoute('/library/[itemId]');

const lazyLoadLimit = 50;
const initialId = route.params.itemId;
const COLLECTION_TYPES_MAPPINGS: Record<string, BaseItemKind> = {
  tvshows: BaseItemKind.Series,
  movies: BaseItemKind.Movie,
  books: BaseItemKind.Book,
  music: BaseItemKind.MusicAlbum,
  boxsets: BaseItemKind.BoxSet
};

const innerItemKind = shallowRef<BaseItemKind>();
const sortBy = shallowRef<string>();
const sortAscending = shallowRef(true);
const queryLimit = shallowRef<number | undefined>(lazyLoadLimit);
const filters = ref<Filters>({
  status: [],
  features: [],
  genres: [],
  ratings: [],
  types: [],
  years: []
});

/**
 * Updates sort value when it is changed
 */
function onChangeSort(sort: string, ascending: boolean): void {
  sortBy.value = sort;
  sortAscending.value = ascending;
}

/**
 * Updates filters when they are changed
 */
function onChangeFilter(changedFilters: Filters): void {
  filters.value = changedFilters;
}

const { data: libraryQuery } = await useBaseItem(getItemsApi, 'getItems')(() => ({
  ids: [route.params.itemId]
}));
const library = computed(() => libraryQuery.value[0]!);
const viewType = computed({
  get() {
    if (innerItemKind.value) {
      return innerItemKind.value;
    } else {
      return library.value.CollectionType ? COLLECTION_TYPES_MAPPINGS[library.value.CollectionType] : undefined;
    }
  },
  set(newVal) {
    innerItemKind.value = newVal;
  }
});

const hasFilters = computed(() =>
  Object.values(filters.value).some(({ length }) => length > 0)
);
const hasViewTypes = computed(
  () =>
    library.value.CollectionType === 'movies'
    || library.value.CollectionType === 'music'
    || library.value.CollectionType === 'tvshows'
);
const isSortable = computed(
  () =>
    viewType.value
    /**
     * Not everything is sortable, so depending on what we're showing, we need to hide the sort menu.
     * Reusing this as "isFilterable" too, since these seem to go hand in hand for now.
     */
    && ![
      'MusicArtist',
      'Person',
      'Genre',
      'MusicGenre',
      'Studio'
    ].includes(viewType.value)
);

const recursive = computed(() =>
  library.value.CollectionType === 'homevideos'
  || library.value.Type === 'Folder'
  || (library.value.Type === 'CollectionFolder'
    && !('CollectionType' in library.value))
    ? undefined
    : true
);

const parentId = computed(() => library.value.Id);
const methods = computed(() => {
  switch (viewType.value) {
    case 'MusicArtist': {
      return [getArtistsApi, 'getArtists'] as const;
    }
    case 'Person': {
      return [getPersonsApi, 'getPersons'] as const;
    }
    case 'Genre': {
      return [getGenresApi, 'getGenres'] as const;
    }
    case 'MusicGenre': {
      return [getMusicGenresApi, 'getMusicGenres'] as const;
    }
    case 'Studio': {
      return [getStudiosApi, 'getStudios'] as const;
    }
    default: {
      return [getItemsApi, 'getItems'] as const;
    }
  }
});
const api = computed(() => methods.value[0]);
const method = computed(() => methods.value[1]);

/**
 * TODO: Improve the type situation of this statement
 */
const { loading, data: items } = await useBaseItem(api, method)(() => ({
  parentId: parentId.value,
  personTypes: viewType.value === 'Person' ? ['Actor'] : undefined,
  includeItemTypes: viewType.value ? [viewType.value] : undefined,
  sortOrder: [sortAscending.value ? SortOrder.Descending : SortOrder.Ascending],
  sortBy: [sortBy.value ?? 'PremiereDate'],
  recursive: recursive.value,
  filters: filters.value.status,
  genres: filters.value.genres,
  years: filters.value.years,
  officialRatings: filters.value.ratings,
  hasSubtitles: filters.value.features.includes('HasSubtitles') || undefined,
  hasTrailer: filters.value.features.includes('HasTrailer') || undefined,
  hasSpecialFeature: filters.value.features.includes('HasSpecialFeature') || undefined,
  hasThemeSong: filters.value.features.includes('HasThemeSong') || undefined,
  hasThemeVideo: filters.value.features.includes('HasThemeVideo') || undefined,
  isHd: filters.value.types.includes('isHD') || undefined,
  is4K: filters.value.types.includes('is4K') || undefined,
  is3D: filters.value.types.includes('is3D') || undefined,
  limit: queryLimit.value
}));

useItemPageTitle(library);

/**
 * We fetch the 1st 50 items and, after mount, we fetch the rest.
 */
onBeforeMount(() => {
  queryLimit.value = undefined;
});
</script>

<style scoped>
.empty-card-container {
  max-height: 90vh;
  overflow: hidden;
  mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0));
}

.empty-message {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
</style>
