<template>
  <VListItem
    v-if="commit_hash"
    :title="'#' + commit_hash.slice(0, 7)"
    :prepend-icon="IMdiGithub"
    :href="link"
    target="_blank"
    rel="noopener noreferrer" />
</template>

<script setup lang="ts">
import IMdiGithub from 'virtual:icons/mdi/github';
import { commit_hash } from 'virtual:commit';
import { sanitizeHtml } from '@/utils/html';

const link = commit_hash ? sanitizeHtml(`https://github.com/sluthub/jellyfin-vue/commit/${commit_hash}`) : undefined;
</script>
