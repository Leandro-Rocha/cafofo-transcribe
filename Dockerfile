FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src/ ./src/
RUN mkdir -p /data
VOLUME ["/data"]
ENV PORT=3020 DB_PATH=/data/cafofo-transcribe.db
EXPOSE 3020
CMD ["node", "src/index.js"]
