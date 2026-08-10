FROM node:22-alpine AS builder

WORKDIR /build

ARG VITE_API_BASE=/api
ARG VITE_KEYCLOAK_URL=http://localhost:8180/realms/elouav
ARG VITE_REDIRECT_URI=http://localhost:3000/callback

ENV VITE_API_BASE=$VITE_API_BASE
ENV VITE_KEYCLOAK_URL=$VITE_KEYCLOAK_URL
ENV VITE_REDIRECT_URI=$VITE_REDIRECT_URI

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /build/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
