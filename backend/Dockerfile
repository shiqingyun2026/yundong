FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --omit=dev

COPY lib ./lib
COPY middleware ./middleware
COPY miniprogram-container ./miniprogram-container
COPY routes ./routes
COPY shared ./shared
COPY utils ./utils

ENV NODE_ENV=production
ENV PORT=8000

EXPOSE 8000

CMD ["npm", "run", "miniprogram-container:start"]
