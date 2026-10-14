# Hoplite mobile prototype

Interactive, dependency-free prototype of the Hoplite mobile app (home composer + sliding thread sidebar), recreated from the screen recording.

Run it with `npm run dev` (or just open `index.html`) and view at phone width — on desktop it renders inside a phone frame.

What works: sidebar button and left-edge swipe (push-style drawer), thread search and sort, new thread, model / effort / repo pickers, file attach, submitting a task (simulated agent run → "Ready" with a PR card), replies, thread rename/archive, Automations and Settings pages. In the sidebar, hold a thread and drop it on another to make a folder; tap a folder to expand it, drag a thread out to remove it (a folder with one thread left dissolves). State persists in `localStorage`; Settings → "Reset demo data" restores the seed threads.
