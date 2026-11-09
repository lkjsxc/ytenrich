// Single MV3 manifest for Chromium and Firefox (each ignores the other's background key).
export const manifest = {
  manifest_version: 3,
  name: 'ytenrich',
  version: '0.1.0',
  description: 'YouTube, enriched: recommendation stats, one-click dismiss, tiling window manager.',
  permissions: ['storage', 'unlimitedStorage'],
  host_permissions: ['https://www.youtube.com/*'],
  background: { service_worker: 'background.js', scripts: ['background.js'], type: 'module' },
  action: { default_title: 'ytenrich' },
  options_ui: { page: 'options.html', open_in_tab: true },
  content_scripts: [
    {
      matches: ['https://www.youtube.com/*'],
      js: ['content.js'],
      css: ['youtube.css'],
      run_at: 'document_start',
    },
  ],
  browser_specific_settings: { gecko: { id: 'ytenrich@lkjsxc', strict_min_version: '128.0' } },
};
