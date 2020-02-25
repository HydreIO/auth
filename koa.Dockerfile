FROM node:current-alpine
WORKDIR /app
COPY . .
RUN npm i -g pnpm
RUN pnpm i -r