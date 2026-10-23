# Block Blast

An offline block puzzle game built with plain JavaScript and Canvas.

The game uses an 8x8 board and gives you three pieces at a time. Piece choices are based on the current board, and each set is generated so all three pieces can be placed. Clear rows or columns to score points and build a streak multiplier. A streak resets after three placements without clearing a line.

## Run the game

Open `index.html` in a modern browser to play without installing anything. Browser-based offline installation requires serving the app from HTTPS or localhost; service workers do not work from a `file://` URL.

## Deploy to Vercel

This project is a static front-end and can be deployed directly to Vercel without a build step. Push the repository to GitHub, import it into Vercel, and keep the project root as the app directory. No custom build command is required because the app is served straight from the static files in the repository.

After opening the deployed site once while online, wait for the service worker to cache the game files. Then use your browser's **Install app** or **Add to Home Screen** option. The installed game can launch offline; updating it requires reconnecting to the internet.

## Play

- Drag a piece from the tray onto the board to place it.
- On desktop, press `1`, `2`, or `3` to select a piece, use the arrow keys to position it, then press `Space` or `Enter` to place it. Press `Esc` to cancel.
- Fill a complete row or column to clear it.
- Clear lines to increase your streak multiplier. Three placements without a line clear reset the streak.
- Open Settings with the gear button to adjust sound, vibration, reduced motion, or restart.
- When no remaining piece fits, the game-over dialog offers a Play Again button.

The best score is saved in the browser's local storage.

The game works offline when opened directly from disk. To install it as a PWA, serve it from a secure web origin (HTTPS or localhost).
