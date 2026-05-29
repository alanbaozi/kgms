FROM node:20-alpine AS builder

WORKDIR /app

ARG VITE_KGMS_API_BASE_URL=/
ARG NPM_REGISTRY=https://registry.npmmirror.com
ENV VITE_KGMS_API_BASE_URL=${VITE_KGMS_API_BASE_URL}
ENV npm_config_registry=${NPM_REGISTRY}

COPY kgms-frontend/package*.json ./
RUN npm ci

COPY kgms-frontend ./
RUN npm run build

FROM nginx:1.27-alpine

COPY kgms-frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
