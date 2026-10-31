# Goal Celebrations

A tiny web app: describe someone, log their goals, and when they complete one, generate a 1000×1000 celebration image with OpenAI's image API.

## What's in it

- **People** – saved in your browser (localStorage). Use *Export backup* / *Import* to move them between devices.
- **Profile** – name + "who they are" (how you'd describe them, your experience of them, qualities you admire).
- **Goals** – Professional, Personal, Contribution, Self-honor, plus PM enrollments and Greatness notes. Tick *Complete* and hit *Celebrate →*.
- **Celebrate** – optional notes about this specific win, an **Image style** box, and a **Master prompt template** that controls how everything is combined. Placeholders: `{{name}}`, `{{description}}`, `{{goal_type}}`, `{{goal}}`, `{{notes}}`, `{{all_goals}}`, `{{style}}`.
- **Final prompt** – see (and hand-edit) exactly what gets sent before you generate.
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
3. Deploy. Your API key stays on the server; the browser never sees it.

Note: your OpenAI organization may need to be verified before it can use the `gpt-image-1` model.
