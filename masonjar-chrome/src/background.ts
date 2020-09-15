import log from './util/log';
import { ISyncVideoRequest } from './content';

export interface IRequest {
  requestAction: string;
}

export interface ISessionCreatedRequest extends IRequest {
  sessionId: string;
}

export interface IJoinRoomRequest extends IRequest {
  roomId: string;
  hostId: string;
}

export interface IUpdateRoomInfoRequest extends IRequest {
  roomId: string;
  isHost: boolean;
  videoUrl: string;
}

export interface IStartWatching extends IRequest {
  playing: boolean;
  videoTimestamp: number;
  videoUrl: string;
}

export interface IStartWatchingButtonState extends IRequest {
  enabled: boolean;
}

let websocket: WebSocket;

const contentPorts: chrome.runtime.Port[] = [];
let popupPort: chrome.runtime.Port = undefined;
let roomId: string = undefined;
let isHost: boolean = false;
let videoUrl: string = undefined;
let activeVideoTabId: number = undefined;

let currentActiveTabId: number = undefined;

let sessionId: string = undefined;

const socketUrl = process.env.SOCKET_URL;

const videoTabs = {};

const getActiveVideoTabId = (videoUrl: string) => {
  for (const port of contentPorts) {
    if (port.sender.tab.url === videoUrl) {
      return port.sender.tab.id;
    }
  }

  log.info(`no active tab with the correct url`);
  return undefined;
}

const createWebSocketConnection: () => Promise<void> = async () => {
  if (websocket !== undefined) {
    log.warn(`tried to create websocket when one exists`);
    return Promise.resolve();
  }

  roomId = undefined;
  isHost = false;
  sessionId = undefined;
  videoUrl = undefined;
  activeVideoTabId = undefined;
  
  if('WebSocket' in window) {
    let socket: WebSocket;
    try {
      socket = await openWebsocket(socketUrl);

      socket.onmessage = (message) => {
        const jsonMessage = JSON.parse(message.data);
        const request = <IRequest> jsonMessage;

        log.info(`incoming websocket request [${request.requestAction}]`);

        switch (request.requestAction) {
          case 'sessionCreated':
            sessionId = (<ISessionCreatedRequest> request).sessionId;
            log.info(`session started [${sessionId}]`);
            break;
          case 'joinRoom':
            const joinRequest = <IJoinRoomRequest> request;
            roomId = joinRequest.roomId;
            isHost = joinRequest.hostId === sessionId;

            postToPopupPort(<IUpdateRoomInfoRequest> {
              requestAction: 'updateRoomInfo',
              roomId: roomId,
              isHost: isHost,
              videoUrl,
            });
            break;
          case 'leaveRoom':
            roomId = undefined;
            isHost = false;

            postToPopupPort(<IUpdateRoomInfoRequest> {
              requestAction: 'updateRoomInfo',
              roomId: undefined,
              isHost: false,
              videoUrl,
            });
            break;
          case 'updateStream':
            postToContentPort(request, activeVideoTabId);
            break;
          case 'syncVideo':
            const syncRequest = <ISyncVideoRequest> request;
            videoUrl = syncRequest.videoUrl;
            activeVideoTabId = getActiveVideoTabId(videoUrl);

            postToPopupPort(<IUpdateRoomInfoRequest> {
              requestAction: 'updateRoomInfo',
              roomId: roomId,
              isHost: isHost,
              videoUrl,
            });
            postToContentPort(request, activeVideoTabId);
            break;
          default:
        }
      };

      socket.onclose = () => {
        websocket = undefined;
        sessionId = undefined;
        videoUrl = undefined;
      }
    } catch(err) {
      return Promise.reject(err);
    }
  } else {
    return Promise.reject(new Error(`window doesn't support websockets`));
  }
}

const postToContentPort = (request: IRequest, id: number) => {
  for(const port of contentPorts) {
    if (port.sender.tab.id === id) {
      log.info(`sending [${request.requestAction}] to tab [${port.sender.tab.id}]`);
      return port.postMessage(request);
    } else {
      log.info(`blocking [${request.requestAction}] to tab [${port.sender.tab.id}]`);
    }
  }

  log.info(`request could not be sent to port [${id}]`);
}

const postToPopupPort = (message: IRequest) => {
  if (popupPort) {
    popupPort.postMessage(message);
  }
}

const openWebsocket = async (host) => {
  return new Promise((resolve: (ws: WebSocket) => void, reject: (err: Error) => void) => {
    websocket = new WebSocket(host);
  
    websocket.onopen = () => {
      return resolve(websocket);
    };

    websocket.onerror = () => {
      log.error(`websocket error`);
    }

    websocket.onclose = (ev: CloseEvent) => {
      if (ev.code !== 3001) {
        // failed to connect

        return reject(new Error(`websocket connection refused`));
      }
    }
  });
}

//Close the websocket connection
const closeWebSocketConnection = async () => {
  return new Promise((resolve: () => void) => {
    log.info('closing websocket connection');
    if (websocket != null || websocket != undefined) {
      websocket.close();
      websocket = undefined;
    }

    return resolve();
  });
}

