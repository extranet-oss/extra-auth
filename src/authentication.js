const debug = require('debug')('extra-auth:server');
const passport = require('koa-passport');
const { OIDCStrategy } = require('passport-azure-ad');

module.exports = function (app, config) {
  // setup passport strategies
  debug('Setting up passport...');

  app.use(passport.initialize());
  app.use(passport.session());

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
      if (!profile.oid) {
        return done(new Error('No oid found'), null);
      }
      debug('azuread:', {iss, sub, profile, accessToken, refreshToken});
      done(null, profile);
    }
  ));
};
