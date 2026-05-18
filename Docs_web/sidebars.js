// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  guideSidebar: [
    'intro',
    {
      type: 'category',
      label: '베타 사용 가이드',
      items: [
        'beta/getting-started',
        'beta/api-keys',
        'beta/engines',
        'beta/shortcuts',
        'beta/troubleshooting',
        'beta/feature-status',
      ],
    },
  ],
};

module.exports = sidebars;
