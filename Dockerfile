# syntax=docker/dockerfile:1

FROM node:24.22.1-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53 AS build

WORKDIR /app

RUN npm install --global npm@12.2.1

COPY package.json package-lock.json .npmrc ./
RUN npm ci --include=dev --include=optional

COPY . .
RUN npm run build

FROM nginx:1.30.6-alpine@sha256:47928bf67eb62a1863cb08d9ecb52d3e704304ba614eaee17884204677702951 AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/health | grep -q '"status":"ok"' || exit 1

CMD ["nginx", "-g", "daemon off;"]
