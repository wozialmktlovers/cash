FROM node:22-slim
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV DATA_DIR=/data
# Puerto HTTP convencional: el servicio arrastra un proxy TCP en 5432 que, si se
# deja mandar, hace que el servidor escuche en el puerto de Postgres y el router
# HTTP de Railway no lo encuentre. PORT se fija además en las variables del servicio.
ENV PORT=8080
EXPOSE 8080

CMD ["node", "scripts/arranque.mjs"]
