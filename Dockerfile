# ╔════════════════ [ Build stage ] ════════════════════════════════════════════ ]
FROM node:25-alpine as build

RUN apk add git

WORKDIR /app

COPY package.json package-lock.json ./

# Disable lifecycle scripts (prepare) that try to run husky in production
RUN npm install --production --ignore-scripts

# ╔════════════════ [ Production stage ] ═══════════════════════════════════════ ]
FROM node:25-alpine as production

WORKDIR /app

COPY --from=build /app .
COPY . .

CMD npm run start