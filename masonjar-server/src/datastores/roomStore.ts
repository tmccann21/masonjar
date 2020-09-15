import { randomString } from '../util/randomString';

// in memory room storage because i dont want to get postgres up and running
// for a 3 day hack

export interface IVideoInfo {
  url: string;
  timestamp: number;
  lastUpdated: number;
  playing: boolean;
}

export interface IRoom {
  name: string;
  id: string;
  host: string;
  sockets: string[];
  videoInfo: IVideoInfo;
}

export interface IRoomStore {
  create: (host: string, name: string) => IRoom;
  get: (id: string) => IRoom;
  delete: (id: string) => void;
}
const _data: {[key: string]: IRoom} = {};

const roomStore: IRoomStore = {
  create: (host, name) => {
    let roomId = randomString(6);
    while (_data[roomId] !== undefined) {
      roomId = randomString(6);
    }

    const newRoom = {
      name,
      host,
      id: roomId,
      sockets: [ host ],
      videoInfo: {
        url: undefined,
        timestamp: 0,
        lastUpdated: Date.now(),
        playing: false,
      },
    }
    
    _data[roomId] = newRoom;
    return newRoom;
  },
  get: id => _data[id],
  delete: id => _data[id] = undefined,
}

export default roomStore;