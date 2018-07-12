const debug = require('debug')('extra-auth:server');
const merge = require('lodash.merge');

// eslint-disable-next-line no-unused-vars
module.exports = function (router, oidc, config) {

  const dest = '/interaction/failed';

  const checkSession = require('../middlewares/check-interaction-session.js')(oidc);

  router.get(dest,
    checkSession,
    async function failed(ctx) {
      debug('Interaction failed');
      ctx.state = merge(ctx.state, ctx.flash.get());

      await ctx.render('failed');
    }
  );
};
