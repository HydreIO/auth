FROM node:current-alpine
WORKDIR /app
RUN apk add chromium
COPY . .
RUN npm i
RUN npm run build
RUN rm -rf src && mv lib/* ./