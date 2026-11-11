FROM node:22-bookworm
WORKDIR /app
COPY . /app
RUN npm install --ignore-scripts && git init && git add . ':!node_modules' && git -c user.name=Fixture -c user.email=fixture@example.invalid commit -m baseline
