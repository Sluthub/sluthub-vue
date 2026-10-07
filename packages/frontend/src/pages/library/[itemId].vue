<template>
  <div>
    <VAppBar
      density="compact"
      flat>
      <span class="text-h6 uno-hidden uno-min-[960px]:block">
        {{ library.Name }}
      </span>
      <VChip
        size="small"
        class="uno-m-2 uno-hidden uno-min-[960px]:flex">
        <template v-if="batchState.total !== undefined">
          {{ batchState.total.toLocaleString(i18next.language) }} ({{ items.length.toLocaleString(i18next.language) }})
        </template>
        <JProgressCircular
          v-else-if="loading"
          indeterminate
          class="uno-h-full" />
        <template v-else>
          — ({{ items.length.toLocaleString(i18next.language) }})
        </template>
      </VChip>
      <VDivider

        vertical
        inset
        class="uno-mx-2 uno-hidden uno-min-[960px]:flex" />
      <TypeButton
        v-if="hasViewTypes"
        v-model="viewType"
        :type="library.CollectionType" />
      <VDivider
        v-if="isSortable && hasViewTypes"
        inset
        vertical
        class="uno-mx-2" />
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
        v-if="items.length || !batchState.error"
        :items="items">
        <h1 class="text-h5">
          {{ loading ? t('loading') : hasFilters ? t('libraryEmptyFilters') : t('libraryEmpty') }}
        </h1>
      </ItemGrid>
      <div
        ref="loadMoreTarget"
        class="uno-flex uno-justify-center uno-py-6"
        aria-live="polite">
        <JProgressCircular
          v-if="loading"
          indeterminate />
        <div
          v-else-if="batchState.error"
          class="text-center">
          <p>{{ t('libraryBatchError') }}</p>
          <VBtn @click="loadMore">
            {{ t('retry') }}
          </VBtn>
        </div>
        <VBtn
          v-else-if="batchState.hasMore"
          @click="loadMore">
          {{ t('loadMore') }}
        </VBtn>
      </div>
    </VContainer>
    <ScrollToTopButton />
  </div>
</template>

<script lang="ts">
import { BatchCache, type BatchResult, BatchLoader, type BatchState } from '@jellyfin-vue/shared/batch-loader';
import { type BaseItemDto,
  BaseItemKind, ImageType, ItemFields, ItemSortBy, SortOrder, type BaseItemDtoQueryResult
} from '@jellyfin/sdk/lib/generated-client';

// Shared across library navigation; at most 1,000 card summaries for 60 seconds.
const libraryBatchCache = new BatchCache<BatchResult<BaseItemDto>>();
</script>

<script setup lang="ts">
import { getArtistsApi } from '@jellyfin/sdk/lib/utils/api/artists-api';
import { getGenresApi } from '@jellyfin/sdk/lib/utils/api/genres-api';
import { getItemsApi } from '@jellyfin/sdk/lib/utils/api/items-api';
import { getMusicGenresApi } from '@jellyfin/sdk/lib/utils/api/music-genres-api';
import { getPersonsApi } from '@jellyfin/sdk/lib/utils/api/persons-api';
import { getStudiosApi } from '@jellyfin/sdk/lib/utils/api/studios-api';
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue';
import { useIntersectionObserver } from '@vueuse/core';
import { useTranslation } from 'i18next-vue';
import { useRoute } from 'vue-router';
import { useBaseItem } from '#/composables/apis.ts';
import type { Filters } from '#/components/Buttons/FilterButton.vue';
import { useItemPageTitle } from '#/composables/page-title.ts';
import { remote } from '#/plugins/remote/index.ts';
import { lastUpdatedIds } from '#/store/dbs/api/index.ts';
import { windowScroll } from '#/store/index.ts';

const { t, i18next } = useTranslation();
const route = useRoute('/library/[itemId]');

const COLLECTION_TYPES_MAPPINGS: Record<string, BaseItemKind> = {
  tvshows: BaseItemKind.Series,
  movies: BaseItemKind.Movie,
  books: BaseItemKind.Book,
  music: BaseItemKind.MusicAlbum,
  boxsets: BaseItemKind.BoxSet
};

