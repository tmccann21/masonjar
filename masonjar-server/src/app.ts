import dotenv from 'dotenv';

dotenv.config();

import http from 'http';
import getenv from './util/getenv';
import express from 'express';
import WebSocket from 'ws';
import { socketConnect } from './socket/socket';

const port = getenv('PORT', true);
const app = express();



app.set('port', port);
app.use(express.json());


// catch 404 and forward to error handler
app.use(function(req, res, next) {
  res.statusCode = 404;
});

app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;

  // render the error page
  res.status(err.status || 500);
  res.json({
    error: err.message
  })
});

const server = http.createServer(app)
const wss = new WebSocket.Server({ server });
wss.on('connection', socketConnect)

console.log("Server Starting on Port: "+port)
server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
  var addr = server.address();
}
