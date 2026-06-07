// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  appsSidebar: [
    'apps/overview',
    {
      type: 'category',
      label: '앱 설치 및 사용 가이드',
      items: [
        'apps/extension',
        'apps/desktop-app',
      ],
    },
    {
      type: 'category',
      label: '설정 및 문제 해결',
      items: [
        'apps/api-keys',
        'apps/engines',
        'apps/shortcuts',
        'apps/troubleshooting',
        'apps/feature-status',
      ],
    },
  ],
  platformSidebar: [
    'platform/overview',
    'platform/community-subtitles',
    'platform/subtitle-editor',
    'platform/creator-workflow',
    'platform/subtitle-format',
  ],
  betaSidebar: [
    'intro',
    'beta/getting-started',
    'beta/api-keys',
    'beta/engines',
    'beta/shortcuts',
    'beta/troubleshooting',
    'beta/feature-status',
  ],
};

module.exports = sidebars;
