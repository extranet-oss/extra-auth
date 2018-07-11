const querystring = require('querystring');

// eslint-disable-next-line no-unused-vars
module.exports = function (config) {

  async function logoutSource (ctx, form) {
    ctx.state = {
      title: 'Signing you out...',
      form,
      redirect_uri: ctx.oidc.session.logout.postLogoutRedirectUri
    };

    if (ctx.oidc.session.logout.state)
      ctx.state.redirect_uri += `?${querystring.stringify({state: ctx.oidc.session.logout.state})}`;

    await ctx.render('session_end');
  }

  async function frontchannelLogoutPendingSource (ctx, frames, postLogoutRedirectUri, timeout) {
    ctx.body = {
      action: 'frontchannelLogout',
      data: {
        frames,
        timeout
      }
    };
  }

  return {
    logoutSource,
    frontchannelLogoutPendingSource
  };
};
