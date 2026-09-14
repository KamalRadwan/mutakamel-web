import { proxyDevelopmentGateway } from "@/lib/api/dev-gateway-proxy.server";

export const runtime = "nodejs";

export {
  proxyDevelopmentGateway as GET,
  proxyDevelopmentGateway as HEAD,
  proxyDevelopmentGateway as POST,
  proxyDevelopmentGateway as PUT,
  proxyDevelopmentGateway as PATCH,
  proxyDevelopmentGateway as DELETE,
  proxyDevelopmentGateway as OPTIONS,
};
