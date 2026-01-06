FROM node:20-bullseye-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY client-display/package.json ./client-display/package.json
COPY client-admin/package.json ./client-admin/package.json

RUN npm ci

COPY client-display ./client-display
COPY client-admin ./client-admin

RUN npm run build

COPY server ./server

VOLUME ["/app/data"]

EXPOSE 3000

CMD ["npm", "run", "dev:server"]
