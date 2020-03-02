ARG SERVICE=services/auth-server-mongo
ARG CORE=packages/auth-core
ARG DATA=packages/datas-mongo

FROM node:13.8-alpine AS base
WORKDIR /app

## build ##
FROM base

ARG SERVICE
ARG CORE
ARG DATA

RUN npm i -g pnpm

COPY package.json pnpm-workspace.yml ./
COPY ${CORE}/package.json ${CORE}/pnpm-lock.yaml ${CORE}/
COPY ${DATA}/package.json ${DATA}/pnpm-lock.yaml ${DATA}/
COPY ${SERVICE}/package.json ${SERVICE}/

RUN pnpm install --reporter=silent --production --recursive

COPY $CORE $CORE
COPY $DATA $DATA
COPY $SERVICE $SERVICE

CMD npm run start:mongo
