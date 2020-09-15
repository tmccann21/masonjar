const readStorage = async (key: string) => {
  return new Promise((resolve: (val: any) => void) => {
    chrome.storage.local.get(key, function(result) {
      return resolve(result);
    });
  });
}

const writeStorage = async (key: string, value: any) => {
  return new Promise((resolve: () => void) => {
    chrome.storage.local.set({[ key ]: value}, function() {
      return resolve();
    });
  });
}

const delay = (ms: number) => new Promise( resolve => setTimeout(resolve, ms));

const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJLKMNOPQRSTUVWXYZ123456789';

const randomString = (len: number) => {
  let str = '';

  for (let i = 0; i < len; i++) {
    str += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return str;
}

export {
  readStorage,
  writeStorage,
  randomString,
  delay,
}