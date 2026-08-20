HRS WEB ACCESS + SHARED IDENTITY PATCH — v1.5

WHAT THIS DOES
- /hrs becomes the public HRS distribution/access threshold.
- Logged-in website members go directly to /app/ through /hrs/open.
- Visitors can sign in or create a Seeker account on the website.
- Website registration uses the EXISTING Spring /api/auth/register endpoint; no JAR/backend change required.
- Website login/registration and the PWA share the same HRS token through same-origin bridge endpoints.
- PWA login/registration also adopts a website session, so /profile recognizes the same identity.
- Existing Archive Administration XLSX upload on profile is preserved.
- Android APK stays at /downloads/hrs-v1.5.apk.
- iPhone/iPad users use /app/ PWA now; native sideload distribution can be added later.

WEBSITE FILES
server.js                         -> website root/server.js
views/hrs.ejs                     -> website views/hrs.ejs
views/login.ejs                   -> website views/login.ejs
views/register.ejs                -> website views/register.ejs (NEW)
views/profile.ejs                 -> website views/profile.ejs
views/partials/header.ejs         -> website views/partials/header.ejs
public/css/style.css              -> website public/css/style.css
public/css/auth-bridge.css        -> website public/css/auth-bridge.css (NEW)

PWA FILE
mobile/src/auth/AuthContext.tsx   -> your HRS v1.5 PWA/mobile/src/auth/AuthContext.tsx

IMPORTANT
The PWA AuthContext change requires a new web export and upload to /srv/hrs/web/app/.
The native Android behavior is unchanged because the bridge code runs only when Platform.OS === 'web'.

AFTER COPYING WEBSITE FILES
node --check server.js
pm2 restart heralds

AFTER COPYING THE PWA AUTHCONTEXT
cd mobile
npm run typecheck
npx expo export --platform web
# clear old server PWA files, then upload dist and normalize permissions
