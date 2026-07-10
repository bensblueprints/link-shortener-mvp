# ---- build frontend ----
FROM node:20-slim AS build
WORKDIR /app
# python3-setuptools: better-sqlite3 has no prebuilt binary for every Node
# patch version, so it can fall back to compiling from source, which needs
# a full toolchain including the distutils shim newer Python drops by default.
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-setuptools make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

# ---- runtime ----
FROM node:20-slim
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-setuptools make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force
COPY server ./server
COPY --from=build /app/dist ./dist
ENV PORT=5302 \
    DB_PATH=/app/data/links.db
EXPOSE 5302
VOLUME ["/app/data"]
CMD ["node", "server/index.js"]
