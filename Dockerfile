FROM node:20.12.0-alpine3.19

ARG DATABASE_URL

ENV DATABASE_URL=${DATABASE_URL}

WORKDIR /app

COPY package.json tsconfig.json ./

RUN npm install --legacy-peer-deps

COPY app ./app

RUN npm run build

CMD ["npm", "start"]