const sendToWebsocket = async (request: IRequest) => {
  if (websocket === undefined) {
    try {
      log.info(`websocket not found, creating a new one`);
      await createWebSocketConnection();
    } catch(err) {
      return log.error(`failed to create websocket connection ${err.message ?  `[${err.message}]` : ''}`);
    }
  }
  
  log.info(`sending [${request.requestAction}] to websocket`);
  websocket.send(JSON.stringify(request));
}

const removePort = (port) => {
  for (let i = 0; i < contentPorts.length; i++) {
    if (contentPorts[i] === port) {
      contentPorts.splice(i,1);
    }
  }
  log.info(`removed content port, [${contentPorts.length}] remaining`);

  if (roomId === undefined && contentPorts.length === 0){
    closeWebSocketConnection();
  }
}

const updatePopupPort = (port: chrome.runtime.Port) => {
  if (popupPort) {
    popupPort.disconnect();
  }
    
  popupPort = port;
  popupPort.postMessage(<IUpdateRoomInfoRequest> {
    requestAction: 'updateRoomInfo',
    roomId: roomId,
    isHost: isHost,
    videoUrl,
  });


  chrome.tabs.query({active: true, lastFocusedWindow: true}, function (tabs: chrome.tabs.Tab[]) {
    const activeTab = tabs[0]
    log.info(`opening popup ${!!videoTabs[activeTab.id]}`)
    postToPopupPort(<IStartWatchingButtonState> {
      requestAction: 'setStartWatchingEnabled',
      enabled: !!videoTabs[activeTab.id],
    });
  });

  port.onMessage.addListener((request: IRequest) => {
    log.info(`incoming popup request [${request.requestAction}]`);

    switch (request.requestAction) {
      case 'createRoom':
      case 'joinRoom':
      case 'leaveRoom':
      case 'stopVideo':
        sendToWebsocket(request);
        break;
      case 'startVideoOnPage':
        chrome.tabs.query({active: true, lastFocusedWindow: true}, function (tabs: chrome.tabs.Tab[]) {
          const activeTab = tabs[0]
          postToContentPort(request, activeTab.id);
        });
        break;
      case 'openVideoTab':
        if (roomId !== undefined && videoUrl !== undefined) {
          chrome.tabs.create({ url: videoUrl });
        }
        break;
      case 'copyVideoUrl':
        if (roomId !== undefined && videoUrl !== undefined) {
          try {
            navigator.clipboard.writeText(videoUrl);
          } catch (err) {
            log.error(err);
          }
        }
        break;
      default:
        log.warn(`invalid popup requestAction action [${request.requestAction}]`);
    }
  });

  port.onDisconnect.addListener(() => {
    popupPort = undefined;
  });
}

chrome.tabs.onUpdated.addListener((tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
  if (changeInfo.url) {
    log.info(`tab [${tab.id}] URL changed. new URL [${changeInfo.url}]`)
    postToContentPort({ requestAction: 'urlChanged' }, tabId);
  }
});

chrome.tabs.onActivated.addListener((activeTabInfo: chrome.tabs.TabActiveInfo) => {
  currentActiveTabId = activeTabInfo.tabId;
  if (popupPort) {
    postToPopupPort(<IStartWatchingButtonState> {
      requestAction: 'setStartWatchingEnabled',
      enabled: !!videoTabs[activeTabInfo.tabId],
    });
  }
});

chrome.tabs.onRemoved.addListener((tabId: number, removeInfo: chrome.tabs.TabRemoveInfo) => {
  if (videoTabs[tabId]) {
    videoTabs[tabId] = undefined;
  }
});

chrome.runtime.onConnect.addListener(async (port: chrome.runtime.Port) => {
  log.info(`port connected to runtime from extension [${port.sender.id}]`);
  if (port.name === 'masonjar-popup') {
    log.info(`popup port connected`);
    updatePopupPort(port);

    port.onDisconnect.addListener(() => {
      log.info(`popup port disconnected`);
    })
  } else if (port.name === 'masonjar-content') {
    if (websocket === undefined) {
      try {
        await createWebSocketConnection();
      } catch(err) {
        log.error(`failed to create websocket connection ${err.message ?  `[${err.message}]` : ''}`);
      }
    }

    contentPorts.push(port);
    port.onMessage.addListener(async (request: IRequest) => {
      log.info(`incoming content request [${request.requestAction}]`);

      switch (request.requestAction) {
        case 'updateStream':
          if (roomId !== undefined && port.sender.tab.id === activeVideoTabId)
            await sendToWebsocket(request);
          else
            log.info(`throwing away request from inactive tab [${port.sender.tab.id}]`);
          break;
        case 'startVideo':
          await sendToWebsocket(request);
          break;
        case 'videoElementLoaded':
          if (port.sender.tab.url === videoUrl) {
            await sendToWebsocket(<IRequest> {
              requestAction: 'forceSync',
            });
          }

          videoTabs[port.sender.tab.id] = true;
          if (port.sender.tab.id === currentActiveTabId && popupPort) {
            postToPopupPort(<IStartWatchingButtonState> {
              requestAction: 'setStartWatchingEnabled',
              enabled: true,
            });
          };
          break;
        default:
          log.warn(`invalid content requestAction action [${request.requestAction}]`);
      }
    });

    log.info(`adding content port [${contentPorts.length}]`);
    port.onDisconnect.addListener((port: chrome.runtime.Port) => {
      removePort(port);
    })
  }
});