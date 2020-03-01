ARG SERVICE=services/auth-server-neo4j
ARG CORE=packages/auth-core
ARG DATA=packages/datas-neo4j

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
RUN ls

CMD npm run start:neo
