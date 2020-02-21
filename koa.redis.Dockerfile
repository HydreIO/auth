FROM node:current-alpine
WORKDIR /app
COPY packages/auth-core auth-core
COPY packages/auth-koa auth-koa
COPY packages/datas-redisgraph datas-redisgraph
RUN npm i --prefix auth-koa
RUN npm run build --prefix auth-koa