import '@jellyfin-vue/i18n';
import { setup } from '@storybook/vue3';
import i18next from 'i18next';
import I18NextVue from 'i18next-vue';
import 'uno.css';

setup((app) => {
  app.use(I18NextVue, { i18next });
});
