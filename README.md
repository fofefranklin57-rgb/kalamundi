<div align="center">

# Kalamundi

**Digital publishing platform for African authors and readers**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-kalamundi.pages.dev-8B5CF6?style=for-the-badge)](https://kalamundi.pages.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)
[![Flutter](https://img.shields.io/badge/Flutter-3.x-02569B?style=for-the-badge&logo=flutter)](https://flutter.dev)
[![Next.js](https://img.shields.io/badge/Next.js-15-000000?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com)

</div>

---

## Overview

Kalamundi is a digital publishing platform built specifically for African authors. It gives writers tools to create, publish, and distribute their work — stories, novels, comics, and webtoons — while connecting them directly with readers across the continent and the diaspora.

The platform bridges the gap between African literary talent and digital distribution, with a creation studio, AI-assisted illustration tools, and a reader app built for mobile-first audiences.

**Live at:** [kalamundi.pages.dev](https://kalamundi.pages.dev)

---

## Features

### For Authors
- **Creation Studio** — write and format stories directly in the platform
- **Series & chapters** — organize long-form content into structured series
- **AI-assisted illustrations** — generate cover art and chapter illustrations
- **Publishing workflow** — draft → review → publish with one click
- **Reader analytics** — track reads, follows, and engagement

### For Readers
- **Discover** curated African stories, novels, and comics
- **Mobile-first reading experience** — optimized for small screens
- **Offline reading** — downloaded chapters available without internet
- **Follow authors** and get notified of new chapters
- **Multilingual** — French and English content

### Platform
- Author onboarding with profile and portfolio
- Content moderation and editorial curation
- Category system: fiction, non-fiction, romance, thriller, sci-fi, comics
- Search and discovery by genre, language, and author

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Mobile App** | Flutter 3.x (Dart) — iOS & Android |
| **Web Portal** | Next.js 15 (TypeScript) |
| **Backend / API** | Cloudflare Workers |
| **Database** | PostgreSQL via Supabase |
| **Auth** | Supabase Auth |
| **Storage** | Supabase Storage (cover images, chapter assets) |
| **Deployment** | Cloudflare Pages (auto CI/CD via GitHub) |

---

## Architecture

```
┌─────────────────────────────────────────────┐
│              CLIENT LAYER                    │
│  Flutter App (iOS/Android) │ Next.js Web     │
└──────────────┬──────────────────────┬────────┘
               │                      │
┌──────────────▼──────────────────────▼────────┐
│           CLOUDFLARE WORKERS                  │
│    REST API · Auth · Business Logic           │
└──────────────────────┬────────────────────────┘
                        │
┌───────────────────────▼────────────────────┐
│             SUPABASE                        │
│  PostgreSQL · Storage · Auth               │
└─────────────────────────────────────────────┘
```

---

## Local Development

### Prerequisites
- Flutter SDK 3.x
- Node.js 18+
- A Supabase project

### Web Portal (Next.js)

```bash
git clone https://github.com/fofefranklin57-rgb/kalamundi.git
cd kalamundi

npm install

# Configure environment
cp .env.example .env.local
# Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY

npm run dev
```

### Mobile App (Flutter)

```bash
cd mobile/

flutter pub get

# Configure Supabase credentials in lib/config/supabase.dart

flutter run
```

---

## Project Status

- ✅ Author profiles and onboarding
- ✅ Story creation and publishing
- ✅ Series and chapter management
- ✅ Mobile reader app (Flutter)
- ✅ Web portal (Next.js)
- ✅ AI-assisted illustration features
- 🔄 Offline reading (Flutter)
- 📋 In-app monetization for authors
- 📋 Audiobook support
- 📋 Community features (comments, ratings)

---

## License

MIT © 2024 Franklin Fofe Nodem — see [LICENSE](LICENSE)

---

<div align="center">
Built with ☕ in Yaoundé, Cameroon · <a href="https://kalamundi.pages.dev">Live Demo</a>
</div>
