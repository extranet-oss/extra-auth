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
    function(iss, sub, profile, accessToken, refreshToken, done) {
      if (!profile.oid || !profile.upn)
        return done(null, false, 'Invalid azuread account.');

      users.find({
        query: {
          intra_id: profile.upn
        }
      })
        .then(matches => {
          if (matches.total == 0)
            return done(null, false, 'Your account is not yet registered on the intranet.');

          // deny login if user is suspended
          if (matches.data[0].suspended)
            return done(null, false, `Account suspended. ${matches.data[0].suspended_reason ? matches.data[0].suspended_reason : ''}`);

          done(null, matches.data[0]);
        })
        .catch(err => done(err));
    }
  ));
};
