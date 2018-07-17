const debug = require('debug')('extra-auth:server');
const io = require('socket.io-client');
const feathers = require('@feathersjs/feathers');
const socketio = require('@feathersjs/socketio-client');
const authentication = require('@feathersjs/authentication-client');
const localStorage = require('localstorage-memory');

module.exports = function (config) {
  const socket = io(config.extra_api.url, {transports: ['websocket']});
  const client = feathers();

  client.configure(socketio(socket));

  client.configure(authentication({
    storage: localStorage
  }));

  async function authenticate() {
    debug('Authenticating to extra-api...');
    try {
      await client.authenticate({
        strategy: 'token',
        token: config.extra_api.token
      });
      debug('Successfully authenticated to extra-api!');
    }
    catch (err) {
      debug(err);
    }
  }

  client.on('reauthentication-error', authenticate);
  authenticate();

  return client;
};
