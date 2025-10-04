# CommunityBoard (CommunityHub)

En modern digital anslagstavla där användare kan läsa, skapa, kommentera och administrera inlägg.

**Frontend:** React + TypeScript (Vite) + React Bootstrap  
**Backend:** .NET Minimal API + SQLite

---

## Funktioner

- Inloggning med cookie-baserad session
- Roller: **admin** och **user** (rollstyrd åtkomst)
- Inlägg: skapa, lista, söka, filtrera, redigera, ta bort
- Kommentarer per inlägg (+ admin kan ta bort)
- Export (CSV/JSON) – **endast admin**
- Mörkt/ljust/system-tema via eget `ThemeProvider`
- Responsiv design (mobil → desktop)

---

##  Teknik

- **Frontend:** React 18, TypeScript, Vite, React Router, React Bootstrap
- **Hooks:** `useAuth`, `useStateObject`
- **Backend:** .NET Minimal API, SQLite, PBKDF2 (lösenord), HMAC-signerad cookie
- **Databas:** tabeller `users`, `posts`, `comments`, vy `v_posts_with_comment_count`

---

## Kom igång

### Förutsättningar
- Node 18+ och npm
- .NET 8 SDK
- Git

###  Starta backend
```bash
cd backend
dotnet run
