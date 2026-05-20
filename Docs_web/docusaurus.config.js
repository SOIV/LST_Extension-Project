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
          lastVersion: 'current',
          versions: {
            current: {
              label: 'Beta',
              badge: true,
            },
            '1.0.0': {
              label: 'v1.0.0',
              badge: true,
              banner: 'unreleased',
            },
          },
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
            type: 'custom-versionAwareDocs',
            position: 'left',
          },
          {
            type: 'docsVersionDropdown',
            position: 'right',
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
                label: 'API 키 설정',
                to: '/beta/api-keys',
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
