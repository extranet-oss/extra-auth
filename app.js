const Koa = require('koa');
const morgan = require('koa-morgan');
const conditional = require('koa-conditional-get');
const etag = require('koa-etag');
const path = require('path');
const hbs = require('koa-hbs');
const serve = require('koa-static');
const statuses = require('statuses');
const Router = require('koa-router');
const mount = require('koa-mount');

// Create app
const app = new Koa();

// Trust proxy
app.proxy = true;

// Request logger
app.use(morgan('dev'));

// Conditionnal GET for saving bandwidth
app.use(conditional());
app.use(etag());

// View engine setup (shared with sub-app)
const view_engine = hbs.middleware({
  viewPath: path.join(__dirname, 'views'),
  defaultLayout: 'layout'
});
app.use(view_engine);

// Public directory setup
app.use(serve(path.join(__dirname, 'public'), {
  maxage: 0
}));

// Error handler
const error_handler = async (ctx, error) => {
  var dev = ctx.app.env === 'development';

  ctx.state = {
    title: statuses[error.status],
    message: error.expose || dev ? error.message : '',
    error: dev ? `${error.stack}\n\n${JSON.stringify(error, null, 4)}` : ''
  };

  ctx.status = error.status;
  await ctx.render('error');
};

app.use(async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    await error_handler(ctx, error);
  }
});

// Create default routes
const router = new Router();

app.use(router.routes())
.use(router.allowedMethods());

// OIDC Provider setup
const Provider = require('oidc-provider');

const oidc = new Provider('https://login.dev.tryextra.net/', {
  routes: {
    authorization: '/oauth/authorize',
    certificates: '/discovery/certs',
    revocation: '/oauth/revoke',
    token: '/oauth/token',
    userinfo: '/openid/userinfo',
  },
  features: {
    devInteractions: false
  },
  renderError: async (ctx, out, error) => {
    if (ctx.accepts('html')) {
      error.message = out.error_description;
      await error_handler(ctx, error);
    } else {
      ctx.body = out;
    }
  }
});

oidc.initialize({ }).then(() => {
  oidc.use(view_engine);
  app.use(mount(oidc.app));
});

module.exports = app;
