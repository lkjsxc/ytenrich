// Live playback stalled with this Chromium's Headless UA even with tiling off; its desktop-UA control passed.
import { launch } from './smoke-lib.ts';

export const launchSession = (settings: Record<string, unknown>) =>
  launch(settings, {
    width: 1440,
    height: 900,
    dark: true,
    desktopUa: true,
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