const innerItemKind = shallowRef<BaseItemKind>();
const sortBy = shallowRef<ItemSortBy>(ItemSortBy.PremiereDate);
const sortAscending = shallowRef(false);
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
  if (Object.values(ItemSortBy).includes(sort as ItemSortBy)) {
    sortBy.value = sort as ItemSortBy;
  }

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
    }

    return library.value.CollectionType ? COLLECTION_TYPES_MAPPINGS[library.value.CollectionType] : undefined;
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
    ['movies', 'music', 'tvshows'].includes(library.value.CollectionType ?? '')
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
const query = computed(() => ({
  parentId: parentId.value,
  personTypes: viewType.value === 'Person' ? ['Actor'] : undefined,
  includeItemTypes: viewType.value ? [viewType.value] : undefined,
  sortOrder: [sortAscending.value ? SortOrder.Ascending : SortOrder.Descending],
  sortBy: [sortBy.value],
  recursive: recursive.value,
  filters: filters.value.status,
  genres: filters.value.genres,
  years: filters.value.years,
  officialRatings: filters.value.ratings,
  hasSubtitles: filters.value.features.includes('HasSubtitles') ? true : undefined,
  hasTrailer: filters.value.features.includes('HasTrailer') ? true : undefined,
  hasSpecialFeature: filters.value.features.includes('HasSpecialFeature') ? true : undefined,
  hasThemeSong: filters.value.features.includes('HasThemeSong') ? true : undefined,
  hasThemeVideo: filters.value.features.includes('HasThemeVideo') ? true : undefined,
  isHd: filters.value.types.includes('isHD') ? true : undefined,
  is4K: filters.value.types.includes('is4K') ? true : undefined,
  is3D: filters.value.types.includes('is3D') ? true : undefined
}));

useItemPageTitle(library);

const batchState = shallowRef<BatchState<BaseItemDto>>({ items: [], loading: false, hasMore: true, error: false });
const items = computed(() => batchState.value.items);
const loading = computed(() => batchState.value.loading);
const cache = libraryBatchCache;
const loader = new BatchLoader<BaseItemDto>(async ({ startIndex, limit, signal }) => {
  const params = {
    ...query.value, startIndex, limit,
    userId: remote.auth.currentUserId.value,
    // Card summaries must never replace complete detail/playback DTOs in the worker cache.
    fields: [ItemFields.PrimaryImageAspectRatio, ItemFields.CanDelete, ItemFields.CanDownload, ItemFields.ChildCount],
    enableImages: true, enableImageTypes: [ImageType.Primary, ImageType.Thumb], imageTypeLimit: 1,
    // Count this query once, then fetch only bounded lazy batches.
    enableUserData: true, enableTotalRecordCount: startIndex === 0
  };
  const options = { signal };
  let data: BaseItemDtoQueryResult;

  switch (viewType.value) {
    case BaseItemKind.MusicArtist: {
      data = (await remote.sdk.newUserApi(getArtistsApi).getArtists(params, options)).data;
      break;
    }
    case BaseItemKind.Person: {
      data = (await remote.sdk.newUserApi(getPersonsApi).getPersons(params, options)).data;
      break;
    }
    case BaseItemKind.Genre: {
      data = (await remote.sdk.newUserApi(getGenresApi).getGenres(params, options)).data;
      break;
    }
    case BaseItemKind.MusicGenre: {
      data = (await remote.sdk.newUserApi(getMusicGenresApi).getMusicGenres(params, options)).data;
      break;
    }
    case BaseItemKind.Studio: {
      data = (await remote.sdk.newUserApi(getStudiosApi).getStudios(params, options)).data;
      break;
    }
    default: { data = (await remote.sdk.newUserApi(getItemsApi).getItems(params, options)).data;
    }
  }

  // Later responses can contain a zero count because counting is disabled.
  return { items: data.Items ?? [], total: startIndex === 0 ? data.TotalRecordCount : undefined };
}, item => item.Id, (state) => {
  batchState.value = state;
}, cache);
const scope = computed(() => JSON.stringify([
  remote.auth.currentServer.value?.Id, remote.auth.currentServer.value?.PublicAddress, remote.auth.currentUserId.value
]));

watch([scope, query], () => {
  loader.reset(remote.auth.currentUserId.value ? scope.value : '', JSON.stringify([viewType.value, query.value]));
  void loader.next();
}, { immediate: true });
watch(remote.auth.currentUserToken, () => {
  cache.clear();
});
watch(lastUpdatedIds, () => {
  cache.clear();
});
watch(remote.socket.message, (message) => {
  if (message?.MessageType === 'LibraryChanged') {
    cache.clear();
  }

  if (message?.MessageType === 'UserDataChanged' && message.Data && typeof message.Data === 'object' && 'UserDataList' in message.Data) {
    if ('UserId' in message.Data && message.Data.UserId !== remote.auth.currentUserId.value) {
      return;
    }

    cache.clear();

    const updates = message.Data.UserDataList;

    if (Array.isArray(updates)) {
      loader.update((item) => {
        const update = updates.find(userData => userData.ItemId === item.Id);

        return update ? { ...item, UserData: { ...item.UserData, ...update } } : item;
      });
    }
  }
});

const loadMoreTarget = ref<HTMLElement>();
const loadMore = () => loader.next();
const nearBottom = shallowRef(false);
const loadNearBottom = () => {
  // Wait for an actual scroll: the virtual grid has zero height until its first measurement.
  if (nearBottom.value && windowScroll.y.value > 0 && !batchState.value.error) {
    void loadMore();
  }
};
useIntersectionObserver(loadMoreTarget, ([entry]) => {
  nearBottom.value = entry?.isIntersecting ?? false;
  loadNearBottom();
}, { rootMargin: '600px' });
watch(windowScroll.y, loadNearBottom);
onScopeDispose(() => loader.cancel());
</script>
