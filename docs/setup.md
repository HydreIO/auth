# Setup

- clone the repo
```
git clone git@github.com:HydreIO/hydre.auth.git
```
- Rename `./serverless.exemple.yml` in `./serverless.yml` (the file become untracked thus you can always pull changes from git while keeping your configuration)
- configure `./serverless.yml`, you'll see some *CHANGE ME: * fields, read the entire file
	> to accept a wildcard cors origin you need to create a custom ressource and disable serverless cors, create an issue if u need more explanation

	> to accept multiple origin replace `origin` by `origins` and input an array
- you can also disable the serverless warmup plugin which is used to keep lambda containers warm