const debug = require('debug')('extra-auth:adapter');

const MemoryAdapter = require('oidc-provider/lib/adapters/memory_adapter.js');

module.exports = function (client) {

  const ClientAdapter = require('./client.js')(client);

  class AdapterProxy {

    constructor(name) {
      debug(`${name}.constructor`);

      this.name = name;

      switch (this.name) {
        case "Session":
        case "AuthorizationCode":
        case "AccessToken":
        case "RefreshToken":
        case "ClientCredentials":
          this.adapter = new MemoryAdapter(this.name);
          break;
        case "Client":
          this.adapter = new ClientAdapter(this.name);
          break;
      }
    }

    async upsert(id, payload, expiresIn) {
      debug(`${this.name}.upsert`, id);

      return this.adapter.upsert(id, payload, expiresIn);
    }

    async find(id) {
      debug(`${this.name}.find`, id);

      return this.adapter.find(id);
    }

    async consume(id) {
      debug(`${this.name}.consume`, id);

      return this.adapter.consume(id);
    }

    async destroy(id) {
      debug(`${this.name}.destroy`, id);

      return this.adapter.destroy(id);
    }

    static async connect(provider) {
      debug('Adapter.connect');

      MemoryAdapter.connect(provider);
      ClientAdapter.connect(provider);
    }
  }

  return AdapterProxy;
}
