const youtube = 'https://www.youtube.com/*';

const common = {
  manifest_version: 3,
  name: 'ytenrich',
  version: '0.1.0',
  description: 'YouTube, enriched: recommendation stats, one-click dismiss, tiling window manager.',
  permissions: ['storage', 'unlimitedStorage'],
  host_permissions: [youtube],
  incognito: 'not_allowed',
  icons: { 16: 'icon-16.png', 32: 'icon-32.png', 48: 'icon-48.png', 128: 'icon-128.png' },
  action: { default_title: 'ytenrich' },
  options_ui: { page: 'options.html', open_in_tab: true },
  content_scripts: [
    {
      matches: [youtube],
      js: ['content.js'],
      css: ['youtube.css'],
      run_at: 'document_start',
    },
  ],
};

export const chromiumManifest = {
  ...common,
  background: { service_worker: 'background.js', type: 'module' },
};

export const firefoxManifest = {
  ...common,
  background: { scripts: ['background.js'], type: 'module' },
  browser_specific_settings: {
    gecko: {
      id: 'ytenrich@lkjsxc',
      strict_min_version: '140.0',
      data_collection_permissions: {
        required: ['browsingActivity', 'websiteContent', 'websiteActivity'],
      },
    },
  },
};
