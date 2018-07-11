const debug = require('debug')('extra-auth:server');
const statuses = require('statuses');

// Error handler
module.exports = async function errorHandler(ctx, error) {
  let dev = ctx.app.env === 'development';

  debug(error);

  ctx.state = {
    title: statuses[error.status || 500],
    message: error.expose || dev ? error.message : '',
    error: dev ? `${error.stack}\n\n${JSON.stringify(error, null, 4)}` : ''
  };

  ctx.status = error.status || 500;
  await ctx.render('error');
};
