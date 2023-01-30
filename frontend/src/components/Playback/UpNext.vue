<template>
  <v-container
    v-if="visible && playbackManager.currentItem && playbackManager.nextItem"
    class="up-next-dialog pointer-events-none pa-lg-6">
    <v-row>
      <v-col
        cols="12"
        offset-md="6"
        md="6"
        offset-lg="8"
        lg="4"
        offset-xl="9"
        xl="3">
        <v-card class="pointer-events-all">
          <v-card-title class="text-h6">
            <i18n path="dialog.upNext.nextItemPlayingIn" tag="span">
              <template #time>
                <span class="text-primary darken-2">
                  {{ $tc('units.time.seconds', currentItemTimeLeft) }}
                </span>
              </template>
            </i18n>
          </v-card-title>
          <v-card-subtitle class="text-truncate text-subtitle-1">
            <span v-if="playbackManager.currentItem.Type === 'Episode'">
              {{ playbackManager.nextItem.SeriesName }} -
              {{
                $t('seasonEpisodeAbbrev', {
                  seasonNumber: playbackManager.nextItem.ParentIndexNumber,
                  episodeNumber: playbackManager.nextItem.IndexNumber
                })
              }}
              <span v-if="$vuetify.display.smAndUp"> - </span> <br v-else />
              {{ playbackManager.nextItem.Name }}
            </span>
            <span v-if="playbackManager.currentItem.Type === 'Movie'">
              {{ playbackManager.nextItem.Name }}
            </span>
          </v-card-subtitle>
          <v-card-text v-if="playbackManager.nextItem?.RunTimeTicks">
            <span>
              {{ getRuntimeTime(playbackManager.nextItem.RunTimeTicks) }}
              <span class="pl-4">
                {{
                  $t('endsAt', {
                    time: getEndsAtTime(playbackManager.nextItem.RunTimeTicks)
                  })
                }}
              </span>
            </span>
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn
              class="bg-primary-darken-2"
              variant="flat"
              @click="playbackManager.setNextTrack">
              {{ $t('dialog.upNext.startNow') }}
            </v-btn>
            <v-btn @click="isHiddenByUser = true">
              {{ $t('dialog.upNext.hide') }}
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { playbackManagerStore } from '@/store';
import { ticksToMs, getEndsAtTime, getRuntimeTime } from '@/utils/time';

export default defineComponent({
  setup() {
    const playbackManager = playbackManagerStore();

    return { playbackManager };
  },
  data() {
    return {
      isHiddenByUser: false
    };
  },
  computed: {
    currentItemDuration(): number {
      return ticksToMs(this.playbackManager.currentItem?.RunTimeTicks) / 1000;
    },
    currentItemTimeLeft(): number {
      return Math.round(
        this.currentItemDuration - (this.playbackManager.currentTime || 0)
      );
    },
    visible(): boolean | undefined {
      if (
        this.isHiddenByUser ||
        this.playbackManager.currentlyPlayingMediaType !== 'Video'
      ) {
        return false;
      }

      if (this.currentItemTimeLeft <= this.nextUpDuration) {
        return true;
      }

      return undefined;
    },
    nextUpDuration(): number {
      // If longer than 5 hours, set the duration to 9 minutes
      if (this.currentItemDuration >= 5 * 60 * 60) {
        return 540;
      }
      // If longer than 2 hours, set the duration to 3.5 minutes
      else if (this.currentItemDuration >= 2 * 60 * 60) {
        return 210;
      }
      // If longer than 45 minutes, set the duration to 2 minutes
      else if (this.currentItemDuration >= 45 * 60) {
        return 120;
      }

      return 45;
    }
  },
  watch: {
    'playbackManager.currentItemIndex'(): void {
      this.isHiddenByUser = false;
    },
    visible(): void {
      this.$emit('change', this.visible);
    }
  },
  methods: {
    getEndsAtTime,
    getRuntimeTime
  }
});
</script>
<style lang="scss" scoped>
.up-next-dialog {
  position: absolute;
  bottom: 0;
  right: 0;
  z-index: 9999;
}
</style>