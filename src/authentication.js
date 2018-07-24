const debug = require('debug')('extra-auth:server');
const passport = require('koa-passport');
const { OIDCStrategy } = require('passport-azure-ad');

module.exports = function (app, client, config) {
  // setup passport strategies
  debug('Setting up passport...');

  app.use(passport.initialize());
  app.use(passport.session());

  const users = client.service('users');

  passport.use(new OIDCStrategy(
    {
      identityMetadata: `https://login.microsoftonline.com/${config.azuread.tenantID}/.well-known/openid-configuration`,
      clientID: config.azuread.clientID,
      responseType: 'id_token',
      responseMode: 'form_post',
      redirectUrl: `${config.hosts.login}/interaction/azuread`,
      allowHttpForRedirectUrl: config.hosts.login.startsWith('http'),
      passReqToCallback: false
    },
    async function (iss, sub, profile, accessToken, refreshToken, done) {
      if (!profile.oid || !profile.upn)
        return done(null, false, 'Invalid azuread account.');

      try {
        var matches = await users.find({
          query: {
            $limit: 1,
            intra_code: profile.upn
          }
        });
      } catch (err) {
        done(err);
      }

      if (matches.total == 0)
        return done(null, false, 'Your account is not yet registered on the intranet.');

      var user = matches.data[0];

      // deny login if user is suspended
      if (user.suspended)
        return done(null, false, `Account suspended. ${user.suspended_reason ? user.suspended_reason : ''}`);

      done(null, user);
    }
  ));
};
