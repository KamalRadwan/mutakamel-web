// Opt in with ng serve --proxy-config proxy.local.conf.cjs.
const gatewayPort = Number(process.env.TENANT_PORTAL_LOCAL_GATEWAY_PORT ?? '9000');
if (!Number.isInteger(gatewayPort) || gatewayPort < 1 || gatewayPort > 65_535) {
  throw new Error('TENANT_PORTAL_LOCAL_GATEWAY_PORT must be a valid TCP port.');
}

module.exports = {
  '/api/**': {
    target: `http://127.0.0.1:${gatewayPort}`,
    // Gateway and Core use the browser Host to resolve the tenant.
    changeOrigin: false,
  },
};
