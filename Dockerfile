FROM node:22-slim

WORKDIR /app
COPY package.json ./
# No package-lock.json in the repo (AI Studio exports bun.lock), so npm ci is not possible
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["npm", "start"]
