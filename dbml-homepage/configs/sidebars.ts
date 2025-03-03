// https://docusaurus.io/docs/sidebar
import { SidebarsConfig } from '@docusaurus/plugin-content-docs';

/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */
const SidebarConfigs: SidebarsConfig = {
  docs: [
    'home',
    'docs',
    'cli',
    {
      type: 'category',
      label: 'JS Module',
      collapsed: false,
      collapsible: true,
      items: [
        {
          id: 'js-module/core',
          type: 'doc',
          label: '@dbml/core',
        },
        {
          id: 'js-module/connector',
          type: 'doc',
          label: '@dbml/connector',
        },
      ],
    },
  ],
};

export default SidebarConfigs;
