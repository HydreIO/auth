FROM node:alpine
WORKDIR /app
COPY . .
RUN npm i -g pnpm
RUN pnpm i -r --force
CMD npm run start:koa