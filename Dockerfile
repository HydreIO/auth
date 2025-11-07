# ╔════════════════ [ Build stage ] ════════════════════════════════════════════ ]
FROM node:14.13-alpine as build

RUN apk add git

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm install --production

# ╔════════════════ [ Build stage ] ════════════════════════════════════════════ ]
FROM node:14.13-alpine as production

WORKDIR /app

COPY --from=build /app .
COPY . .

CMD npm run start