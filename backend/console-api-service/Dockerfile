FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --omit=dev

COPY config ./config
COPY console-api ./console-api
COPY lib ./lib
COPY middleware ./middleware
COPY repositories ./repositories
COPY shared ./shared
COPY utils ./utils

ENV NODE_ENV=production
ENV PORT=8000

EXPOSE 8000

CMD ["npm", "run", "console:start"]
