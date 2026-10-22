import type { StorybookConfig } from '@storybook/vue3-vite';

export default {
  stories: ['./stories/**/*.stories.ts'],
  addons: [
    '@chromatic-com/storybook',
    '@storybook/addon-a11y'
  ],
  framework: {
    name: '@storybook/vue3-vite',
    options: {}
  },
  core: {
    builder: {
      name: '@storybook/builder-vite',
      options: {
        docgen: 'vue-component-meta',
        viteConfigPath: undefined as undefined | string
      }
    }
  },
  // Keep Storybook's own preview entry and vue-component-meta pipeline.
  async viteFinal(config) {
    const plugins = await Promise.all((config.plugins ?? []).map(plugin => Promise.resolve(plugin)));

    const excludedPlugins = new Set([
      'Jellyfin_Vue:monorepo_setup',
      'storybook:vue-docgen-plugin'
    ]);

    config.plugins = plugins.filter(plugin => !plugin || Array.isArray(plugin) || !excludedPlugins.has(plugin.name));

    return config;
  }
} satisfies StorybookConfig;
