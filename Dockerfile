FROM node:13.8-alpine

ARG NAME
ARG SERVICE=services/auth-server-${NAME}
ARG CORE=packages/auth-core
ARG DATA=packages/datas-${NAME}

WORKDIR /app

COPY package.json pnpm-workspace.yml ./
COPY ${CORE}/package.json ${CORE}/pnpm-lock.yaml ${CORE}/
COPY ${DATA}/package.json ${DATA}/pnpm-lock.yaml ${DATA}/
COPY ${SERVICE}/package.json ${SERVICE}/pnpm-lock.yaml ${SERVICE}/

RUN npx pnpm recursive install --prod

COPY $CORE $CORE
COPY $DATA $DATA
COPY $SERVICE $SERVICE

ENV DOCKERFILE_START_CMD start:${NAME}

CMD npm run $DOCKERFILE_START_CMD
