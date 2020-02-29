<h1 align=center>@hydre/auth</h1>
<p align=center>
  <img src="https://img.shields.io/github/license/HydreIO/doubt.svg?style=for-the-badge" />
  <a href="https://hub.docker.com/r/hydre/auth">
    <img src="https://img.shields.io/docker/cloud/build/hydre/auth?label=build&logo=docker&style=for-the-badge" />
  </a>
  <a>
    <img src="https://img.shields.io/docker/pulls/hydre/auth?label=pulls&logo=docker&style=for-the-badge">
  </a>
  <a href="https://discord.gg/bRSpRpD">
    <img src="https://img.shields.io/discord/398114799776694272.svg?logo=discord&style=for-the-badge" />
  </a>
</p>

<h3 align=center>A simple and fast authentication server built on KoaJS</h3>

- Graphql API
- Production ready (Almost)
- Support multiple databases
- Highly configurable

Use your favorite database, we currently support

- Mongodb
- Neo4j
- Memgraph
- RedisGraph (can't be used yet as Redisgraph cypher support is not mature enough)

> if you need any help feel free to join the discord above to get a fast reply!

## Quickstart

Assuming you run a mongodb instance to `localhost:27017` and you configured your host file to allow `127.0.0.1 dev.local`
```sh
docker run \
  -p 3000:3000 \
  -e DEBUG="auth* internal*" \
  -e PORT=3000 \
  -e LOCALHOST=true \
  hydre/auth:mongo-edge
```

you can now execute graphql queries against `http://dev.local:3000`

> Don't use this in production as it's configured with default secrets

<a href="https://docs.auth.hydre.io/" target="_blank">
  <h2 align=center>Documentation</h3>
</a>