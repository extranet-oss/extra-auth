const debug = require('debug')('extra-auth:server');
const { difference } = require('lodash');

const epochTime = require('oidc-provider/lib/helpers/epoch_time.js');

// eslint-disable-next-line no-unused-vars
module.exports = function (router, oidc, client, config) {

  const dest = '/interaction/';

  const checkSession = require('../middlewares/check-interaction-session.js')(oidc);

  const clients = client.service('clients');
  const authorizations = client.service('authorizations');

  async function login_prompt(ctx) {
    if (ctx.state.client.trusted && ctx.state.details.params.bypass_signin !== undefined) {
      debug('Sign-in screen bypass accepted');
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
      debug('Client is trusted, ignoring consent');
      await oidc.interactionFinished(ctx.req, ctx.res, {
        consent: {}
      });
      return;
    }

    ctx.state.scopes = ctx.state.details.params.scope.split(' ');
    ctx.state.title = `Connect with ${ctx.state.client.name}`;

    var matches = await authorizations.find({
      query: {
        $limit: 1,
        user_id: ctx.state.details.accountId,
        client_id: ctx.state.client.id
      }
    });

    if (matches.total == 1) {

      var authorization = matches.data[0];

      if (difference(ctx.state.scopes, authorization.scopes).length == 0
        && !ctx.state.prompts.includes('consent')) {
        debug('Client is already authorized, skipping consent');
        await oidc.interactionFinished(ctx.req, ctx.res, {
          consent: {}
        });
        return;
      }

      debug('Client is already authorized, but new scopes or consent prompt');
      ctx.state.title = `${ctx.state.client.name} is asking for new permissions`;
      ctx.state.authorized_scopes = authorization.scopes;
      ctx.state.scopes = difference(ctx.state.scopes, authorization.scopes);
    }

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
        ctx.state.details.save(ctx.state.details.exp - epochTime());
        debug('Initialized interaction meta data');
      }

      ctx.state.client = await clients.get(ctx.state.details.params.client_id);

      ctx.state.prompts = ctx.state.details.params.prompt ? ctx.state.details.params.prompt.split(' ') : [];

      let prompt = 'consent';

      if (!ctx.state.details.accountId ||
        (ctx.state.prompts.includes('login') &&
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
