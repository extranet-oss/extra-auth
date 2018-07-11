const debug = require('debug')('extra-auth:server');
const Provider = require('oidc-provider');

const errorHandler = require('./error.js');

module.exports = function (client, config, keystore) {

  const users = client.service('users');

  const {
    logoutSource,
    frontchannelLogoutPendingSource
  } = require('./actions/logout.js')(config);

  const oidc = new Provider(config.hosts.login, {
    routes: {
      authorization: '/oauth/authorize',
      certificates: '/discovery/keys',
      check_session: '/session/check',
      end_session: '/session/end',
      introspection: '/oauth/tokeninfo',
      revocation: '/oauth/revoke',
      token: '/oauth/token',
      userinfo: '/openid/userinfo'
    },

    // eslint-disable-next-line no-unused-vars
    async interactionUrl(ctx, interaction) {
      return `/interaction/?request_id=${ctx.oidc.uuid}`;
    },

    formats: {
      default: 'opaque',
      AccessToken: 'jwt'
    },

    async findById(ctx, id) {
      return {
        accountId: id,
        async claims(use, scope) {
          debug('claims: ', use, scope);
          return new Promise ((resolve, reject) => {
            users.get(id)
              .then(data => {
                resolve({ sub: id });
              })
              .catch(reject);
          });
        },
      };
    },

    claims: {
      openid: ['sub', 'unique_name'],
      email: ['email'],
      profile: ['name', 'given_name', 'family_name', 'profile', 'picture', 'updated_at']
    },

    scopes: [
      'offline_access'
    ],

    features: {
      devInteractions: false,
      discovery: true,
      claimsParameter: true,
      conformIdTokenClaims: true,
      clientCredentials: true,
      encryption: false,
      alwaysIssueRefresh: false,
      request: false,
      requestUri: false,
      introspection: true,
      revocation: true,
      oauthNativeApps: true,
      sessionManagement: true,
      backchannelLogout: true,
      frontchannelLogout: true,
      registration: false,
      registrationManagement: false,
      pkce: true
    },

    extraParams: [
      'bypass_signin'
    ],

    cookies: {
      thirdPartyCheckUrl: config.oidc.cookies.thirdPartyCheckUrl
    },

    // eslint-disable-next-line no-unused-vars
    async postLogoutRedirectUri(ctx) {
      return 'https://tryextra.net/';
    },

    // eslint-disable-next-line no-unused-vars
    async renderError(ctx, out, error) {
      debug('Caught error on oidc provider app:');

      if (ctx.accepts('html')) {
        error.message = out.error_description;
        await errorHandler(ctx, error);
      } else {
        ctx.body = out;
      }
    },

    logoutSource,
    frontchannelLogoutPendingSource,

    // eslint-disable-next-line no-unused-vars
    async audiences(ctx, sub, token, use, scope) {
      if (use == 'access_token')
        return [config.hosts.api];

      return undefined;
    }
  });

  return oidc.initialize({
    keystore,
    clients: [{
      token_endpoint_auth_method: 'client_secret_basic',
      client_id: 'foo',
      client_secret: 'bar',
      redirect_uris: ['https://local.tryextra.net'],
      grant_types: ['authorization_code', 'implicit', 'refresh_token'],
      response_types: ['code', 'id_token'],
      frontchannel_logout_uri: 'https://local.tryextra.net/logout'
    }]
  });
};