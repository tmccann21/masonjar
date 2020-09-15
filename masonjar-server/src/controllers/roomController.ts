import log from '../util/log';
import socketStore from '../datastores/socketStore';
import roomStore, { IVideoInfo } from '../datastores/roomStore';
import { ISocketRequest, IVideoUpdate } from '../socket/socket';

export interface IRoomController {
  create: (hostId: string, roomName: string) => string;
  join: (socketId: string, roomId: string) => void;
  evict: (socketId: string) => void;
  updateVideoInfo: (socketId: string, fields: IVideoUpdate) => void;
  forceSync: (socketId: string) => void;
  broadcast: (socketId: string, request: ISocketRequest, replay: boolean) => void;
}

export interface IJoinedRoomRequest extends ISocketRequest {
  roomId: string;
  hostId: string;
}

export interface ISyncVideoRequest extends ISocketRequest {
  videoUrl: string;
  videoTimestamp: number;
  playing: boolean;
  timestamp: number;
}

const roomController: IRoomController = {
  create: (hostId: string, roomName: string) => {
    const currentSocketData = socketStore.get(hostId);
    if (currentSocketData.roomId) {
      log.warn(`user [${hostId}] in room ${currentSocketData.roomId} tried to create a new room`);
      return currentSocketData.roomId;
    }

    const newRoom = roomStore.create(hostId, roomName);
    log.info(`user [${hostId}] created room ${newRoom.id}`);

    currentSocketData.roomId = newRoom.id;
    currentSocketData.socket.send(<IJoinedRoomRequest> {
      requestAction: 'joinRoom',
      roomId: newRoom.id,
      hostId: newRoom.host,
    });
    return newRoom.id;
  },
  join: (socketId: string, roomId: string) => {
    const room = roomStore.get(roomId);
    const currentSocketData = socketStore.get(socketId);

    if (currentSocketData.roomId !== undefined) {
      log.warn(`user ${socketId} in room ${currentSocketData.roomId} tried to join a new room`);
      return;
    }

    if (room && !room.sockets.includes(socketId)) {
      room.sockets.push(socketId);
      log.info(`user ${socketId} joined room ${roomId}`);
      currentSocketData.roomId = room.id;
      currentSocketData.socket.send(<IJoinedRoomRequest> {
        requestAction: 'joinRoom',
        roomId: roomId,
        hostId: room.host,
      });
      
      const currentVideoTimestamp = room.videoInfo.timestamp + (room.videoInfo.playing ? (Date.now() - room.videoInfo.lastUpdated) / 1000 : 0);

      currentSocketData.socket.send(<ISyncVideoRequest> {
        requestAction: 'syncVideo',
        videoUrl: room.videoInfo.url,
        videoTimestamp: currentVideoTimestamp,
        playing: room.videoInfo.playing,
        timestamp: Date.now(),
      });
    }
  },
  evict: (socketId: string) => {
    const currentSocketData = socketStore.get(socketId);
    if (currentSocketData.roomId === undefined) {
      return log.warn(`user [${socketId}] tried to leave room but isn't in one`);
    }

    const room = roomStore.get(currentSocketData.roomId);
    if (room === undefined) {
      currentSocketData.roomId = undefined;
      return log.warn(`user [${socketId}] has roomId but room does not exist`);
    }

    if (room.host === socketId) {
      for (const socket of room.sockets) {
        const socketToEvict = socketStore.get(socket);
        log.info(`evicting user [${socket}] from room ${room.id}`);
        socketToEvict.socket.send({ requestAction: 'leaveRoom' });
        socketToEvict.roomId = undefined;
      }
      log.info(`closing room ${room.id}`);
      roomStore.delete(room.id);
    } else { 
      for (let i = 0; i < room.sockets.length; i++) {
        if (room.sockets[i] === socketId) {
          log.info(`evicting user [${socketId}] from room ${currentSocketData.roomId}`);
          room.sockets.splice(i, 1);
          currentSocketData.roomId = undefined;
          currentSocketData.socket.send({ requestAction: 'leaveRoom' });
        }
      }
    }
  },
  updateVideoInfo: (socketId: string, fields: IVideoUpdate) => {
    const currentSocketData = socketStore.get(socketId);

    const room = roomStore.get(currentSocketData.roomId);

    if (room === undefined) {
      currentSocketData.roomId = undefined;
      return log.warn(`user [${socketId}] has roomId but room does not exist`);
    }

    room.videoInfo.url = fields['url'] ? fields['url'] : room.videoInfo.url;
    room.videoInfo.timestamp = fields['timestamp'] ? fields['timestamp'] : room.videoInfo.timestamp;
    room.videoInfo.playing = fields['playing'] !== undefined ? fields['playing'] : room.videoInfo.playing;
    room.videoInfo.lastUpdated = Date.now();
  },
  forceSync: (socketId: string) => {
    const currentSocketData = socketStore.get(socketId);
    if (currentSocketData.roomId === undefined) {
      return log.warn(`user [${socketId}] tried to force sync with a room but isn't in one`);
    }

    const room = roomStore.get(currentSocketData.roomId);
    if (room === undefined) {
      currentSocketData.roomId = undefined;
      return log.warn(`user [${socketId}] has roomId but room does not exist`);
    }

    const currentVideoTimestamp = room.videoInfo.timestamp + (room.videoInfo.playing ? (Date.now() - room.videoInfo.lastUpdated) / 1000 : 0);
    currentSocketData.socket.send(<ISyncVideoRequest> {
      requestAction: 'syncVideo',
      videoUrl: room.videoInfo.url,
      videoTimestamp: currentVideoTimestamp,
      playing: room.videoInfo.playing,
      timestamp: Date.now(),
    });
  },
  broadcast: (socketId: string, request: ISocketRequest, replay: boolean = true) => {
    const currentSocketData = socketStore.get(socketId);
    if (currentSocketData.roomId === undefined) {
      return log.warn(`user [${socketId}] tried to broadcast to a room but isn't in one`);
    }

    const room = roomStore.get(currentSocketData.roomId);
    if (room === undefined) {
      currentSocketData.roomId = undefined;
      return log.warn(`user [${socketId}] has roomId but room does not exist`);
    }

    if (room.videoInfo.url === undefined) {
      return log.warn(`user [${socketId}] tried to broadcast to a room that wasn't watching`)
    }

    for (const socket of room.sockets) {
      if (!replay && socket === socketId)
        continue;
      log.info(`broadcasting ${request.requestAction} to user [${socket}]`)
      socketStore.get(socket).socket.send(request);
    }
  },
}

export default roomController;