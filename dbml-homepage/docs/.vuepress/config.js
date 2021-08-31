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
          { text: 'dbdiagram',link: 'https://dbdiagram.io?utm_source=dbml' },
          { text: 'dbdocs',link: 'https://dbdocs.io?utm_source=dbml' },
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
