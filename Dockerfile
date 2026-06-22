FROM apify/actor-node:20

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm --quiet set progress=false \
    && npm install --omit=dev --omit=optional

COPY . ./
CMD npm start --silent
