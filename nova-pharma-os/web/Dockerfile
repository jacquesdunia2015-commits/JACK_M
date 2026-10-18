FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json next.config.ts ./
COPY src ./src
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S nova && adduser -S nova -G nova
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/package.json ./
COPY --from=build /app/next.config.ts ./
USER nova
EXPOSE 3000
CMD ["npm", "run", "start"]
