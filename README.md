# Goal Celebrations

A tiny web app: describe someone, log their goals, and when they complete one, generate a 1000×1000 celebration image with OpenAI's image API.

## What's in it

- **People** – saved in a Neon Postgres database when one is connected (so every device sees the same data), with your browser's localStorage as an instant cache. Without a database, everything stays in this browser. *Export backup* / *Import* still work either way.
- **Profile** – name + "who they are" (how you'd describe them, your experience of them, qualities you admire).
- **Goals** – Professional, Personal, Contribution, Self-honor, plus PM enrollments and Greatness notes. Tick *Complete* and hit *Celebrate →*.
- **Celebrate** – optional notes about this specific win, an **Image style** box, and a **Master prompt template** that controls how everything is combined. Placeholders: `{{name}}`, `{{description}}`, `{{goal_type}}`, `{{goal}}`, `{{notes}}`, `{{all_goals}}`, `{{style}}`.
- **Composition style** – Automatic (default), Abstract Composition, Object-Focused Artwork, or Illustrated Environment. It changes only how the image is organized; the artistic style stays the same.
- **Color palettes** – create, name, edit, duplicate, and delete palettes of HEX colors under *Manage color palettes*. The selected palette's colors are passed straight into the prompt. Ships with one default palette (Teal & Coral).
- **Master prompt** – the single illustration prompt used for every image. Placeholders: `{{goal}}`, `{{notes}}`, `{{description}}`, `{{name}}`, `{{goal_type}}`, `{{composition}}`, `{{palette}}`. Missing goal/description/composition/palette sections are appended automatically.
- **Always enforced** – a strict no-people rule (no humans, faces, hands or body parts, silhouettes, cartoon characters, or anthropomorphic objects) and your *Text in image* choice are appended to every prompt.
- **Final prompt** – see (and hand-edit) exactly what gets sent before you generate.
- **Download** – the image comes back at 1024×1024 (the API's square size) and is downloaded as a 1000×1000 PNG.

## Cloud database (Neon, free tier)

1. In Vercel, open the project → **Storage** → **Create Database** → **Neon** → Free plan.
2. Connect it to this project for all environments. Vercel adds `DATABASE_URL` automatically.
3. Redeploy. Tables are created automatically on first use.
4. Open the app in the browser that already has your people saved. It uploads them once ("Uploaded this device's data to the cloud"); every other device then loads from the cloud.

What syncs: people and goals, color palettes, the master prompt, quality, and the text preference. What stays per-device: the selected person, goal, and composition style.

## Run locally

```bash
cp .env.example .env   # then put your OpenAI key in .env
npm run dev            # http://localhost:3000
```

No dependencies to install; needs Node 18+.

## Deploy to Vercel

1. Import this repo in Vercel (framework preset: **Other**, no build command).
2. Add environment variables:
   - `OPENAI_API_KEY` – required
   - `APP_PASSWORD` – strongly recommended, so a stranger with the URL can't spend your credits
   - `OPENAI_IMAGE_MODEL` – optional; defaults to `gpt-image-2.5-sunburst`, falling back to `gpt-image-2.5-flare` and `gpt-image-2` if a model is retired or unavailable
   - `DATABASE_URL` – added by the Neon integration; enables cross-device sync
3. Deploy. Your API key stays on the server; the browser never sees it.

Note: your OpenAI organization may need to be verified before it can use the GPT Image models.
