const debug = require('debug')('extra-auth:server');
const Provider = require('oidc-provider');
const { union } = require('lodash');

const errorHandler = require('./error.js');

module.exports = function (client, config, jwks, cookiekeys) {

  const Adapter = require('./adapters')(client);

  const users = client.service('users');
  const authorizations = client.service('authorizations');

  const {
    logoutSource,
    frontchannelLogoutPendingSource
  } = require('./actions/logout.js')(config);

  const oidc = new Provider(config.hosts.login, {
    routes: {
      authorization: '/oauth/authorize',
      certificates: '/.well-known/jwks.json',
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
      AccessToken: 'jwt',
      ClientCredentials: 'jwt'
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
      pkce: true,
      webMessageResponseMode: true,
      deviceCode: false,
      jwtIntrospection: false
    },

    extraParams: [
      'bypass_signin'
    ],

    cookies: {
      keys: cookiekeys,
      long: {
        secure: true,
        signed: true,
        httpOnly: true,
        maxAge: (14 * 24 * 60 * 60) * 1000 // 14 days in ms
      },
      short: {
        secure: true,
        signed: true,
        httpOnly: true,
        maxAge: (10 * 60) * 1000 // 10 minutes in ms
      },
      names: {
        session: '_session',
        interaction: '_grant',
        resume: '_grant',
        state: '_state'
      },
      thirdPartyCheckUrl: config.oidc.cookies.thirdPartyCheckUrl
    },

    tokenEndpointAuthMethods: [
      'client_secret_basic',
    ],

    unsupported: {
      idTokenSigningAlgValues: ['none', 'HS256', 'HS384', 'HS512'],
      userinfoSigningAlgValues: ['none', 'HS256', 'HS384', 'HS512']
    },

    async interactionCheck(ctx) {
      debug('!!!!!!!!!!!!!!InteractionCheck!!!!!!!!!!!!!!', ctx.oidc.result);

      if (!ctx.oidc.result || !ctx.oidc.result.consent) { //ctx.oidc.session.sidFor(ctx.oidc.client.clientId)) {
        return {
          error: 'consent_required',
          error_description: 'client not authorized for End-User yet',
          reason: 'client_not_authorized',
        };
      }

      if (ctx.oidc.client.applicationType === 'native'
        && ctx.oidc.params.response_type !== 'none'
        && !ctx.oidc.result) {
        return {
          error: 'interaction_required',
          error_description: 'native clients require End-User interaction',
          reason: 'native_client_prompt',
        };
      }

      var matches = await authorizations.find({
        query: {
          $limit: 1,
          user_id: ctx.oidc.session.accountId(),
          client_id: ctx.oidc.params.client_id
        }
      });

      if (matches.total == 1) {
        var authorization = matches.data[0];

        debug('Client already authorized, updating scopes & timestamp');
        await authorizations.patch(authorization.id, {
          scopes: union(authorization.scopes, ctx.oidc.params.scope.split(' '))
        });
      } else {

        debug('Client not authorized, creating entry');
        await authorizations.create({
          scopes: ctx.oidc.params.scope.split(' '),
          client_id: ctx.oidc.params.client_id,
          user_id: ctx.oidc.session.accountId()
        });
      }

      return false;
    },

    // eslint-disable-next-line no-unused-vars
    async postLogoutRedirectUri(ctx) {
      return 'https://local.tryextra.net/';
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
      if (use == 'access_token' || use == 'client_credentials')
        return [config.hosts.api];

      return undefined;
    }
  });

  return oidc.initialize({
    keystore: jwks,
    adapter: Adapter
  });
};
