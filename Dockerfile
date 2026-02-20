FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

RUN apk del python3 make g++

COPY --from=builder /app/dist ./dist
COPY server.js ./
COPY lib ./lib

RUN mkdir -p data

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server.js"]
