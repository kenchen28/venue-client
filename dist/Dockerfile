# Build stage
FROM docker-env-local.artifacts.tabdigital.com.au/tabdigital-node-18:latest AS build
WORKDIR /app
ENV npm_config_LOGLEVEL=error

COPY . /app/
RUN npm config fix && \
    rm -rf node_modules package-lock.json && \
    npm install && \
    npm run build && \
    npm cache clean --force && \
    rm -f .npmrc

# Production stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]