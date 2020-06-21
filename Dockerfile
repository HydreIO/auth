# ╔════════════════ [ Build stage ] ════════════════════════════════════════════ ]
FROM node:14.4-alpine as build

RUN apk add git

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --prod

# ╔════════════════ [ Build stage ] ════════════════════════════════════════════ ]
FROM node:14.4-alpine as production

WORKDIR /app

COPY --from=build /app .
COPY . .

CMD npm run start