const debug = require('debug')('extra-auth:adapter:client');
const errors = require('@feathersjs/errors');

module.exports = function (client) {

  let service = client.service('clients');

  class ClientAdapter {

    constructor(name) {
      this.name = name;
    }

    async find(id) {
      debug('Getting client', id);

      try {
        var data = await service.get(id);
      } catch (err) {
        debug(err);

        if (err instanceof errors.NotFound || err instanceof errors.BadRequest) {
          debug('Item not found, ignoring exception');
          return false;
        } else {
          throw err;
        }
      }

      return this.normalize_client(data);
    }

    async normalize_client(client) {
      let grant_types = [
        'implicit',
        'authorization_code',
        'refresh_token',
        'client_credentials'
      ];

      let response_types = [
        'code id_token token',
        'code id_token',
        'code token',
        'code',
        'id_token token',
        'id_token',
      ];

      return {
        application_type: client.type,
        client_id_issued_at: client.created_at,
        client_id: client.id,
        client_name: client.name,
        client_secret: client.secret,
        client_uri: client.links.homepage,
        grant_types,
        initiate_login_uri: client.links.login,
        logo_uri: undefined, //client.picture.url,
        policy_uri: client.links.privacy,
        redirect_uris: client.redirect_uris,
        response_types,
        token_endpoint_auth_method: 'client_secret_basic',
        tos_uri: client.links.tos,
        post_logout_redirect_uris: client.session.post_logout_redirect_uris,
        backchannel_logout_session_required: client.session.backchannel_logout_session_required,
        backchannel_logout_uri: client.session.backchannel_logout_uri,
        frontchannel_logout_session_required: client.session.frontchannel_logout_session_required,
        frontchannel_logout_uri: client.session.frontchannel_logout_uri,
        web_message_uris: client.web_message_uris
      };
    }

    static async connect(provider) {

      function clear_cache(client) {
        debug('Clearing client cache', client.id);
        provider.Client.cacheClear(client.id);
      }

      debug('Registering service events');
      service
        .on('updated', clear_cache)
        .on('patched', clear_cache)
        .on('removed', clear_cache);
    }
  }

  return ClientAdapter;
}
