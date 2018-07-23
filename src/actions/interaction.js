const debug = require('debug')('extra-auth:server');

// eslint-disable-next-line no-unused-vars
module.exports = function (router, oidc, client, config) {

  const dest = '/interaction/';

  const checkSession = require('../middlewares/check-interaction-session.js')(oidc);

  const clients = client.service('clients');

  async function login_prompt(ctx) {
    if (ctx.state.client.trusted && ctx.state.details.params.bypass_signin !== undefined) {
      debug(`Sign-in screen bypass accepted`);
      await ctx.redirect(`/interaction/azuread?request_id=${ctx.state.details.uuid}`);
      return;
    }

    ctx.state.title = 'Please Sign-in to continue.';
    if (ctx.state.details.accountId)
      ctx.state.title = 'Please Sign-in again to continue.';

    await ctx.render('login');
  }

  async function consent_prompt(ctx) {
    if (ctx.state.client.trusted) {
      debug(`Client is trusted, ignoring consent`);
      await oidc.interactionFinished(ctx.req, ctx.res, {
        consent: {}
      });
      return;
    }

    ctx.state.title = ctx.state.details.interaction.reason_description;
    ctx.state.scopes = ctx.state.details.params.scope.split(' ');

    await ctx.render('consent');
  }

  router.get(dest,
    checkSession,
    async function interaction(ctx) {
      debug('Interaction start', ctx.state.details.interaction.reason);

      if (!ctx.state.details.meta) {
        ctx.state.details.meta = {
          done: []
        };
        ctx.state.details.save();
        debug(`Initialized interaction meta data`);
      }

      ctx.state.client = await clients.get(ctx.state.details.params.client_id);

      let prompt = 'consent';

      if (!ctx.state.details.accountId ||
        (ctx.state.details.params.prompt &&
          ctx.state.details.params.prompt.split(' ').includes('login') &&
          !ctx.state.details.meta.done.includes('login')))
        prompt = 'login';

      debug(`Selecting ${prompt} prompt`);
      switch (prompt) {
        case 'login':
          await login_prompt(ctx);
          break;
        case 'consent':
          await consent_prompt(ctx);
          break;
      }
    }
  );
};
