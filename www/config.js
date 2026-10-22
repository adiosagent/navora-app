// Navora front-end config — edit before deploying
const KR = {
  TOMTOM_KEY: "ZfWfnnIkTtikNVDNjqgzvZ20m506aUE5",                     // my.tomtom.com/keys — restrict by domain in the key settings
  API_BASE: "https://navora.my/api/",                                  // PHP backend path
  DEFAULT_CENTER: { lat: 3.1390, lng: 101.6869 },    // KL
  DEFAULT_ZOOM: 12,
  ALERT_REFRESH_MS: 60000,                           // pull alerts every 60s
  ROUTE_ALERT_RADIUS_M: 300,                         // alert counts as "on route" within this distance
  // Firebase Web Push (optional; leave empty to disable push)
  FIREBASE: {
    apiKey: "", authDomain: "", projectId: "", messagingSenderId: "", appId: "",
    vapidKey: ""
  }
};
