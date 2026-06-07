// @ts-check

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'LST Project Docs',
  tagline: 'STT 기반 실시간 자막/번역 확장 프로그램 사용자 문서',
  favicon: 'img/favicon.ico',

  url: 'https://lst-project-docs.vercel.app',
  baseUrl: '/',

  organizationName: 'SOIV Studio',
  projectName: 'LST-Project',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'ko',
    locales: ['ko'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          routeBasePath: '/',
          sidebarPath: './sidebars.js',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: 'LST Project Docs',
        items: [
          {
            to: '/beta/getting-started',
            label: 'Beta 가이드',
            position: 'left',
            activeBasePath: '/beta',
          },
          {
            to: '/apps/overview',
            label: 'Apps',
            position: 'left',
            activeBasePath: '/apps',
          },
          {
            to: '/platform/overview',
            label: 'Platform',
            position: 'left',
            activeBasePath: '/platform',
          },
          {
            href: 'https://github.com/SOIV/LST_Extension-Project',
            className: 'header-github-link',
            'aria-label': 'GitHub repository',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              {
                label: '시작하기',
                to: '/',
              },
              {
                label: 'Beta 가이드',
                to: '/beta/getting-started',
              },
              {
                label: '문제 해결',
                to: '/beta/troubleshooting',
              },
            ],
          },
        ],
        copyright: `Copyright © 2025 ~ ${new Date().getFullYear()} SOIV Studio. All Rights Reserved.`,
      },
      prism: {
        additionalLanguages: ['bash', 'json'],
      },
    }),
};

module.exports = config;
