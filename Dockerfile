FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
# Prefer reproducible `npm ci`, but fall back to `npm install` when the
# committed lockfile drifts out of sync (recurring issue: npm on Windows
# strips non-host platform/esbuild entries, which breaks Linux `npm ci`).
RUN npm ci || npm install
COPY . .
# Vite inlines VITE_* vars at build time, so the Google client id must be
# passed as a build arg (empty value hides the Google sign-in button).
ARG VITE_GOOGLE_CLIENT_ID=
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
