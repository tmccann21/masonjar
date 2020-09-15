import log from '../util/log';
import { IUpdateRoomInfoRequest, IStartWatchingButtonState } from '../background';

var port = chrome.runtime.connect({name: 'masonjar-popup'});

interface IRequest {
  requestAction: string;
}

export interface IRoomViewRequest extends IRequest {
  roomName: string;
  roomId: string;
}

enum VIEW {
  'JOIN',
  'ROOM'
}

let view: VIEW = VIEW.JOIN;

let roomIdHeader: HTMLHeadingElement;
let startWatchingButton: HTMLButtonElement;
let stopWatchingButton: HTMLButtonElement;
let leaveRoomButton: HTMLButtonElement;

let openVideoButton: HTMLButtonElement;
let copyLinkButton: HTMLButtonElement;
let openVideoControls: HTMLDivElement;

let waitingForHostMessage: HTMLParagraphElement;

function hasClass(element, className) {
  return !!element.className.match(new RegExp('(\\s|^)'+className+'(\\s|$)'));
}

function addClass(element, className) {
  if (!hasClass(element, className)) {
    element.className += (element.className.length > 0 ? ' ' : '') + className;
  }
}

function removeClass(element, className) {
  if (hasClass(element, className)) {
    var reg = new RegExp('(\\s|^)'+className+'(\\s|$)');
    element.className= element.className.replace(reg,' ');
  }
}


const updateView = (nextState: VIEW) => {
  const roomViewElement = document.getElementById('room-view');
  const joinViewElement = document.getElementById('join-view');
  if (nextState === VIEW.JOIN) {
    addClass(roomViewElement, 'isHidden');
    removeClass(joinViewElement, 'isHidden');
  } else if (nextState = VIEW.ROOM) {
    addClass(joinViewElement, 'isHidden');
    removeClass(roomViewElement, 'isHidden');
  }

  view = nextState;
}

const updateHostControls = (isHost: boolean, isWatching: boolean) => {
  if (isHost) {
    leaveRoomButton.textContent = 'Close Room';
    addClass(waitingForHostMessage, 'isHidden');

    if (isWatching) {
      addClass(startWatchingButton, 'isHidden');
      removeClass(stopWatchingButton, 'isHidden');
      removeClass(openVideoControls, 'isHidden');
    } else {
      removeClass(startWatchingButton, 'isHidden');
      addClass(stopWatchingButton, 'isHidden');
      addClass(openVideoControls, 'isHidden');
    }
  } else {
    if (isWatching) {
      addClass(waitingForHostMessage, 'isHidden');
      removeClass(openVideoControls, 'isHidden');
    } else {
      removeClass(waitingForHostMessage, 'isHidden');
      addClass(openVideoControls, 'isHidden');
    }
    leaveRoomButton.textContent = 'Leave Room';

    addClass(stopWatchingButton, 'isHidden');
    addClass(startWatchingButton, 'isHidden');
  }
}

port.onMessage.addListener((incomingRequest) => {
  const request = <IRequest> incomingRequest;

  switch (request.requestAction) {
    case 'updateRoomInfo':
      const updateRequest = <IUpdateRoomInfoRequest> request;
      if (updateRequest.roomId === undefined) {
        updateView(VIEW.JOIN);
      } else {
        updateView(VIEW.ROOM);
        roomIdHeader.textContent = `you are in room ${updateRequest.roomId}`
        updateHostControls(updateRequest.isHost, updateRequest.videoUrl !== undefined);
      }
      break;
    case 'setStartWatchingEnabled':
      const buttonState = (<IStartWatchingButtonState> request).enabled;
      startWatchingButton.disabled = (buttonState !== undefined) ? !buttonState : true;
      break;
    default:
      log.warn(`invalid popup requestAction action [${incomingRequest.requestAction}]`);
  }
});

document.addEventListener('DOMContentLoaded', function() {
  const joinRoomButton = <HTMLButtonElement> document.getElementById('join-room-btn');
  const createRoomButton = <HTMLButtonElement> document.getElementById('create-room-btn');
  leaveRoomButton = <HTMLButtonElement> document.getElementById('leave-room-btn');
  startWatchingButton = <HTMLButtonElement> document.getElementById('start-watching-btn');
  stopWatchingButton = <HTMLButtonElement> document.getElementById('stop-watching-btn');
  waitingForHostMessage = <HTMLParagraphElement> document.getElementById('waiting-for-host');
  roomIdHeader = <HTMLHeadingElement> document.getElementById('room-id');
  openVideoButton = <HTMLButtonElement> document.getElementById('open-video-btn');
  copyLinkButton = <HTMLButtonElement> document.getElementById('copy-link-btn');
  
  openVideoControls = <HTMLDivElement> document.getElementById('open-video-controls');

  const roomInput = <HTMLInputElement> document.getElementById('room-input');

  joinRoomButton.addEventListener('click', (ev: MouseEvent) => {
    port.postMessage({ requestAction: 'joinRoom', roomId: roomInput.value.toUpperCase() });
  });

  createRoomButton.addEventListener('click', (ev: MouseEvent) => {
    port.postMessage({ requestAction: 'createRoom', roomName: 'temp' });
  });

  leaveRoomButton.addEventListener('click', (ev: MouseEvent) => {
    port.postMessage({ requestAction: 'leaveRoom' });
  });

  startWatchingButton.addEventListener('click', () => {
    port.postMessage({ requestAction: 'startVideoOnPage' });
  });

  stopWatchingButton.addEventListener('click', () => {
    port.postMessage({ requestAction: 'stopVideo' });
  });

  openVideoButton.addEventListener('click', () => {
    port.postMessage({ requestAction: 'openVideoTab' });
  });

  copyLinkButton.addEventListener('click', () => {
    port.postMessage({ requestAction: 'copyVideoUrl' });
  });
});