FROM node:alpine
WORKDIR /app
COPY . .
RUN cd packages && rm -rf auth-server-neo4j auth-server-redisgraph datas-neo4j datas-redisgraph
RUN npm i -g pnpm
RUN pnpm i -r
CMD npm run start:mongo