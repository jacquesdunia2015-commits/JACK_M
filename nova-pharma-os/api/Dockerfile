FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json nest-cli.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S nova && adduser -S nova -G nova
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
COPY db ../db
RUN mkdir -p /var/lib/nova/backups && chown -R nova:nova /var/lib/nova
USER nova
EXPOSE 3001
# Les migrations sont jouées au démarrage : un déploiement laisse
# toujours le schéma et le code en phase.
CMD ["sh", "-c", "node dist/database/run-migrations.js && node dist/main.js"]
