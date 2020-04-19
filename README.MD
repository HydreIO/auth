<h1 align=center>@hydre/auth</h1>
<p align=center>
  <img src="https://img.shields.io/github/license/HydreIO/auth.svg?style=for-the-badge" />
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
- Support multiple databases
- ZeroMQ for cluster communication
- Highly configurable
- Kubernetes ready

Use your favorite database, we currently support

- Mongodb
- Dgraph
- Neo4j (bolt)
- Memgraph (bolt)
- RedisGraph (can't be used yet as Redisgraph cypher support is not mature enough)

> if you need any help feel free to join the discord above to get a fast reply!

## Quickstart

Assuming you run a mongodb instance to `localhost:27017` and you configured your host file to allow `dev.local`
```sh
docker run -t \
  -p 3000:3000 \
  -e DEBUG="auth* internal*" \
  -e PORT=3000 \
  -e LOCALHOST=true \
  --network host \
  hydre/auth:edge-mongo
```

you can now execute graphql queries against `http://dev.local:3000`

> Don't use this in production as it's configured with default secrets

---

<a href="https://docs.auth.hydre.io/"><h2 align=center>Documentation</h3></a>