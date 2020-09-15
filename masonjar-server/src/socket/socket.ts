import WebSocket from 'ws';
import http from 'http';

import log from '../util/log';
import socketStore, { ISocketData } from '../datastores/socketStore';

import roomController, { ISyncVideoRequest } from '../controllers/roomController';

export interface ISocketRequest {
  requestAction: string;
}

export interface IJoinRoomRequest extends ISocketRequest {
  roomId: string;
}

export interface ISessionCreated extends ISocketRequest {
  sessionId: string;
}

export interface IVideoUpdate {
  url?: string;
  playing?: boolean;
  timestamp?: number;
}

export interface IStreamUpdate extends ISocketRequest {
  updateAction: string;
  timestamp: number;
  videoTimestamp: number;
}

export interface IStartWatching extends ISocketRequest {
  playing: boolean;
  videoTimestamp: number;
  videoUrl: string;
}

const socketConnect = (ws: WebSocket, request: http.IncomingMessage) => {
  const newSocket: ISocketData = socketStore.create(ws);
  const socketId = newSocket.sessionId;

  log.info(`new user [${socketId}] connected`);
  newSocket.socket.send(<ISessionCreated> { requestAction: 'sessionCreated', sessionId: socketId });
  ws.on('message', (data: WebSocket.Data) => {
    const jsonData = JSON.parse(data.toString());
    const requestAction = (<ISocketRequest> jsonData).requestAction;
    log.info(`received [${requestAction}] from user [${socketId}]`);
    switch (requestAction) {
      case 'createRoom':
        roomController.create(socketId, 'test');
        break;
      case 'joinRoom':
        const joinRoomRequest = <IJoinRoomRequest> jsonData;
        roomController.join(socketId, joinRoomRequest.roomId);
        break;
      case 'leaveRoom':
        roomController.evict(socketId);
        break;
      case 'updateStream':
        const updateRequest = <IStreamUpdate> jsonData;
        const timeDiff = (Date.now() - updateRequest.timestamp) / 1000;
        log.info(`updateStream:${updateRequest.updateAction} from user [${socketId}]`);
        
        roomController.updateVideoInfo(socketId, {
          playing: updateRequest.updateAction === 'play',
          timestamp: updateRequest.videoTimestamp + timeDiff,
        });
        roomController.broadcast(socketId, jsonData, false)
        break;
      case 'startVideo':
        const watchRequest = <IStartWatching> jsonData;

        roomController.updateVideoInfo(socketId, {
          playing: watchRequest.playing,
          url: watchRequest.videoUrl,
          timestamp: watchRequest.videoTimestamp,
        });

        roomController.broadcast(socketId, <ISyncVideoRequest> {
          requestAction: 'syncVideo',
          videoUrl: watchRequest.videoUrl,
          videoTimestamp: watchRequest.videoTimestamp,
          playing: watchRequest.playing,
          timestamp: Date.now(),
        }, true);
        break;
      case 'stopVideo':
        roomController.updateVideoInfo(socketId, {
          playing: false,
          url: undefined,
          timestamp: 0,
        });

        roomController.broadcast(socketId, <ISyncVideoRequest> {
          requestAction: 'syncVideo',
          videoUrl: undefined,
          videoTimestamp: 0,
          playing: false,
          timestamp: Date.now(),
        }, true);
        break;
      case 'forceSync':
        roomController.forceSync(socketId);
        break;
      default:
        log.warn(`invalid request action ${requestAction}`);
    }
  });

  ws.on('close', (_, reason: string) => {
    log.info(`user [${socketId}] is leaving ${reason ? 'for reason: '+reason : ''}`);
    const currentSocketData = socketStore.get(socketId);

    if (currentSocketData.roomId !== undefined) {
      roomController.evict(socketId);
    }
    socketStore.remove(socketId);
  });
}

export {
  socketConnect,
}