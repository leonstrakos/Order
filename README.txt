HRS website/PWA follow-up patch

CHANGED
1) server.js
   - Adds isKeeperOfBell(member)
   - /profile/archive/import is now enforced server-side for Keeper of the Bell stage only.
   - ARCHIVE_EDIT alone no longer grants website HRL catalogue upload access.

2) views/profile.ejs
   - Archive Administration is only rendered for stageCode KEEPER_OF_BELL
     (with stageName "Keeper of the Bell" as a compatibility fallback).
   - Upload note now says Keeper of the Bell only.

3) mobile/src/auth/AuthContext.tsx
   - Website <-> PWA HRS session bridge.
   - Required to remove the second login when entering /app/ from an authenticated website session.

WEBSITE DEPLOY
- Copy server.js and views/profile.ejs into BRAND SOCIETY.
- node --check server.js
- git add .
- git commit -m "Restrict archive administration to Keeper and bridge PWA login"
- git pull --rebase origin master
- git push origin master
- server: git pull origin master && pm2 restart heralds --update-env

PWA DEPLOY
- Copy mobile/src/auth/AuthContext.tsx into the HRS v1.5 PWA mobile project.
- npm run typecheck
- npx expo export --platform web
- Replace /srv/hrs/web/app with the new dist contents, chmod dirs 755 and files 644.
