FROM node:current-alpine
WORKDIR /app
COPY packages/* .
RUN npm i --prefix auth-koa
RUN npm run build --prefix auth-koa