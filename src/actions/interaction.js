const debug = require('debug')('extra-auth:server');

// eslint-disable-next-line no-unused-vars
module.exports = function (router, oidc, config) {

  const dest = '/interaction/';

  const checkSession = require('../middlewares/check-interaction-session.js')(oidc);

  router.get(dest,
    checkSession,
    async function interaction(ctx) {
      debug('Interaction start');

      ctx.state.title = ctx.state.details.interaction.reason_description;

      switch (ctx.state.details.interaction.reason) {
      default:
        await ctx.render('login');
      }
    }
  );
};
