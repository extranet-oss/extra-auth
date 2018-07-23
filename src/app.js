const debug = require('debug')('extra-auth:server');
const Koa = require('koa');

const morgan = require('koa-morgan');
const helmet = require('koa-helmet');
const conditional = require('koa-conditional-get');
const etag = require('koa-etag');
const hbs = require('koa-hbs');
const path = require('path');
const serve = require('koa-static');
const session = require('koa-session');
const flash = require('koa-flash-simple');
const bodyparser = require('koa-body');
const mount = require('koa-mount');

const errorHandler = require('./error.js');
const setupAuthentication = require('./authentication.js');
const setupApiClient = require('./extra-api.js');
const setupProvider = require('./oidc.js');
const setupRoutes = require('./routes.js');

const config = require('../config/config.json');
const jwks = require('../config/jwks.json');
const cookiekeys = require('../config/cookiekeys.json');


debug('Creating master app...');

// Create app
const app = new Koa();

// Trust proxy
app.proxy = true;
app.keys = cookiekeys;

// Request logger
app.use(morgan('dev'));
app.use(helmet());

// Conditionnal GET for saving bandwidth
app.use(conditional());
app.use(etag());

// View engine setup (shared with sub-app)
const viewEngine = hbs.middleware({
  viewPath: path.join(__dirname, 'views'),
  defaultLayout: 'layout'
});
app.use(viewEngine);

// Public directory setup
app.use(serve(path.join(__dirname, '../public'), {
  maxage: 0
}));

// Error handler setup
app.use(async function errorHandlerMiddleware(ctx, next) {
  try {
    await next();
  } catch (error) {
    debug('Caught error on master app');
    await errorHandler(ctx, error);
  }
});

// session setup
app.use(session({ signed: false }, app));
app.use(flash());

// parse body
app.use(bodyparser({ patchNode: true }));

// Setup extra-api client
const client = setupApiClient(config);

// Setup passport strategies
setupAuthentication(app, client, config);

// OIDC Provider setup
debug('Setting up oidc provider...');
setupProvider(client, config, jwks, cookiekeys)
  .then(function providerReady(oidc) {
    oidc.proxy = true;

    debug('Oidc provider app ready.');
    debug('Setting up interaction routes...');

    oidc.use(viewEngine);

    // setup interaction routes, needing oidc instance
    setupRoutes(app, oidc, client, config);

    debug('Mounting oidc provider to main app...');
    app.use(mount(oidc.app));
  })
  .catch((err) => {
    throw err;
  });

module.exports = app;
