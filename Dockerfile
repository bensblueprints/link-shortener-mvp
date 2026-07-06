# ---- build frontend ----
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

# ---- runtime ----
FROM node:20-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force
COPY server ./server
COPY --from=build /app/dist ./dist
ENV PORT=5302 \
    DB_PATH=/app/data/links.db
EXPOSE 5302
VOLUME ["/app/data"]
CMD ["node", "server/index.js"]
