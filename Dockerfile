FROM node:22-slim
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV DATA_DIR=/data
EXPOSE 4321

CMD ["node", "scripts/arranque.mjs"]
