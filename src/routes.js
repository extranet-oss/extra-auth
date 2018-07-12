const Router = require('koa-router');

const interaction = require('./actions/interaction.js');
const azuread = require('./actions/azuread.js');
const failed = require('./actions/failed.js');

module.exports = function (app, oidc, config) {

  // Create default routes
  const router = new Router();

  app.use(router.routes())
    .use(router.allowedMethods());

  interaction(router, oidc, config);
  azuread(router, oidc, config);
  failed(router, oidc, config);
};
