const debug = require('debug')('extra-auth:server');
const passport = require('koa-passport');
const { pull } = require('lodash');

const epochTime = require('oidc-provider/lib/helpers/epoch_time.js');

// eslint-disable-next-line no-unused-vars
module.exports = function (router, oidc, config) {

  const dest = '/interaction/azuread';

  const checkSession = require('../middlewares/check-interaction-session.js')(oidc);

  async function azureadFailure(ctx, message) {
    ctx.flash.set({
      title: 'Failed to sign in',
      message
    });
    await ctx.redirect(`/interaction/failed?request_id=${ctx.state.details.uuid}`);
  }

  router.get(dest,
    checkSession,
    async function azureadStart(ctx, next) {
      debug('Interaction azuread');
      await passport.authenticate('azuread-openidconnect', {
        failureRedirect: `/interaction/?request_id=${ctx.state.details.uuid}`,
        session: false,
        domain_hint: config.azuread.tenantDomain
      }, async function (err, user, info) {
        if (err) throw err;
        if (!user) return await azureadFailure(ctx, info);

        ctx.state.user = user;
        await next();
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
      }, async function (err, user, info) {
        if (err) throw err;
        if (!user) return await azureadFailure(ctx, info);

        ctx.state.user = user;
        await next();
      })(ctx, next);
    },
    async function azureadSuccess(ctx) {
      debug('Interaction azuread callback #2');

      await oidc.setProviderSession(ctx.req, ctx.res, {
        account: ctx.state.user.id
      });
      ctx.state.details.accountId = ctx.state.user.id;
      pull(ctx.state.details.prompts, 'login');
      ctx.state.details.params.prompt = ctx.state.details.prompts.join(' ');
      await ctx.state.details.save(ctx.state.details.exp - epochTime());
      await ctx.redirect(`/interaction/?request_id=${ctx.state.details.uuid}`);
    }
  );
};
