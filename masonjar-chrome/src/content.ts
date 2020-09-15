import { IRequest, IStartWatching } from './background';
import { delay } from './util';
import log from './util/log';

let port = chrome.runtime.connect({name: "masonjar-content"});

let VIDEO_SEEK_TIMEOUT = 5000;
let VIDEO_LOAD_TIMEOUT = 10000;

export interface IStreamUpdate extends IRequest {
  updateAction: string;
  timestamp: number;
  videoTimestamp: number;
}

export interface ISyncVideoRequest extends IRequest {
  videoUrl: string;
  videoTimestamp: number;
  playing: boolean;
  timestamp: number;
}

let lastStateChange = 0;

let _videoElement: HTMLVideoElement;
let synced = true;

const getVideoElement: () => Promise<HTMLVideoElement> = async () => {
  if (document.contains(_videoElement))
    return Promise.resolve(_videoElement);
  
  _videoElement = <HTMLVideoElement> document.getElementsByTagName('video')[0];
  if (_videoElement) {
    _videoElement.addEventListener('pause', (e: Event) => {
      if (!synced)
        return;

      log.info('pause event fired');
      e.preventDefault();
      lastStateChange = Date.now();
      port.postMessage({
        requestAction: 'updateStream',
        timestamp: Date.now(),
        updateAction: 'pause',
        videoTimestamp: _videoElement.currentTime,
      });
    });
    _videoElement.addEventListener('play', (e: Event) => {
      if (!synced)
        return;

      log.info('play event fired');
      e.preventDefault();
      lastStateChange = Date.now();
      port.postMessage({
        requestAction: 'updateStream',
        timestamp: Date.now(),
        updateAction: 'play',
        videoTimestamp: _videoElement.currentTime,
      });
    });

    _videoElement.addEventListener('seeked', (e: Event) => {
      if (!synced)
        return;
      
      log.info('seeked event fired');
      e.preventDefault();
      lastStateChange = Date.now();
      port.postMessage({
        requestAction: 'updateStream',
        timestamp: Date.now(),
        updateAction: _videoElement.paused ? 'pause' : 'play',
        videoTimestamp: _videoElement.currentTime,
      });
    });

    try {
      await spinTillVideoReady(_videoElement, VIDEO_LOAD_TIMEOUT);
      log.info('video element found and ready to play');
      port.postMessage({ requestAction: 'videoElementLoaded' });
    } catch (err) {
      log.warn(err.message);
    }
  }

  return Promise.resolve(_videoElement);
}


const initializeVideoElement = async () => {
  const element = await getVideoElement();
  var observer = new MutationObserver(async (mutations: MutationRecord[]) => {
    for (const record of mutations) {
      for (const node of record.addedNodes) {
        if (node.nodeName === 'DIV') {
          const vid = await getVideoElement();
          if (vid) {
            observer.disconnect();
            return;
          }
        }
      }
    }
  });

  if (element === undefined) {
    observer.observe(document.body, {childList: true, subtree: true});
  }
}

const spinTillVideoReady = async (element: HTMLVideoElement, timeout: number) => {
  return new Promise(async (resolve: () => void, reject: (err: Error) => void) => {
    const timeoutSteps = Math.floor(timeout / 250);
    for (let i = 0; i < timeoutSteps; i++) {
      if (element.readyState === element.HAVE_ENOUGH_DATA) {
        return resolve();
      }
      await delay(250);
    }

    return reject(new Error(`video wasn't ready after ${timeout}ms`));
  });
}

const syncTolerance = 1;

const syncTimestamp = (element: HTMLVideoElement, newTimestamp: number) => {
  return new Promise(async (resolve: () => void) => {
    const timeDiff = Math.abs(element.currentTime - newTimestamp);
    if (timeDiff > syncTolerance) {
      log.info(`stream is off by [${timeDiff}s], syncing to [${newTimestamp}]`);
      element.currentTime = newTimestamp;

      try {
        await spinTillVideoReady(element, VIDEO_SEEK_TIMEOUT);
      } catch (err) {
        log.warn(err.message);
      }
    }
    return resolve();
  });
}

port.onMessage.addListener(async (request) => {
  const incomingRequest = <IRequest> request;

  let videoElement: HTMLVideoElement;
  try {
    videoElement = await getVideoElement();

    if (videoElement === undefined) {
      log.warn(`failed to find video element`);
      return;
    }
  } catch (err) {
    log.error(err);
    return;
  }
  
  log.info(`incoming request, action [${incomingRequest.requestAction}]`);


  switch (incomingRequest.requestAction) {
    case 'updateStream':
      const updateRequest = <IStreamUpdate> request;
      if (lastStateChange > updateRequest.timestamp) {
        log.info(`squashing request to [${updateRequest.updateAction}]`);
        return;
      }

      switch (updateRequest.updateAction) {
        case 'play':
          if (videoElement.paused) {
            await syncTimestamp(videoElement, updateRequest.videoTimestamp);
            log.info(`playing video from request`);
            await videoElement.play();
          }
          break;
        case 'pause':
          if (!videoElement.paused) {
            log.info(`pausing video from request`);
            await syncTimestamp(videoElement, updateRequest.videoTimestamp);
            videoElement.pause();
          }
          break;
      }
      break;
    case 'syncVideo':
      synced = false;
      const syncRequest = <ISyncVideoRequest> request;
      log.info(`current time [${videoElement.currentTime}], syncing to [${syncRequest.videoTimestamp}]`);
      await syncTimestamp(videoElement, syncRequest.videoTimestamp + (Date.now() - syncRequest.timestamp) / 1000);
      if (syncRequest.playing && videoElement.paused)
        videoElement.play();
      else if (!syncRequest.playing && !videoElement.paused)
        videoElement.pause();
      
      synced = true;
      break;
    case 'startVideoOnPage':
      if (videoElement) {
        port.postMessage(<IStartWatching> {
          requestAction: 'startVideo',
          videoTimestamp: videoElement.currentTime,
          videoUrl: window.location.href,
          playing: !videoElement.paused,
        });
      }
      break;
    case 'urlChanged':
        log.info('current content URL changed');
        await getVideoElement();
        break;
    default:
      log.warn(`invalid content requestAction action [${incomingRequest.requestAction}]`);
  }
});

initializeVideoElement();