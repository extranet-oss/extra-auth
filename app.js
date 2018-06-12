const Koa = require('koa');
const morgan = require('koa-morgan');
const conditional = require('koa-conditional-get');
const etag = require('koa-etag');
const path = require('path');
const hbs = require('koa-hbs');
const serve = require('koa-static');
const statuses = require('statuses');
const session = require('koa-session');
const bodyparser = require('koa-body');
const passport = require('koa-passport');
const { OIDCStrategy } = require('passport-azure-ad');
const Router = require('koa-router');
const mount = require('koa-mount');

const config = require('./config.json');

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
async function error_handler(ctx, error) {
  let dev = ctx.app.env === 'development';

  ctx.state = {
    title: statuses[error.status || 500],
    message: error.expose || dev ? error.message : '',
    error: dev ? `${error.stack}\n\n${JSON.stringify(error, null, 4)}` : ''
  };

  ctx.status = error.status || 500;
  await ctx.render('error');
};

app.use(async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    await error_handler(ctx, error);
  }
});

// session setup
app.use(session({ signed: false }, app));

// parse body
app.use(bodyparser({ patchNode: true }));

// setup passport strategies
app.use(passport.initialize())
app.use(passport.session())

function external_scheme() {
  return config.host.startsWith('127.0.0.1') ? 'http' : 'https';
}
function external_url(path) {
  return `${external_scheme()}://${config.host}${path}`;
}

passport.use(new OIDCStrategy({
    identityMetadata: `https://login.microsoftonline.com/${config.azuread.tenantID}/.well-known/openid-configuration`,
    clientID: config.azuread.clientID,
    responseType: 'id_token',
    responseMode: 'form_post',
    redirectUrl: external_url('/interaction/azuread'),
    allowHttpForRedirectUrl: external_scheme() == 'http',
    passReqToCallback: false
  },
  function(iss, sub, profile, accessToken, refreshToken, done) {
    if (!profile.oid) {
      return done(new Error('No oid found'), null);
    }
    console.log("azuread:", {iss, sub, profile, accessToken, refreshToken})
    done(null, profile);
  }
));

// Create default routes
const router = new Router();

app.use(router.routes())
.use(router.allowedMethods());

// OIDC Provider setup
const Provider = require('oidc-provider');

const oidc = new Provider(external_url(''), {
  routes: {
    authorization: '/oauth/authorize',
    certificates: '/discovery/keys',
    check_session: '/session/check',
    end_session: '/session/end',
    introspection: '/oauth/tokeninfo',
    revocation: '/oauth/revoke',
    token: '/oauth/token',
    userinfo: '/openid/userinfo'
  },
  async interactionUrl(ctx, interaction) {
    return `/interaction/?request_id=${ctx.oidc.uuid}`;
  },
  features: {
    devInteractions: false,
    discovery: true,
    claimsParameter: true,
    clientCredentials: true,
    encryption: false,
    alwaysIssueRefresh: false,
    request: false,
    requestUri: false,
    introspection: true,
    revocation: true,
    oauthNativeApps: true,
    sessionManagement: true,
    backchannelLogout: false,
    frontchannelLogout: false,
    registration: false,
    registrationManagement: false,
    pkce: true
  },
  async renderError(ctx, out, error) {
    if (ctx.accepts('html')) {
      error.message = out.error_description;
      await error_handler(ctx, error);
    } else {
      ctx.body = out;
    }
  },
  async logoutSource(ctx, form) {
    ctx.state = {
      title: 'Signing you out...',
      form
    };
    await ctx.render('session_end');
  }
});

const keystore = require('./keystore.json');

oidc.initialize({
  keystore,
}).then(() => {
  oidc.use(view_engine);

  async function checkFlowSession(ctx, next) {
    ctx.assert(ctx.cookies.get(oidc.cookieName('interaction')), 401, 'Session expired');
    const details = await oidc.interactionDetails(ctx.req);
    ctx.assert(details.uuid, 401, 'Session expired');
    ctx.state.details = details;
    await next();
  }

  router.get('/interaction/',
    checkFlowSession,
    async ctx => {
      await ctx.redirect(`/interaction/signin?request_id=${ctx.state.details.uuid}`);
    });

  router.get('/interaction/signin',
    checkFlowSession,
    async ctx => {
      ctx.state.title = ctx.state.details.interaction.reason_description;

      console.log(ctx.state.details)
      await ctx.render('login');
    });

  router.get('/interaction/azuread',
    checkFlowSession,
    async (ctx, next) => {
      await passport.authenticate('azuread-openidconnect', {
        failureRedirect: `/interaction/signin?request_id=${ctx.state.details.uuid}`,
        session: false,
        domain_hint: config.azuread.tenantDomain
      })(ctx, next);
    })
  .post('/interaction/azuread',
    checkFlowSession,
    async (ctx, next) => {
      await passport.authenticate('azuread-openidconnect', {
        failureRedirect: `/interaction/signin?request_id=${ctx.state.details.uuid}`,
        session: false
      })(ctx, next);
    },
    async ctx => {
      await oidc.interactionFinished(ctx.req, ctx.res, {
        login: {
          account: ctx.state.user.oid
        },
        consent: {}
      });
    })

  app.use(mount(oidc.app));
});

module.exports = app;
