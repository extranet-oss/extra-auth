const debug = require('debug')('extra-auth:server');
const passport = require('koa-passport');

// eslint-disable-next-line no-unused-vars
module.exports = function (router, oidc, config) {

  const dest = '/interaction/azuread';

  const checkSession = require('../middlewares/check-interaction-session.js')(oidc);

  router.get(dest,
    checkSession,
    async function azureadStart(ctx, next) {
      debug('Interaction azuread');
      await passport.authenticate('azuread-openidconnect', {
        failureRedirect: `/interaction/?request_id=${ctx.state.details.uuid}`,
        session: false,
        domain_hint: config.azuread.tenantDomain
      })(ctx, next);
    }
  );

  router.post(dest,
    checkSession,
    async function azureadContinue(ctx, next) {
      debug('Interaction azuread callback');
      await passport.authenticate('azuread-openidconnect', {
        failureRedirect: `/interaction/?request_id=${ctx.state.details.uuid}`,
        session: false
      })(ctx, next);
    },
    async function azureadSuccess(ctx) {
      debug('Interaction azuread callback #2');
      await oidc.interactionFinished(ctx.req, ctx.res, {
        login: {
          account: ctx.state.user.id
        }
      });
    }
  );
};
