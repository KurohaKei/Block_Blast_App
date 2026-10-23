# Block Blast

An offline block puzzle game built with plain JavaScript and Canvas.

The game uses an 8x8 board and gives you three pieces at a time. Piece choices are based on the current board, and each set is generated so all three pieces can be placed. Clear rows or columns to score points and build a streak multiplier. A streak resets after three placements without clearing a line.

## Run the game

Open `index.html` in a modern browser to play without installing anything. Browser-based offline installation requires serving the app from HTTPS or localhost; service workers do not work from a `file://` URL.

## Deploy to Vercel

This project is a static front-end and can be deployed directly to Vercel without a build step. Push the repository to GitHub, import it into Vercel, and keep the project root as the app directory. No custom build command is required because the app is served straight from the static files in the repository.

After opening the deployed site once while online, wait for the service worker to cache the game files. Then use your browser's **Install app** or **Add to Home Screen** option. The installed game can launch offline; updating it requires reconnecting to the internet.

On Android, open the site in Chrome and choose **Install app** (or **Add to Home screen**) from the browser menu. On iPhone or iPad, open the HTTPS site in Safari, tap **Share**, then **Add to Home Screen**. iOS does not offer PWA installation from every third-party browser. This installs the game to the device home screen; publishing a native app in Google Play or the App Store requires a separate native wrapper and store submission.

## Play

- Drag a piece from the tray onto the board to place it.
- On desktop, press `1`, `2`, or `3` to select a piece, use the arrow keys to position it, then press `Space` or `Enter` to place it. Press `Esc` to cancel.
- Fill a complete row or column to clear it.
- Clear lines to increase your streak multiplier. Three placements without a line clear reset the streak.
- Open Settings with the gear button to adjust sound, vibration, reduced motion, or restart.
- Every Perfect board clear switches to another theme without repeating until the theme bag cycles. Themes persist between sessions; use **Reset to Default Theme** in Settings to restore the original palette.
- Use the download button beside Settings to check for an app update. The page saves the current game, then activates an installed update and reloads; an update waits until you request it.
- When no remaining piece fits, the game-over dialog offers a Play Again button.

The best score is saved in the browser's local storage.

The game works offline when opened directly from disk. To install it as a PWA, serve it from a secure web origin (HTTPS or localhost).

## Check for app updates

The download button checks connectivity with a small same-origin request, then asks the service-worker registration to check for a newer app version. If one is installed, the game saves and waits for any active drag to finish before activating the new worker and reloading. Failed checks and an already-current app display a short status message. Update checks are never initiated by an app timer or visibility event.

To test the flow locally:

1. Serve the app from `localhost` or HTTPS and open it twice in the same browser profile so the existing service worker controls a page.
2. To test **up to date**, click the download button without changing the files.
3. To test an **available update**, increment `CACHE_NAME` in `sw.js` and change a visible app file. Reload once to let the browser discover and install the worker update; click the download button in the still-open controlled page to activate it.
4. Start dragging a piece before clicking the button and verify the page reloads only after dropping or cancelling the drag.
5. Disconnect the browser before clicking to check the offline message. For the unsupported case, open the page via `file://` or use a browser with service workers disabled.

Browsers may perform their own service-worker update checks during navigation or at browser-defined intervals. This app does not call `registration.update()` automatically and does not activate waiting updates or reload the page unless the user clicks the download button.

Run `node tests/text-layout.js` for canvas-edge and text-stack layout regression checks.
