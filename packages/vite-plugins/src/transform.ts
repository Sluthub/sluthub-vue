import { extname, join, relative } from 'node:path';
import { normalizePath, type Plugin, type Rolldown } from 'vite';
import { findUpSync } from 'find-up-simple';

/**
 * This plugin allows the Vite Config to be used as a monorepo with multiple Vite projects
 * In normal setups, Vite takes the application inputs from the `<script type="module" src="...">`
 * tags in the index.html file. This plugin generates those dynamically based on the `build.rolldownOptions.input`
 * of the Vite config.
 *
 * @param path - Must always be import.meta.dirname, but needs to be passed from the parent module
 * @param inputAttrs - Additional attributes to provide for specific inputs
 */
export function JMonorepo(path: string, inputAttrs: Record<string, Record<string, string>>): Plugin {
  let resolvedInputs: NonNullable<Rolldown.InputOptions['input']> = {};

  return {
    name: 'Jellyfin_Vue:monorepo_setup',
    enforce: 'pre',
    config: () => ({
      root: path,
      cacheDir: findUpSync(join(path, 'node_modules'), { type: 'directory' }),
      build: {
        emptyOutDir: true
      }
    }),
    configResolved(config) {
      resolvedInputs = config.build.rolldownOptions.input ?? {};
    },
    transformIndexHtml: {
      order: 'pre',
      handler: html => ({
        html,
        tags: Object.entries(resolvedInputs)
          .filter(([_, value]) => extname(value) !== '.html')
          .map(([key, value]) => ({
            tag: 'script',
            attrs: {
              type: 'module',
              // Browser URLs must not contain Windows drive paths or file:// addresses.
              src: relative(path, value).startsWith('..')
                ? `/@fs/${normalizePath(value)}`
                : `/${normalizePath(relative(path, value))}`,
              ...inputAttrs[key]
            },
            injectTo: 'head'
          }))
      })
    }
  };
}
