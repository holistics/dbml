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
    {
      type: 'doc',
      label: 'Introduction',
      id: 'home',
    },
    {
      type: 'doc',
      label: 'Syntax',
      id: 'syntax',
    },
    {
      type: 'doc',
      label: 'CLI',
      id: 'cli',
    },
    {
      type: 'doc',
      label: 'JS Module',
      id: 'js-module',
    },
  ],
};

export default SidebarConfigs;
