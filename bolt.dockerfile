FROM node:alpine
WORKDIR /app
COPY . .
RUN cd packages && rm -rf auth-server-mongo auth-server-redisgraph datas-mongo datas-redisgraph
RUN npm i -g pnpm
RUN pnpm i -r
CMD npm run start:neo