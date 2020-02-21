FROM node:current-alpine
WORKDIR /app
COPY packages/auth-core auth-core
COPY packages/auth-koa auth-koa
COPY packages/datas-neo4j datas-neo4j
RUN npm i --prefix auth-koa
RUN npm run build --prefix auth-koa