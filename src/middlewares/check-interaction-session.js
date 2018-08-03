
module.exports = function (oidc) {

  return async function checkFlowSession(ctx, next) {
    ctx.assert(ctx.cookies.get(oidc.cookieName('interaction')), 401, 'Session expired');

    const details = await oidc.interactionDetails(ctx.req);
    ctx.assert(details.uuid, 401, 'Session expired');

    if (ctx.query.request_id)
      ctx.assert(details.uuid == ctx.query.request_id, 401, 'Session expired');

    ctx.state.details = details;

    ctx.state.details.prompts = ctx.state.details.params.prompt ? ctx.state.details.params.prompt.split(' ') : [];
    ctx.state.details.scopes = ctx.state.details.params.scope.split(' ');

    await next();
  };
};
