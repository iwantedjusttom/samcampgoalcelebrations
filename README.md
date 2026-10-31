# Goal Celebrations

A tiny web app: describe someone, log their goals, and when they complete one, generate a 1000×1000 celebration image with OpenAI's image API.

## What's in it

- **People** – saved in your browser (localStorage). Use *Export backup* / *Import* to move them between devices.
- **Profile** – name + "who they are" (how you'd describe them, your experience of them, qualities you admire).
- **Goals** – Professional, Personal, Contribution, Self-honor, plus PM enrollments and Greatness notes. Tick *Complete* and hit *Celebrate →*.
- **Celebrate** – optional notes about this specific win, an **Image style** box, and a **Master prompt template** that controls how everything is combined. Placeholders: `{{name}}`, `{{description}}`, `{{goal_type}}`, `{{goal}}`, `{{notes}}`, `{{all_goals}}`, `{{style}}`.
- **Creative Direction** (collapsed by default) – illustration approach, color palette, composition, and emotional tone, all defaulting to *Auto*, plus an editable visual concept, subject, artistic treatment, and perspective.
  - **Suggest Direction** asks an OpenAI text model to plan a concept from the goal, details, image style, and your last 10 generated directions. It never generates an image.
  - **Try Another Direction** asks for a meaningfully different concept for the same goal.
  - **Randomize Direction** instantly shuffles unlocked settings (no AI call).
  - Changing a setting locks it 🔒, so suggestions and randomizing won't overwrite it.
  - Skipping all of this still works: *Auto* fields are resolved internally, steering away from recent choices.
- **Preferences** – Visual variety (Consistent / Balanced / High), Artistic flexibility (Fixed / Related / Experimental), and Text in image (None / Name only / Name and goal). With *None*, the prompt forbids all lettering; otherwise only the approved words are allowed.
- **Recent directions** – every successful image's direction is saved (last 50) and the last 10 are used to keep the collection varied.
- **Final prompt** – see (and hand-edit) exactly what gets sent before you generate. It is built in layers: goal context → artistic identity → creative direction → variety → output requirements.
- **Download** – the image comes back at 1024×1024 (the API's square size) and is downloaded as a 1000×1000 PNG.

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
   - `OPENAI_IMAGE_MODEL` – optional, defaults to `gpt-image-1`
   - `OPENAI_TEXT_MODEL` – optional, model for Suggest Direction, defaults to `gpt-5-mini`
3. Deploy. Your API key stays on the server; the browser never sees it.

Note: your OpenAI organization may need to be verified before it can use the `gpt-image-1` model.
