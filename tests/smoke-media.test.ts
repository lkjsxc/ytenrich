import { afterEach, beforeEach, expect, it } from 'vitest';
import { observeMedia } from '../scripts/smoke-session-media.ts';

let player: HTMLElement;
let video: HTMLVideoElement;
let observation: ReturnType<typeof observeMedia> | undefined;
beforeEach(() => {
  player = document.createElement('div');
  player.id = 'movie_player';
  video = document.createElement('video');
  player.append(video);
  document.body.replaceChildren(player);
});
afterEach(() => {
  observation?.dispose();
  observation = undefined;
  document.body.replaceChildren();
});

it('sees a complete advertisement phase between two content snapshots', () => {
  observation = observeMedia(video);
  const before = observation.snapshot();
  player.className = 'html5-video-player ad-showing';
  player.className = 'html5-video-player playing-mode';
  const after = observation.snapshot();
  expect(before).toMatchObject({ ad: false, adPhases: 0 });
  expect(after).toMatchObject({ ad: false, adPhases: 2 });
  expect(observation.snapshot().adPhases).toBe(2);
});

it('sees ad-to-content-to-ad transitions even when both samples are advertisements', () => {
  player.className = 'ad-showing';
  observation = observeMedia(video);
  player.className = '';
  player.className = 'ad-showing ad-interrupting';
  expect(observation.snapshot()).toMatchObject({ ad: true, adPhases: 2 });
});

it('does not mistake player styling or repeated ad classes for an ad transition', () => {
  player.className = 'ad-showing';
  observation = observeMedia(video);
  player.className = 'ad-showing playing-mode';
  player.className = 'ad-interrupting ad-showing';
  expect(observation.snapshot()).toMatchObject({ ad: true, adPhases: 0 });
});

it('keeps previous event snapshots independent when media interrupts later', () => {
  observation = observeMedia(video);
  const before = observation.snapshot();
  for (const event of ['pause', 'emptied', 'seeking', 'ended'])
    video.dispatchEvent(new Event(event));
  expect(before.counts).toEqual({ pause: 0, emptied: 0, seeking: 0, ended: 0 });
  expect(observation.snapshot().counts).toEqual({ pause: 1, emptied: 1, seeking: 1, ended: 1 });
});

it('disconnects the observer and media listeners when a proof is disposed', () => {
  observation = observeMedia(video);
  observation.dispose();
  player.className = 'ad-showing';
  video.dispatchEvent(new Event('pause'));
  expect(observation.snapshot()).toMatchObject({ ad: false, adPhases: 0, counts: { pause: 0 } });
});

it('retains counters when the native player is reparented with its media', () => {
  observation = observeMedia(video);
  const mini = document.createElement('ytd-miniplayer');
  document.body.append(mini);
  mini.append(player);
  player.className = 'ad-showing';
  video.dispatchEvent(new Event('ended'));
  expect(observation.snapshot()).toMatchObject({ ad: true, adPhases: 1, counts: { ended: 1 } });
});

function creative(title: string, ordinal = '') {
  player.className = 'ad-showing';
  const link = document.createElement('a');
  link.className = 'ytp-title-link';
  link.textContent = title;
  const pod = document.createElement('div');
  pod.className = 'ytp-ad-pod-index';
  pod.textContent = ordinal;
  player.append(link, pod);
  observation = observeMedia(video);
  return { link, pod, read: () => observation!.snapshot() };
}

it('recognizes the next creative in a native ad pod without ad-class or ended events', () => {
  const { link, pod, read } = creative('First creative', '1 of 3');
  expect(read()).toMatchObject({ adChanges: 0, adPod: '1 of 3' });
  link.textContent = 'Second creative';
  pod.textContent = '2 of 3';
  expect(read()).toMatchObject({
    adChanges: 1,
    adPod: '2 of 3',
    adPhases: 0,
    counts: { ended: 0 },
  });
});

it('does not count a delayed creative title a second time after its pod ordinal advanced', () => {
  const { link, pod, read } = creative('First creative', '1 of 3');
  read();
  pod.textContent = '2 of 3';
  expect(read().adChanges).toBe(1);
  link.textContent = 'Second creative';
  expect(read().adChanges).toBe(1);
});

it('uses a changed nonempty ad-owned title when the native pod ordinal is absent', () => {
  const { link, read } = creative('');
  read();
  link.textContent = 'First creative';
  expect(read().adChanges).toBe(0);
  link.textContent = 'Second creative';
  expect(read().adChanges).toBe(1);
  expect(read()).not.toHaveProperty('title');
});

it('does not confuse a pod restart or a lingering content title with a new native ad', () => {
  const { link, pod, read } = creative('First creative', '2 of 3');
  read();
  pod.textContent = '1 of 3';
  link.textContent = 'Restarted creative';
  expect(read().adChanges).toBe(0);
  observation!.dispose();
  pod.remove();
  link.href = 'https://www.youtube.com/watch?v=abcdef12345';
  observation = observeMedia(video);
  observation.snapshot();
  link.textContent = 'Different content title';
  expect(observation.snapshot().adChanges).toBe(0);
});
