const debug = require('debug')('extra-auth:server');

// eslint-disable-next-line no-unused-vars
module.exports = function (router, oidc, client, config) {

  const dest = '/interaction/';

  const checkSession = require('../middlewares/check-interaction-session.js')(oidc);

  const clients = client.service('clients');

  router.get(dest,
    checkSession,
    async function interaction(ctx) {
      debug('Interaction start');

      ctx.state.title = ctx.state.details.interaction.reason_description;
      ctx.state.client = await clients.get(ctx.state.details.params.client_id);

      switch (ctx.state.details.interaction.reason) {
      default:
        await ctx.render('login');
      }
    }
  );
};
