import { Navbar } from '@docusaurus/theme-common';

const NavbarConfigs: Navbar = {
  title: 'DBML',
  hideOnScroll: false,
  logo: {
    alt: 'DBML logo',
    src: 'img/dbml-logo.png',
  },
  items: [
    {
      type: 'docSidebar',
      sidebarId: 'docs',
      position: 'left',
      label: 'Docs',
    },
    {
      href: '/playground',
      label: 'Playground',
      position: 'left',
      target: '_blank',
    },
    {
      type: 'dropdown',
      label: 'dbx',
      position: 'right',
      className: 'dbx-dropdown',
      items: [
        {
          label: 'dbdiagram - Database Diagram As Code',
          href: 'https://dbdiagram.io/?utm_source=dbml',
        },
        {
          label: 'dbdocs - Database Docs As Code',
          href: 'https://dbdocs.io/?utm_source=dbml',
        },
        {
          label: 'RunSQL - SQL Query Testing Tool',
          href: 'https://dbdocs.io/?utm_source=dbml',
        },
        {
          label: 'Holistics.io - BI Reporting As Code',
          href: 'https://www.holistics.io/?utm_source=dbml&utm_medium=topnav&utm_campaign=landing',
        },
      ],
    },
    {
      href: 'https://github.com/holistics/dbml',
      position: 'right',
      className: 'header-github-link',
      'aria-label': 'GitHub repository',
    },
  ],
};

export default NavbarConfigs;
