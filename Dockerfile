FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

RUN mkdir -p uploads db

EXPOSE 5000

CMD ["sh", "-c", "node db/seed.js && node server.js"]
