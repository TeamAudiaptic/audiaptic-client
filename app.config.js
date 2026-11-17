// Extends app.json (passed in as `config`) with settings that need comments,
// since JSON can't hold them.
module.exports = ({ config }) => ({
  ...config,
  ios: {
    ...config.ios,
    infoPlist: {
      ...config.ios?.infoPlist,
      // DEV ONLY: allow plain http:// fetches (e.g. GET /api/time on the dev
      // server, which is a bare IP so NSExceptionDomains can't be used).
      // NSAllowsLocalNetworking is deliberately omitted: if present, iOS
      // ignores NSAllowsArbitraryLoads. Remove this before an App Store
      // release and serve the API over HTTPS instead.
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: true,
      },
    },
  },
});
