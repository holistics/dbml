module.exports = {
  title: 'DBML',
  themeConfig: {
    nav: [
      { text: 'Home', link: '/home/' },
      { text: 'Docs', link: '/docs/' },
      { text: 'CLI', link: '/cli/' },
      { text: 'JS Module', link: '/js-module/' },
      { text: 'Github',link: 'https://github.com/holistics/dbml'},
      { text: 'Community', link: 'https://github.com/holistics/dbml/issues/'}
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
