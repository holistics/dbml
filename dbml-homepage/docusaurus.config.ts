import type * as Preset from '@docusaurus/preset-classic';
import npm2yarn from '@docusaurus/remark-plugin-npm2yarn';
import type { Config } from '@docusaurus/types';
import { themes as prismThemes } from 'prism-react-renderer';
import NavbarConfigs from './configs/navbar';

const config: Config = {
  title: 'DBML',
  tagline: 'Documentations for dbml',
  favicon: '/img/dbml-favicon.svg',
  // Set the production url of your site here
  url: 'https://dbml.dbdiagram.io',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',
  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'holistics', // Usually your GitHub org/user name.
  projectName: 'dbml', // Usually your repo name.
  onBrokenLinks: 'throw',
  onBrokenAnchors: 'throw',
  onBrokenMarkdownLinks: 'throw',
  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './configs/sidebars.ts',
          breadcrumbs: true,
          routeBasePath: '/',
          remarkPlugins: [
            [npm2yarn, { sync: true }]
          ],
        },
        blog: false,
        theme: {
          customCss: './src/assets/scss/index.scss',
        },
      } satisfies Preset.Options,
    ],
  ],
  themeConfig: {
    // Replace with your project's social card
    image: 'img/dbml-logo.png',
    navbar: NavbarConfigs,
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
    colorMode: {
      // prefer system preferences
      respectPrefersColorScheme: true,
    },
    // https://docusaurus.io/docs/markdown-features/toc#table-of-contents-heading-level
    tableOfContents: {
      minHeadingLevel: 2,
      maxHeadingLevel: 5,
    },
  } satisfies Preset.ThemeConfig,
  plugins: [
    'docusaurus-plugin-sass',
    [
      '@docusaurus/plugin-google-gtag',
      {
        trackingID: 'G-46KNY3YRW9',
        anonymizeIP: true,
      },
    ],
    [
      'docusaurus-lunr-search',
      {
        indexBaseUrl: false,
      },
    ],
  ],
};

export default config;
