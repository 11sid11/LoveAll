# LoveAll

LoveAll is a focused, client-side badminton scoring companion designed for friends who want to keep their eyes on the rally instead of mentally tracking the score.

## Product scope

LoveAll deliberately does only three things:

1. Create a singles or doubles match.
2. Score the match with a court-oriented, low-attention interface.
3. Keep a basic local match history grouped by date.

There are no accounts, cloud services, rankings, tournaments, analytics, ads, or remote APIs.

## Core UX principles

- **Court first:** the scorer identifies which player/team is physically on the left before scoring starts. Screen position follows court position; scores always stay attached to the correct team.
- **One-glance scoring:** the two add-point targets dominate the landscape scoring screen. The scorer should be able to tap the correct side using peripheral attention.
- **Premium tactile feedback:** score controls react immediately with press states, restrained micro-animation, score transitions, and Vibration API feedback when the browser/device supports it.
- **Error tolerant:** undo and decrement controls make mistakes cheap to correct. Active match state is persisted locally after every meaningful change.
- **Badminton-aware:** standard 21-point games, win by two, 30-point cap, best of three, end changes between games, and the third-game 11-point change of ends are handled by the app.
- **Fast and reliable:** no framework, no runtime dependencies, no network dependency after the page is loaded.

## Technical architecture

- Semantic HTML
- Modern CSS
- Vanilla ES modules
- `localStorage` for active-match recovery and basic history
- Feature-detected Vibration and Fullscreen APIs with graceful fallback
- Static GitHub Pages deployment

## Local development

Because the JavaScript uses ES modules, serve the repository from a local HTTP server instead of opening `index.html` directly.

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Deployment

The repository includes a GitHub Pages workflow. Pushes to `main` deploy the static site when GitHub Pages is configured to use GitHub Actions.
