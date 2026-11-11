FROM node:22-bookworm
WORKDIR /app
COPY . /app
RUN node check.mjs > reports/check.log && git init && git add . && git -c user.name=Fixture -c user.email=fixture@example.invalid commit -m baseline
