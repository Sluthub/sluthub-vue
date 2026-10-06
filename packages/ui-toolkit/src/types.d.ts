export interface JAnchorProps {
  /**
   * Reference position to use. The real position might differ
   * from the real one, since the component will be repositioned
   * automatically if it doesn't fit properly in the screen.
   */
  position?: 'top' | 'bottom' | 'left' | 'right';
}

declare module 'vue' {
  // Vuetify forwards native events/anchor attributes but omits them from generated component types.
  // This explicit allowlist preserves strict validation of every component-specific prop.
  interface ComponentCustomProps extends Pick<import('vue').HTMLAttributes, 'onClick' | 'onDblclick' | 'onContextmenu'> {
    target?: string;
    rel?: string;
  }
}
