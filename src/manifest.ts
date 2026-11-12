const youtube = 'https://www.youtube.com/*';

const common = {
  manifest_version: 3,
  name: 'ytenrich',
  version: '0.0.0', // replaced with package.json "version" by scripts/build.ts
  description: '__MSG_description__', // English-only store metadata from src/_locales/en/messages.json
  default_locale: 'en',
  homepage_url: 'https://github.com/lkjsxc/ytenrich',
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
  minimum_chrome_version: '120',
  background: { service_worker: 'background.js', type: 'module' },
};

export const firefoxManifest = {
  ...common,
  background: { scripts: ['background.js'], type: 'module' },
  browser_specific_settings: {
    gecko: {
      id: 'ytenrich@lkjsxc',
      strict_min_version: '140.0',
      // Stats stay in the browser and remote thumbnails are compiled out of this build (__FIREFOX__),
      // so nothing is transmitted. Re-check this whenever a feature sends anything off the device.
      data_collection_permissions: { required: ['none'] },
    },
  },
};
