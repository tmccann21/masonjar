import WebSocket from 'ws';
import { ISocketRequest } from '../socket/socket';
import { randomHex } from '../util/randomString';

const _data: {[key: string]: ISocketData} = {};
let socketCount = 0; // awful way to do this lol

class WrappedWebsocket {
  _socket: WebSocket;
  constructor(socket: WebSocket) {
    this._socket = socket;
  }

  send(message: ISocketRequest) {
    return this._socket.send(JSON.stringify(message));
  }

  close() {
    return this._socket.close()
  }

  getSocket() {
    return this._socket;
  }
}

export interface ISocketData {
  socket: WrappedWebsocket;
  roomId: string;
  sessionId: string;
}

export interface ISocketStore {
  create: (socket: WebSocket) => ISocketData;
  get: (id: string) => ISocketData;
  remove: (id: string) => void;
}

const socketStore: ISocketStore = {
  create: (socket: WebSocket) => {
    const nextId = randomHex(8);

    _data[nextId] = {
      socket: new WrappedWebsocket(socket),
      roomId: undefined,
      sessionId: nextId,
    };

    return _data[nextId];
  },
  get: (id: string) => _data[id],
  remove: (id: string) => {
    if (_data[id] === undefined)
      return;

    _data[id].socket.close()
    _data[id] = undefined;
  }
}

export default socketStore;