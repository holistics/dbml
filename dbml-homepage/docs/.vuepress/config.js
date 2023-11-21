module.exports = {
  title: 'DBML',
  themeConfig: {
    nav: [
      { text: 'Home', link: '/home/' },
      { text: 'Docs', link: '/docs/' },
      { text: 'CLI', link: '/cli/' },
      { text: 'JS Module', link: '/js-module/' },
      {
        text: 'dbx',
        items: [
          { text: 'dbdiagram - Database Diagram As Code',link: 'https://dbdiagram.io?utm_source=dbml' },
          { text: 'dbdocs - Database Docs As Code',link: 'https://dbdocs.io?utm_source=dbml' },
          { text: 'Holistics.io - BI Reporting As Code',link: 'https://www.holistics.io/?utm_source=dbml&utm_medium=topnav&utm_campaign=landing' },
        ]
      },
      { text: 'Github',link: 'https://github.com/holistics/dbml'},
    ],
    sidebarDepth: 2,
    sidebar: {
      '/docs/':[
        '',
      ],
      //home sidebar
      '/home/':[
        ''
      ],
      '/cli/': [
        ''
      ],
      '/js-module/': [
        ''
      ]
    }
  },
  plugins: [
    [
      '@vuepress/google-analytics',
      {
        'ga': 'UA-47899822-13'
      }
    ]
  ]
}
