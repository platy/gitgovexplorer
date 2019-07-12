FROM node:10.16-alpine AS build
WORKDIR /build

# install dependencies
COPY package.json package-lock.json ./
RUN npm install

# build
COPY . .
RUN npm test
RUN npm run build

# pack deployment container
FROM nginx:1.17

EXPOSE 80
COPY --from=build /build/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/nginx.template

CMD ["/bin/bash", "-c", "envsubst < /etc/nginx/conf.d/nginx.template > /etc/nginx/conf.d/default.conf && exec nginx -g 'daemon off;'"]
