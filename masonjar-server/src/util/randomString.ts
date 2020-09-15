const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'
const hex = '0123456789abcdef'


const randomString: (len: number) => string = (len: number) => {
  let out = '';
  for (let i = 0; i < len; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return out
}

const randomHex: (len: number) => string = (len: number) => {
  let out = '';
  for (let i = 0; i < len; i++) {
    out += hex[Math.floor(Math.random() * hex.length)];
  }

  return out
}


export {
  randomString,
  randomHex, 
}