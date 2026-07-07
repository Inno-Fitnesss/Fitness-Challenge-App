# Mobile Design References

This folder contains the Figma exports for the mobile version. Use these files as implementation references for the mobile subdomain work.

| File | Purpose |
| --- | --- |
| [auth-onboarding.png](assets/auth-onboarding.png) | Unauthenticated onboarding screen with product pitch and CTAs to start registration or open login. |
| [auth-login.png](assets/auth-login.png) | Login screen for an existing user. |
| [auth-register.png](assets/auth-register.png) | Account creation screen with username, email, password, and password confirmation. |
| [home-without-articles.png](assets/home-without-articles.png) | Main mobile home screen without article cards: greeting, streak/action indicator, week selector, today plan, and bottom navigation. |
| [competitions-with-featured.png](assets/competitions-with-featured.png) | Competitions overview with the ready competitions carousel/top card, group tab selected, joined competition cards, and floating create button. |
| [competitions-no-featured.png](assets/competitions-no-featured.png) | Competitions overview empty state for ready competitions, with the same group tab and joined competition list. |
| [competition-create-modal.png](assets/competition-create-modal.png) | Create competition modal opened from the competitions screen. |
| [articles-list.png](assets/articles-list.png) | Articles tab with article cards for push-ups, squats, and plank. |
| [article-detail.png](assets/article-detail.png) | Article detail page with back navigation and long-form text content. |

Implementation notes:

- These images are design references only and should not be imported by the app at runtime.
- The bottom navigation appears on home, competitions, articles, and article detail screens.
- The competition create modal is shown over the competitions screen with the background dimmed.

Runtime notes:

- The production frontend serves one SPA build for both the main site and the mobile subdomain.
- Hostnames starting with `m.` or `mobile.` automatically render the mobile React app.
- For local development, set `VITE_FORCE_MOBILE_APP=true` to force the mobile app without configuring a subdomain.
