FROM node:20-alpine

WORKDIR /app

RUN npm install express

COPY index.js .

ENV GATEWAY_PORT=4000
ENV LOG_FILE=/tmp/egress-log.json

EXPOSE 4000

CMD ["node", "index.js"]