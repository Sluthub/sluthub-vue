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
  // vue-component-meta handles functional components; exclude the obsolete docgen transformer.
  async viteFinal(config) {
    const plugins = await Promise.all((config.plugins ?? []).map(plugin => Promise.resolve(plugin)));

    config.plugins = plugins.filter(plugin => !plugin || Array.isArray(plugin) || plugin.name !== 'storybook:vue-docgen-plugin');

    return config;
  }
} satisfies StorybookConfig;
