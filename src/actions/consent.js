const debug = require('debug')('extra-auth:server');

// eslint-disable-next-line no-unused-vars
module.exports = function (router, oidc, config) {

  const dest = '/interaction/consent';

  const checkSession = require('../middlewares/check-interaction-session.js')(oidc);

  router.post(dest,
    checkSession,
    async function consentDecision(ctx) {
      debug('Consent decision');

      if (ctx.request.body.decision && ctx.request.body.decision == 'consent') {
        await oidc.interactionFinished(ctx.req, ctx.res, {
          consent: {}
        });
      } else {
        await oidc.interactionFinished(ctx.req, ctx.res, {
          error: 'access_denied',
          error_description: 'End-User refused to consent'
        });
      }
    }
  );
};
