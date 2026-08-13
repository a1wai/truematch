# Profile photos

Drop the two photos in this folder with these exact names:

```
public/avatars/usama.jpg
public/avatars/bisma.jpg
```

They are referenced from `src/data/seed.js` (`photo: 'usama.jpg'`). Until the
files exist the app shows a coloured monogram instead — nothing breaks, so you
can add them whenever.

Notes:

- Square images look best (they are cropped to a circle with `object-cover`).
  512×512 is plenty.
- `.jpg` is what the code expects. For a `.png` or `.webp`, update the `photo`
  field in `src/data/seed.js` to match the filename.
- Anything in `public/` is copied verbatim into `dist/`, so the same files ship
  to Vercel, GitHub Pages and inside the Android APK.
- Easiest way to add them without a terminal: open this folder on GitHub, click
  **Add file → Upload files**, and drag both photos in.
